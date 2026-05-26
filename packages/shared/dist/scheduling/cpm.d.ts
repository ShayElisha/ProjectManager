import type { Task, TaskDependency } from "../types";
declare function addDays(iso: string, days: number): string;
export interface CPMResult {
    tasks: Task[];
    projectEnd: string;
    criticalPathIds: string[];
}
/**
 * Critical Path Method — forward/backward pass with FS/SS/FF/SF + lag.
 * Targets <200ms for 5k tasks (pure computation; client should batch UI).
 */
export declare function calculateCPM(tasks: Task[], dependencies: TaskDependency[], projectStart: string): CPMResult;
export { addDays };
//# sourceMappingURL=cpm.d.ts.map