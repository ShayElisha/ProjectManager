import type { Baseline, EVMMetrics, OrgDashboardRollup, PortfolioOverview, Project, ProjectHealth, Task, TaskDependency } from "./types";
export type { ProjectHealth };
export interface ProjectHealthInput {
    tasks: Task[];
    evm: EVMMetrics;
    projectEnd?: string;
    budgetCap?: number;
}
export declare function computeProjectHealth(input: ProjectHealthInput): ProjectHealth;
/** Days project end is after planned contract end (positive = late). */
export declare function scheduleVarianceDays(projectEnd: string | undefined, cpmEnd: string): number;
export declare function forecastProjectDelay(tasks: Task[], dependencies: TaskDependency[], projectStart: string, projectEnd?: string, evm?: EVMMetrics): number;
export interface BaselineVarianceRow {
    taskId: string;
    taskName: string;
    wbs: string;
    baselineStart: string;
    baselineEnd: string;
    currentStart: string;
    currentEnd: string;
    startVarianceDays: number;
    endVarianceDays: number;
    baselineCost: number;
    currentCost: number;
    costVariance: number;
    isCritical: boolean;
    percentComplete: number;
}
export interface BaselineVarianceReport {
    projectId: string;
    baselineId: string;
    baselineName: string;
    savedAt: string;
    generatedAt: string;
    summary: {
        taskCount: number;
        lateFinishCount: number;
        avgEndVarianceDays: number;
        totalCostVariance: number;
    };
    rows: BaselineVarianceRow[];
}
export declare function compareBaselineVariance(baseline: Baseline, tasks: Task[]): BaselineVarianceReport;
export interface WhatIfImpactRow {
    taskId: string;
    taskName: string;
    wbs: string;
    beforeEnd: string;
    afterEnd: string;
    endDeltaDays: number;
    becameCritical: boolean;
    wasCritical: boolean;
}
export interface WhatIfReport {
    projectId: string;
    taskId: string;
    taskName: string;
    delayDays: number;
    generatedAt: string;
    beforeProjectEnd: string;
    afterProjectEnd: string;
    projectEndDeltaDays: number;
    beforeCriticalCount: number;
    afterCriticalCount: number;
    impactedTasks: WhatIfImpactRow[];
}
export declare function simulateTaskDelay(tasks: Task[], dependencies: TaskDependency[], projectStart: string, taskId: string, delayDays: number): WhatIfReport;
export interface ScheduleCurvePoint {
    month: string;
    plannedCumulativePct: number;
    actualCumulativePct: number;
}
export declare function buildScheduleSCurve(tasks: Task[], asOfDate: string): ScheduleCurvePoint[];
export interface ProjectForecastReport {
    projectId: string;
    forecastDelayDays: number;
    scheduleVarianceDays: number;
    health: ProjectHealth;
    messageKey: "on_track" | "delay_forecast";
}
export declare function buildProjectForecast(project: Project, tasks: Task[], dependencies: TaskDependency[], evm: EVMMetrics): ProjectForecastReport;
export interface ExecutivePortfolioSummary extends PortfolioOverview {
    generatedAt: string;
    counts: {
        on_track: number;
        at_risk: number;
        critical: number;
    };
    rollup: OrgDashboardRollup;
}
//# sourceMappingURL=pmo.d.ts.map