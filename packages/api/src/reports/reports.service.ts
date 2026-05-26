import { Injectable, NotFoundException } from "@nestjs/common";
import { getProjectFinancials } from "@nexus/shared";
import type { ProjectStatusReport, ResourceLoadReport, CashFlowReport } from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";
import { detectOverAllocations } from "@nexus/shared";

@Injectable()
export class ReportsService {
  constructor(private readonly db: DataStoreService) {}

  projectStatus(projectId: string): ProjectStatusReport {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const tasks = this.db.getTasks(projectId);
    const today = new Date().toISOString().slice(0, 10);
    const leaf = tasks.filter((t) => !t.isSummary);
    const avg =
      leaf.length > 0 ? leaf.reduce((s, t) => s + t.percentComplete, 0) / leaf.length : 0;
    const critical = tasks.filter((t) => t.isCritical);
    const late = leaf.filter((t) => t.endDate < today && t.percentComplete < 100);

    const financials = getProjectFinancials({
      projectId,
      currency: project.currency,
      budgetCap: project.budgetCap,
      tasks,
      lines: this.db.getBudgetLines(projectId),
      assignments: this.db.getAssignments(projectId),
      resources: this.db.getResources(project.organizationId),
      timesheets: this.db.getTimesheets(projectId),
      members: this.db.getProjectMembers(projectId),
      hoursPerDay: project.hoursPerDay ?? 8,
    });
    const plannedBudget = financials.totalPlanned;
    const evm = financials.evm;

    let health: ProjectStatusReport["health"] = "on_track";
    if (evm.cpi < 0.9 || evm.spi < 0.9 || late.length > 0) health = "at_risk";
    if (evm.cpi < 0.8 || evm.spi < 0.8 || late.length > 2) health = "critical";

    const topRisks = [
      ...late.slice(0, 3).map((t) => ({
        taskName: t.name,
        reason: `Late finish (${t.endDate}), ${t.percentComplete}% complete`,
      })),
      ...critical
        .filter((t) => !late.includes(t))
        .slice(0, 2)
        .map((t) => ({ taskName: t.name, reason: "On critical path" })),
    ];

    return {
      projectId,
      projectName: project.name,
      generatedAt: new Date().toISOString(),
      health,
      percentComplete: Math.round(avg),
      criticalTaskCount: critical.length,
      lateTaskCount: late.length,
      evm,
      plannedBudget,
      actualCost: evm.ac,
      forecastEAC: evm.eac,
      topRisks,
    };
  }

  resourceLoad(projectId: string): ResourceLoadReport {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const resources = this.db.getResources(project.organizationId);
    const assignments = this.db.getAssignments(projectId);
    const tasks = this.db.getTasks(projectId);

    const dates: string[] = [];
    for (let d = new Date("2026-05-01"); d <= new Date("2026-07-31"); d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }
    const slots = detectOverAllocations(assignments, tasks, resources, dates);

    const byResource = new Map<
      string,
      { name: string; peak: number; overDays: number; hours: number }
    >();
    for (const res of resources) {
      byResource.set(res.id, { name: res.name, peak: 0, overDays: 0, hours: 0 });
    }
    for (const slot of slots) {
      const r = byResource.get(slot.resourceId);
      if (!r) continue;
      r.peak = Math.max(r.peak, slot.utilizationPct);
      r.hours += slot.allocatedHours;
      if (slot.isOverAllocated) r.overDays += 1;
    }

    return {
      projectId,
      generatedAt: new Date().toISOString(),
      resources: [...byResource.values()].map((r) => ({
        name: r.name,
        peakUtilizationPct: r.peak,
        overAllocationDays: r.overDays,
        totalAssignedHours: Math.round(r.hours),
      })),
    };
  }

  cashFlow(projectId: string): CashFlowReport {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const financials = getProjectFinancials({
      projectId,
      currency: project.currency,
      budgetCap: project.budgetCap,
      tasks: this.db.getTasks(projectId),
      lines: this.db.getBudgetLines(projectId),
      assignments: this.db.getAssignments(projectId),
      resources: this.db.getResources(project.organizationId),
      timesheets: this.db.getTimesheets(projectId),
      members: this.db.getProjectMembers(projectId),
      hoursPerDay: project.hoursPerDay ?? 8,
    });

    return {
      projectId,
      generatedAt: financials.generatedAt,
      points: financials.cashFlow.map(({ month, planned, actual }) => ({
        month,
        planned,
        actual,
      })),
    };
  }
}
