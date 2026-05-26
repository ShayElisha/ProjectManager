import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { v4 as uuid } from "uuid";
import type {
  Project,
  Task,
  TaskDependency,
  Resource,
  ResourceAssignment,
  Baseline,
  TimesheetEntry,
  Notification,
  ProjectMember,
  BudgetLineItem,
  ProjectRisk,
  ChangeRequest,
  ManualRejectionEntry,
  ManualRejectionCategory,
} from "@nexus/shared";
import { riskScore as calcRiskScore } from "@nexus/shared";
import { PrismaService } from "./prisma.service";
import { InMemoryBackend } from "./in-memory.backend";
import { buildSeedData } from "./seed-data";

function prismaProjectData(p: Project) {
  return {
    id: p.id,
    organizationId: p.organizationId,
    name: p.name,
    description: p.description ?? null,
    locale: p.locale,
    currency: p.currency,
    startDate: p.startDate,
    endDate: p.endDate ?? null,
    status: p.status,
    budgetCap: p.budgetCap ?? null,
    createdAt: new Date(p.createdAt),
    updatedAt: new Date(p.updatedAt),
  };
}

function mapTask(t: {
  id: string;
  projectId: string;
  parentId: string | null;
  wbs: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  percentComplete: number;
  isMilestone: boolean;
  isSummary: boolean;
  manuallyScheduled: boolean;
  constraint: string;
  constraintDate: string | null;
  isCritical: boolean;
  earlyStart: string | null;
  earlyFinish: string | null;
  lateStart: string | null;
  lateFinish: string | null;
  totalFloat: number | null;
  freeFloat: number | null;
  baselineStart: string | null;
  baselineFinish: string | null;
  plannedCost: number | null;
  actualCost: number | null;
  plannedLaborCost?: number | null;
  actualLaborCost?: number | null;
  plannedMaterialCost?: number | null;
  actualMaterialCost?: number | null;
  plannedOtherCost?: number | null;
  actualOtherCost?: number | null;
  assigneeIds: unknown;
  sortOrder: number;
  isPriority?: boolean;
  pausedAt?: string | null;
  pausedSegmentEnd?: string | null;
  resumeDate?: string | null;
  remainingWorkDays?: number | null;
  pausedAssigneeId?: string | null;
  taskNotes?: unknown;
}): Task {
  return {
    ...t,
    taskNotes: (t.taskNotes as string[] | undefined) ?? undefined,
    parentId: t.parentId,
    isPriority: t.isPriority ?? false,
    pausedAt: t.pausedAt ?? undefined,
    pausedSegmentEnd: t.pausedSegmentEnd ?? undefined,
    resumeDate: t.resumeDate ?? undefined,
    remainingWorkDays: t.remainingWorkDays ?? undefined,
    pausedAssigneeId: t.pausedAssigneeId ?? undefined,
    assigneeIds: (t.assigneeIds as string[]) ?? [],
    constraint: t.constraint as Task["constraint"],
    status: t.status as Task["status"],
    constraintDate: t.constraintDate ?? undefined,
    earlyStart: t.earlyStart ?? undefined,
    earlyFinish: t.earlyFinish ?? undefined,
    lateStart: t.lateStart ?? undefined,
    lateFinish: t.lateFinish ?? undefined,
    totalFloat: t.totalFloat ?? undefined,
    freeFloat: t.freeFloat ?? undefined,
    baselineStart: t.baselineStart ?? undefined,
    baselineFinish: t.baselineFinish ?? undefined,
    plannedCost: t.plannedCost ?? undefined,
    actualCost: t.actualCost ?? undefined,
    plannedLaborCost: t.plannedLaborCost ?? undefined,
    actualLaborCost: t.actualLaborCost ?? undefined,
    plannedMaterialCost: t.plannedMaterialCost ?? undefined,
    actualMaterialCost: t.actualMaterialCost ?? undefined,
    plannedOtherCost: t.plannedOtherCost ?? undefined,
    actualOtherCost: t.actualOtherCost ?? undefined,
  };
}

/** Prisma/MongoDB task payload — only schema fields, no `id` on update. */
function taskToPrismaCreate(task: Task) {
  return {
    id: task.id,
    projectId: task.projectId,
    parentId: task.parentId,
    wbs: task.wbs,
    name: task.name,
    status: task.status,
    startDate: task.startDate,
    endDate: task.endDate,
    durationDays: task.durationDays,
    percentComplete: task.percentComplete,
    isMilestone: task.isMilestone,
    isSummary: task.isSummary,
    manuallyScheduled: task.manuallyScheduled,
    constraint: task.constraint,
    constraintDate: task.constraintDate ?? null,
    isCritical: task.isCritical,
    earlyStart: task.earlyStart ?? null,
    earlyFinish: task.earlyFinish ?? null,
    lateStart: task.lateStart ?? null,
    lateFinish: task.lateFinish ?? null,
    totalFloat: task.totalFloat ?? null,
    freeFloat: task.freeFloat ?? null,
    baselineStart: task.baselineStart ?? null,
    baselineFinish: task.baselineFinish ?? null,
    plannedCost: task.plannedCost ?? null,
    actualCost: task.actualCost ?? null,
    plannedLaborCost: task.plannedLaborCost ?? null,
    actualLaborCost: task.actualLaborCost ?? null,
    plannedMaterialCost: task.plannedMaterialCost ?? null,
    actualMaterialCost: task.actualMaterialCost ?? null,
    plannedOtherCost: task.plannedOtherCost ?? null,
    actualOtherCost: task.actualOtherCost ?? null,
    assigneeIds: task.assigneeIds,
    sortOrder: task.sortOrder,
    isPriority: task.isPriority,
    pausedAt: task.pausedAt ?? null,
    pausedSegmentEnd: task.pausedSegmentEnd ?? null,
    resumeDate: task.resumeDate ?? null,
    remainingWorkDays: task.remainingWorkDays ?? null,
    pausedAssigneeId: task.pausedAssigneeId ?? null,
    taskNotes: task.taskNotes ?? [],
  };
}

