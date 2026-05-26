import type {
  Project,
  ProjectMember,
  Task,
  TaskDependency,
  DependencyType,
  EVMMetrics,
  Baseline,
  ExecutivePortfolioSummary,
  ProjectRisk,
  RiskSuggestion,
  ChangeRequest,
  RejectionRecord,
  RejectionSuggestion,
  ManualRejectionCategory,
  ResourceCapacityRow,
  PortfolioSimulateResult,
  ExecutiveSummary,
  LevelingSuggestion,
  Resource,
  ResourceAssignment,
  Notification,
  TimesheetEntry,
  ProjectStatusReport,
  ResourceLoadReport,
  CashFlowReport,
  BudgetOverviewReport,
  BudgetLineItem,
  BaselineVarianceReport,
  WhatIfReport,
  ScheduleCurvePoint,
  ProjectForecastReport,
} from "@nexus/shared";
import type { AllocationSlot } from "@nexus/shared";

const BASE = "/api";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status >= 500 && (!text || text.includes("ECONNREFUSED") || text.includes("proxy"))) {
      throw new Error(
        "השרת (API) לא זמין. הרץ מהשורש: pnpm dev — או בנפרד: cd packages/api && pnpm dev",
      );
    }
    throw new Error(text || `HTTP ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  projects: () => fetchJson<Project[]>("/projects"),
  project: (id: string) => fetchJson<Project>(`/projects/${id}`),
  createProject: (body: Partial<Project>) =>
    fetchJson<Project>("/projects", { method: "POST", body: JSON.stringify(body) }),
  updateProject: (id: string, body: Partial<Project>) =>
    fetchJson<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteProject: (id: string) =>
    fetchJson<{ deleted: boolean }>(`/projects/${id}`, { method: "DELETE" }),
  team: (projectId: string) =>
    fetchJson<{
      project: Project;
      resources: Resource[];
      members: ProjectMember[];
      assignments: ResourceAssignment[];
    }>(`/projects/${projectId}/team`),
  addTeamMember: (
    projectId: string,
    body: {
      name: string;
      email?: string;
      role: ProjectMember["role"];
      costPerHour?: number;
      costPerUnit?: number;
      hoursPerDay?: number;
    },
  ) =>
    fetchJson<{ resource: Resource; member: ProjectMember }>(
      `/projects/${projectId}/team/members`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  updateTeamMember: (
    projectId: string,
    memberId: string,
    body: {
      role?: ProjectMember["role"];
      hoursPerDay?: number;
      costPerHour?: number | null;
      costPerUnit?: number | null;
      name?: string;
      email?: string;
    },
  ) =>
    fetchJson<{ resource: Resource; member: ProjectMember }>(
      `/projects/${projectId}/team/members/${memberId}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ),
  assignToTask: (
    projectId: string,
    taskId: string,
    body: { resourceId: string; workHours: number; units?: number },
  ) =>
    fetchJson<ResourceAssignment>(
      `/projects/${projectId}/team/tasks/${taskId}/assign`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  addDependency: (
    projectId: string,
    body: { predecessorId: string; successorId: string; type: DependencyType; lagDays?: number },
  ) =>
    fetchJson<TaskDependency>(`/projects/${projectId}/tasks/dependencies`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  removeDependency: (projectId: string, depId: string) =>
    fetchJson<{ removed: boolean }>(
      `/projects/${projectId}/tasks/dependencies/${depId}`,
      { method: "DELETE" },
    ),
  portfolio: () => fetchJson<ExecutivePortfolioSummary>("/portfolio/executive"),
  portfolioSimulate: (body: { extraHoursPerWeek?: number }) =>
    fetchJson<PortfolioSimulateResult>("/portfolio/simulate-load", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  executiveSummary: () => fetchJson<ExecutiveSummary>("/ai/executive-summary"),
  listRejections: (projectId?: string) =>
    fetchJson<RejectionRecord[]>(
      projectId ? `/rejections?projectId=${encodeURIComponent(projectId)}` : "/rejections",
    ),
  rejectionSuggestions: (projectId: string) =>
    fetchJson<RejectionSuggestion[]>(
      `/rejections/suggestions?projectId=${encodeURIComponent(projectId)}`,
    ),
  createRejection: (body: {
    projectId: string;
    title: string;
    description?: string;
    category: ManualRejectionCategory;
    rejectedAt: string;
    decisionNote?: string;
    impactScheduleDays?: number;
    impactCost?: number;
    taskId?: string;
  }) =>
    fetchJson<RejectionRecord>("/rejections", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteRejection: (id: string) =>
    fetchJson<{ ok: boolean }>(`/rejections/${encodeURIComponent(id)}`, { method: "DELETE" }),
  listRisks: (projectId: string) => fetchJson<ProjectRisk[]>(`/projects/${projectId}/risks`),
  riskSuggestions: (projectId: string) =>
    fetchJson<RiskSuggestion[]>(`/projects/${projectId}/risks/suggestions`),
  createRisk: (
    projectId: string,
    body: Pick<
      ProjectRisk,
      "title" | "category" | "probability" | "impact" | "description" | "responsePlan"
    > & {
      source?: ProjectRisk["source"];
      ownerResourceId?: string;
      taskId?: string;
    },
  ) =>
    fetchJson<ProjectRisk>(`/projects/${projectId}/risks`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createRiskFromSuggestion: (projectId: string, suggestion: RiskSuggestion) =>
    fetchJson<ProjectRisk>(`/projects/${projectId}/risks/from-suggestion`, {
      method: "POST",
      body: JSON.stringify(suggestion),
    }),
  updateRisk: (
    projectId: string,
    riskId: string,
    body: Partial<
      Pick<
        ProjectRisk,
        | "title"
        | "description"
        | "category"
        | "probability"
        | "impact"
        | "status"
        | "ownerResourceId"
        | "responsePlan"
      >
    >,
  ) =>
    fetchJson<ProjectRisk>(`/projects/${projectId}/risks/${riskId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  listChanges: (projectId: string) =>
    fetchJson<ChangeRequest[]>(`/projects/${projectId}/changes`),
  createChange: (
    projectId: string,
    body: Pick<ChangeRequest, "title" | "impactScheduleDays" | "impactCost"> & {
      description?: string;
      requestedBy?: string;
    },
  ) =>
    fetchJson<ChangeRequest>(`/projects/${projectId}/changes`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  submitChange: (projectId: string, changeId: string) =>
    fetchJson<ChangeRequest>(`/projects/${projectId}/changes/${changeId}/submit`, {
      method: "POST",
    }),
  approveChange: (projectId: string, changeId: string, decisionNote?: string) =>
    fetchJson<ChangeRequest>(`/projects/${projectId}/changes/${changeId}/approve`, {
      method: "POST",
      body: JSON.stringify({ decisionNote }),
    }),
  rejectChange: (projectId: string, changeId: string, decisionNote?: string) =>
    fetchJson<ChangeRequest>(`/projects/${projectId}/changes/${changeId}/reject`, {
      method: "POST",
      body: JSON.stringify({ decisionNote }),
    }),
  resourceCapacity: (projectId: string, from: string, to: string) =>
    fetchJson<ResourceCapacityRow[]>(
      `/projects/${projectId}/resources/capacity?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  tasks: (projectId: string) =>
    fetchJson<{ tasks: Task[]; dependencies: TaskDependency[] }>(
      `/projects/${projectId}/tasks`,
    ),
  createTask: (
    projectId: string,
    body: Partial<Task> & {
      subtasks?: Array<{
        name: string;
        startDate: string;
        endDate: string;
        durationDays?: number;
        assigneeId?: string;
        kind?: "T" | "M";
      }>;
    },
  ) =>
    fetchJson<Task | { parent: Task; children: Task[] }>(`/projects/${projectId}/tasks`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateTask: (projectId: string, taskId: string, body: Partial<Task>) =>
    fetchJson<Task>(`/projects/${projectId}/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteTask: (projectId: string, taskId: string) =>
    fetchJson<{ deletedIds: string[] }>(`/projects/${projectId}/tasks/${taskId}`, {
      method: "DELETE",
    }),
  pauseTask: (
    projectId: string,
    taskId: string,
    body: { resumeDate: string; remainingWorkDays?: number; transferToTaskId?: string },
  ) =>
    fetchJson<Task>(`/projects/${projectId}/tasks/pause`, {
      method: "POST",
      body: JSON.stringify({ taskId, ...body }),
    }),
  resumeTask: (projectId: string, taskId: string) =>
    fetchJson<Task>(`/projects/${projectId}/tasks/resume`, {
      method: "POST",
      body: JSON.stringify({ taskId }),
    }),
  recalculate: (projectId: string) =>
    fetchJson<{ tasks: Task[]; criticalPathIds: string[]; projectEnd: string }>(
      `/projects/${projectId}/tasks/recalculate`,
      { method: "POST" },
    ),
  baselines: (projectId: string) =>
    fetchJson<Baseline[]>(`/projects/${projectId}/tasks/baselines`),
  saveBaseline: (projectId: string, name: string) =>
    fetchJson<Baseline>(`/projects/${projectId}/tasks/baselines`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  evm: (projectId: string) => fetchJson<EVMMetrics>(`/projects/${projectId}/evm`),
  resources: (projectId: string) =>
    fetchJson<{ resources: Resource[]; assignments: ResourceAssignment[] }>(
      `/projects/${projectId}/resources`,
    ),
  histogram: (projectId: string, from: string, to: string) =>
    fetchJson<AllocationSlot[]>(
      `/projects/${projectId}/resources/histogram?from=${from}&to=${to}`,
    ),
  leveling: (projectId: string, from: string, to: string) =>
    fetchJson<LevelingSuggestion[]>(
      `/projects/${projectId}/resources/leveling?from=${from}&to=${to}`,
    ),
  notifications: (projectId: string) =>
    fetchJson<Notification[]>(`/projects/${projectId}/notifications`),
  timesheets: (projectId: string) =>
    fetchJson<TimesheetEntry[]>(`/projects/${projectId}/timesheets`),
  submitTimesheet: (
    projectId: string,
    body: { userId: string; taskId: string; date: string; hours: number; notes?: string },
  ) =>
    fetchJson<{ entry: TimesheetEntry; budget: BudgetOverviewReport }>(
      `/projects/${projectId}/timesheets`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  updateTimesheetStatus: (
    projectId: string,
    entryId: string,
    body: { status: TimesheetEntry["status"]; notes?: string },
  ) =>
    fetchJson<{ entry: TimesheetEntry; budget: BudgetOverviewReport }>(
      `/projects/${projectId}/timesheets/${entryId}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ),
  exportProjectPayload: (projectId: string) =>
    fetchJson<{
      project: Project;
      tasks: Task[];
      dependencies: TaskDependency[];
      exportedAt?: string;
    }>(`/projects/${projectId}/export`),
  importProject: (projectId: string, data: { tasks?: Task[]; dependencies?: TaskDependency[] }) =>
    fetchJson<{ importedTasks: number }>(`/projects/${projectId}/import`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  autoLevel: (projectId: string) =>
    fetchJson<{ applied: number; taskIds: string[] }>(
      `/projects/${projectId}/resources/auto-level`,
      { method: "POST" },
    ),
  reportStatus: (projectId: string) =>
    fetchJson<ProjectStatusReport>(`/projects/${projectId}/reports/status`),
  reportResources: (projectId: string) =>
    fetchJson<ResourceLoadReport>(`/projects/${projectId}/reports/resources`),
  reportCashflow: (projectId: string) =>
    fetchJson<CashFlowReport>(`/projects/${projectId}/reports/cashflow`),
  pmoBaselineVariance: (projectId: string, baselineId: string) =>
    fetchJson<BaselineVarianceReport>(
      `/projects/${projectId}/pmo/baseline-variance?baselineId=${encodeURIComponent(baselineId)}`,
    ),
  pmoWhatIf: (projectId: string, taskId: string, delayDays: number) =>
    fetchJson<WhatIfReport>(`/projects/${projectId}/pmo/what-if`, {
      method: "POST",
      body: JSON.stringify({ taskId, delayDays }),
    }),
  pmoScheduleCurve: (projectId: string, asOf?: string) =>
    fetchJson<ScheduleCurvePoint[]>(
      `/projects/${projectId}/pmo/schedule-curve${asOf ? `?asOf=${asOf}` : ""}`,
    ),
  pmoForecast: (projectId: string) =>
    fetchJson<ProjectForecastReport>(`/projects/${projectId}/pmo/forecast`),
  getBudget: (projectId: string) =>
    fetchJson<BudgetOverviewReport>(`/projects/${projectId}/budget`),
  listBudgetLines: (projectId: string) =>
    fetchJson<BudgetLineItem[]>(`/projects/${projectId}/budget-lines`),
  listMaterialBudgetLines: (projectId: string) =>
    fetchJson<BudgetLineItem[]>(`/projects/${projectId}/budget/material-lines`),
  createBudgetLine: (
    projectId: string,
    body: Omit<BudgetLineItem, "id" | "projectId">,
  ) =>
    fetchJson<BudgetLineItem>(`/projects/${projectId}/budget-lines`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateBudgetLine: (
    projectId: string,
    lineId: string,
    body: Partial<Omit<BudgetLineItem, "id" | "projectId">>,
  ) =>
    fetchJson<BudgetLineItem>(`/projects/${projectId}/budget-lines/${lineId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteBudgetLine: (projectId: string, lineId: string) =>
    fetchJson<{ ok: boolean }>(`/projects/${projectId}/budget-lines/${lineId}`, {
      method: "DELETE",
    }),
  recalculateBudget: (projectId: string, overwriteManual = false) =>
    fetchJson<BudgetOverviewReport>(`/projects/${projectId}/budget/recalculate`, {
      method: "POST",
      body: JSON.stringify({ overwriteManual }),
    }),
  recordBudgetReceipt: (
    projectId: string,
    lineId: string,
    body: { amount: number; cashMonth?: string; note?: string; replace?: boolean },
  ) =>
    fetchJson<{ line: BudgetLineItem; overview: BudgetOverviewReport }>(
      `/projects/${projectId}/budget-lines/${lineId}/receipt`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  syncBudgetFromRfq: (
    projectId: string,
    body: {
      comparisonId: string;
      vendorId: string;
      vendorName: string;
      rfqTitle: string;
      quotedPrice: number;
      category?: BudgetLineItem["category"];
      taskId?: string;
      cashMonth?: string;
    },
  ) =>
    fetchJson<{ line: BudgetLineItem; overview: BudgetOverviewReport }>(
      `/projects/${projectId}/budget/sync-from-rfq`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  generateDemoTasks: (projectId: string, count: number) =>
    fetchJson<Task[]>(`/projects/${projectId}/tasks/generate-demo`, {
      method: "POST",
      body: JSON.stringify({ count }),
    }),
  analyze: (projectId: string) => apiFetch<AIInsight[]>(`/ai/projects/${projectId}/analyze`),
  generatePlan: (prompt: string) =>
    apiFetch<GeneratedPlan>(`/ai/generate-plan`, {
      method: "POST",
      body: JSON.stringify({ prompt }),
    }),
  applyPlan: (projectId: string, plan: GeneratedPlan) =>
    apiFetch<Task[]>(`/ai/projects/${projectId}/apply-plan`, {
      method: "POST",
      body: JSON.stringify(plan),
    }),
};

export interface AIInsight {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  taskId?: string;
  suggestedAction?: string;
}

export interface GeneratedPlan {
  tasks: Array<{
    name: string;
    wbs: string;
    durationDays: number;
    parentWbs?: string;
    dependencies?: Array<{ predecessorWbs: string; type: "FS" | "SS" | "FF" | "SF"; lagDays?: number }>;
  }>;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  return fetchJson<T>(url, init);
}
