import { Injectable, NotFoundException } from "@nestjs/common";
import {
  compareBaselineVariance,
  computeProjectHealth,
  detectOverAllocations,
  forecastProjectDelay,
  getProjectFinancials,
  riskScore,
  suggestRisksFromProject,
  type ProjectRisk,
  type RiskCategory,
  type RiskLevel,
  type RiskSource,
  type RiskSuggestion,
} from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";

@Injectable()
export class RisksService {
  constructor(private readonly db: DataStoreService) {}

  list(projectId: string) {
    return this.db.getRisks(projectId);
  }

  suggest(projectId: string): RiskSuggestion[] {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const tasks = this.db.getTasks(projectId);
    const assignments = this.db.getAssignments(projectId);
    const today = new Date().toISOString().slice(0, 10);
    const leaf = tasks.filter((t) => !t.isSummary);
    const late = leaf.filter((t) => t.endDate < today && t.percentComplete < 100);
    const criticalLate = late.filter((t) => t.isCritical);

    const financials = getProjectFinancials({
      projectId,
      currency: project.currency,
      budgetCap: project.budgetCap,
      tasks,
      lines: this.db.getBudgetLines(projectId),
      assignments,
      resources: this.db.getResources(project.organizationId),
      timesheets: this.db.getTimesheets(projectId),
      members: this.db.getProjectMembers(projectId),
      hoursPerDay: project.hoursPerDay ?? 8,
    });

    const dates: string[] = [];
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const end = new Date();
    end.setDate(end.getDate() + 28);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }

    const orgResources = this.db.getResources(project.organizationId);
    const slots = detectOverAllocations(assignments, tasks, orgResources, dates);
    const hasOverload = slots.some((s) => s.isOverAllocated);

    const byResourceUtil = new Map<string, number>();
    for (const s of slots.filter((x) => x.isOverAllocated)) {
      byResourceUtil.set(
        s.resourceId,
        Math.max(byResourceUtil.get(s.resourceId) ?? 0, s.utilizationPct),
      );
    }
    const overloadedResources = [...byResourceUtil.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([resourceId, maxUtilizationPct]) => ({
        resourceId,
        resourceName: orgResources.find((r) => r.id === resourceId)?.name ?? resourceId,
        maxUtilizationPct,
      }));

    const assignmentTaskIds = new Set(assignments.map((a) => a.taskId));
    const hasAssignee = (t: (typeof tasks)[0]) =>
      t.assigneeIds.length > 0 || assignmentTaskIds.has(t.id);
    const unassignedCriticalCount = leaf.filter(
      (t) => t.isCritical && t.percentComplete < 100 && !hasAssignee(t),
    ).length;

    const deps = this.db.getDependencies(projectId);
    const forecastDelayDays = forecastProjectDelay(
      tasks,
      deps,
      project.startDate,
      project.endDate,
      financials.evm,
    );

    const projectHealth = computeProjectHealth({
      tasks,
      evm: financials.evm,
      projectEnd: project.endDate,
      budgetCap: project.budgetCap,
    });

