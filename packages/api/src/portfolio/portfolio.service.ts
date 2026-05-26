import { Injectable } from "@nestjs/common";
import type {
  BudgetCategory,
  OrgDashboardRollup,
  PortfolioOverview,
  PortfolioProjectSummary,
  PortfolioSimulateResult,
  ResourceConflict,
} from "@nexus/shared";
import {
  detectOverAllocations,
  getProjectFinancials,
  computeProjectHealth,
  forecastProjectDelay,
  scheduleVarianceDays,
  calculateCPM,
  budgetVarianceAtCompletion,
} from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";

const BUDGET_CATEGORIES: BudgetCategory[] = [
  "labor",
  "material",
  "equipment",
  "subcontractor",
  "other",
];

@Injectable()
export class PortfolioService {
  constructor(private readonly db: DataStoreService) {}

  getOverview(): PortfolioOverview {
    return this.buildOverview();
  }

  getExecutive() {
    const overview = this.buildOverview();
    const counts = { on_track: 0, at_risk: 0, critical: 0 };
    for (const p of overview.projects) {
      counts[p.health]++;
    }
    return {
      ...overview,
      generatedAt: new Date().toISOString(),
      counts,
      rollup: this.buildOrgRollup(overview.projects, overview.resourceConflicts),
    };
  }

  private buildOverview(): PortfolioOverview {
    const projects = this.db.getProjects();
    const orgId = projects[0]?.organizationId ?? this.db.mem.organizationId;

    const summaries: PortfolioProjectSummary[] = projects.map((p) => {
      const tasks = this.db.getTasks(p.id);
      const deps = this.db.getDependencies(p.id);
      const leaf = tasks.filter((t) => !t.isSummary);
      const avg =
        leaf.length > 0
          ? leaf.reduce((s, t) => s + t.percentComplete, 0) / leaf.length
          : 0;
      const lines = this.db.getBudgetLines(p.id);
      const financials = getProjectFinancials({
        projectId: p.id,
        currency: p.currency,
        budgetCap: p.budgetCap,
        tasks,
        lines,
        assignments: this.db.getAssignments(p.id),
        resources: this.db.getResources(p.organizationId),
        timesheets: this.db.getTimesheets(p.id),
        members: this.db.getProjectMembers(p.id),
        hoursPerDay: p.hoursPerDay ?? 8,
      });
      const evm = financials.evm;
      const health = computeProjectHealth({ tasks, evm, projectEnd: p.endDate, budgetCap: p.budgetCap });
      const cpm = calculateCPM(tasks, deps, p.startDate);
      const today = new Date().toISOString().slice(0, 10);
      const lateTaskCount = leaf.filter(
        (t) => t.endDate < today && t.percentComplete < 100,
      ).length;
      const forecastDelayDays = forecastProjectDelay(
        tasks,
        deps,
        p.startDate,
        p.endDate,
        evm,
      );

      let percentBudgetUsed: number | null = null;
      if (p.budgetCap != null && p.budgetCap > 0) {
        percentBudgetUsed = Math.min(
          100,
          Math.round((financials.totalActual / p.budgetCap) * 100),
        );
      }

      return {
        ...p,
        taskCount: tasks.length,
        percentComplete: Math.round(avg),
        plannedBudget: financials.totalPlanned,
        actualCost: financials.totalActual,
        criticalCount: tasks.filter((t) => t.isCritical).length,
        health,
        scheduleVarianceDays: scheduleVarianceDays(p.endDate, cpm.projectEnd),
        budgetVariance: budgetVarianceAtCompletion(p.budgetCap, financials.totalPlanned),
        forecastDelayDays,
        cpi: Math.round(evm.cpi * 100) / 100,
        spi: Math.round(evm.spi * 100) / 100,
        lateTaskCount,
        pv: evm.pv,
        ev: evm.ev,
        eac: evm.eac,
        vac: evm.vac,
        percentBudgetUsed,
      };
    });

    return {
      organizationId: orgId,
      organizationName: this.db.getOrganizationName(),
      projects: summaries,
      resourceConflicts: this.detectCrossProjectConflicts(orgId, projects.map((p) => p.id)),
    };
  }

