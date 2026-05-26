import type { Task } from "./types";
export type RejectionKind = "change_request" | "timesheet" | "vendor_quote" | "approval_step" | "manual";
export type ManualRejectionCategory = "schedule_delay" | "supply_delay" | "approval" | "scope" | "other";
export interface RejectionRecord {
    id: string;
    kind: RejectionKind;
    projectId?: string;
    projectName?: string;
    title: string;
    detail?: string;
    rejectedAt: string;
    decisionNote?: string;
    impactScheduleDays?: number;
    impactCost?: number;
    hours?: number;
    date?: string;
    taskId?: string;
    taskName?: string;
    manualCategory?: ManualRejectionCategory;
    /** Client-only vendor RFQ comparisons */
    comparisonId?: string;
    comparisonName?: string;
}
export interface ManualRejectionEntry {
    id: string;
    projectId: string;
    title: string;
    description?: string;
    category: ManualRejectionCategory;
    rejectedAt: string;
    decisionNote?: string;
    impactScheduleDays?: number;
    impactCost?: number;
    taskId?: string;
    createdAt: string;
    updatedAt: string;
}
export type RejectionSuggestionSeverity = "info" | "warning" | "critical";
export interface RejectionSuggestion {
    key: string;
    severity: RejectionSuggestionSeverity;
    title: string;
    reason: string;
    description: string;
    projectId: string;
    projectName?: string;
    taskId?: string;
    taskName?: string;
    suggestedCategory: ManualRejectionCategory;
    impactScheduleDays?: number;
    impactCost?: number;
    /** Pre-fill for manual form */
    suggestedRejectedAt?: string;
}
export interface SuggestRejectionsInput {
    projectId: string;
    projectName: string;
    tasks: Task[];
    existingKeys: string[];
    lateTaskCount: number;
    criticalLateCount: number;
    onHoldCount: number;
    pendingTimesheetCount: number;
    pendingChangeCount: number;
    forecastDelayDays?: number;
}
export declare function suggestRejectionsFromProject(input: SuggestRejectionsInput): RejectionSuggestion[];
export declare function manualEntryToRecord(entry: ManualRejectionEntry, projectName: string, taskName?: string): RejectionRecord;
//# sourceMappingURL=rejections.d.ts.map