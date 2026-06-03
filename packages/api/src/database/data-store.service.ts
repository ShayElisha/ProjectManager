import { Inject, Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import type {
  Organization,
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
  TaskComment,
  TaskAttachment,
  ActiveTimer,
  UserAccount,
  UserRole,
  CustomColumn,
  Sprint,
  Cycle,
  ProjectForm,
  SavedView,
  RecurrenceRule,
  SprintVelocity,
  AutomationRule,
  ActivityLogEntry,
  ProjectMessage,
  ProjectWikiPage,
  ProjectGuest,
  CustomReport,
  WebhookSubscription,
} from "@nexus/shared";
import type { StoredUserRecord } from "./in-memory.backend";
import { riskScore as calcRiskScore } from "@nexus/shared";
import type { PrismaClient } from "@prisma/client";
import { PRISMA, type PrismaConnectFacade } from "./prisma.token";
import { InMemoryBackend } from "./in-memory.backend";
import { buildSeedData } from "./seed-data";

const DB_BOOTSTRAP_TIMEOUT_MS = process.env.VERCEL ? 5000 : 8000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function prismaProjectData(p: Project) {
  return {
    id: p.id,
    organizationId: p.organizationId,
    parentId: p.parentId ?? null,
    isTemplate: p.isTemplate ?? false,
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
  tags?: unknown;
  description?: string | null;
  descriptionHtml?: string | null;
  issueType?: string | null;
  storyPoints?: number | null;
  sprintId?: string | null;
  cycleId?: string | null;
  seriesId?: string | null;
  recurrenceRule?: unknown;
  customFields?: unknown;
}): Task {
  return {
    ...t,
    tags: (t.tags as string[] | undefined) ?? [],
    description: t.description ?? undefined,
    descriptionHtml: t.descriptionHtml ?? undefined,
    issueType: (t.issueType as Task["issueType"]) ?? "task",
    storyPoints: t.storyPoints ?? undefined,
    sprintId: t.sprintId ?? undefined,
    cycleId: t.cycleId ?? undefined,
    seriesId: t.seriesId ?? undefined,
    recurrenceRule: (t.recurrenceRule as RecurrenceRule | undefined) ?? undefined,
    customFields: (t.customFields as Task["customFields"]) ?? {},
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
    tags: task.tags ?? [],
    description: task.description ?? null,
    descriptionHtml: task.descriptionHtml ?? null,
    issueType: task.issueType ?? "task",
    storyPoints: task.storyPoints ?? null,
    sprintId: task.sprintId ?? null,
    cycleId: task.cycleId ?? null,
    seriesId: task.seriesId ?? null,
    recurrenceRule: (task.recurrenceRule ?? undefined) as object | undefined,
    customFields: (task.customFields ?? {}) as object,
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

  constructor(@Inject(PRISMA) private readonly prisma: PrismaConnectFacade & PrismaClient) {}

  get useDb(): boolean {
    return this.prisma.enabled;
  }

  private get db(): PrismaClient {
    return this.prisma as PrismaClient;
  }

  async onApplicationBootstrap() {
    if (process.env.VERCEL) {
      await this.ensureBootstrapAdminUser();
      this.logger.warn("DataStore: Vercel fast bootstrap (in-memory login; set DATABASE_URL + Atlas IP allowlist for persistence)");
      return;
    }

    if (!this.useDb) {
      this.mem.seed();
      this.logger.warn("DataStore bootstrap:in-memory mode");
      await this.ensureBootstrapAdminUser();
      return;
    }

    try {
      await withTimeout(
        (async () => {
          const count = await this.db.project.count();
          if (count === 0) {
            await this.seedDatabase();
            this.logger.log("DataStore: empty organization ready (no demo projects)");
          }
          if (process.env.VERCEL) {
            await this.hydrateLiteFromDatabase();
          } else {
            await this.hydrateFromDatabase();
          }
        })(),
        DB_BOOTSTRAP_TIMEOUT_MS,
        "DataStore bootstrap",
      );
      this.logger.log("DataStore: database connected, cache hydrated");
    } catch (err) {
      this.logger.warn(
        `DataStore: DB init failed (${err instanceof Error ? err.message : err}) — in-memory fallback`,
      );
      this.mem.seed();
    }
    await this.ensureBootstrapAdminUser();
    if (process.env.VERCEL) this.logger.warn("DataStore bootstrap:done");
  }

  /** First login on empty deploy (Vercel in-memory or fresh Atlas). Override via BOOTSTRAP_ADMIN_* env. */
  private async ensureBootstrapAdminUser(): Promise<void> {
    if (this.mem.users.size > 0) return;
    const email = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? "admin@nexus.local").trim().toLowerCase();
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "admin1234";
    const orgId = await this.ensureDefaultOrganizationId();
    await this.createUser({
      email,
      name: "Admin",
      passwordHash: await bcrypt.hash(password, 10),
      role: "admin",
      organizationId: orgId,
    });
    this.logger.warn(`Bootstrap admin ready (${email}) — change password after first login`);
  }

  private async seedDatabase() {
    const data = buildSeedData();
    await this.db.organization.create({
      data: {
        id: data.organizationId,
        name: data.organizationName,
        defaultLocale: "he",
        defaultCurrency: "ILS",
      },
    });

    for (const resource of data.resources) {
      await this.db.resource.create({ data: resource });
    }

    for (const project of data.projects) {
      await this.db.project.create({ data: prismaProjectData(project) });
      const tasks = data.tasks.get(project.id) ?? [];
      if (tasks.length) {
        await this.db.task.createMany({ data: tasks.map(taskToPrismaCreate) });
      }
      const deps = data.dependencies.get(project.id) ?? [];
      if (deps.length) {
        await this.db.taskDependency.createMany({ data: deps });
      }
      const assigns = data.assignments.get(project.id) ?? [];
      for (const a of assigns) {
        await this.db.resourceAssignment.create({
          data: { ...a, projectId: project.id },
        });
      }
    }
  }

  /** Vercel: batch queries only — avoids N+1 per project (prevents 60s+ cold start). */
  private async hydrateLiteFromDatabase(): Promise<void> {
    const orgs = await this.db.organization.findMany();
    const org = orgs[0];
    if (!org) return;

    for (const o of orgs) {
      this.mem.organizations.set(o.id, {
        id: o.id,
        name: o.name,
        defaultLocale: o.defaultLocale as Organization["defaultLocale"],
        defaultCurrency: o.defaultCurrency as Organization["defaultCurrency"],
      });
    }

    try {
      const dbUsers = await this.db.user.findMany();
      for (const u of dbUsers) {
        this.mem.users.set(u.id, {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role as UserRole,
          organizationId: u.organizationId ?? undefined,
          passwordHash: u.passwordHash,
          totpSecret: u.totpSecret ?? undefined,
          totpEnabled: u.totpEnabled ?? false,
        });
        this.mem.usersByEmail.set(u.email, u.id);
      }
    } catch {
      /* users table may be empty */
    }

    const data = buildSeedData();
    data.organizationId = org.id;
    data.organizationName = org.name;
    data.projects = [];
    data.tasks = new Map();
    data.dependencies = new Map();
    data.assignments = new Map();

    const rawResources = await this.db.resource.findMany({ where: { organizationId: org.id } });
    data.resources = rawResources.map((r) => ({
      ...r,
      type: r.type as Resource["type"],
      email: r.email ?? undefined,
      costPerHour: r.costPerHour ?? undefined,
      costPerUnit: r.costPerUnit ?? undefined,
      calendarId: r.calendarId ?? undefined,
    }));

    const projects = await this.db.project.findMany();
    for (const p of projects) {
      data.projects.push({
        id: p.id,
        organizationId: p.organizationId,
        parentId: p.parentId ?? null,
        isTemplate: p.isTemplate ?? false,
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
    }

    const projectIds = new Set(data.projects.map((p) => p.id));
    const groupByProject = <T extends { projectId: string }>(rows: T[]) => {
      const m = new Map<string, T[]>();
      for (const row of rows) {
        if (!projectIds.has(row.projectId)) continue;
        const list = m.get(row.projectId) ?? [];
        list.push(row);
        m.set(row.projectId, list);
      }
      return m;
    };

    for (const l of await this.db.budgetLineItem.findMany()) {
      if (!projectIds.has(l.projectId)) continue;
      const lines = this.mem.budgetLines.get(l.projectId) ?? [];
      lines.push({
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
      });
      this.mem.budgetLines.set(l.projectId, lines);
    }

    for (const t of await this.db.task.findMany({ orderBy: { sortOrder: "asc" } })) {
      const list = data.tasks.get(t.projectId) ?? [];
      list.push(mapTask(t));
      data.tasks.set(t.projectId, list);
    }

    for (const [pid, deps] of groupByProject(await this.db.taskDependency.findMany())) {
      data.dependencies.set(pid, deps.map((d) => ({ ...d, type: d.type as TaskDependency["type"] })));
    }

    for (const [pid, rows] of groupByProject(await this.db.resourceAssignment.findMany())) {
      data.assignments.set(pid, rows);
    }

    for (const b of await this.db.baseline.findMany()) {
      if (!projectIds.has(b.projectId)) continue;
      const list = this.mem.baselines.get(b.projectId) ?? [];
      list.push({
        id: b.id,
        projectId: b.projectId,
        index: b.index,
        name: b.name,
        savedAt: b.savedAt.toISOString(),
        tasks: b.tasks as Baseline["tasks"],
      });
      this.mem.baselines.set(b.projectId, list);
    }

    for (const [pid, members] of groupByProject(await this.db.projectMember.findMany())) {
      this.mem.projectMembers.set(
        pid,
        members.map((m) => ({
          id: m.id,
          projectId: m.projectId,
          resourceId: m.resourceId,
          role: m.role,
          hoursPerDay: m.hoursPerDay ?? undefined,
        })),
      );
    }

    try {
      for (const [pid, risks] of groupByProject(await this.db.projectRisk.findMany())) {
        this.mem.risks.set(pid, risks.map((r) => mapPrismaRisk(r)));
      }
    } catch {
      /* optional tables */
    }

    try {
      for (const [pid, changes] of groupByProject(await this.db.changeRequest.findMany())) {
        this.mem.changeRequests.set(
          pid,
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
      }
    } catch {
      /* optional */
    }

    try {
      for (const [pid, logs] of groupByProject(await this.db.rejectionLog.findMany())) {
        this.mem.rejectionLogs.set(
          pid,
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
      }
    } catch {
      /* optional */
    }

    this.mem.loadFromSeedData(data);

    for (const p of data.projects) {
      if (!this.mem.customColumns.has(p.id)) this.mem.customColumns.set(p.id, []);
      if (!this.mem.sprints.has(p.id)) this.mem.sprints.set(p.id, []);
      if (!this.mem.cycles.has(p.id)) this.mem.cycles.set(p.id, []);
      if (!this.mem.projectForms.has(p.id)) this.mem.projectForms.set(p.id, []);
      if (!this.mem.savedViews.has(p.id)) this.mem.savedViews.set(p.id, []);
      if (!this.mem.automationRules.has(p.id)) this.mem.automationRules.set(p.id, []);
      if (!this.mem.activityLogs.has(p.id)) this.mem.activityLogs.set(p.id, []);
      if (!this.mem.projectMessages.has(p.id)) this.mem.projectMessages.set(p.id, []);
      if (!this.mem.wikiPages.has(p.id)) this.mem.wikiPages.set(p.id, []);
      if (!this.mem.projectGuests.has(p.id)) this.mem.projectGuests.set(p.id, []);
      if (!this.mem.customReports.has(p.id)) this.mem.customReports.set(p.id, []);
      if (!this.mem.webhookSubscriptions.has(p.id)) this.mem.webhookSubscriptions.set(p.id, []);
      if (!this.mem.goals.has(p.id)) this.mem.goals.set(p.id, []);
      if (!this.mem.keyResults.has(p.id)) this.mem.keyResults.set(p.id, []);
      if (!this.mem.whiteboardItems.has(p.id)) this.mem.whiteboardItems.set(p.id, []);
      if (!this.mem.projectIntegrations.has(p.id)) {
        this.mem.projectIntegrations.set(p.id, { projectId: p.id });
      }
    }

    const sheets = await this.db.timesheetEntry.findMany();
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
    const notifs = await this.db.notification.findMany();
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

    this.logger.warn("DataStore: lite hydrate complete (Vercel)");
  }

  private async hydrateFromDatabase() {
    const orgs = await this.db.organization.findMany();
    const org = orgs[0];
    if (!org) return;

    for (const o of orgs) {
      this.mem.organizations.set(o.id, {
        id: o.id,
        name: o.name,
        defaultLocale: o.defaultLocale as Organization["defaultLocale"],
        defaultCurrency: o.defaultCurrency as Organization["defaultCurrency"],
      });
    }

    try {
      const dbUsers = await this.db.user.findMany();
      for (const u of dbUsers) {
        this.mem.users.set(u.id, {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role as UserRole,
          organizationId: u.organizationId ?? undefined,
          passwordHash: u.passwordHash,
          totpSecret: u.totpSecret ?? undefined,
          totpEnabled: u.totpEnabled ?? false,
        });
        this.mem.usersByEmail.set(u.email, u.id);
      }
    } catch {
      /* users table may be empty on first deploy */
    }

    const data = buildSeedData();
    data.organizationId = org.id;
    data.organizationName = org.name;
    data.projects = [];
    data.tasks = new Map();
    data.dependencies = new Map();
    const rawResources = await this.db.resource.findMany({ where: { organizationId: org.id } });
    data.resources = rawResources.map((r) => ({
      ...r,
      type: r.type as Resource["type"],
      email: r.email ?? undefined,
      costPerHour: r.costPerHour ?? undefined,
      costPerUnit: r.costPerUnit ?? undefined,
      calendarId: r.calendarId ?? undefined,
    }));
    data.assignments = new Map();

    const projects = await this.db.project.findMany();
    for (const p of projects) {
      data.projects.push({
        id: p.id,
        organizationId: p.organizationId,
        parentId: p.parentId ?? null,
        isTemplate: p.isTemplate ?? false,
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
      const lines = await this.db.budgetLineItem.findMany({ where: { projectId: p.id } });
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
      const tasks = await this.db.task.findMany({
        where: { projectId: p.id },
        orderBy: { sortOrder: "asc" },
      });
      data.tasks.set(p.id, tasks.map(mapTask));
      const deps = await this.db.taskDependency.findMany({ where: { projectId: p.id } });
      data.dependencies.set(
        p.id,
        deps.map((d) => ({ ...d, type: d.type as TaskDependency["type"] })),
      );
      data.assignments.set(
        p.id,
        await this.db.resourceAssignment.findMany({ where: { projectId: p.id } }),
      );
      const baselines = await this.db.baseline.findMany({ where: { projectId: p.id } });
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
      const members = await this.db.projectMember.findMany({ where: { projectId: p.id } });
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
        const risks = await this.db.projectRisk.findMany({ where: { projectId: p.id } });
        this.mem.risks.set(
          p.id,
          risks.map((r) => mapPrismaRisk(r)),
        );
      } catch {
        if (!this.mem.risks.has(p.id)) this.mem.risks.set(p.id, []);
      }
      try {
        const changes = await this.db.changeRequest.findMany({ where: { projectId: p.id } });
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
        const logs = await this.db.rejectionLog.findMany({ where: { projectId: p.id } });
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
      await this.hydrateProjectFeatures(p.id);
    }

    await this.hydrateEnterpriseFromDb(org.id);

    this.mem.loadFromSeedData(data);
    const sheets = await this.db.timesheetEntry.findMany();
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
    const notifs = await this.db.notification.findMany();
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

  private async hydrateProjectFeatures(projectId: string): Promise<void> {
    try {
      const comments = await this.db.taskComment.findMany({ where: { projectId } });
      for (const c of comments) {
        if (!this.mem.taskComments.some((x) => x.id === c.id)) {
          this.mem.taskComments.push({
            id: c.id,
            projectId: c.projectId,
            taskId: c.taskId,
            userId: c.userId,
            userName: c.userName,
            body: c.body,
            createdAt: c.createdAt.toISOString(),
          });
        }
      }
      const attachments = await this.db.taskAttachment.findMany({ where: { projectId } });
      for (const a of attachments) {
        if (!this.mem.taskAttachments.some((x) => x.id === a.id)) {
          this.mem.taskAttachments.push({
            id: a.id,
            projectId: a.projectId,
            taskId: a.taskId,
            fileName: a.fileName,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
            storagePath: a.storagePath,
            uploadedBy: a.uploadedBy ?? undefined,
            createdAt: a.createdAt.toISOString(),
          });
        }
      }
      const savedViews = await this.db.savedView.findMany({ where: { projectId } });
      this.mem.savedViews.set(
        projectId,
        savedViews.map((v) => ({
          id: v.id,
          projectId: v.projectId,
          userId: v.userId ?? undefined,
          name: v.name,
          viewMode: v.viewMode as SavedView["viewMode"],
          filters: v.filters as SavedView["filters"],
          columns: (v.columns as SavedView["columns"]) ?? undefined,
        })),
      );
      const rules = await this.db.automationRule.findMany({ where: { projectId } });
      this.mem.automationRules.set(
        projectId,
        rules.map((r) => ({
          id: r.id,
          projectId: r.projectId,
          name: r.name,
          enabled: r.enabled,
          triggerField: r.triggerField,
          triggerOp: r.triggerOp as AutomationRule["triggerOp"],
          triggerValue: r.triggerValue as AutomationRule["triggerValue"],
          actionType: r.actionType as AutomationRule["actionType"],
          actionPayload: r.actionPayload as AutomationRule["actionPayload"],
        })),
      );
      const logs = await this.db.activityLog.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      this.mem.activityLogs.set(
        projectId,
        logs.map((l) => ({
          id: l.id,
          projectId: l.projectId,
          userId: l.userId ?? undefined,
          userName: l.userName ?? undefined,
          action: l.action,
          entityType: l.entityType,
          entityId: l.entityId ?? undefined,
          summary: l.summary,
          createdAt: l.createdAt.toISOString(),
        })),
      );
      const messages = await this.db.projectMessage.findMany({ where: { projectId } });
      this.mem.projectMessages.set(
        projectId,
        messages.map((m) => ({
          id: m.id,
          projectId: m.projectId,
          userId: m.userId,
          userName: m.userName,
          body: m.body,
          createdAt: m.createdAt.toISOString(),
        })),
      );
      const wiki = await this.db.projectWikiPage.findMany({ where: { projectId } });
      this.mem.wikiPages.set(
        projectId,
        wiki.map((w) => ({
          id: w.id,
          projectId: w.projectId,
          title: w.title,
          content: w.content,
          updatedAt: w.updatedAt.toISOString(),
        })),
      );
      const guests = await this.db.projectGuest.findMany({ where: { projectId } });
      this.mem.projectGuests.set(
        projectId,
        guests.map((g) => ({
          id: g.id,
          projectId: g.projectId,
          email: g.email,
          name: g.name ?? undefined,
          role: g.role as ProjectGuest["role"],
          token: g.token,
          createdAt: g.createdAt.toISOString(),
        })),
      );
      const reports = await this.db.customReport.findMany({ where: { projectId } });
      this.mem.customReports.set(
        projectId,
        reports.map((r) => ({
          id: r.id,
          projectId: r.projectId,
          name: r.name,
          widgets: r.widgets as CustomReport["widgets"],
          createdAt: r.createdAt.toISOString(),
        })),
      );
      const hooks = await this.db.webhookSubscription.findMany({ where: { projectId } });
      this.mem.webhookSubscriptions.set(
        projectId,
        hooks.map((h) => ({
          id: h.id,
          projectId: h.projectId,
          url: h.url,
          events: h.events as WebhookSubscription["events"],
          secret: h.secret ?? undefined,
          enabled: h.enabled,
        })),
      );
      const goals = await this.db.goal.findMany({ where: { projectId } });
      this.mem.goals.set(
        projectId,
        goals.map((g) => ({
          id: g.id,
          projectId: g.projectId,
          title: g.title,
          period: g.period,
          progress: g.progress,
        })),
      );
      const krs = await this.db.keyResult.findMany({ where: { projectId } });
      this.mem.keyResults.set(
        projectId,
        krs.map((k) => ({
          id: k.id,
          goalId: k.goalId,
          projectId: k.projectId,
          title: k.title,
          targetValue: k.targetValue,
          currentValue: k.currentValue,
          unit: k.unit ?? undefined,
        })),
      );
      const wb = await this.db.whiteboardItem.findMany({ where: { projectId } });
      this.mem.whiteboardItems.set(
        projectId,
        wb.map((w) => ({
          id: w.id,
          projectId: w.projectId,
          x: w.x,
          y: w.y,
          width: w.width,
          height: w.height,
          text: w.text,
          color: w.color,
        })),
      );
    } catch (err) {
      this.logger.warn(`hydrateProjectFeatures(${projectId}): ${err instanceof Error ? err.message : err}`);
    }
  }

  private async hydrateEnterpriseFromDb(organizationId: string): Promise<void> {
    try {
      const audits = await this.db.auditLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      this.mem.auditLogs = audits.map((a) => ({
        id: a.id,
        organizationId: a.organizationId,
        userId: a.userId ?? undefined,
        userName: a.userName ?? undefined,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId ?? undefined,
        summary: a.summary,
        metadata: (a.metadata as Record<string, unknown>) ?? undefined,
        createdAt: a.createdAt.toISOString(),
      }));
      const programs = await this.db.program.findMany({ where: { organizationId } });
      this.mem.programs = programs.map((p) => ({
        id: p.id,
        organizationId: p.organizationId,
        name: p.name,
        description: p.description ?? undefined,
        projectIds: (p.projectIds as string[]) ?? [],
        startDate: p.startDate ?? undefined,
        endDate: p.endDate ?? undefined,
      }));
      const invoices = await this.db.invoice.findMany({ where: { organizationId } });
      this.mem.invoices = invoices.map((i) => ({
        id: i.id,
        organizationId: i.organizationId,
        projectId: i.projectId ?? undefined,
        clientName: i.clientName,
        clientEmail: i.clientEmail ?? undefined,
        status: i.status as import("@nexus/shared").Invoice["status"],
        currency: i.currency,
        lines: i.lines as unknown as import("@nexus/shared").InvoiceLine[],
        total: i.total,
        dueDate: i.dueDate ?? undefined,
        createdAt: i.createdAt.toISOString(),
      }));
      const contacts = await this.db.crmContact.findMany({ where: { organizationId } });
      this.mem.crmContacts = contacts.map((c) => ({ ...c, email: c.email ?? undefined, company: c.company ?? undefined, phone: c.phone ?? undefined }));
      const deals = await this.db.crmDeal.findMany({ where: { organizationId } });
      this.mem.crmDeals = deals.map((d) => ({
        id: d.id,
        organizationId: d.organizationId,
        contactId: d.contactId ?? undefined,
        title: d.title,
        value: d.value,
        stage: d.stage as import("@nexus/shared").CrmDeal["stage"],
        projectId: d.projectId ?? undefined,
      }));
      const orgRules = await this.db.orgAutomationRule.findMany({ where: { organizationId } });
      this.mem.orgAutomationRules = orgRules.map((r) => ({
        id: r.id,
        organizationId: r.organizationId,
        name: r.name,
        enabled: r.enabled,
        event: r.event,
        actionType: r.actionType as import("@nexus/shared").OrgAutomationRule["actionType"],
        actionPayload: r.actionPayload as Record<string, unknown> | undefined,
      }));
      const proofs = await this.db.proofAsset.findMany();
      this.mem.proofAssets = proofs
        .filter((p) => {
          const proj = this.mem.projects.get(p.projectId);
          return proj?.organizationId === organizationId;
        })
        .map((p) => ({
          id: p.id,
          projectId: p.projectId,
          taskId: p.taskId ?? undefined,
          title: p.title,
          fileUrl: p.fileUrl ?? undefined,
          status: p.status as import("@nexus/shared").ProofAsset["status"],
          reviewerNote: p.reviewerNote ?? undefined,
          createdAt: p.createdAt.toISOString(),
        }));
      const perms = await this.db.taskPermission.findMany();
      this.mem.taskPermissions = perms.map((p) => ({
        id: p.id,
        projectId: p.projectId,
        taskId: p.taskId,
        userId: p.userId,
        level: p.level as import("@nexus/shared").TaskPermissionLevel,
      }));
    } catch (err) {
      this.logger.warn(`hydrateEnterpriseFromDb: ${err instanceof Error ? err.message : err}`);
    }
  }

  private async persistTask(task: Task) {
    if (!this.useDb) return;
    await this.db.task.upsert({
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
    const existing = await this.db.task.findMany({
      where: { projectId },
      select: { id: true },
    });
    const orphanIds = existing.map((e) => e.id).filter((id) => !incomingIds.has(id));
    if (orphanIds.length) {
      await this.db.task.deleteMany({ where: { id: { in: orphanIds } } });
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

  getNotifications(userId?: string) {
    const list = this.mem.notifications;
    if (!userId) return list;
    return list.filter((n) => n.userId === userId);
  }

  getOrganizations(): Organization[] {
    if (this.mem.organizations.size === 0 && this.mem.organizationId) {
      this.mem.organizations.set(this.mem.organizationId, {
        id: this.mem.organizationId,
        name: this.mem.organizationName,
        defaultLocale: "he",
        defaultCurrency: "ILS",
      });
    }
    return Array.from(this.mem.organizations.values());
  }

  getOrganization(id: string) {
    return this.mem.organizations.get(id);
  }

  async createOrganization(dto: {
    name: string;
    defaultLocale?: Organization["defaultLocale"];
    defaultCurrency?: Organization["defaultCurrency"];
  }): Promise<Organization> {
    const org: Organization = {
      id: uuid(),
      name: dto.name,
      defaultLocale: dto.defaultLocale ?? "he",
      defaultCurrency: dto.defaultCurrency ?? "ILS",
    };
    this.mem.organizations.set(org.id, org);
    if (this.useDb) {
      await this.db.organization.create({
        data: {
          id: org.id,
          name: org.name,
          defaultLocale: org.defaultLocale,
          defaultCurrency: org.defaultCurrency,
        },
      });
    }
    return org;
  }

  updateOrganization(
    id: string,
    patch: Partial<Pick<Organization, "name" | "defaultLocale" | "defaultCurrency">>,
  ): Organization | null {
    const org = this.mem.organizations.get(id);
    if (!org) return null;
    const updated = { ...org, ...patch };
    this.mem.organizations.set(id, updated);
    if (id === this.mem.organizationId) this.mem.organizationName = updated.name;
    if (this.useDb) {
      void this.db.organization.update({
        where: { id },
        data: {
          ...(patch.name != null ? { name: patch.name } : {}),
          ...(patch.defaultLocale != null ? { defaultLocale: patch.defaultLocale } : {}),
          ...(patch.defaultCurrency != null ? { defaultCurrency: patch.defaultCurrency } : {}),
        },
      });
    }
    return updated;
  }

  async ensureDefaultOrganizationId(): Promise<string> {
    return this.ensureOrganization();
  }

  getUserByEmail(email: string): UserAccount | undefined {
    const id = this.mem.usersByEmail.get(email.trim().toLowerCase());
    if (!id) return undefined;
    const u = this.mem.users.get(id);
    if (!u) return undefined;
    const { passwordHash: _p, ...account } = u;
    return account;
  }

  getUserById(id: string): UserAccount | undefined {
    const u = this.mem.users.get(id);
    if (!u) return undefined;
    const { passwordHash: _p, ...account } = u;
    return account;
  }

  getUsersByOrganization(organizationId: string): UserAccount[] {
    return Array.from(this.mem.users.values())
      .filter((u) => u.organizationId === organizationId)
      .map(({ passwordHash: _p, ...account }) => account);
  }

  resolveMentionUserIds(projectId: string, mentionName: string): string[] {
    const needle = mentionName.trim().toLowerCase();
    if (!needle) return [];
    const project = this.getProject(projectId);
    if (!project) return [];
    const members = this.getProjectMembers(projectId);
    const resources = this.getResources(project.organizationId);
    const ids = new Set<string>();
    for (const m of members) {
      const res = resources.find((r) => r.id === m.resourceId);
      if (res?.name.toLowerCase().includes(needle)) {
        const user = Array.from(this.mem.users.values()).find(
          (u) => u.email.split("@")[0]!.toLowerCase() === needle || u.name.toLowerCase().includes(needle),
        );
        if (user) ids.add(user.id);
      }
    }
    for (const u of this.mem.users.values()) {
      if (u.organizationId !== project.organizationId) continue;
      if (u.name.toLowerCase().includes(needle) || u.email.toLowerCase().startsWith(needle)) {
        ids.add(u.id);
      }
    }
    return [...ids];
  }

  notifyProjectManagers(
    projectId: string,
    notification: Omit<Notification, "id" | "createdAt" | "read" | "userId">,
  ): void {
    const project = this.getProject(projectId);
    if (!project) return;
    const orgUsers = this.getUsersByOrganization(project.organizationId).filter((u) =>
      ["admin", "pmo", "project_manager"].includes(u.role),
    );
    const targets = orgUsers.length > 0 ? orgUsers : this.getUsersByOrganization(project.organizationId).slice(0, 2);
    for (const user of targets) {
      void this.addNotification({
        ...notification,
        id: uuid(),
        userId: user.id,
        read: false,
        createdAt: new Date().toISOString(),
      });
    }
  }

  getUserRecord(id: string): StoredUserRecord | undefined {
    return this.mem.users.get(id);
  }

  async createUser(input: {
    email: string;
    name: string;
    passwordHash: string;
    role: UserRole;
    organizationId?: string;
  }): Promise<UserAccount> {
    const id = uuid();
    const record: StoredUserRecord = {
      id,
      email: input.email,
      name: input.name,
      role: input.role,
      organizationId: input.organizationId,
      passwordHash: input.passwordHash,
    };
    this.mem.users.set(id, record);
    this.mem.usersByEmail.set(input.email, id);
    if (this.useDb) {
      await this.db.user.create({
        data: {
          id,
          email: input.email,
          name: input.name,
          passwordHash: input.passwordHash,
          role: input.role,
          organizationId: input.organizationId ?? null,
        },
      });
    }
    const { passwordHash: _p, ...account } = record;
    return account;
  }

  getTaskComments(projectId: string, taskId: string): TaskComment[] {
    return this.mem.taskComments
      .filter((c) => c.projectId === projectId && c.taskId === taskId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async addTaskComment(input: {
    projectId: string;
    taskId: string;
    userId: string;
    userName: string;
    body: string;
  }): Promise<TaskComment> {
    const comment: TaskComment = {
      id: uuid(),
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.userId,
      userName: input.userName,
      body: input.body,
      createdAt: new Date().toISOString(),
    };
    this.mem.taskComments.push(comment);
    if (this.useDb) {
      await this.db.taskComment.create({ data: { ...comment, createdAt: new Date(comment.createdAt) } });
    }
    const mentions = input.body.match(/@([\w\u0590-\u05FF.-]+)/g);
    if (mentions) {
      const notified = new Set<string>();
      for (const raw of mentions) {
        const name = raw.slice(1);
        for (const userId of this.resolveMentionUserIds(input.projectId, name)) {
          if (notified.has(userId)) continue;
          notified.add(userId);
          void this.addNotification({
            id: uuid(),
            userId,
            type: "mention",
            title: "Mentioned in comment",
            body: `${input.userName} mentioned you on a task`,
            read: false,
            createdAt: new Date().toISOString(),
            metadata: { taskId: input.taskId, commentId: comment.id },
          });
        }
      }
    }
    this.logActivity({
      projectId: input.projectId,
      userId: input.userId,
      userName: input.userName,
      action: "comment",
      entityType: "task",
      entityId: input.taskId,
      summary: `${input.userName} commented`,
    });
    return comment;
  }

  getTaskAttachments(projectId: string, taskId: string): TaskAttachment[] {
    return this.mem.taskAttachments
      .filter((a) => a.projectId === projectId && a.taskId === taskId)
      .map(({ storagePath: _s, ...rest }) => rest);
  }

  getAttachmentById(id: string): TaskAttachment | undefined {
    return this.mem.taskAttachments.find((a) => a.id === id);
  }

  async addTaskAttachment(input: {
    projectId: string;
    taskId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storagePath: string;
    uploadedBy?: string;
  }): Promise<TaskAttachment> {
    const att: TaskAttachment = {
      id: uuid(),
      projectId: input.projectId,
      taskId: input.taskId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storagePath: input.storagePath,
      uploadedBy: input.uploadedBy,
      createdAt: new Date().toISOString(),
    };
    this.mem.taskAttachments.push(att);
    if (this.useDb) {
      await this.db.taskAttachment.create({
        data: {
          id: att.id,
          projectId: att.projectId,
          taskId: att.taskId,
          fileName: att.fileName,
          mimeType: att.mimeType,
          sizeBytes: att.sizeBytes,
          storagePath: att.storagePath!,
          uploadedBy: att.uploadedBy ?? null,
          createdAt: new Date(att.createdAt),
        },
      });
    }
    const { storagePath: _s, ...pub } = att;
    return pub;
  }

  deleteTaskAttachment(projectId: string, taskId: string, attachmentId: string) {
    const idx = this.mem.taskAttachments.findIndex(
      (a) => a.id === attachmentId && a.projectId === projectId && a.taskId === taskId,
    );
    if (idx < 0) return { deleted: false };
    this.mem.taskAttachments.splice(idx, 1);
    if (this.useDb) {
      void this.db.taskAttachment.delete({ where: { id: attachmentId } });
    }
    return { deleted: true };
  }

  markNotificationRead(id: string) {
    const n = this.mem.notifications.find((x) => x.id === id);
    if (!n) return { ok: false };
    n.read = true;
    if (this.useDb) {
      void this.db.notification.update({ where: { id }, data: { read: true } });
    }
    return { ok: true, notification: n };
  }

  markAllNotificationsRead(userId?: string) {
    let count = 0;
    for (const n of this.mem.notifications) {
      if (userId && n.userId !== userId) continue;
      if (!n.read) {
        n.read = true;
        count++;
      }
    }
    if (this.useDb && userId) {
      void this.db.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
    }
    return { marked: count };
  }

  getActiveTimer(userId: string, projectId: string): ActiveTimer | null {
    return (
      this.mem.activeTimers.find(
        (t) => t.userId === userId && t.projectId === projectId && !t.stoppedAt,
      ) ?? null
    );
  }

  startTimer(userId: string, projectId: string, taskId?: string): ActiveTimer {
    const existing = this.getActiveTimer(userId, projectId);
    if (existing) return existing;
    const timer: ActiveTimer = {
      id: uuid(),
      userId,
      projectId,
      taskId,
      startedAt: new Date().toISOString(),
    };
    this.mem.activeTimers.push(timer);
    if (this.useDb) {
      void this.db.activeTimer.create({
        data: {
          id: timer.id,
          userId,
          projectId,
          taskId: taskId ?? null,
          startedAt: new Date(timer.startedAt),
        },
      });
    }
    return timer;
  }

  async stopTimer(userId: string, projectId: string, notes?: string) {
    const timer = this.getActiveTimer(userId, projectId);
    if (!timer) return { ok: false as const };
    timer.stoppedAt = new Date().toISOString();
    const started = new Date(timer.startedAt).getTime();
    const ended = new Date(timer.stoppedAt).getTime();
    const hours = Math.round(((ended - started) / 3600000) * 100) / 100;
    const date = timer.startedAt.slice(0, 10);
    const entry: TimesheetEntry = {
      id: uuid(),
      projectId,
      userId,
      taskId: timer.taskId ?? this.getTasks(projectId)[0]?.id ?? "",
      date,
      hours: Math.max(0.25, hours),
      status: "draft",
      notes: notes ?? "Timer",
    };
    if (entry.taskId) await this.addTimesheet(entry);
    if (this.useDb) {
      void this.db.activeTimer.update({
        where: { id: timer.id },
        data: { stoppedAt: new Date(timer.stoppedAt) },
      });
    }
    return { ok: true as const, timer, entry: entry.taskId ? entry : undefined };
  }

  async cloneProjectFromTemplate(
    templateId: string,
    opts: { name: string; organizationId?: string; parentId?: string | null },
  ): Promise<Project | null> {
    return this.cloneProject(templateId, opts, true);
  }

  async duplicateProject(
    projectId: string,
    opts: { name: string; organizationId?: string; parentId?: string | null },
  ): Promise<Project | null> {
    return this.cloneProject(projectId, opts, false);
  }

  private async cloneProject(
    sourceId: string,
    opts: { name: string; organizationId?: string; parentId?: string | null },
    requireTemplate: boolean,
  ): Promise<Project | null> {
    const source = this.mem.projects.get(sourceId);
    if (!source) return null;
    if (requireTemplate && !source.isTemplate) return null;

    const created = await this.createProject({
      name: opts.name,
      organizationId: opts.organizationId ?? source.organizationId,
      parentId: opts.parentId ?? null,
      isTemplate: false,
      locale: source.locale,
      currency: source.currency,
      startDate: source.startDate,
      endDate: source.endDate,
      status: "planning",
      budgetCap: source.budgetCap,
      hoursPerDay: source.hoursPerDay,
      workDays: source.workDays,
      defaultLinkType: source.defaultLinkType,
    });

    const srcTasks = this.getTasks(sourceId);
    const idMap = new Map<string, string>();
    for (const t of srcTasks) idMap.set(t.id, uuid());

    const cloned = srcTasks.map((t) => ({
      ...t,
      id: idMap.get(t.id)!,
      projectId: created.id,
      parentId: t.parentId ? (idMap.get(t.parentId) ?? null) : null,
      sprintId: undefined,
      seriesId: undefined,
    }));
    if (cloned.length) await this.bulkCreateTasks(created.id, cloned);

    for (const d of this.getDependencies(sourceId)) {
      const pred = idMap.get(d.predecessorId);
      const succ = idMap.get(d.successorId);
      if (pred && succ) {
        await this.addDependency({
          ...d,
          id: uuid(),
          projectId: created.id,
          predecessorId: pred,
          successorId: succ,
        });
      }
    }

    for (const m of this.getProjectMembers(sourceId)) {
      await this.addProjectMember({
        ...m,
        id: uuid(),
        projectId: created.id,
      });
    }

    for (const col of this.getCustomColumns(sourceId)) {
      await this.createCustomColumn({ ...col, id: uuid(), projectId: created.id });
    }

    return created;
  }

  async moveTaskToProject(
    sourceProjectId: string,
    taskId: string,
    targetProjectId: string,
  ): Promise<Task | null> {
    const tasks = this.mem.tasks.get(sourceProjectId) ?? [];
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx < 0) return null;

    const targetProject = this.mem.projects.get(targetProjectId);
    if (!targetProject) return null;

    const task = { ...tasks[idx]! };
    const toMoveIds = new Set<string>();
    const collect = (id: string) => {
      toMoveIds.add(id);
      for (const c of tasks.filter((t) => t.parentId === id)) collect(c.id);
    };
    collect(taskId);

    const moving = tasks.filter((t) => toMoveIds.has(t.id));
    const remaining = tasks.filter((t) => !toMoveIds.has(t.id));
    this.mem.tasks.set(sourceProjectId, remaining);

    const targetOrgResources = this.getResources(targetProject.organizationId);
    const resourceIds = new Set(targetOrgResources.map((r) => r.id));

    const idMap = new Map<string, string>();
    for (const t of moving) idMap.set(t.id, uuid());

    const remapped = moving.map((t) => ({
      ...t,
      id: idMap.get(t.id)!,
      projectId: targetProjectId,
      parentId: t.parentId ? (idMap.get(t.parentId) ?? null) : null,
      assigneeIds: t.assigneeIds.filter((id) => resourceIds.has(id)),
      sprintId: undefined,
      cycleId: undefined,
    }));

    const targetTasks = [...(this.mem.tasks.get(targetProjectId) ?? []), ...remapped];
    await this.setTasks(targetProjectId, targetTasks);

    if (this.useDb) {
      await this.db.task.deleteMany({
        where: { id: { in: [...toMoveIds] }, projectId: sourceProjectId },
      });
    }

    return remapped.find((t) => t.id === idMap.get(taskId)) ?? null;
  }

  getCustomColumns(projectId: string): CustomColumn[] {
    return this.mem.customColumns.get(projectId) ?? [];
  }

  async createCustomColumn(input: Omit<CustomColumn, "id"> & { id?: string }): Promise<CustomColumn> {
    const col: CustomColumn = { ...input, id: input.id ?? uuid() };
    const list = this.mem.customColumns.get(col.projectId) ?? [];
    list.push(col);
    this.mem.customColumns.set(col.projectId, list);
    if (this.useDb) {
      await this.db.customColumnDef.create({
        data: {
          id: col.id,
          projectId: col.projectId,
          key: col.key,
          label: col.label,
          type: col.type,
          options: col.options ?? undefined,
        },
      });
    }
    return col;
  }

  getSprints(projectId: string): Sprint[] {
    return this.mem.sprints.get(projectId) ?? [];
  }

  async createSprint(input: Omit<Sprint, "id"> & { id?: string }): Promise<Sprint> {
    const sprint: Sprint = { ...input, id: input.id ?? uuid() };
    const list = this.mem.sprints.get(sprint.projectId) ?? [];
    list.push(sprint);
    this.mem.sprints.set(sprint.projectId, list);
    if (this.useDb) {
      await this.db.sprint.create({ data: sprint });
    }
    return sprint;
  }

  async updateSprint(projectId: string, sprintId: string, patch: Partial<Sprint>): Promise<Sprint | null> {
    const list = this.mem.sprints.get(projectId) ?? [];
    const idx = list.findIndex((s) => s.id === sprintId);
    if (idx < 0) return null;
    list[idx] = { ...list[idx]!, ...patch };
    if (this.useDb) {
      await this.db.sprint.update({ where: { id: sprintId }, data: patch });
    }
    return list[idx]!;
  }

  getSprintVelocity(projectId: string, sprintId: string): SprintVelocity | null {
    const sprint = this.getSprints(projectId).find((s) => s.id === sprintId);
    if (!sprint) return null;
    const tasks = this.getTasks(projectId).filter((t) => t.sprintId === sprintId);
    const points = (t: Task) => t.storyPoints ?? 0;
    return {
      sprintId,
      sprintName: sprint.name,
      committedPoints: tasks.reduce((s, t) => s + points(t), 0),
      completedPoints: tasks
        .filter((t) => t.status === "completed")
        .reduce((s, t) => s + points(t), 0),
    };
  }

  getCycles(projectId: string): Cycle[] {
    return this.mem.cycles.get(projectId) ?? [];
  }

  async createCycle(input: Omit<Cycle, "id"> & { id?: string }): Promise<Cycle> {
    const cycle: Cycle = { ...input, id: input.id ?? uuid() };
    const list = this.mem.cycles.get(cycle.projectId) ?? [];
    list.push(cycle);
    this.mem.cycles.set(cycle.projectId, list);
    if (this.useDb) {
      await this.db.cycle.create({ data: cycle });
    }
    return cycle;
  }

  getProjectForms(projectId: string): ProjectForm[] {
    return this.mem.projectForms.get(projectId) ?? [];
  }

  getFormBySlug(slug: string): ProjectForm | undefined {
    for (const forms of this.mem.projectForms.values()) {
      const f = forms.find((x) => x.slug === slug && x.enabled);
      if (f) return f;
    }
    return undefined;
  }

  async createProjectForm(input: Omit<ProjectForm, "id"> & { id?: string }): Promise<ProjectForm> {
    const form: ProjectForm = { ...input, id: input.id ?? uuid() };
    const list = this.mem.projectForms.get(form.projectId) ?? [];
    list.push(form);
    this.mem.projectForms.set(form.projectId, list);
    if (this.useDb) {
      await this.db.projectForm.create({
        data: { ...form, fields: form.fields as object },
      });
    }
    return form;
  }

  getSavedViews(projectId: string, userId?: string): SavedView[] {
    const list = this.mem.savedViews.get(projectId) ?? [];
    if (!userId) return list;
    return list.filter((v) => !v.userId || v.userId === userId);
  }

  async createSavedView(input: Omit<SavedView, "id"> & { id?: string }): Promise<SavedView> {
    const view: SavedView = { ...input, id: input.id ?? uuid() };
    const list = this.mem.savedViews.get(view.projectId) ?? [];
    list.push(view);
    this.mem.savedViews.set(view.projectId, list);
    if (this.useDb) {
      await this.db.savedView.create({
        data: { ...view, filters: view.filters as object },
      });
    }
    return view;
  }

  async generateRecurringTasks(
    projectId: string,
    base: Omit<Task, "id">,
    rule: RecurrenceRule,
  ): Promise<Task[]> {
    const seriesId = uuid();
    const count = Math.min(rule.count ?? 12, 52);
    const created: Task[] = [];
    let start = new Date(base.startDate);
    let end = new Date(base.endDate);
    const durationMs = end.getTime() - start.getTime();

    for (let i = 0; i < count; i++) {
      if (i > 0) {
        if (rule.frequency === "daily") {
          start.setDate(start.getDate() + rule.interval);
          end = new Date(start.getTime() + durationMs);
        } else if (rule.frequency === "weekly") {
          start.setDate(start.getDate() + 7 * rule.interval);
          end = new Date(start.getTime() + durationMs);
        } else {
          start.setMonth(start.getMonth() + rule.interval);
          end = new Date(start.getTime() + durationMs);
        }
        if (rule.until && start.toISOString().slice(0, 10) > rule.until) break;
      }
      const task: Task = {
        ...base,
        id: uuid(),
        projectId,
        seriesId,
        recurrenceRule: i === 0 ? rule : undefined,
        name: count > 1 ? `${base.name} #${i + 1}` : base.name,
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        sortOrder: base.sortOrder + i,
      };
      await this.createTask(projectId, task);
      created.push(task);
    }
    return created;
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
      const exists = await this.db.organization.findUnique({
        where: { id: this.mem.organizationId },
      });
      if (exists) return this.mem.organizationId;
    }

    if (this.useDb) {
      const org = await this.db.organization.findFirst();
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
      await this.db.organization.create({
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
      parentId: dto.parentId ?? null,
      isTemplate: dto.isTemplate ?? false,
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
    this.mem.customColumns.set(project.id, []);
    this.mem.sprints.set(project.id, []);
    this.mem.cycles.set(project.id, []);
    this.mem.projectForms.set(project.id, []);
    this.mem.savedViews.set(project.id, []);
    this.mem.automationRules.set(project.id, []);
    this.mem.activityLogs.set(project.id, []);
    this.mem.projectMessages.set(project.id, []);
    this.mem.wikiPages.set(project.id, []);
    this.mem.projectGuests.set(project.id, []);
    this.mem.customReports.set(project.id, []);
    this.mem.webhookSubscriptions.set(project.id, []);
    this.mem.goals.set(project.id, []);
    this.mem.keyResults.set(project.id, []);
    this.mem.whiteboardItems.set(project.id, []);
    this.mem.projectIntegrations.set(project.id, { projectId: project.id });

    if (this.useDb) {
      await this.db.project.create({ data: prismaProjectData(project) });
    }
    return project;
  }

  logActivity(entry: Omit<ActivityLogEntry, "id" | "createdAt">) {
    const row: ActivityLogEntry = {
      ...entry,
      id: uuid(),
      createdAt: new Date().toISOString(),
    };
    const list = this.mem.activityLogs.get(entry.projectId) ?? [];
    list.unshift(row);
    if (list.length > 500) list.length = 500;
    this.mem.activityLogs.set(entry.projectId, list);
    if (this.useDb) {
      void this.db.activityLog.create({
        data: { ...row, createdAt: new Date(row.createdAt) },
      });
    }
    return row;
  }

  getActivityLogs(projectId: string, limit = 100): ActivityLogEntry[] {
    return (this.mem.activityLogs.get(projectId) ?? []).slice(0, limit);
  }

  getAutomationRules(projectId: string): AutomationRule[] {
    return this.mem.automationRules.get(projectId) ?? [];
  }

  async createAutomationRule(rule: AutomationRule): Promise<AutomationRule> {
    const list = this.mem.automationRules.get(rule.projectId) ?? [];
    list.push(rule);
    this.mem.automationRules.set(rule.projectId, list);
    if (this.useDb) {
      await this.db.automationRule.create({
        data: {
          ...rule,
          triggerValue: rule.triggerValue as object | undefined,
          actionPayload: rule.actionPayload as object | undefined,
        },
      });
    }
    return rule;
  }

  getProjectMessages(projectId: string): ProjectMessage[] {
    return this.mem.projectMessages.get(projectId) ?? [];
  }

  async addProjectMessage(msg: Omit<ProjectMessage, "id" | "createdAt">): Promise<ProjectMessage> {
    const row: ProjectMessage = {
      ...msg,
      id: uuid(),
      createdAt: new Date().toISOString(),
    };
    const list = this.mem.projectMessages.get(msg.projectId) ?? [];
    list.push(row);
    this.mem.projectMessages.set(msg.projectId, list);
    if (this.useDb) {
      await this.db.projectMessage.create({
        data: { ...row, createdAt: new Date(row.createdAt) },
      });
    }
    return row;
  }

  getWikiPages(projectId: string): ProjectWikiPage[] {
    return this.mem.wikiPages.get(projectId) ?? [];
  }

  async upsertWikiPage(
    projectId: string,
    body: { id?: string; title: string; content: string },
  ): Promise<ProjectWikiPage> {
    const list = this.mem.wikiPages.get(projectId) ?? [];
    const existing = body.id ? list.find((p) => p.id === body.id) : undefined;
    const page: ProjectWikiPage = existing
      ? { ...existing, title: body.title, content: body.content, updatedAt: new Date().toISOString() }
      : {
          id: uuid(),
          projectId,
          title: body.title,
          content: body.content,
          updatedAt: new Date().toISOString(),
        };
    if (existing) {
      const idx = list.findIndex((p) => p.id === page.id);
      list[idx] = page;
    } else {
      list.push(page);
    }
    this.mem.wikiPages.set(projectId, list);
    if (this.useDb) {
      await this.db.projectWikiPage.upsert({
        where: { id: page.id },
        create: { ...page, updatedAt: new Date(page.updatedAt) },
        update: { title: page.title, content: page.content, updatedAt: new Date(page.updatedAt) },
      });
    }
    return page;
  }

  getProjectGuests(projectId: string): ProjectGuest[] {
    return this.mem.projectGuests.get(projectId) ?? [];
  }

  getGuestByToken(token: string): ProjectGuest | undefined {
    for (const guests of this.mem.projectGuests.values()) {
      const g = guests.find((x) => x.token === token);
      if (g) return g;
    }
    return undefined;
  }

  async createProjectGuest(
    input: Omit<ProjectGuest, "id" | "token" | "createdAt">,
  ): Promise<ProjectGuest> {
    const guest: ProjectGuest = {
      ...input,
      id: uuid(),
      token: uuid().replace(/-/g, ""),
      createdAt: new Date().toISOString(),
    };
    const list = this.mem.projectGuests.get(input.projectId) ?? [];
    list.push(guest);
    this.mem.projectGuests.set(input.projectId, list);
    if (this.useDb) {
      await this.db.projectGuest.create({
        data: { ...guest, createdAt: new Date(guest.createdAt) },
      });
    }
    return guest;
  }

  getCustomReports(projectId: string): import("@nexus/shared").CustomReport[] {
    return this.mem.customReports.get(projectId) ?? [];
  }

  async createCustomReport(
    input: Omit<import("@nexus/shared").CustomReport, "id" | "createdAt">,
  ): Promise<import("@nexus/shared").CustomReport> {
    const report: import("@nexus/shared").CustomReport = {
      ...input,
      id: uuid(),
      createdAt: new Date().toISOString(),
    };
    const list = this.mem.customReports.get(input.projectId) ?? [];
    list.push(report);
    this.mem.customReports.set(input.projectId, list);
    if (this.useDb) {
      await this.db.customReport.create({
        data: { ...report, widgets: report.widgets as object },
      });
    }
    return report;
  }

  getWebhooks(projectId: string): import("@nexus/shared").WebhookSubscription[] {
    return this.mem.webhookSubscriptions.get(projectId) ?? [];
  }

  async createWebhook(
    input: Omit<import("@nexus/shared").WebhookSubscription, "id">,
  ): Promise<import("@nexus/shared").WebhookSubscription> {
    const hook: import("@nexus/shared").WebhookSubscription = { ...input, id: uuid() };
    const list = this.mem.webhookSubscriptions.get(input.projectId) ?? [];
    list.push(hook);
    this.mem.webhookSubscriptions.set(input.projectId, list);
    if (this.useDb) {
      await this.db.webhookSubscription.create({
        data: { ...hook, events: hook.events as object },
      });
    }
    return hook;
  }

  getProjectIntegrations(projectId: string): import("@nexus/shared").ProjectIntegrations {
    return this.mem.projectIntegrations.get(projectId) ?? { projectId };
  }

  setProjectIntegrations(settings: import("@nexus/shared").ProjectIntegrations): void {
    this.mem.projectIntegrations.set(settings.projectId, settings);
  }

  getGoals(projectId: string): import("@nexus/shared").Goal[] {
    return this.mem.goals.get(projectId) ?? [];
  }

  async createGoal(
    input: Omit<import("@nexus/shared").Goal, "id" | "progress"> & { progress?: number },
  ): Promise<import("@nexus/shared").Goal> {
    const goal: import("@nexus/shared").Goal = {
      ...input,
      id: uuid(),
      progress: input.progress ?? 0,
    };
    const list = this.mem.goals.get(input.projectId) ?? [];
    list.push(goal);
    this.mem.goals.set(input.projectId, list);
    if (this.useDb) {
      await this.db.goal.create({ data: goal });
    }
    return goal;
  }

  getKeyResults(projectId: string, goalId?: string): import("@nexus/shared").KeyResult[] {
    const all = this.mem.keyResults.get(projectId) ?? [];
    return goalId ? all.filter((k) => k.goalId === goalId) : all;
  }

  async createKeyResult(
    input: Omit<import("@nexus/shared").KeyResult, "id" | "currentValue"> & { currentValue?: number },
  ): Promise<import("@nexus/shared").KeyResult> {
    const kr: import("@nexus/shared").KeyResult = {
      ...input,
      id: uuid(),
      currentValue: input.currentValue ?? 0,
    };
    const list = this.mem.keyResults.get(input.projectId) ?? [];
    list.push(kr);
    this.mem.keyResults.set(input.projectId, list);
    if (this.useDb) {
      await this.db.keyResult.create({ data: kr });
    }
    return kr;
  }

  async updateKeyResult(
    projectId: string,
    krId: string,
    patch: Partial<import("@nexus/shared").KeyResult>,
  ): Promise<import("@nexus/shared").KeyResult | null> {
    const list = this.mem.keyResults.get(projectId) ?? [];
    const idx = list.findIndex((k) => k.id === krId);
    if (idx < 0) return null;
    list[idx] = { ...list[idx]!, ...patch };
    this.mem.keyResults.set(projectId, list);
    if (this.useDb) {
      await this.db.keyResult.update({
        where: { id: krId },
        data: {
          title: list[idx]!.title,
          targetValue: list[idx]!.targetValue,
          currentValue: list[idx]!.currentValue,
          unit: list[idx]!.unit ?? null,
        },
      });
    }
    return list[idx]!;
  }

  getWhiteboardItems(projectId: string): import("@nexus/shared").WhiteboardItem[] {
    return this.mem.whiteboardItems.get(projectId) ?? [];
  }

  async upsertWhiteboardItem(
    projectId: string,
    body: Partial<import("@nexus/shared").WhiteboardItem> & {
      id?: string;
      text: string;
      x: number;
      y: number;
    },
  ): Promise<import("@nexus/shared").WhiteboardItem> {
    const list = this.mem.whiteboardItems.get(projectId) ?? [];
    const existing = body.id ? list.find((i) => i.id === body.id) : undefined;
    const item: import("@nexus/shared").WhiteboardItem = existing
      ? {
          ...existing,
          ...body,
          projectId,
        }
      : {
          id: uuid(),
          projectId,
          x: body.x,
          y: body.y,
          width: body.width ?? 160,
          height: body.height ?? 100,
          text: body.text,
          color: body.color ?? "#fef08a",
        };
    if (existing) {
      const idx = list.findIndex((i) => i.id === item.id);
      list[idx] = item;
    } else {
      list.push(item);
    }
    this.mem.whiteboardItems.set(projectId, list);
    if (this.useDb) {
      await this.db.whiteboardItem.upsert({
        where: { id: item.id },
        create: item,
        update: {
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          text: item.text,
          color: item.color,
        },
      });
    }
    return item;
  }

  async deleteWhiteboardItem(projectId: string, itemId: string): Promise<boolean> {
    const list = this.mem.whiteboardItems.get(projectId) ?? [];
    const next = list.filter((i) => i.id !== itemId);
    if (next.length === list.length) return false;
    this.mem.whiteboardItems.set(projectId, next);
    if (this.useDb) {
      await this.db.whiteboardItem.delete({ where: { id: itemId } }).catch(() => undefined);
    }
    return true;
  }

  findProjectByZapierToken(token: string): string | undefined {
    for (const [projectId, settings] of this.mem.projectIntegrations) {
      if (settings.zapierHookToken === token) return projectId;
    }
    return undefined;
  }

  findProjectByEmailSecret(projectId: string, secret: string): boolean {
    const settings = this.mem.projectIntegrations.get(projectId);
    return Boolean(settings?.emailInboundSecret && settings.emailInboundSecret === secret);
  }

  getResourcePtos(resourceId?: string): import("@nexus/shared").ResourcePto[] {
    const all = this.mem.resourcePtos;
    return resourceId ? all.filter((p) => p.resourceId === resourceId) : all;
  }

  async createResourcePto(
    input: Omit<import("@nexus/shared").ResourcePto, "id">,
  ): Promise<import("@nexus/shared").ResourcePto> {
    const row: import("@nexus/shared").ResourcePto = { ...input, id: uuid() };
    this.mem.resourcePtos.push(row);
    return row;
  }

  matchResourcesBySkills(orgId: string, required: string[]): Resource[] {
    const need = required.map((s) => s.toLowerCase());
    return this.getResources(orgId).filter((r) => {
      const skills = (r.skills ?? []).map((s) => s.toLowerCase());
      return need.every((n) => skills.some((s) => s.includes(n) || n.includes(s)));
    });
  }

  ptoHoursOnDate(resourceId: string, date: string): number {
    const pto = this.mem.resourcePtos.filter(
      (p) => p.resourceId === resourceId && p.startDate <= date && p.endDate >= date,
    );
    return pto.length > 0 ? 8 : 0;
  }

  writeAudit(entry: Omit<import("@nexus/shared").AuditLogEntry, "id" | "createdAt">) {
    const row: import("@nexus/shared").AuditLogEntry = {
      ...entry,
      id: uuid(),
      createdAt: new Date().toISOString(),
    };
    this.mem.auditLogs.unshift(row);
    const orgLogs = this.mem.auditLogs.filter((a) => a.organizationId === entry.organizationId);
    if (orgLogs.length > 500) {
      const drop = orgLogs.length - 500;
      let removed = 0;
      for (let i = this.mem.auditLogs.length - 1; i >= 0 && removed < drop; i--) {
        if (this.mem.auditLogs[i]!.organizationId === entry.organizationId) {
          this.mem.auditLogs.splice(i, 1);
          removed++;
        }
      }
    }
    if (this.useDb) {
      void this.db.auditLog
        .create({
          data: {
            id: row.id,
            organizationId: row.organizationId,
            userId: row.userId,
            userName: row.userName,
            action: row.action,
            entityType: row.entityType,
            entityId: row.entityId,
            summary: row.summary,
            metadata: (row.metadata ?? undefined) as object | undefined,
            createdAt: new Date(row.createdAt),
          },
        })
        .catch(() => undefined);
    }
    return row;
  }

  getAuditLogs(organizationId: string, limit = 200): import("@nexus/shared").AuditLogEntry[] {
    return this.mem.auditLogs.filter((a) => a.organizationId === organizationId).slice(0, limit);
  }

  getTaskPermissions(projectId: string, taskId?: string): import("@nexus/shared").TaskPermission[] {
    const all = this.mem.taskPermissions.filter((p) => p.projectId === projectId);
    return taskId ? all.filter((p) => p.taskId === taskId) : all;
  }

  setTaskPermission(input: Omit<import("@nexus/shared").TaskPermission, "id">): import("@nexus/shared").TaskPermission {
    const existing = this.mem.taskPermissions.findIndex(
      (p) => p.taskId === input.taskId && p.userId === input.userId,
    );
    const row: import("@nexus/shared").TaskPermission = { ...input, id: uuid() };
    if (existing >= 0) this.mem.taskPermissions[existing] = row;
    else this.mem.taskPermissions.push(row);
    return row;
  }

  canAccessTask(
    userId: string,
    projectId: string,
    taskId: string,
    level: import("@nexus/shared").TaskPermissionLevel,
  ): boolean {
    const perms = this.getTaskPermissions(projectId, taskId);
    if (perms.length === 0) return true;
    const userPerm = perms.find((p) => p.userId === userId);
    if (!userPerm) return false;
    const rank = { read: 1, write: 2, admin: 3 };
    return rank[userPerm.level] >= rank[level];
  }

  getPrograms(organizationId: string): import("@nexus/shared").Program[] {
    return this.mem.programs.filter((p) => p.organizationId === organizationId);
  }

  createProgram(input: Omit<import("@nexus/shared").Program, "id">): import("@nexus/shared").Program {
    const row: import("@nexus/shared").Program = { ...input, id: uuid() };
    this.mem.programs.push(row);
    if (this.useDb) {
      void this.db.program
        .create({
          data: {
            id: row.id,
            organizationId: row.organizationId,
            name: row.name,
            description: row.description,
            projectIds: row.projectIds,
            startDate: row.startDate,
            endDate: row.endDate,
          },
        })
        .catch(() => undefined);
    }
    return row;
  }

  getInvoices(organizationId: string): import("@nexus/shared").Invoice[] {
    return this.mem.invoices.filter((i) => i.organizationId === organizationId);
  }

  createInvoice(
    input: Omit<import("@nexus/shared").Invoice, "id" | "createdAt" | "total"> & {
      lines: import("@nexus/shared").InvoiceLine[];
    },
  ): import("@nexus/shared").Invoice {
    const total = input.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const row: import("@nexus/shared").Invoice = {
      ...input,
      id: uuid(),
      total,
      createdAt: new Date().toISOString(),
    };
    this.mem.invoices.push(row);
    if (this.useDb) {
      void this.db.invoice
        .create({
          data: {
            id: row.id,
            organizationId: row.organizationId,
            projectId: row.projectId,
            clientName: row.clientName,
            clientEmail: row.clientEmail,
            status: row.status,
            currency: row.currency,
            lines: JSON.parse(JSON.stringify(row.lines)),
            total: row.total,
            dueDate: row.dueDate,
          },
        })
        .catch(() => undefined);
    }
    return row;
  }

  getProofAssets(projectId: string): import("@nexus/shared").ProofAsset[] {
    return this.mem.proofAssets.filter((p) => p.projectId === projectId);
  }

  createProofAsset(
    input: Omit<import("@nexus/shared").ProofAsset, "id" | "createdAt" | "status">,
  ): import("@nexus/shared").ProofAsset {
    const row: import("@nexus/shared").ProofAsset = {
      ...input,
      id: uuid(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.mem.proofAssets.push(row);
    return row;
  }

  updateProofAsset(
    id: string,
    patch: Partial<import("@nexus/shared").ProofAsset>,
  ): import("@nexus/shared").ProofAsset | null {
    const idx = this.mem.proofAssets.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    this.mem.proofAssets[idx] = { ...this.mem.proofAssets[idx]!, ...patch };
    return this.mem.proofAssets[idx]!;
  }

  getCrmContacts(organizationId: string): import("@nexus/shared").CrmContact[] {
    return this.mem.crmContacts.filter((c) => c.organizationId === organizationId);
  }

  createCrmContact(
    input: Omit<import("@nexus/shared").CrmContact, "id">,
  ): import("@nexus/shared").CrmContact {
    const row: import("@nexus/shared").CrmContact = { ...input, id: uuid() };
    this.mem.crmContacts.push(row);
    return row;
  }

  getCrmDeals(organizationId: string): import("@nexus/shared").CrmDeal[] {
    return this.mem.crmDeals.filter((d) => d.organizationId === organizationId);
  }

  createCrmDeal(input: Omit<import("@nexus/shared").CrmDeal, "id">): import("@nexus/shared").CrmDeal {
    const row: import("@nexus/shared").CrmDeal = { ...input, id: uuid() };
    this.mem.crmDeals.push(row);
    return row;
  }

  getOrgAutomationRules(organizationId: string): import("@nexus/shared").OrgAutomationRule[] {
    return this.mem.orgAutomationRules.filter((r) => r.organizationId === organizationId);
  }

  createOrgAutomationRule(
    input: Omit<import("@nexus/shared").OrgAutomationRule, "id">,
  ): import("@nexus/shared").OrgAutomationRule {
    const row: import("@nexus/shared").OrgAutomationRule = { ...input, id: uuid() };
    this.mem.orgAutomationRules.push(row);
    return row;
  }

  getSubscriptionPlans(): import("@nexus/shared").SubscriptionPlan[] {
    return this.mem.subscriptionPlans;
  }

  setUserTotp(userId: string, secret: string, enabled: boolean): void {
    const u = this.mem.users.get(userId);
    if (!u) return;
    u.totpSecret = secret || undefined;
    u.totpEnabled = enabled;
    if (this.useDb) {
      void this.db.user.update({
        where: { id: userId },
        data: { totpSecret: secret || null, totpEnabled: enabled },
      });
    }
  }

  getUserTotp(userId: string): { secret?: string; enabled: boolean } {
    const u = this.mem.users.get(userId);
    return { secret: u?.totpSecret, enabled: !!u?.totpEnabled };
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

  getTask(projectId: string, taskId: string): Task | undefined {
    return this.mem.tasks.get(projectId)?.find((t) => t.id === taskId);
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
      await this.db.project.update({
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
          parentId: updated.parentId ?? null,
          isTemplate: updated.isTemplate ?? false,
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
      await this.db.budgetLineItem.create({
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
      await this.db.budgetLineItem.update({
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
      await this.db.budgetLineItem.deleteMany({ where: { id: lineId, projectId } });
    }
    return true;
  }

  async addResource(orgId: string, dto: Omit<Resource, "id" | "organizationId">): Promise<Resource> {
    const resource: Resource = { id: uuid(), organizationId: orgId, ...dto };
    const list = this.mem.resources.get(orgId) ?? [];
    list.push(resource);
    this.mem.resources.set(orgId, list);
    if (this.useDb) await this.db.resource.create({ data: resource });
    return resource;
  }

  async addProjectMember(member: ProjectMember): Promise<ProjectMember> {
    const list = this.mem.projectMembers.get(member.projectId) ?? [];
    list.push(member);
    this.mem.projectMembers.set(member.projectId, list);
    if (this.useDb) {
      await this.db.projectMember.create({
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
      await this.db.projectMember.update({
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
      await this.db.resource.update({
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
      await this.db.resourceAssignment.create({
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
    if (this.useDb) await this.db.taskDependency.create({ data: dep });
    return dep;
  }

  async removeDependency(projectId: string, depId: string): Promise<boolean> {
    const deps = this.mem.dependencies.get(projectId) ?? [];
    const next = deps.filter((d) => d.id !== depId);
    if (next.length === deps.length) return false;
    this.mem.dependencies.set(projectId, next);
    if (this.useDb) {
      await this.db.taskDependency.deleteMany({ where: { id: depId, projectId } });
    }
    return true;
  }

  async saveBaseline(baseline: Baseline) {
    const list = this.mem.baselines.get(baseline.projectId) ?? [];
    list.push(baseline);
    this.mem.baselines.set(baseline.projectId, list);
    if (this.useDb) {
      await this.db.baseline.create({
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
      await this.db.timesheetEntry.create({
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
      await this.db.timesheetEntry.updateMany({
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
      await this.db.notification.create({
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
      await this.db.task.createMany({ data: newTasks.map(taskToPrismaCreate) });
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
      await this.db.taskDependency.deleteMany({
        where: {
          projectId,
          OR: [{ predecessorId: { in: ids } }, { successorId: { in: ids } }],
        },
      });
      await this.db.resourceAssignment.deleteMany({
        where: { projectId, taskId: { in: ids } },
      });
      await this.db.task.deleteMany({ where: { id: { in: ids }, projectId } });
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
      await this.db.projectRisk.deleteMany({ where: { projectId } }).catch(() => undefined);
      await this.db.changeRequest.deleteMany({ where: { projectId } }).catch(() => undefined);
      await this.db.rejectionLog.deleteMany({ where: { projectId } }).catch(() => undefined);
      await this.db.task.deleteMany({ where: { projectId } });
      await this.db.taskDependency.deleteMany({ where: { projectId } });
      await this.db.resourceAssignment.deleteMany({ where: { projectId } });
      await this.db.baseline.deleteMany({ where: { projectId } });
      await this.db.budgetLineItem.deleteMany({ where: { projectId } });
      await this.db.timesheetEntry.deleteMany({ where: { projectId } });
      await this.db.projectMember.deleteMany({ where: { projectId } });
      await this.db.project.delete({ where: { id: projectId } });
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
      await this.db.projectRisk
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
      await this.db.projectRisk
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
      await this.db.projectRisk.delete({ where: { id: riskId } }).catch(() => undefined);
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
      await this.db.changeRequest
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
      await this.db.changeRequest
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
      await this.db.changeRequest.delete({ where: { id: crId } }).catch(() => undefined);
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
      await this.db.rejectionLog
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
      await this.db.rejectionLog.delete({ where: { id: logId } }).catch(() => undefined);
    }
    return true;
  }
}
