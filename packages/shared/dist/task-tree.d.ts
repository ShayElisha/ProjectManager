import type { Task } from "./types";
export declare function daysBetween(a: string, b: string): number;
export declare function clampDateToRange(date: string, min: string, max: string): string;
export declare function isRangeWithinParent(start: string, end: string, parentStart: string, parentEnd: string): boolean;
/** Subtask work days must not exceed parent work days (milestones use 0). */
export declare function isWorkDaysWithinParent(childDays: number, parentDays: number, isMilestone?: boolean): boolean;
export declare function clampWorkDays(days: number, parentDays: number): number;
/** Progress from sub-tasks: average of child percentComplete values. */
export declare function progressFromChildren(children: Task[]): number;
export declare function parentStatusFromProgress(percent: number): Task["status"];
export declare function dateSpanFromChildren(children: Task[]): {
    start: string;
    end: string;
};
//# sourceMappingURL=task-tree.d.ts.map