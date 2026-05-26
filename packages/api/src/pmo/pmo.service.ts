import { Injectable, NotFoundException } from "@nestjs/common";
import {
  compareBaselineVariance,
  simulateTaskDelay,
  buildScheduleSCurve,
  buildProjectForecast,
} from "@nexus/shared";
import { getProjectFinancials } from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";

@Injectable()
export class PmoService {
  constructor(private readonly db: DataStoreService) {}

  baselineVariance(projectId: string, baselineId: string) {
    const baselines = this.db.getBaselines(projectId);
    const baseline = baselines.find((b) => b.id === baselineId);
    if (!baseline) throw new NotFoundException(`Baseline ${baselineId} not found`);
    return compareBaselineVariance(baseline, this.db.getTasks(projectId));
  }

  whatIf(projectId: string, taskId: string, delayDays: number) {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    const tasks = this.db.getTasks(projectId);
    const deps = this.db.getDependencies(projectId);
    return simulateTaskDelay(
      tasks,
      deps,
      project.startDate,
      taskId,
      Math.max(0, Math.min(365, Math.round(delayDays))),
    );
  }

  scheduleCurve(projectId: string, asOfDate?: string) {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    const asOf = asOfDate ?? new Date().toISOString().slice(0, 10);
    return buildScheduleSCurve(this.db.getTasks(projectId), asOf);
  }

  forecast(projectId: string) {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    const tasks = this.db.getTasks(projectId);
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
    return buildProjectForecast(
      project,
      tasks,
      this.db.getDependencies(projectId),
      financials.evm,
    );
  }
}
