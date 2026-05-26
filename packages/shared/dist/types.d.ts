/** Core domain types for NexusProject */
export type Locale = "he" | "en";
export type Direction = "rtl" | "ltr";
export type Currency = "ILS" | "USD" | "EUR";
export type UserRole = "admin" | "pmo" | "project_manager" | "team_member" | "viewer";
export type DependencyType = "FS" | "SS" | "FF" | "SF";
export type ScheduleConstraint = "ASAP" | "ALAP" | "MFO" | "MSO" | "SNET" | "SNLT" | "FNET" | "FNLT";
export type ResourceType = "work" | "material" | "cost";
export type BudgetCategory = "labor" | "material" | "equipment" | "subcontractor" | "other";
/** How actual/planned labor on a task is derived */
export type LaborCostSource = "auto" | "manual" | "timesheet";
export type TaskStatus = "not_started" | "in_progress" | "completed" | "on_hold";
export type ViewMode = "gantt" | "grid" | "kanban" | "calendar" | "timeline";
export declare const DependencyType: {
    readonly FS: "FS";
    readonly SS: "SS";
    readonly FF: "FF";
    readonly SF: "SF";
};
export interface Organization {
    id: string;
    name: string;
    defaultLocale: Locale;
    defaultCurrency: Currency;
}
/** Project role code — free text, up to 3 letters (e.g. PMO, DEV). */
export type ProjectMemberRole = string;
export interface Project {
    id: string;
    organizationId: string;
    name: string;
    description?: string;
    locale: Locale;
    currency: Currency;
    startDate: string;
    endDate?: string;
    status: "planning" | "active" | "on_hold" | "completed";
    /** שעות עבודה ליום (ברירת מחדל 8) */
    hoursPerDay?: number;
    /** ימי עבודה: 0=א׳ … 6=ש׳ (ברירת מחדל א׳-ה׳) */
    workDays?: number[];
    /** סוג קישור ברירת מחדל בגאנט */
    defaultLinkType?: DependencyType;
    /** תקרת תקציב מאושרת (BAC ל-EVM) */
    budgetCap?: number;
    createdAt: string;
    updatedAt: string;
}
export interface ProjectMember {
    id: string;
    projectId: string;
    resourceId: string;
    role: ProjectMemberRole;
    hoursPerDay?: number;
}
export interface Task {
    id: string;
    projectId: string;
    parentId: string | null;
    wbs: string;
    name: string;
    status: TaskStatus;
    startDate: string;
    endDate: string;
    durationDays: number;
    percentComplete: number;
    isMilestone: boolean;
    isSummary: boolean;
    manuallyScheduled: boolean;
    constraint: ScheduleConstraint;
    constraintDate?: string;
    isCritical: boolean;
    earlyStart?: string;
    earlyFinish?: string;
    lateStart?: string;
    lateFinish?: string;
    totalFloat?: number;
    freeFloat?: number;
    baselineStart?: string;
    baselineFinish?: string;
    plannedCost?: number;
    actualCost?: number;
    plannedLaborCost?: number;
    actualLaborCost?: number;
    /** auto = assignments; timesheet = approved hours only; manual = user-entered */
    laborCostSource?: LaborCostSource;
    plannedMaterialCost?: number;
    actualMaterialCost?: number;
    plannedOtherCost?: number;
    actualOtherCost?: number;
    earnedValue?: number;
    assigneeIds: string[];
    sortOrder: number;
    /** משימה בעדיפות גבוהה */
    isPriority: boolean;
    /** תאריך השהיה (עצירה זמנית) */
    pausedAt?: string;
    /** סוף הקטע הראשון בגאנט (לפני רווח) */
    pausedSegmentEnd?: string;
    /** תאריך חזרה מתוכנן לעבודה */
    resumeDate?: string;
    /** ימי עבודה שנותרו אחרי החזרה */
    remainingWorkDays?: number;
    /** שמירת משויך לשחזור אחרי חזרה */
    pausedAssigneeId?: string;
    /** הערות מהירות (MVP) */
    taskNotes?: string[];
}
export interface TaskDependency {
    id: string;
    projectId: string;
    predecessorId: string;
    successorId: string;
    type: DependencyType;
    lagDays: number;
}
export interface Resource {
    id: string;
    organizationId: string;
    name: string;
    type: ResourceType;
    email?: string;
    costPerHour?: number;
    costPerUnit?: number;
    maxUnits: number;
    calendarId?: string;
}
export interface ResourceAssignment {
    id: string;
    taskId: string;
    resourceId: string;
    units: number;
    workHours: number;
}
export interface Baseline {
    id: string;
    projectId: string;
    index: number;
    name: string;
    savedAt: string;
    tasks: Array<{
        taskId: string;
        startDate: string;
        endDate: string;
        cost: number;
    }>;
}
export interface EVMMetrics {
    pv: number;
    ev: number;
    ac: number;
    cv: number;
    sv: number;
    cpi: number;
    spi: number;
    eac: number;
    etc: number;
    vac: number;
    /** Sum of planned costs (tasks + budget lines). */
    totalPlanned?: number;
    /** Sum of actual costs (tasks + budget lines). */
    totalActual?: number;
    /** User-defined budget cap from project settings. */
    budgetAllocated?: number | null;
    /** תקציב בסיס − סכום מתוכנן (סטיית תקציב לסיום). */
    budgetVariance?: number | null;
}
export interface CustomColumn {
    id: string;
    projectId: string;
    key: string;
    label: string;
    type: "text" | "number" | "date" | "formula" | "multi_select";
    options?: string[];
}
export interface TimesheetEntry {
    id: string;
    projectId?: string;
    userId: string;
    taskId: string;
    date: string;
    hours: number;
    status: "draft" | "submitted" | "approved" | "rejected";
    notes?: string;
}
export type RiskLevel = "low" | "medium" | "high";
export type RiskStatus = "open" | "mitigated" | "closed";
export type RiskCategory = "schedule" | "budget" | "resource" | "technical" | "scope" | "external";
export type RiskSource = "manual" | "template" | "auto_schedule" | "auto_evm" | "auto_resource" | "auto_baseline" | "auto_scope";
export interface ProjectRisk {
    id: string;
    projectId: string;
    title: string;
    description?: string;
    category: RiskCategory;
    probability: RiskLevel;
    impact: RiskLevel;
    riskScore: number;
    status: RiskStatus;
    source: RiskSource;
    ownerResourceId?: string;
    responsePlan?: string;
    taskId?: string;
    /** Stable id for auto-suggestion deduplication (e.g. evm:spi, late:taskId). */
    dedupeKey?: string;
    createdAt: string;
    updatedAt: string;
}
export type ChangeRequestStatus = "draft" | "submitted" | "approved" | "rejected";
export interface ChangeRequest {
    id: string;
    projectId: string;
    title: string;
    description?: string;
    impactScheduleDays: number;
    impactCost: number;
    status: ChangeRequestStatus;
    requestedBy?: string;
    decidedAt?: string;
    decisionNote?: string;
    createdAt: string;
    updatedAt: string;
}
export interface ResourceCapacityRow {
    resourceId: string;
    resourceName: string;
    weekStart: string;
    availableHours: number;
    allocatedHours: number;
    utilizationPct: number;
}
export interface PortfolioSimulateResult {
    addedConflicts: number;
    peakUtilizationPct: number;
    message: string;
}
export interface ExecutiveSummary {
    generatedAt: string;
    organizationName: string;
    paragraphs: string[];
    actions: string[];
}
export interface Notification {
    id: string;
    userId: string;
    type: "task_late" | "mention" | "critical_path" | "approval" | "over_allocation" | "risk_escalation" | "change_pending";
    title: string;
    body: string;
    read: boolean;
    createdAt: string;
    metadata?: Record<string, string>;
}
export type ProjectHealth = "on_track" | "at_risk" | "critical";
export interface PortfolioProjectSummary extends Project {
    taskCount: number;
    percentComplete: number;
    plannedBudget: number;
    actualCost: number;
    criticalCount: number;
    health: ProjectHealth;
    scheduleVarianceDays: number;
    budgetVariance: number | null;
    forecastDelayDays: number;
    cpi: number;
    spi: number;
    lateTaskCount: number;
    pv: number;
    ev: number;
    eac: number;
    vac: number;
    /** 0–100 when budgetCap is set */
    percentBudgetUsed: number | null;
}
export interface OrgBudgetCategoryRollup {
    category: BudgetCategory;
    planned: number;
    actual: number;
}
export interface OrgDashboardRollup {
    totalPv: number;
    totalEv: number;
    totalAc: number;
    totalEac: number;
    totalVac: number;
    totalCv: number;
    totalSv: number;
    totalBudgetCap: number;
    avgPercentBudgetUsed: number | null;
    openRisks: number;
    highRisks: number;
    pendingChangeRequests: number;
    pendingChangeImpactDays: number;
    pendingChangeImpactCost: number;
    pendingTimesheets: number;
    pendingTimesheetHours: number;
    totalCriticalTasks: number;
    onTimeProjects: number;
    delayedProjects: number;
    resourceConflictCount: number;
    projectsByStatus: Record<Project["status"], number>;
    budgetByCategory: OrgBudgetCategoryRollup[];
}
export interface ResourceConflict {
    resourceId: string;
    resourceName: string;
    date: string;
    allocatedHours: number;
    projectNames: string[];
}
export interface PortfolioOverview {
    organizationId: string;
    organizationName: string;
    projects: PortfolioProjectSummary[];
    resourceConflicts: ResourceConflict[];
}
export interface LevelingSuggestion {
    taskId: string;
    resourceId: string;
    currentStart: string;
    suggestedStart: string;
    reason: string;
}
export type BudgetLineSource = "manual" | "rfq" | "import";
export interface BudgetLineItem {
    id: string;
    projectId: string;
    category: BudgetCategory;
    name: string;
    description?: string;
    plannedAmount: number;
    /** Committed cost (e.g. approved vendor quote) before actual spend. */
    committedAmount?: number;
    actualAmount: number;
    /** YYYY-MM — month for cash flow */
    cashMonth: string;
    taskId?: string;
    source?: BudgetLineSource;
    /** Stable external key, e.g. rfq:comparisonId:vendorId */
    sourceRef?: string;
}
/** Categories rolled into materials & equipment budget UI. */
export declare const MATERIAL_BUDGET_CATEGORIES: BudgetCategory[];
//# sourceMappingURL=types.d.ts.map