    let baselineLateFinishCount: number | undefined;
    let baselineAvgEndVarianceDays: number | undefined;
    const baselines = this.db.getBaselines(projectId);
    if (baselines.length > 0) {
      const latest = [...baselines].sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0];
      const report = compareBaselineVariance(latest, tasks);
      baselineLateFinishCount = report.summary.lateFinishCount;
      baselineAvgEndVarianceDays = report.summary.avgEndVarianceDays;
    }

    const pendingChangeCount = this.db
      .getChangeRequests(projectId)
      .filter((c) => c.status === "submitted").length;

    const existing = this.db.getRisks(projectId);
    const existingKeys = this.collectExistingKeys(existing);

    return suggestRisksFromProject({
      tasks,
      evm: financials.evm,
      lateTaskCount: late.length,
      criticalLateCount: criticalLate.length,
      hasResourceOverload: hasOverload,
      overloadedResources,
      forecastDelayDays,
      baselineLateFinishCount,
      baselineAvgEndVarianceDays,
      projectHealth,
      pendingChangeCount,
      unassignedCriticalCount,
      existingKeys,
    });
  }

  create(
    projectId: string,
    body: {
      title: string;
      description?: string;
      category: RiskCategory;
      probability: RiskLevel;
      impact: RiskLevel;
      source?: RiskSource;
      ownerResourceId?: string;
      responsePlan?: string;
      taskId?: string;
      dedupeKey?: string;
    },
  ) {
    this.assertProject(projectId);
    const score = riskScore(body.probability, body.impact);
    return this.db.createRisk(projectId, {
      title: body.title,
      description: body.description,
      category: body.category,
      probability: body.probability,
      impact: body.impact,
      riskScore: score,
      status: "open",
      source: body.source ?? "manual",
      ownerResourceId: body.ownerResourceId,
      responsePlan: body.responsePlan,
      taskId: body.taskId,
      dedupeKey: body.dedupeKey,
    });
  }

  createFromSuggestion(projectId: string, suggestion: RiskSuggestion) {
    let ownerResourceId: string | undefined;
    if (
      suggestion.key.startsWith("resource:") &&
      suggestion.key !== "resource:overload" &&
      suggestion.key !== "resource:unassigned-critical"
    ) {
      ownerResourceId = suggestion.key.slice("resource:".length);
    }
    return this.create(projectId, {
      title: suggestion.title,
      description: suggestion.description,
      category: suggestion.category,
      probability: suggestion.probability,
      impact: suggestion.impact,
      source: suggestion.source,
      responsePlan: suggestion.responsePlan,
      taskId: suggestion.taskId,
      dedupeKey: suggestion.key,
      ownerResourceId,
    });
  }

  update(projectId: string, riskId: string, patch: Partial<ProjectRisk>) {
    const list = this.db.getRisks(projectId);
    const current = list.find((r) => r.id === riskId);
    if (!current) return null;

    const prob = patch.probability ?? current.probability;
    const imp = patch.impact ?? current.impact;
    const next: Partial<ProjectRisk> = {
      ...patch,
      riskScore: riskScore(prob, imp),
    };
    return this.db.updateRisk(projectId, riskId, next);
  }

  async remove(projectId: string, riskId: string) {
    const ok = await this.db.deleteRisk(projectId, riskId);
    if (!ok) throw new NotFoundException(`Risk ${riskId} not found`);
    return { ok: true };
  }

  private collectExistingKeys(risks: ProjectRisk[]): string[] {
    const keys: string[] = [];
    for (const r of risks) {
      if (r.dedupeKey) {
        keys.push(r.dedupeKey);
        continue;
      }
      if (r.taskId) keys.push(`late:${r.taskId}`);
      if (r.source === "auto_evm") {
        if (r.title.includes("SPI")) keys.push("evm:spi");
        if (r.title.includes("CPI")) keys.push("evm:cpi");
        if (r.title.includes("SV")) keys.push("evm:sv");
        if (r.title.includes("VAC")) keys.push("evm:vac");
        if (r.title.includes("תקציב מאושר") || r.title.includes("approved budget"))
          keys.push("evm:budget-cap");
      }
      if (r.source === "auto_resource") {
        if (r.title.includes("ללא מוקצים") || r.title.includes("Unassigned"))
          keys.push("resource:unassigned-critical");
        else if (r.ownerResourceId) keys.push(`resource:${r.ownerResourceId}`);
        else if (r.title.startsWith("עומס יתר:")) {
          const m = r.title.match(/^עומס יתר:\s*(.+)$/);
          if (m) keys.push(`resource:legacy:${m[1]}`);
        } else keys.push("resource:overload");
      }
      if (r.source === "auto_baseline") keys.push("baseline:drift");
      if (r.source === "auto_scope") keys.push("scope:pending-cr");
      if (r.title.includes("פיגור מערכתי")) keys.push("late:aggregate");
      if (r.title.includes("נתיב קריטי") || r.title.includes("critical path"))
        keys.push("schedule:critical-path");
      if (r.title.includes("תחזית עיכוב") || r.title.includes("forecast delay"))
        keys.push("schedule:forecast");
      if (r.title.includes("דדליין קרוב") || r.title.includes("Due soon")) keys.push(`due:legacy:${r.id}`);
      if (r.title.includes("בריאות פרויקט")) keys.push(`health:legacy:${r.id}`);
    }
    return keys;
  }

  private assertProject(projectId: string) {
    if (!this.db.getProject(projectId)) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
  }
}