function taskToPrismaUpdate(task: Task) {
  const { id: _id, projectId: _pid, ...rest } = taskToPrismaCreate(task);
  return rest;
}

function mapPrismaRisk(r: {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  category?: string | null;
  probability: string;
  impact: string;
  riskScore?: number | null;
  status: string;
  source?: string | null;
  ownerResourceId: string | null;
  responsePlan: string | null;
  taskId?: string | null;
  dedupeKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ProjectRisk {
  const probability = r.probability as ProjectRisk["probability"];
  const impact = r.impact as ProjectRisk["impact"];
  return {
    id: r.id,
    projectId: r.projectId,
    title: r.title,
    description: r.description ?? undefined,
    category: (r.category ?? "schedule") as ProjectRisk["category"],
    probability,
    impact,
    riskScore: r.riskScore ?? calcRiskScore(probability, impact),
    status: r.status as ProjectRisk["status"],
    source: (r.source ?? "manual") as ProjectRisk["source"],
    ownerResourceId: r.ownerResourceId ?? undefined,
    responsePlan: r.responsePlan ?? undefined,
    taskId: r.taskId ?? undefined,
    dedupeKey: r.dedupeKey ?? undefined,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

@Injectable()
export class DataStoreService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DataStoreService.name);
  readonly mem = new InMemoryBackend();

  constructor(private readonly prisma: PrismaService) {}

  get useDb(): boolean {
    return this.prisma.enabled;
  }

  async onApplicationBootstrap() {
    if (!this.useDb) {
      this.mem.seed();
      this.logger.log("DataStore: in-memory mode (set DATABASE_URL to persist data)");
      return;
    }

    try {
      const count = await this.prisma.project.count();
      if (count === 0) {
        await this.seedDatabase();
        this.logger.log("DataStore: empty organization ready (no demo projects)");
      }
      await this.hydrateFromDatabase();
      this.logger.log("DataStore: database connected, cache hydrated");
    } catch (err) {
      this.logger.warn(
        `DataStore: DB init failed (${err instanceof Error ? err.message : err}) — in-memory fallback`,
      );
      this.mem.seed();
    }
  }

  private async seedDatabase() {
    const data = buildSeedData();
    await this.prisma.organization.create({
      data: {
        id: data.organizationId,
        name: data.organizationName,
        defaultLocale: "he",
        defaultCurrency: "ILS",
      },
    });

    for (const resource of data.resources) {
      await this.prisma.resource.create({ data: resource });
    }

    for (const project of data.projects) {
      await this.prisma.project.create({ data: prismaProjectData(project) });
      const tasks = data.tasks.get(project.id) ?? [];
      if (tasks.length) {
        await this.prisma.task.createMany({ data: tasks.map(taskToPrismaCreate) });
      }
      const deps = data.dependencies.get(project.id) ?? [];
      if (deps.length) {
        await this.prisma.taskDependency.createMany({ data: deps });
      }
      const assigns = data.assignments.get(project.id) ?? [];
      for (const a of assigns) {
        await this.prisma.resourceAssignment.create({
          data: { ...a, projectId: project.id },
        });
      }
    }
  }

  private async hydrateFromDatabase() {
    const org = await this.prisma.organization.findFirst();
    if (!org) return;

    const data = buildSeedData();
    data.organizationId = org.id;
    data.organizationName = org.name;
    data.projects = [];
    data.tasks = new Map();
    data.dependencies = new Map();
    const rawResources = await this.prisma.resource.findMany({ where: { organizationId: org.id } });
    data.resources = rawResources.map((r) => ({
      ...r,
      type: r.type as Resource["type"],
      email: r.email ?? undefined,
      costPerHour: r.costPerHour ?? undefined,
      costPerUnit: r.costPerUnit ?? undefined,
      calendarId: r.calendarId ?? undefined,
    }));
    data.assignments = new Map();

    const projects = await this.prisma.project.findMany();
    for (const p of projects) {
      data.projects.push({
        id: p.id,
        organizationId: p.organizationId,
        name: p.name,
        description: p.description ?? undefined,
        locale: p.locale as Project["locale"],
        currency: p.currency as Project["currency"],
        startDate: p.startDate,
        endDate: p.endDate ?? undefined,
        status: p.status as Project["status"],
        budgetCap: p.budgetCap ?? undefined,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      });
      const lines = await this.prisma.budgetLineItem.findMany({ where: { projectId: p.id } });
      this.mem.budgetLines.set(
        p.id,
        lines.map((l) => ({
          id: l.id,
          projectId: l.projectId,
          category: l.category as BudgetLineItem["category"],
          name: l.name,
          description: l.description ?? undefined,
          plannedAmount: l.plannedAmount,
          committedAmount: l.committedAmount ?? undefined,
          actualAmount: l.actualAmount,
          cashMonth: l.cashMonth,
          taskId: l.taskId ?? undefined,
          source: (l.source as BudgetLineItem["source"]) ?? undefined,
          sourceRef: l.sourceRef ?? undefined,
        })),
      );
      const tasks = await this.prisma.task.findMany({
        where: { projectId: p.id },
        orderBy: { sortOrder: "asc" },
      });
      data.tasks.set(p.id, tasks.map(mapTask));
      const deps = await this.prisma.taskDependency.findMany({ where: { projectId: p.id } });
      data.dependencies.set(
        p.id,
        deps.map((d) => ({ ...d, type: d.type as TaskDependency["type"] })),
      );
      data.assignments.set(
        p.id,
        await this.prisma.resourceAssignment.findMany({ where: { projectId: p.id } }),
      );
      const baselines = await this.prisma.baseline.findMany({ where: { projectId: p.id } });
      this.mem.baselines.set(
        p.id,
        baselines.map((b) => ({
          id: b.id,
          projectId: b.projectId,
          index: b.index,
          name: b.name,
          savedAt: b.savedAt.toISOString(),
          tasks: b.tasks as Baseline["tasks"],
        })),
      );
      const members = await this.prisma.projectMember.findMany({ where: { projectId: p.id } });
      this.mem.projectMembers.set(
        p.id,
        members.map((m) => ({
          id: m.id,
          projectId: m.projectId,
          resourceId: m.resourceId,
          role: m.role,
          hoursPerDay: m.hoursPerDay ?? undefined,
        })),
      );
      try {
        const risks = await this.prisma.projectRisk.findMany({ where: { projectId: p.id } });
        this.mem.risks.set(
          p.id,
          risks.map((r) => mapPrismaRisk(r)),
        );
      } catch {
        if (!this.mem.risks.has(p.id)) this.mem.risks.set(p.id, []);
      }
      try {
        const changes = await this.prisma.changeRequest.findMany({ where: { projectId: p.id } });
        this.mem.changeRequests.set(
          p.id,
          changes.map((c) => ({
            id: c.id,
            projectId: c.projectId,
            title: c.title,
            description: c.description ?? undefined,
            impactScheduleDays: c.impactScheduleDays,
            impactCost: c.impactCost,
            status: c.status as ChangeRequest["status"],
            requestedBy: c.requestedBy ?? undefined,
            decidedAt: c.decidedAt?.toISOString(),
            decisionNote: c.decisionNote ?? undefined,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
          })),
        );
      } catch {
        if (!this.mem.changeRequests.has(p.id)) this.mem.changeRequests.set(p.id, []);
      }
      try {
        const logs = await this.prisma.rejectionLog.findMany({ where: { projectId: p.id } });
        this.mem.rejectionLogs.set(
          p.id,
          logs.map((l) => ({
            id: l.id,
            projectId: l.projectId,
            title: l.title,
            description: l.description ?? undefined,
            category: l.category as ManualRejectionCategory,
            rejectedAt: l.rejectedAt,
            decisionNote: l.decisionNote ?? undefined,
            impactScheduleDays: l.impactScheduleDays ?? undefined,
            impactCost: l.impactCost ?? undefined,
            taskId: l.taskId ?? undefined,
            createdAt: l.createdAt.toISOString(),
            updatedAt: l.updatedAt.toISOString(),
          })),
        );
      } catch {
        if (!this.mem.rejectionLogs.has(p.id)) this.mem.rejectionLogs.set(p.id, []);
      }
    }

    this.mem.loadFromSeedData(data);
    const sheets = await this.prisma.timesheetEntry.findMany();
    this.mem.timesheets = sheets.map((e) => ({
      id: e.id,
      projectId: e.projectId,
      userId: e.userId,
      taskId: e.taskId,
      date: e.date,
      hours: e.hours,
      status: e.status as TimesheetEntry["status"],
      notes: e.notes ?? undefined,
    }));
    const notifs = await this.prisma.notification.findMany();
    this.mem.notifications = notifs.map((n) => ({
      id: n.id,
      userId: n.userId,
      type: n.type as Notification["type"],
      title: n.title,
      body: n.body,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
      metadata: (n.metadata as Record<string, string>) ?? undefined,
    }));
  }

  private async persistTask(task: Task) {
    if (!this.useDb) return;
    await this.prisma.task.upsert({
      where: { id: task.id },
      create: taskToPrismaCreate(task),
      update: taskToPrismaUpdate(task),
    });
  }

  /** Serializes DB writes per project to avoid delete/create races (e.g. CPM + budget recalc in parallel). */
  private taskPersistChains = new Map<string, Promise<void>>();

  private async persistTasks(projectId: string, tasks: Task[]) {
    if (!this.useDb) return;
    const incomingIds = new Set(tasks.map((t) => t.id));
    const existing = await this.prisma.task.findMany({
      where: { projectId },
      select: { id: true },
    });
    const orphanIds = existing.map((e) => e.id).filter((id) => !incomingIds.has(id));
    if (orphanIds.length) {
      await this.prisma.task.deleteMany({ where: { id: { in: orphanIds } } });
    }
    for (const task of tasks) {
      await this.persistTask(task);
    }
  }

  // --- Read API (sync, from cache) ---

  getOrganizationName() {
    return this.mem.organizationName;
  }

  getProjects(): Project[] {
    return Array.from(this.mem.projects.values());
  }

  getProject(id: string) {
    return this.mem.projects.get(id);
  }

  getTasks(projectId: string) {
    return this.mem.tasks.get(projectId) ?? [];
  }

  getDependencies(projectId: string) {
    return this.mem.dependencies.get(projectId) ?? [];
  }

  getResources(orgId: string) {
    return this.mem.resources.get(orgId) ?? [];
  }

  getAssignments(projectId: string) {
    return this.mem.assignments.get(projectId) ?? [];
  }

  getProjectMembers(projectId: string) {
    return this.mem.projectMembers.get(projectId) ?? [];
  }

  getBaselines(projectId: string) {
    return this.mem.baselines.get(projectId) ?? [];
  }

  getTimesheets(projectId: string) {
    const taskIds = new Set((this.mem.tasks.get(projectId) ?? []).map((t) => t.id));
    return this.mem.timesheets.filter((e) => taskIds.has(e.taskId));
  }

  getNotifications() {
    return this.mem.notifications;
  }

  getBudgetLines(projectId: string): BudgetLineItem[] {
    return this.mem.budgetLines.get(projectId) ?? [];
  }

  getBudgetLine(projectId: string, lineId: string): BudgetLineItem | undefined {
    return this.getBudgetLines(projectId).find((l) => l.id === lineId);
  }

  // --- Write API ---

  /** Guarantees organization exists in memory and DB (e.g. after db:clear while API still running). */
  private async ensureOrganization(): Promise<string> {
    if (this.mem.organizationId) {
      if (!this.useDb) return this.mem.organizationId;
      const exists = await this.prisma.organization.findUnique({
        where: { id: this.mem.organizationId },
      });
      if (exists) return this.mem.organizationId;
    }

    if (this.useDb) {
      const org = await this.prisma.organization.findFirst();
      if (org) {
        this.mem.organizationId = org.id;
        this.mem.organizationName = org.name;
        return org.id;
      }
    }

    const data = buildSeedData();
    this.mem.organizationId = data.organizationId;
    this.mem.organizationName = data.organizationName;
    if (this.useDb) {
      await this.prisma.organization.create({
        data: {
          id: data.organizationId,
          name: data.organizationName,
          defaultLocale: "he",
          defaultCurrency: "ILS",
        },
      });
    }
    return data.organizationId;
  }

  async createProject(dto: Partial<Project>): Promise<Project> {
    const orgId = await this.ensureOrganization();
    const now = new Date().toISOString();
    const project: Project = {
      id: uuid(),
      organizationId: dto.organizationId ?? orgId,
      name: dto.name ?? "New Project",
      description: dto.description,
      locale: dto.locale ?? "he",
      currency: dto.currency ?? "ILS",
      startDate: dto.startDate ?? now.slice(0, 10),
      endDate: dto.endDate,
      status: dto.status ?? "planning",
      budgetCap: dto.budgetCap,
      hoursPerDay: dto.hoursPerDay ?? 8,
      workDays: dto.workDays ?? [0, 1, 2, 3, 4],
      defaultLinkType: dto.defaultLinkType ?? "FS",
      createdAt: now,
      updatedAt: now,
    };
    this.mem.projects.set(project.id, project);
    this.mem.tasks.set(project.id, []);
    this.mem.dependencies.set(project.id, []);
    this.mem.assignments.set(project.id, []);
    this.mem.baselines.set(project.id, []);
    this.mem.projectMembers.set(project.id, []);
    this.mem.budgetLines.set(project.id, []);
    this.mem.risks.set(project.id, []);
    this.mem.changeRequests.set(project.id, []);
    this.mem.rejectionLogs.set(project.id, []);

    if (this.useDb) {
      await this.prisma.project.create({ data: prismaProjectData(project) });
    }
    return project;
  }

  async setTasks(projectId: string, tasks: Task[]) {
    this.mem.tasks.set(projectId, tasks);
    const prev = this.taskPersistChains.get(projectId) ?? Promise.resolve();
    const chain = prev
      .catch(() => undefined)
      .then(() => this.persistTasks(projectId, tasks));
    this.taskPersistChains.set(projectId, chain);
    await chain;
  }

  async updateTask(projectId: string, taskId: string, patch: Partial<Task>): Promise<Task | null> {
    const tasks = this.mem.tasks.get(projectId) ?? [];
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx < 0) return null;
    tasks[idx] = { ...tasks[idx], ...patch };
    await this.persistTask(tasks[idx]);
    return tasks[idx];
  }

  async createTask(projectId: string, task: Task) {
    const tasks = this.mem.tasks.get(projectId) ?? [];
    tasks.push(task);
    await this.persistTask(task);
    return task;
  }

  async updateProject(projectId: string, patch: Partial<Project>): Promise<Project | null> {
    const project = this.mem.projects.get(projectId);
    if (!project) return null;
    const updated = { ...project, ...patch, updatedAt: new Date().toISOString() };
    this.mem.projects.set(projectId, updated);
    if (this.useDb) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: {
          name: updated.name,
          description: updated.description,
          locale: updated.locale,
          currency: updated.currency,
          startDate: updated.startDate,
          endDate: updated.endDate,
          status: updated.status,
          budgetCap: updated.budgetCap ?? null,
          updatedAt: new Date(updated.updatedAt),
        },
      });
    }
    return updated;
  }

  async addBudgetLine(line: BudgetLineItem): Promise<BudgetLineItem> {
    const list = this.mem.budgetLines.get(line.projectId) ?? [];
    list.push(line);
    this.mem.budgetLines.set(line.projectId, list);
    if (this.useDb) {
      await this.prisma.budgetLineItem.create({
        data: {
          id: line.id,
          projectId: line.projectId,
          category: line.category,
          name: line.name,
          description: line.description ?? null,
      plannedAmount: line.plannedAmount,
          committedAmount: line.committedAmount ?? null,
          actualAmount: line.actualAmount,
          cashMonth: line.cashMonth,
          taskId: line.taskId ?? null,
          source: line.source ?? null,
          sourceRef: line.sourceRef ?? null,
        },
      });
    }
    return line;
  }

  async updateBudgetLine(
    projectId: string,
    lineId: string,
    patch: Partial<BudgetLineItem>,
  ): Promise<BudgetLineItem | null> {
    const list = this.mem.budgetLines.get(projectId) ?? [];
    const idx = list.findIndex((l) => l.id === lineId);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...patch };
    if (this.useDb) {
      await this.prisma.budgetLineItem.update({
        where: { id: lineId },
        data: {
          category: list[idx].category,
          name: list[idx].name,
          description: list[idx].description ?? null,
          plannedAmount: list[idx].plannedAmount,
          committedAmount: list[idx].committedAmount ?? null,
          actualAmount: list[idx].actualAmount,
          cashMonth: list[idx].cashMonth,
          taskId: list[idx].taskId ?? null,
          source: list[idx].source ?? null,
          sourceRef: list[idx].sourceRef ?? null,
        },
      });
    }
    return list[idx];
  }

  findBudgetLineBySourceRef(projectId: string, sourceRef: string): BudgetLineItem | undefined {
    return this.getBudgetLines(projectId).find((l) => l.sourceRef === sourceRef);
  }

  async deleteBudgetLine(projectId: string, lineId: string): Promise<boolean> {
    const list = this.mem.budgetLines.get(projectId) ?? [];
    const next = list.filter((l) => l.id !== lineId);
    if (next.length === list.length) return false;
    this.mem.budgetLines.set(projectId, next);
    if (this.useDb) {
      await this.prisma.budgetLineItem.deleteMany({ where: { id: lineId, projectId } });
    }
    return true;
  }

  async addResource(orgId: string, dto: Omit<Resource, "id" | "organizationId">): Promise<Resource> {
    const resource: Resource = { id: uuid(), organizationId: orgId, ...dto };
    const list = this.mem.resources.get(orgId) ?? [];
    list.push(resource);
    this.mem.resources.set(orgId, list);
    if (this.useDb) await this.prisma.resource.create({ data: resource });
    return resource;
  }

  async addProjectMember(member: ProjectMember): Promise<ProjectMember> {
    const list = this.mem.projectMembers.get(member.projectId) ?? [];
    list.push(member);
    this.mem.projectMembers.set(member.projectId, list);
    if (this.useDb) {
      await this.prisma.projectMember.create({
        data: {
          id: member.id,
          projectId: member.projectId,
          resourceId: member.resourceId,
          role: member.role,
          hoursPerDay: member.hoursPerDay ?? null,
        },
      });
    }
    return member;
  }

  async updateProjectMember(
    projectId: string,
    memberId: string,
    patch: Partial<Pick<ProjectMember, "role" | "hoursPerDay">>,
  ): Promise<ProjectMember | null> {
    const list = this.mem.projectMembers.get(projectId) ?? [];
    const idx = list.findIndex((m) => m.id === memberId);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...patch };
    if (this.useDb) {
      await this.prisma.projectMember.update({
        where: { id: memberId },
        data: {
          ...(patch.role !== undefined && { role: patch.role }),
          ...(patch.hoursPerDay !== undefined && { hoursPerDay: patch.hoursPerDay }),
        },
      });
    }
    return list[idx];
  }

  async updateResource(
    orgId: string,
    resourceId: string,
    patch: Partial<
      Omit<Resource, "id" | "organizationId" | "costPerHour" | "costPerUnit">
    > & {
      costPerHour?: number | null;
      costPerUnit?: number | null;
    },
  ): Promise<Resource | null> {
    const list = this.mem.resources.get(orgId) ?? [];
    const idx = list.findIndex((r) => r.id === resourceId);
    if (idx < 0) return null;
    const next = { ...list[idx] };
    if (patch.name !== undefined) next.name = patch.name;
    if (patch.type !== undefined) next.type = patch.type;
    if (patch.email !== undefined) next.email = patch.email;
    if (patch.maxUnits !== undefined) next.maxUnits = patch.maxUnits;
    if (patch.calendarId !== undefined) next.calendarId = patch.calendarId;
    if (patch.costPerHour !== undefined) {
      next.costPerHour = patch.costPerHour === null ? undefined : patch.costPerHour;
    }
    if (patch.costPerUnit !== undefined) {
      next.costPerUnit = patch.costPerUnit === null ? undefined : patch.costPerUnit;
    }
    list[idx] = next;
    if (this.useDb) {
      await this.prisma.resource.update({
        where: { id: resourceId },
        data: {
          ...(patch.name !== undefined && { name: patch.name }),
          ...(patch.type !== undefined && { type: patch.type }),
          ...(patch.email !== undefined && { email: patch.email ?? null }),
          ...(patch.costPerHour !== undefined && { costPerHour: patch.costPerHour }),
          ...(patch.costPerUnit !== undefined && { costPerUnit: patch.costPerUnit }),
          ...(patch.maxUnits !== undefined && { maxUnits: patch.maxUnits }),
          ...(patch.calendarId !== undefined && { calendarId: patch.calendarId ?? null }),
        },
      });
    }
    return list[idx];
  }

  async addAssignment(assignment: ResourceAssignment): Promise<ResourceAssignment> {
    const projectId = this.findProjectIdForTask(assignment.taskId);
    if (!projectId) return assignment;
    const list = this.mem.assignments.get(projectId) ?? [];
    list.push(assignment);
    this.mem.assignments.set(projectId, list);
    if (this.useDb) {
      await this.prisma.resourceAssignment.create({
        data: { ...assignment, projectId },
      });
    }
    return assignment;
  }

  private findProjectIdForTask(taskId: string): string | undefined {
    for (const [pid, tasks] of this.mem.tasks) {
      if (tasks.some((t) => t.id === taskId)) return pid;
    }
    return undefined;
  }

  async addDependency(dep: TaskDependency) {
    const deps = this.mem.dependencies.get(dep.projectId) ?? [];
    deps.push(dep);
    this.mem.dependencies.set(dep.projectId, deps);
    if (this.useDb) await this.prisma.taskDependency.create({ data: dep });
    return dep;
  }

  async removeDependency(projectId: string, depId: string): Promise<boolean> {
    const deps = this.mem.dependencies.get(projectId) ?? [];
    const next = deps.filter((d) => d.id !== depId);
    if (next.length === deps.length) return false;
    this.mem.dependencies.set(projectId, next);
    if (this.useDb) {
      await this.prisma.taskDependency.deleteMany({ where: { id: depId, projectId } });
    }
    return true;
  }

  async saveBaseline(baseline: Baseline) {
    const list = this.mem.baselines.get(baseline.projectId) ?? [];
    list.push(baseline);
    this.mem.baselines.set(baseline.projectId, list);
    if (this.useDb) {
      await this.prisma.baseline.create({
        data: {
          ...baseline,
          savedAt: new Date(baseline.savedAt),
          tasks: baseline.tasks,
        },
      });
    }
    return baseline;
  }

  async addTimesheet(entry: TimesheetEntry) {
    this.mem.timesheets.push(entry);
    if (this.useDb && entry.projectId) {
      await this.prisma.timesheetEntry.create({
        data: {
          id: entry.id,
          projectId: entry.projectId,
          userId: entry.userId,
          taskId: entry.taskId,
          date: entry.date,
          hours: entry.hours,
          status: entry.status,
          notes: entry.notes,
        },
      });
    }
    return entry;
  }

  async updateTimesheet(
    projectId: string,
    entryId: string,
    patch: Partial<Pick<TimesheetEntry, "status" | "hours" | "notes">>,
  ): Promise<TimesheetEntry | null> {
    const taskIds = new Set(this.getTasks(projectId).map((t) => t.id));
    const idx = this.mem.timesheets.findIndex(
      (e) => e.id === entryId && taskIds.has(e.taskId),
    );
    if (idx < 0) return null;
    const next = { ...this.mem.timesheets[idx]!, ...patch };
    this.mem.timesheets[idx] = next;
    if (this.useDb) {
      await this.prisma.timesheetEntry.updateMany({
        where: { id: entryId, projectId },
        data: {
          ...(patch.status != null ? { status: patch.status } : {}),
          ...(patch.hours != null ? { hours: patch.hours } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        },
      });
    }
    return next;
  }

  async addNotification(n: Notification) {
    this.mem.notifications.push(n);
    if (this.useDb) {
      await this.prisma.notification.create({
        data: {
          ...n,
          createdAt: new Date(n.createdAt),
          metadata: n.metadata ?? undefined,
        },
      });
    }
    return n;
  }

  async bulkCreateTasks(projectId: string, newTasks: Task[]) {
    const tasks = [...(this.mem.tasks.get(projectId) ?? []), ...newTasks];
    this.mem.tasks.set(projectId, tasks);
    if (this.useDb) {
      await this.prisma.task.createMany({ data: newTasks.map(taskToPrismaCreate) });
    }
    return tasks;
  }

  async deleteTask(projectId: string, taskId: string): Promise<{ deletedIds: string[] } | null> {
    const tasks = this.mem.tasks.get(projectId) ?? [];
    if (!tasks.some((t) => t.id === taskId)) return null;

    const toDelete = new Set<string>();
    const collect = (id: string) => {
      toDelete.add(id);
      for (const child of tasks.filter((t) => t.parentId === id)) {
        collect(child.id);
      }
    };
    collect(taskId);

    const remaining = tasks.filter((t) => !toDelete.has(t.id));
    const deps = (this.mem.dependencies.get(projectId) ?? []).filter(
      (d) => !toDelete.has(d.predecessorId) && !toDelete.has(d.successorId),
    );
    const assignments = (this.mem.assignments.get(projectId) ?? []).filter(
      (a) => !toDelete.has(a.taskId),
    );

    this.mem.tasks.set(projectId, remaining);
    this.mem.dependencies.set(projectId, deps);
    this.mem.assignments.set(projectId, assignments);

    const ids = [...toDelete];
    if (this.useDb && ids.length) {
      await this.prisma.taskDependency.deleteMany({
        where: {
          projectId,
          OR: [{ predecessorId: { in: ids } }, { successorId: { in: ids } }],
        },
      });
      await this.prisma.resourceAssignment.deleteMany({
        where: { projectId, taskId: { in: ids } },
      });
      await this.prisma.task.deleteMany({ where: { id: { in: ids }, projectId } });
    }

    return { deletedIds: ids };
  }

  async deleteProject(projectId: string): Promise<boolean> {
    if (!this.mem.projects.has(projectId)) return false;

    this.mem.projects.delete(projectId);
    this.mem.tasks.delete(projectId);
    this.mem.dependencies.delete(projectId);
    this.mem.assignments.delete(projectId);
    this.mem.baselines.delete(projectId);
    this.mem.projectMembers.delete(projectId);
    this.mem.budgetLines.delete(projectId);
    this.mem.risks.delete(projectId);
    this.mem.changeRequests.delete(projectId);
    this.mem.rejectionLogs.delete(projectId);

    if (this.useDb) {
      await this.prisma.projectRisk.deleteMany({ where: { projectId } }).catch(() => undefined);
      await this.prisma.changeRequest.deleteMany({ where: { projectId } }).catch(() => undefined);
      await this.prisma.rejectionLog.deleteMany({ where: { projectId } }).catch(() => undefined);
      await this.prisma.task.deleteMany({ where: { projectId } });
      await this.prisma.taskDependency.deleteMany({ where: { projectId } });
      await this.prisma.resourceAssignment.deleteMany({ where: { projectId } });
      await this.prisma.baseline.deleteMany({ where: { projectId } });
      await this.prisma.budgetLineItem.deleteMany({ where: { projectId } });
      await this.prisma.timesheetEntry.deleteMany({ where: { projectId } });
      await this.prisma.projectMember.deleteMany({ where: { projectId } });
      await this.prisma.project.delete({ where: { id: projectId } });
    }
    return true;
  }

  getRisks(projectId: string): ProjectRisk[] {
    return this.mem.risks.get(projectId) ?? [];
  }

  async createRisk(
    projectId: string,
    dto: Omit<ProjectRisk, "id" | "projectId" | "createdAt" | "updatedAt">,
  ): Promise<ProjectRisk> {
    const now = new Date().toISOString();
    const risk: ProjectRisk = {
      id: uuid(),
      projectId,
      ...dto,
      category: dto.category ?? "schedule",
      source: dto.source ?? "manual",
      riskScore: dto.riskScore ?? calcRiskScore(dto.probability, dto.impact),
      status: dto.status ?? "open",
      createdAt: now,
      updatedAt: now,
    };
    const list = this.mem.risks.get(projectId) ?? [];
    list.push(risk);
    this.mem.risks.set(projectId, list);
    if (this.useDb) {
      await this.prisma.projectRisk
        .create({
          data: {
            id: risk.id,
            projectId,
            title: risk.title,
            description: risk.description ?? null,
            category: risk.category,
            probability: risk.probability,
            impact: risk.impact,
            riskScore: risk.riskScore,
            status: risk.status,
            source: risk.source,
            ownerResourceId: risk.ownerResourceId ?? null,
            responsePlan: risk.responsePlan ?? null,
            taskId: risk.taskId ?? null,
            dedupeKey: risk.dedupeKey ?? null,
          },
        })
        .catch((err) => {
          this.logger.warn(`ProjectRisk persist failed (kept in memory): ${err}`);
        });
    }
    return risk;
  }

  async updateRisk(
    projectId: string,
    riskId: string,
    patch: Partial<ProjectRisk>,
  ): Promise<ProjectRisk | null> {
    const list = this.mem.risks.get(projectId) ?? [];
    const idx = list.findIndex((r) => r.id === riskId);
    if (idx < 0) return null;
    const merged = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
    merged.riskScore = calcRiskScore(merged.probability, merged.impact);
    list[idx] = merged;
    if (this.useDb) {
      await this.prisma.projectRisk
        .update({
          where: { id: riskId },
          data: {
            title: list[idx].title,
            description: list[idx].description ?? null,
            category: list[idx].category,
            probability: list[idx].probability,
            impact: list[idx].impact,
            riskScore: list[idx].riskScore,
            status: list[idx].status,
            source: list[idx].source,
            ownerResourceId: list[idx].ownerResourceId ?? null,
            responsePlan: list[idx].responsePlan ?? null,
            taskId: list[idx].taskId ?? null,
            dedupeKey: list[idx].dedupeKey ?? null,
          },
        })
        .catch(() => undefined);
    }
    return list[idx];
  }

  async deleteRisk(projectId: string, riskId: string): Promise<boolean> {
    const list = this.mem.risks.get(projectId) ?? [];
    const next = list.filter((r) => r.id !== riskId);
    if (next.length === list.length) return false;
    this.mem.risks.set(projectId, next);
    if (this.useDb) {
      await this.prisma.projectRisk.delete({ where: { id: riskId } }).catch(() => undefined);
    }
    return true;
  }

  getChangeRequests(projectId: string): ChangeRequest[] {
    return this.mem.changeRequests.get(projectId) ?? [];
  }

  async createChangeRequest(
    projectId: string,
    dto: Omit<ChangeRequest, "id" | "projectId" | "createdAt" | "updatedAt" | "status"> & {
      status?: ChangeRequest["status"];
    },
  ): Promise<ChangeRequest> {
    const now = new Date().toISOString();
    const cr: ChangeRequest = {
      id: uuid(),
      projectId,
      status: dto.status ?? "draft",
      title: dto.title,
      description: dto.description,
      impactScheduleDays: dto.impactScheduleDays,
      impactCost: dto.impactCost,
      requestedBy: dto.requestedBy,
      createdAt: now,
      updatedAt: now,
    };
    const list = this.mem.changeRequests.get(projectId) ?? [];
    list.push(cr);
    this.mem.changeRequests.set(projectId, list);
    if (this.useDb) {
      await this.prisma.changeRequest
        .create({
          data: {
            id: cr.id,
            projectId,
            title: cr.title,
            description: cr.description ?? null,
            impactScheduleDays: cr.impactScheduleDays,
            impactCost: cr.impactCost,
            status: cr.status,
            requestedBy: cr.requestedBy ?? null,
          },
        })
        .catch(() => undefined);
    }
    return cr;
  }

  async updateChangeRequest(
    projectId: string,
    crId: string,
    patch: Partial<ChangeRequest>,
  ): Promise<ChangeRequest | null> {
    const list = this.mem.changeRequests.get(projectId) ?? [];
    const idx = list.findIndex((c) => c.id === crId);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
    if (this.useDb) {
      await this.prisma.changeRequest
        .update({
          where: { id: crId },
          data: {
            title: list[idx].title,
            description: list[idx].description ?? null,
            impactScheduleDays: list[idx].impactScheduleDays,
            impactCost: list[idx].impactCost,
            status: list[idx].status,
            requestedBy: list[idx].requestedBy ?? null,
            decidedAt: list[idx].decidedAt ? new Date(list[idx].decidedAt!) : null,
            decisionNote: list[idx].decisionNote ?? null,
          },
        })
        .catch(() => undefined);
    }
    return list[idx];
  }

  async deleteChangeRequest(projectId: string, crId: string): Promise<boolean> {
    const list = this.mem.changeRequests.get(projectId) ?? [];
    const next = list.filter((c) => c.id !== crId);
    if (next.length === list.length) return false;
    this.mem.changeRequests.set(projectId, next);
    if (this.useDb) {
      await this.prisma.changeRequest.delete({ where: { id: crId } }).catch(() => undefined);
    }
    return true;
  }

  getRejectionLogs(projectId: string): ManualRejectionEntry[] {
    return this.mem.rejectionLogs.get(projectId) ?? [];
  }

  async createRejectionLog(
    projectId: string,
    dto: Omit<ManualRejectionEntry, "id" | "projectId" | "createdAt" | "updatedAt">,
  ): Promise<ManualRejectionEntry> {
    const now = new Date().toISOString();
    const entry: ManualRejectionEntry = {
      id: uuid(),
      projectId,
      title: dto.title,
      description: dto.description,
      category: dto.category ?? "other",
      rejectedAt: dto.rejectedAt,
      decisionNote: dto.decisionNote,
      impactScheduleDays: dto.impactScheduleDays,
      impactCost: dto.impactCost,
      taskId: dto.taskId,
      createdAt: now,
      updatedAt: now,
    };
    const list = this.mem.rejectionLogs.get(projectId) ?? [];
    list.push(entry);
    this.mem.rejectionLogs.set(projectId, list);
    if (this.useDb) {
      await this.prisma.rejectionLog
        .create({
          data: {
            id: entry.id,
            projectId,
            title: entry.title,
            description: entry.description ?? null,
            category: entry.category,
            rejectedAt: entry.rejectedAt,
            decisionNote: entry.decisionNote ?? null,
            impactScheduleDays: entry.impactScheduleDays ?? null,
            impactCost: entry.impactCost ?? null,
            taskId: entry.taskId ?? null,
          },
        })
        .catch((err) => {
          this.logger.warn(`RejectionLog persist failed (kept in memory): ${err}`);
        });
    }
    return entry;
  }

  async deleteRejectionLog(projectId: string, logId: string): Promise<boolean> {
    const list = this.mem.rejectionLogs.get(projectId) ?? [];
    const next = list.filter((l) => l.id !== logId);
    if (next.length === list.length) return false;
    this.mem.rejectionLogs.set(projectId, next);
    if (this.useDb) {
      await this.prisma.rejectionLog.delete({ where: { id: logId } }).catch(() => undefined);
    }
    return true;
  }
}
