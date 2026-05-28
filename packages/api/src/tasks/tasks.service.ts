import { BadRequestException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { v4 as uuid } from "uuid";
import {
  calculateCPM,
  tasksAlreadyLinked,
  addDays,
  daysBetween,
  isRangeWithinParent,
  isWorkDaysWithinParent,
  progressFromChildren,
  parentStatusFromProgress,
  dateSpanFromChildren,
  remainingWorkDaysFromProgress,
  addDaysIso,
  syncTaskCostTotals,
} from "@nexus/shared";
import type { Task, TaskDependency } from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { runAutomationRules } from "../automation/automation.runner";
import { WebhookDispatcherService } from "../integrations/webhook-dispatcher.service";

@Injectable()
export class TasksService {
  constructor(
    private readonly db: DataStoreService,
    @Optional() private readonly realtime?: RealtimeGateway,
    @Optional() private readonly webhooks?: WebhookDispatcherService,
  ) {}

  private emit(projectId: string, event: string, payload: unknown): void {
    this.realtime?.broadcast(projectId, event, payload);
  }

  findByProject(projectId: string): { tasks: Task[]; dependencies: TaskDependency[] } {
    if (!this.db.getProject(projectId)) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    return {
      tasks: this.db.getTasks(projectId),
      dependencies: this.db.getDependencies(projectId),
    };
  }

  async recalculate(projectId: string) {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const tasks = this.db.getTasks(projectId);
    const deps = this.db.getDependencies(projectId);
    const result = calculateCPM(tasks, deps, project.startDate);
    await this.db.setTasks(projectId, result.tasks);

    this.emit(projectId, "schedule:updated", {
      tasks: result.tasks,
      criticalPathIds: result.criticalPathIds,
      projectEnd: result.projectEnd,
    });

    return result;
  }

  async updateTask(projectId: string, taskId: string, patch: Partial<Task>): Promise<Task> {
    const tasks = this.db.getTasks(projectId);
    const current = tasks.find((t) => t.id === taskId);
    if (!current) throw new NotFoundException(`Task ${taskId} not found`);

    const parent = current.parentId
      ? tasks.find((t) => t.id === current.parentId)
      : undefined;

    let nextStart = patch.startDate ?? current.startDate;
    let nextEnd = patch.endDate ?? current.endDate;
    let nextDuration = patch.durationDays ?? current.durationDays;

    if (patch.durationDays !== undefined) {
      nextDuration = Math.max(1, Math.round(patch.durationDays));
      if (parent) {
        this.assertSubtaskWorkDays(nextDuration, parent.durationDays);
      }
      const children = tasks.filter((t) => t.parentId === current.id);
      for (const child of children) {
        if (child.durationDays > nextDuration) {
          throw new BadRequestException(
            "Parent work days cannot be less than a subtask's work days",
          );
        }
      }
      nextEnd = addDays(nextStart, nextDuration - 1);
      if (parent) {
        this.assertSubtaskWithinParent(projectId, current.parentId!, nextStart, nextEnd);
      }
    } else if (patch.startDate || patch.endDate) {
      this.assertDatesValid(nextStart, nextEnd);
      if (parent) {
        this.assertSubtaskWithinParent(projectId, current.parentId!, nextStart, nextEnd);
      }
      nextDuration = daysBetween(nextStart, nextEnd) + 1;
      if (parent) {
        this.assertSubtaskWorkDays(nextDuration, parent.durationDays);
      }
    }

    if (patch.startDate || patch.endDate || patch.durationDays !== undefined) {
      this.assertDatesValid(nextStart, nextEnd);
    }

    let merged: Partial<Task> = {
      ...patch,
      startDate: nextStart,
      endDate: nextEnd,
      durationDays: nextDuration,
    };
    const hasCostField =
      patch.plannedLaborCost !== undefined ||
      patch.plannedMaterialCost !== undefined ||
      patch.plannedOtherCost !== undefined ||
      patch.actualLaborCost !== undefined ||
      patch.actualMaterialCost !== undefined ||
      patch.actualOtherCost !== undefined;
    if (hasCostField) {
      merged = syncTaskCostTotals({ ...current, ...merged } as Task);
    }
    if (patch.assigneeIds !== undefined) {
      merged.assigneeIds = patch.assigneeIds;
    }
    if (patch.percentComplete !== undefined && patch.status === undefined) {
      merged.status = parentStatusFromProgress(patch.percentComplete);
    }

    const updated = await this.db.updateTask(projectId, taskId, merged);
    if (!updated) throw new NotFoundException(`Task ${taskId} not found`);

    this.db.logActivity({
      projectId,
      action: "update",
      entityType: "task",
      entityId: taskId,
      summary: `Updated «${updated.name}»`,
    });
    runAutomationRules(this.db, projectId, updated, current, merged);
    void this.webhooks?.dispatch(projectId, "task.updated", {
      taskId: updated.id,
      name: updated.name,
    });

    await this.rollupParentIfNeeded(projectId, taskId, updated.parentId);
    this.emit(projectId, "task:updated", updated);
    return updated;
  }

  async createTask(
    projectId: string,
    dto: Partial<Task> & {
      subtasks?: Array<{
        name: string;
        startDate: string;
        endDate: string;
        durationDays?: number;
        assigneeId?: string;
        kind?: "T" | "M";
      }>;
    },
  ): Promise<Task | { parent: Task; children: Task[] }> {
    const subtasks = (dto.subtasks ?? []).filter((s) => s.name.trim());
    if (subtasks.length > 0) {
      return this.createTaskWithSubtasks(projectId, dto, subtasks);
    }
    if (dto.recurrenceRule) {
      const base = this.buildTaskBase(projectId, dto);
      const created = await this.db.generateRecurringTasks(projectId, base, dto.recurrenceRule);
      for (const t of created) this.emit(projectId, "task:created", t);
      return created[0]!;
    }
    const task = await this.persistTask(projectId, {
      ...dto,
      isSummary: true,
      percentComplete: 0,
      status: "not_started",
    });
    this.emit(projectId, "task:created", task);
    void this.webhooks?.dispatch(projectId, "task.created", { taskId: task.id, name: task.name });
    return task;
  }

  private async createTaskWithSubtasks(
    projectId: string,
    dto: Partial<Task>,
    subtasks: Array<{
      name: string;
      startDate: string;
      endDate: string;
      durationDays?: number;
      assigneeId?: string;
      kind?: "T" | "M";
    }>,
  ) {
    const start = dto.startDate ?? new Date().toISOString().slice(0, 10);
    const end = dto.endDate ?? addDays(start, (dto.durationDays ?? 1) - 1);
    const parentWorkDays = dto.durationDays ?? daysBetween(start, end) + 1;
    this.assertDatesValid(start, end);

    for (const st of subtasks) {
      const isMilestone = st.kind === "M";
      const stStart = isMilestone ? end : st.startDate;
      const stEnd = isMilestone ? end : st.endDate;
      if (!isRangeWithinParent(stStart, stEnd, start, end)) {
        throw new BadRequestException(
          "Subtask dates must fall within the parent task start and end dates",
        );
      }
      const stDays = isMilestone ? 0 : (st.durationDays ?? daysBetween(stStart, stEnd) + 1);
      if (!isWorkDaysWithinParent(stDays, parentWorkDays, isMilestone)) {
        throw new BadRequestException(
          "Subtask work days cannot exceed the parent task work days",
        );
      }
    }

    const parent = await this.persistTask(projectId, {
      ...dto,
      startDate: start,
      endDate: end,
      durationDays: parentWorkDays,
      isSummary: true,
      percentComplete: 0,
      status: "not_started",
    });

    const children: Task[] = [];
    for (let i = 0; i < subtasks.length; i++) {
      const st = subtasks[i];
      const isMilestone = st.kind === "M";
      const stStart = isMilestone ? end : st.startDate;
      const stEnd = isMilestone ? end : st.endDate;
      const workDays = isMilestone
        ? 0
        : (st.durationDays ?? daysBetween(stStart, stEnd) + 1);
      const child = await this.persistTask(projectId, {
        name: st.name.trim(),
        parentId: parent.id,
        wbs: `${parent.wbs}.${i + 1}`,
        startDate: stStart,
        endDate: isMilestone ? end : addDays(stStart, workDays - 1),
        durationDays: workDays,
        assigneeIds: st.assigneeId ? [st.assigneeId] : [],
        isSummary: false,
        isMilestone,
        status: "not_started",
        percentComplete: 0,
      });
      children.push(child);
      this.emit(projectId, "task:created", child);
    }

    await this.rollupParent(projectId, parent.id);
    const refreshed = this.db.getTasks(projectId).find((t) => t.id === parent.id)!;
    this.emit(projectId, "task:updated", refreshed);
    return { parent: refreshed, children };
  }

  buildTaskBase(projectId: string, dto: Partial<Task>): Omit<Task, "id"> {
    const tasks = this.db.getTasks(projectId);
    const maxOrder = tasks.reduce((m, t) => Math.max(m, t.sortOrder), -1);
    const start = dto.startDate ?? new Date().toISOString().slice(0, 10);
    const durationDays = dto.durationDays ?? 1;
    const end = dto.endDate ?? addDays(start, durationDays - 1);
    const siblings = dto.parentId
      ? tasks.filter((t) => t.parentId === dto.parentId).length
      : tasks.filter((t) => !t.parentId).length;
    return {
      projectId,
      parentId: dto.parentId ?? null,
      wbs:
        dto.wbs ??
        (dto.parentId
          ? `${tasks.find((t) => t.id === dto.parentId)?.wbs}.${siblings + 1}`
          : String(siblings + 1)),
      name: dto.name ?? "New Task",
      status: dto.status ?? "not_started",
      startDate: start,
      durationDays,
      endDate: end,
      percentComplete: dto.percentComplete ?? 0,
      isMilestone: dto.isMilestone ?? false,
      isSummary: dto.isSummary ?? false,
      manuallyScheduled: dto.manuallyScheduled ?? false,
      constraint: dto.constraint ?? "ASAP",
      isCritical: false,
      assigneeIds: dto.assigneeIds ?? [],
      sortOrder: maxOrder + 1,
      isPriority: dto.isPriority ?? false,
      plannedCost: dto.plannedCost ?? 0,
      actualCost: 0,
      tags: dto.tags ?? [],
      description: dto.description,
      descriptionHtml: dto.descriptionHtml,
      issueType: dto.issueType ?? "task",
      storyPoints: dto.storyPoints,
      sprintId: dto.sprintId,
      cycleId: dto.cycleId,
      customFields: dto.customFields ?? {},
    };
  }

  async moveTask(sourceProjectId: string, taskId: string, targetProjectId: string) {
    const moved = await this.db.moveTaskToProject(sourceProjectId, taskId, targetProjectId);
    if (!moved) throw new NotFoundException("Task or target project not found");
    this.emit(targetProjectId, "task:created", moved);
    return moved;
  }

  private async persistTask(projectId: string, dto: Partial<Task>): Promise<Task> {
    const tasks = this.db.getTasks(projectId);
    const maxOrder = tasks.reduce((m, t) => Math.max(m, t.sortOrder), -1);
    const start = dto.startDate ?? new Date().toISOString().slice(0, 10);
    let durationDays = dto.durationDays ?? 1;
    let end = dto.endDate ?? addDays(start, durationDays - 1);

    if (dto.parentId) {
      const parent = tasks.find((t) => t.id === dto.parentId);
      if (!parent) throw new NotFoundException(`Parent task ${dto.parentId} not found`);
      this.assertSubtaskWorkDays(durationDays, parent.durationDays);
      this.assertSubtaskWithinParent(projectId, dto.parentId, start, end);
      const maxEnd = parent.endDate;
      if (end > maxEnd) {
        end = maxEnd;
        durationDays = Math.min(daysBetween(start, end) + 1, parent.durationDays);
        this.assertSubtaskWorkDays(durationDays, parent.durationDays);
      }
    } else {
      if (!dto.endDate && dto.durationDays) {
        end = addDays(start, durationDays - 1);
      } else if (!dto.durationDays && dto.endDate) {
        durationDays = daysBetween(start, end) + 1;
      }
    }

    this.assertDatesValid(start, end);

    const siblings = dto.parentId
      ? tasks.filter((t) => t.parentId === dto.parentId).length
      : tasks.filter((t) => !t.parentId).length;

    const task: Task = {
      id: uuid(),
      projectId,
      parentId: dto.parentId ?? null,
      wbs: dto.wbs ?? (dto.parentId ? `${tasks.find((t) => t.id === dto.parentId)?.wbs}.${siblings + 1}` : String(siblings + 1)),
      name: dto.name ?? "New Task",
      status: dto.status ?? "not_started",
      startDate: start,
      durationDays,
      endDate: end,
      percentComplete: dto.percentComplete ?? 0,
      isMilestone: dto.isMilestone ?? false,
      isSummary: dto.isSummary ?? false,
      manuallyScheduled: dto.manuallyScheduled ?? false,
      constraint: dto.constraint ?? "ASAP",
      isCritical: false,
      assigneeIds: dto.assigneeIds ?? [],
      sortOrder: maxOrder + 1,
      isPriority: dto.isPriority ?? false,
      plannedCost: dto.plannedCost ?? 0,
      actualCost: 0,
      tags: dto.tags ?? [],
      description: dto.description,
      descriptionHtml: dto.descriptionHtml,
      issueType: dto.issueType ?? "task",
      storyPoints: dto.storyPoints,
      sprintId: dto.sprintId,
      cycleId: dto.cycleId,
      customFields: dto.customFields ?? {},
    };
    await this.db.createTask(projectId, task);
    return task;
  }

  private assertDatesValid(start: string, end: string) {
    if (start > end) {
      throw new BadRequestException("Start date must be on or before end date");
    }
  }

  private assertSubtaskWithinParent(
    projectId: string,
    parentId: string,
    start: string,
    end: string,
  ) {
    const parent = this.db.getTasks(projectId).find((t) => t.id === parentId);
    if (!parent) throw new NotFoundException(`Parent task ${parentId} not found`);
    if (!isRangeWithinParent(start, end, parent.startDate, parent.endDate)) {
      throw new BadRequestException(
        "Subtask dates must fall within the parent task start and end dates",
      );
    }
  }

  private assertSubtaskWorkDays(
    childDays: number,
    parentDays: number,
    isMilestone = false,
  ) {
    if (!isWorkDaysWithinParent(childDays, parentDays, isMilestone)) {
      throw new BadRequestException(
        "Subtask work days cannot exceed the parent task work days",
      );
    }
  }

  private async rollupParentIfNeeded(
    projectId: string,
    taskId: string,
    parentId: string | null,
  ) {
    if (parentId) {
      await this.rollupParent(projectId, parentId);
      return;
    }
    const tasks = this.db.getTasks(projectId);
    if (tasks.some((t) => t.parentId === taskId)) {
      await this.rollupParent(projectId, taskId);
    }
  }

  private async rollupParent(projectId: string, parentId: string) {
    const tasks = this.db.getTasks(projectId);
    const children = tasks.filter((t) => t.parentId === parentId);
    if (children.length === 0) return;

    const percent = progressFromChildren(children);
    const { start, end } = dateSpanFromChildren(children);
    const existing = tasks.find((t) => t.id === parentId);
    const parent = await this.db.updateTask(projectId, parentId, {
      percentComplete: percent,
      status: parentStatusFromProgress(percent),
      startDate: start,
      endDate: end,
      durationDays: existing?.durationDays ?? daysBetween(start, end) + 1,
      isSummary: true,
    });
    if (parent) this.emit(projectId, "task:updated", parent);
  }

  async addDependency(
    projectId: string,
    dto: Omit<TaskDependency, "id" | "projectId">,
  ): Promise<TaskDependency> {
    if (dto.predecessorId === dto.successorId) {
      throw new BadRequestException("Cannot link a task to itself");
    }
    const existing = this.db.getDependencies(projectId);
    if (tasksAlreadyLinked(dto.predecessorId, dto.successorId, existing)) {
      throw new BadRequestException("Only one link is allowed between two tasks");
    }
    const dep: TaskDependency = { id: uuid(), projectId, ...dto };
    const created = await this.db.addDependency(dep);
    this.emit(projectId, "dependency:added", created);
    return created;
  }

  async removeDependency(projectId: string, depId: string) {
    const ok = await this.db.removeDependency(projectId, depId);
    if (!ok) throw new NotFoundException(`Dependency ${depId} not found`);
    this.emit(projectId, "dependency:removed", { id: depId });
    return { removed: true };
  }

  listBaselines(projectId: string) {
    return this.db.getBaselines(projectId);
  }

  async saveBaseline(projectId: string, name: string) {
    const tasks = this.db.getTasks(projectId);
    const baselines = this.db.getBaselines(projectId);
    const baseline = {
      id: uuid(),
      projectId,
      index: baselines.length,
      name,
      savedAt: new Date().toISOString(),
      tasks: tasks.map((t) => ({
        taskId: t.id,
        startDate: t.startDate,
        endDate: t.endDate,
        cost: t.plannedCost ?? 0,
      })),
    };
    const saved = await this.db.saveBaseline(baseline);
    for (const t of tasks) {
      if (t.isSummary) continue;
      await this.db.updateTask(projectId, t.id, {
        baselineStart: t.startDate,
        baselineFinish: t.endDate,
      });
    }
    return saved;
  }

  async pauseTask(
    projectId: string,
    taskId: string,
    body: { resumeDate: string; remainingWorkDays?: number; transferToTaskId?: string },
  ): Promise<Task> {
    const tasks = this.db.getTasks(projectId);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);
    if (task.isSummary || task.isMilestone) {
      throw new BadRequestException("Only regular tasks can be paused");
    }
    if (task.status === "on_hold") {
      throw new BadRequestException("Task is already paused");
    }
    const today = new Date().toISOString().slice(0, 10);
    if (!body.resumeDate || body.resumeDate <= today) {
      throw new BadRequestException("Resume date must be after today");
    }

    const remaining =
      body.remainingWorkDays ?? remainingWorkDaysFromProgress(task);
    if (remaining < 1) {
      throw new BadRequestException("Remaining work days must be at least 1");
    }

    const pausedSegmentEnd =
      today < task.startDate
        ? task.startDate
        : today > task.endDate
          ? task.endDate
          : today;
    const pausedAssigneeId = task.assigneeIds[0];

    if (body.transferToTaskId) {
      const target = tasks.find((t) => t.id === body.transferToTaskId);
      if (!target || target.isSummary || target.isMilestone) {
        throw new BadRequestException("Invalid task to transfer team to");
      }
      const merged = [...new Set([...target.assigneeIds, ...task.assigneeIds])];
      const transferred = await this.db.updateTask(projectId, body.transferToTaskId, {
        assigneeIds: merged,
        manuallyScheduled: true,
      });
      if (transferred) {
        this.emit(projectId, "task:updated", transferred);
      }
    }

    const segmentDays = daysBetween(task.startDate, pausedSegmentEnd) + 1;
    const updated = await this.db.updateTask(projectId, taskId, {
      status: "on_hold",
      pausedAt: today,
      pausedSegmentEnd,
      resumeDate: body.resumeDate,
      remainingWorkDays: remaining,
      pausedAssigneeId,
      endDate: pausedSegmentEnd,
      durationDays: Math.max(1, segmentDays),
      assigneeIds: [],
      manuallyScheduled: true,
    });
    if (!updated) throw new NotFoundException(`Task ${taskId} not found`);

    await this.rollupParentIfNeeded(projectId, taskId, updated.parentId);
    this.emit(projectId, "task:updated", updated);
    return updated;
  }

  async resumeTask(projectId: string, taskId: string): Promise<Task> {
    const tasks = this.db.getTasks(projectId);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);
    if (task.status !== "on_hold" || !task.resumeDate || !task.remainingWorkDays) {
      throw new BadRequestException("Task is not paused or missing resume data");
    }

    const newStart = task.resumeDate;
    const newEnd = addDaysIso(newStart, task.remainingWorkDays - 1);
    const updated = await this.db.updateTask(projectId, taskId, {
      status: task.percentComplete >= 100 ? "completed" : "in_progress",
      startDate: newStart,
      endDate: newEnd,
      durationDays: task.remainingWorkDays,
      assigneeIds: task.pausedAssigneeId ? [task.pausedAssigneeId] : [],
      manuallyScheduled: true,
      pausedAt: undefined,
      pausedSegmentEnd: undefined,
      resumeDate: undefined,
      remainingWorkDays: undefined,
      pausedAssigneeId: undefined,
    });
    if (!updated) throw new NotFoundException(`Task ${taskId} not found`);

    await this.rollupParentIfNeeded(projectId, taskId, updated.parentId);
    this.emit(projectId, "task:updated", updated);
    return updated;
  }

  async deleteTask(projectId: string, taskId: string) {
    const tasks = this.db.getTasks(projectId);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);

    const result = await this.db.deleteTask(projectId, taskId);
    if (!result) throw new NotFoundException(`Task ${taskId} not found`);

    void this.webhooks?.dispatch(projectId, "task.deleted", { taskId, name: task.name });
    await this.recalculate(projectId);
    return { deletedIds: result.deletedIds };
  }

  async generateDemoTasks(projectId: string, count: number) {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const existing = this.db.getTasks(projectId);
    const baseOrder = existing.reduce((m, t) => Math.max(m, t.sortOrder), 0);
    const newTasks: Task[] = [];
    let start = project.startDate;

    for (let i = 0; i < count; i++) {
      const duration = 1 + (i % 5);
      const end = addDays(start, duration - 1);
      newTasks.push({
        id: uuid(),
        projectId,
        parentId: null,
        wbs: `${100 + i}`,
        name: `Auto Task ${i + 1}`,
        status: "not_started",
        startDate: start,
        endDate: end,
        durationDays: duration,
        percentComplete: 0,
        isMilestone: false,
        isSummary: false,
        manuallyScheduled: false,
        constraint: "ASAP",
        isCritical: false,
        assigneeIds: [],
        sortOrder: baseOrder + i + 1,
        isPriority: false,
        plannedCost: 1000 + i * 10,
        actualCost: 0,
      });
      start = addDays(end, 1);
    }

    return this.db.bulkCreateTasks(projectId, newTasks);
  }
}
