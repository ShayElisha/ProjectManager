import type { BudgetCategory, BudgetLineItem, ProjectMember, Resource, ResourceAssignment, Task, TimesheetEntry } from "./types";
import type { BudgetCashFlowPoint, BudgetCategoryBreakdown, BudgetOverviewReport } from "./reports";
export declare function taskCostParts(t: Task): {
    laborP: number;
    materialP: number;
    otherP: number;
    laborA: number;
    materialA: number;
    otherA: number;
    planned: number;
    actual: number;
};
export declare function syncTaskCostTotals(task: Task): Task;
/** עלות שיבוץ: שעתי (שעות×תעריף) או גלובלי (סכום קבוע למשימה). */
export declare function assignmentLaborCost(resource: Resource | undefined, workHours: number, units?: number): number;
/** שיבוצים מפורשים + עובדים מ-assigneeIds עם שעות לפי משך המשימה. */
export declare function effectiveAssignmentsForTask(task: Task, assignments: ResourceAssignment[], members: ProjectMember[], defaultHoursPerDay: number): ResourceAssignment[];
export declare function computeTaskLaborPlanned(task: Task, assignments: ResourceAssignment[], resources: Resource[], members: ProjectMember[], defaultHoursPerDay: number): number;
export declare function computeAssignmentLaborPlanned(assignments: ResourceAssignment[], resources: Resource[], taskId: string): number;
/** מפזר עלות ליניארית לפי ימים בלוח השנה בין תאריך התחלה לסיום. */
export declare function spreadCostOverTaskMonths(startDate: string, endDate: string, totalCost: number): Map<string, number>;
/** Submitted + approved count toward actual labor; rejected/draft do not. */
export declare function timesheetCountsTowardActual(status: TimesheetEntry["status"]): boolean;
/** Resolve worker on a timesheet to a resource id and hourly rate. */
export declare function resolveTimesheetHourlyRate(entry: TimesheetEntry, taskId: string, assignments: ResourceAssignment[], resources: Resource[], members: ProjectMember[], assigneeIds: string[]): number;
export declare function computeTimesheetLaborActual(taskId: string, timesheets: TimesheetEntry[], assignments: ResourceAssignment[], resources: Resource[], assigneeIds: string[], members?: ProjectMember[]): number;
/** Task categories covered by budget lines linked via taskId (avoid double counting). */
export declare function linkedTaskCategoryExclusions(lines: BudgetLineItem[]): Map<string, Set<BudgetCategory>>;
export declare function taskCostPartsForTotals(t: Task, excludeCategories: Set<BudgetCategory> | undefined): ReturnType<typeof taskCostParts>;
export declare function buildBudgetWarnings(tasks: Task[], lines: BudgetLineItem[]): string[];
export declare function rollupTaskCosts(tasks: Task[]): Task[];
export declare function isMaterialBudgetCategory(cat: BudgetCategory): boolean;
/** Push linked budget-line totals onto task material / other cost fields. */
export declare function rollupTaskCostsFromBudgetLines(tasks: Task[], lines: BudgetLineItem[]): Task[];
export declare function recalculateProjectCosts(tasks: Task[], lines: BudgetLineItem[], assignments: ResourceAssignment[], resources: Resource[], timesheets: TimesheetEntry[], overwriteManual: boolean, members?: ProjectMember[], hoursPerDay?: number): Task[];
export declare function recalculateTaskLabor(task: Task, assignments: ResourceAssignment[], resources: Resource[], timesheets: TimesheetEntry[], overwriteManual: boolean, members?: ProjectMember[], defaultHoursPerDay?: number): Task;
export declare function aggregateByCategory(tasks: Task[], lines: BudgetLineItem[]): BudgetCategoryBreakdown[];
export interface CashFlowBuildContext {
    assignments: ResourceAssignment[];
    resources: Resource[];
    timesheets: TimesheetEntry[];
    members?: ProjectMember[];
    hoursPerDay?: number;
}
export declare function buildCashFlow(tasks: Task[], lines: BudgetLineItem[], ctx?: CashFlowBuildContext): BudgetCashFlowPoint[];
export declare function buildBudgetOverview(input: {
    projectId: string;
    currency: string;
    budgetCap?: number;
    tasks: Task[];
    lines: BudgetLineItem[];
    assignments: ResourceAssignment[];
    resources: Resource[];
    timesheets: TimesheetEntry[];
    members?: ProjectMember[];
    hoursPerDay?: number;
}): BudgetOverviewReport;
/** Single entry point for budget, cash flow, and EVM (use in API + reports). */
export interface ProjectFinancialsInput {
    projectId: string;
    currency: string;
    budgetCap?: number;
    tasks: Task[];
    lines: BudgetLineItem[];
    assignments: ResourceAssignment[];
    resources: Resource[];
    timesheets: TimesheetEntry[];
    members?: ProjectMember[];
    hoursPerDay?: number;
}
export declare function getProjectFinancials(input: ProjectFinancialsInput): BudgetOverviewReport;
/** תקציב בסיס פחות סכום מתוכנן (צפי הוצאה מכל המשימות). */
export declare function budgetVarianceAtCompletion(budgetCap: number | undefined | null, totalPlanned: number): number | null;
export declare function projectBudgetTotals(tasks: Task[], lines: BudgetLineItem[]): {
    planned: number;
    actual: number;
    tasks: Task[];
};
//# sourceMappingURL=budget.d.ts.map