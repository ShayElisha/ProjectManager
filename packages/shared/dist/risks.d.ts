import type { EVMMetrics, ProjectHealth, RiskCategory, RiskLevel, RiskSource, Task } from "./types";
/** P×I score 1–9 (standard qualitative matrix). */
export declare function riskScore(probability: RiskLevel, impact: RiskLevel): number;
export declare function riskPriority(score: number): "low" | "medium" | "high";
export interface RiskTemplate {
    id: string;
    category: RiskCategory;
    titleKey: string;
    descriptionKey: string;
    defaultProbability: RiskLevel;
    defaultImpact: RiskLevel;
    defaultResponseKey: string;
}
export declare const RISK_TEMPLATES: RiskTemplate[];
export interface RiskSuggestion {
    key: string;
    title: string;
    description: string;
    category: RiskCategory;
    probability: RiskLevel;
    impact: RiskLevel;
    responsePlan: string;
    source: RiskSource;
    reason: string;
    taskId?: string;
    score: number;
}
export interface OverloadedResourceHint {
    resourceId: string;
    resourceName: string;
    maxUtilizationPct: number;
}
export interface SuggestRisksInput {
    tasks: Task[];
    evm?: EVMMetrics;
    lateTaskCount: number;
    criticalLateCount: number;
    hasResourceOverload: boolean;
    overloadedResources?: OverloadedResourceHint[];
    forecastDelayDays?: number;
    baselineLateFinishCount?: number;
    baselineAvgEndVarianceDays?: number;
    projectHealth?: ProjectHealth;
    pendingChangeCount?: number;
    unassignedCriticalCount?: number;
    /** Keys already registered (dedupeKey or legacy late:taskId). */
    existingKeys: string[];
}
export declare function suggestRisksFromProject(input: SuggestRisksInput): RiskSuggestion[];
//# sourceMappingURL=risks.d.ts.map