  private buildOrgRollup(
    projects: PortfolioProjectSummary[],
    conflicts: ResourceConflict[],
  ): OrgDashboardRollup {
    let totalPv = 0;
    let totalEv = 0;
    let totalAc = 0;
    let totalEac = 0;
    let totalVac = 0;
    let totalCv = 0;
    let totalSv = 0;
    let totalBudgetCap = 0;
    let percentUsedSum = 0;
    let percentUsedCount = 0;
    let totalCriticalTasks = 0;
    let onTimeProjects = 0;
    let delayedProjects = 0;

    const projectsByStatus: OrgDashboardRollup["projectsByStatus"] = {
      planning: 0,
      active: 0,
      on_hold: 0,
      completed: 0,
    };

    const categorySums = new Map<BudgetCategory, { planned: number; actual: number }>();
    for (const c of BUDGET_CATEGORIES) {
      categorySums.set(c, { planned: 0, actual: 0 });
    }

    for (const p of projects) {
      totalPv += p.pv;
      totalEv += p.ev;
      totalAc += p.actualCost;
      totalEac += p.eac;
      totalVac += p.vac;
      totalCv += p.ev - p.actualCost;
      totalSv += p.ev - p.pv;
      totalCriticalTasks += p.criticalCount;
      projectsByStatus[p.status]++;
      if (p.forecastDelayDays > 0) delayedProjects++;
      else onTimeProjects++;

      if (p.budgetCap != null && p.budgetCap > 0) {
        totalBudgetCap += p.budgetCap;
        if (p.percentBudgetUsed != null) {
          percentUsedSum += p.percentBudgetUsed;
          percentUsedCount++;
        }
      }

      const lines = this.db.getBudgetLines(p.id);
      for (const line of lines) {
        const bucket = categorySums.get(line.category) ?? { planned: 0, actual: 0 };
        bucket.planned += line.plannedAmount ?? 0;
        bucket.actual += line.actualAmount ?? 0;
        categorySums.set(line.category, bucket);
      }
    }

    let openRisks = 0;
    let highRisks = 0;
    for (const p of projects) {
      for (const r of this.db.getRisks(p.id)) {
        if (r.status !== "open") continue;
        openRisks++;
        if (r.riskScore >= 9) highRisks++;
      }
    }

    let pendingChangeRequests = 0;
    let pendingChangeImpactDays = 0;
    let pendingChangeImpactCost = 0;
    for (const p of projects) {
      for (const cr of this.db.getChangeRequests(p.id)) {
        if (cr.status !== "submitted") continue;
        pendingChangeRequests++;
        pendingChangeImpactDays += cr.impactScheduleDays;
        pendingChangeImpactCost += cr.impactCost;
      }
    }

    let pendingTimesheets = 0;
    let pendingTimesheetHours = 0;
    for (const p of projects) {
      for (const ts of this.db.getTimesheets(p.id)) {
        if (ts.status !== "submitted") continue;
        pendingTimesheets++;
        pendingTimesheetHours += ts.hours;
      }
    }

    return {
      totalPv,
      totalEv,
      totalAc,
      totalEac,
      totalVac,
      totalCv,
      totalSv,
      totalBudgetCap,
      avgPercentBudgetUsed:
        percentUsedCount > 0 ? Math.round(percentUsedSum / percentUsedCount) : null,
      openRisks,
      highRisks,
      pendingChangeRequests,
      pendingChangeImpactDays,
      pendingChangeImpactCost,
      pendingTimesheets,
      pendingTimesheetHours,
      totalCriticalTasks,
      onTimeProjects,
      delayedProjects,
      resourceConflictCount: conflicts.length,
      projectsByStatus,
      budgetByCategory: BUDGET_CATEGORIES.map((category) => {
        const v = categorySums.get(category)!;
        return { category, planned: v.planned, actual: v.actual };
      }).filter((x) => x.planned > 0 || x.actual > 0),
    };
  }

  simulateLoad(body: { extraHoursPerWeek?: number; resourceId?: string }): PortfolioSimulateResult {
    const overview = this.buildOverview();
    const extra = body.extraHoursPerWeek ?? 16;
    const baseConflicts = overview.resourceConflicts.length;
    const simulated = baseConflicts + Math.ceil(extra / 8);
    const peak = Math.min(150, 85 + extra / 2);
    return {
      addedConflicts: simulated - baseConflicts,
      peakUtilizationPct: Math.round(peak),
      message:
        simulated > baseConflicts
          ? `Adding ~${extra}h/week would increase cross-project conflicts by ${simulated - baseConflicts}.`
          : "Current load can absorb the simulated hours.",
    };
  }

  private detectCrossProjectConflicts(orgId: string, projectIds: string[]): ResourceConflict[] {
    const resources = this.db.getResources(orgId);
    const resourceMap = new Map(resources.map((r) => [r.id, r.name]));
    const byKey = new Map<string, { hours: number; projects: Set<string> }>();

    const dates: string[] = [];
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const end = new Date();
    end.setDate(end.getDate() + 60);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }

    for (const projectId of projectIds) {
      const project = this.db.getProject(projectId);
      const slots = detectOverAllocations(
        this.db.getAssignments(projectId),
        this.db.getTasks(projectId),
        resources,
        dates,
      );
      for (const slot of slots.filter((s) => s.isOverAllocated)) {
        const key = `${slot.resourceId}:${slot.date}`;
        const entry = byKey.get(key) ?? { hours: 0, projects: new Set<string>() };
        entry.hours = Math.max(entry.hours, slot.allocatedHours);
        entry.projects.add(project?.name ?? projectId);
        byKey.set(key, entry);
      }
    }

    const conflicts: ResourceConflict[] = [];
    for (const [key, val] of byKey) {
      if (val.projects.size < 2) continue;
      const [resourceId, date] = key.split(":");
      conflicts.push({
        resourceId,
        resourceName: resourceMap.get(resourceId) ?? resourceId,
        date,
        allocatedHours: val.hours,
        projectNames: [...val.projects],
      });
    }
    return conflicts;
  }
}
