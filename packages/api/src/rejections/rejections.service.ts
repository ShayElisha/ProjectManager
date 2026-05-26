import { Injectable, NotFoundException } from "@nestjs/common";
import {
  forecastProjectDelay,
  getProjectFinancials,
  manualEntryToRecord,
  suggestRejectionsFromProject,
  type ManualRejectionCategory,
  type RejectionRecord,
  type RejectionSuggestion,
} from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";

@Injectable()
export class RejectionsService {
  constructor(private readonly db: DataStoreService) {}

  list(projectId?: string): RejectionRecord[] {
    const projects = this.db
      .getProjects()
      .filter((p) => !projectId || p.id === projectId);
    const records: RejectionRecord[] = [];

    for (const project of projects) {
      const tasks = this.db.getTasks(project.id);
      const taskById = new Map(tasks.map((t) => [t.id, t]));

      for (const entry of this.db.getRejectionLogs(project.id)) {
        records.push(
          manualEntryToRecord(
            entry,
            project.name,
            entry.taskId ? taskById.get(entry.taskId)?.name : undefined,
          ),
        );
      }

      for (const cr of this.db.getChangeRequests(project.id)) {
        if (cr.status !== "rejected") continue;
        records.push({
          id: `cr:${cr.id}`,
          kind: "change_request",
          projectId: project.id,
          projectName: project.name,
          title: cr.title,
          detail: cr.description,
          rejectedAt: cr.decidedAt ?? cr.updatedAt,
          decisionNote: cr.decisionNote,
          impactScheduleDays: cr.impactScheduleDays,
          impactCost: cr.impactCost,
        });
      }

      for (const ts of this.db.getTimesheets(project.id)) {
        if (ts.status !== "rejected") continue;
        const task = taskById.get(ts.taskId);
        records.push({
          id: `ts:${ts.id}`,
          kind: "timesheet",
          projectId: project.id,
          projectName: project.name,
          title: task?.name ?? ts.taskId,
          detail: ts.notes,
          rejectedAt: ts.date,
          decisionNote: ts.notes,
          hours: ts.hours,
          date: ts.date,
          taskId: ts.taskId,
          taskName: task?.name,
        });
      }
    }

    return records.sort((a, b) => b.rejectedAt.localeCompare(a.rejectedAt));
  }

  suggest(projectId: string): RejectionSuggestion[] {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const tasks = this.db.getTasks(projectId);
    const today = new Date().toISOString().slice(0, 10);
    const leaf = tasks.filter((t) => !t.isSummary);
    const late = leaf.filter((t) => t.endDate < today && t.percentComplete < 100);
    const criticalLate = late.filter((t) => t.isCritical);
    const onHoldCount = leaf.filter((t) => t.status === "on_hold").length;

    const assignments = this.db.getAssignments(projectId);
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

    const forecastDelayDays = forecastProjectDelay(
      tasks,
      this.db.getDependencies(projectId),
      project.startDate,
      project.endDate,
      financials.evm,
    );

    const pendingChangeCount = this.db
      .getChangeRequests(projectId)
      .filter((c) => c.status === "submitted").length;
    const pendingTimesheetCount = this.db
      .getTimesheets(projectId)
      .filter((t) => t.status === "submitted").length;

    const existingKeys = this.list(projectId).map((r) => r.id);

    return suggestRejectionsFromProject({
      projectId,
      projectName: project.name,
      tasks,
      existingKeys,
      lateTaskCount: late.length,
      criticalLateCount: criticalLate.length,
      onHoldCount,
      pendingTimesheetCount,
      pendingChangeCount,
      forecastDelayDays,
    });
  }

  async createManual(body: {
    projectId: string;
    title: string;
    description?: string;
    category: ManualRejectionCategory;
    rejectedAt: string;
    decisionNote?: string;
    impactScheduleDays?: number;
    impactCost?: number;
    taskId?: string;
  }): Promise<RejectionRecord> {
    const project = this.db.getProject(body.projectId);
    if (!project) throw new NotFoundException(`Project ${body.projectId} not found`);

    const entry = await this.db.createRejectionLog(body.projectId, {
      title: body.title.trim(),
      description: body.description?.trim() || undefined,
      category: body.category,
      rejectedAt: body.rejectedAt,
      decisionNote: body.decisionNote?.trim() || undefined,
      impactScheduleDays: body.impactScheduleDays,
      impactCost: body.impactCost,
      taskId: body.taskId || undefined,
    });

    const tasks = this.db.getTasks(body.projectId);
    const taskName = entry.taskId
      ? tasks.find((t) => t.id === entry.taskId)?.name
      : undefined;
    return manualEntryToRecord(entry, project.name, taskName);
  }

  async deleteManual(rawId: string): Promise<boolean> {
    const logId = rawId.startsWith("manual:") ? rawId.slice(7) : rawId;
    for (const project of this.db.getProjects()) {
      const logs = this.db.getRejectionLogs(project.id);
      if (!logs.some((l) => l.id === logId)) continue;
      const ok = await this.db.deleteRejectionLog(project.id, logId);
      if (!ok) throw new NotFoundException(`Rejection log ${logId} not found`);
      return true;
    }
    throw new NotFoundException(`Rejection log ${logId} not found`);
  }
}
