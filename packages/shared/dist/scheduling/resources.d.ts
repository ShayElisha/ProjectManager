import type { Resource, ResourceAssignment, Task, LevelingSuggestion } from "../types";
export interface AllocationSlot {
    resourceId: string;
    date: string;
    allocatedHours: number;
    maxHours: number;
    utilizationPct: number;
    isOverAllocated: boolean;
}
export declare function detectOverAllocations(assignments: ResourceAssignment[], tasks: Task[], resources: Resource[], dates: string[]): AllocationSlot[];
export type { LevelingSuggestion };
export declare function suggestResourceLeveling(overSlots: AllocationSlot[], tasks: Task[]): LevelingSuggestion[];
//# sourceMappingURL=resources.d.ts.map