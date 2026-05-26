import type { Resource, ResourceAssignment, Task, LevelingSuggestion } from "../types";

export interface AllocationSlot {
  resourceId: string;
  date: string;
  allocatedHours: number;
  maxHours: number;
  utilizationPct: number;
  isOverAllocated: boolean;
}

const HOURS_PER_DAY = 8;

export function detectOverAllocations(
  assignments: ResourceAssignment[],
  tasks: Task[],
  resources: Resource[],
  dates: string[],
): AllocationSlot[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const resourceMap = new Map(resources.map((r) => [r.id, r]));
  const slots: AllocationSlot[] = [];

  for (const date of dates) {
    const byResource = new Map<string, number>();

    for (const a of assignments) {
      const task = taskMap.get(a.taskId);
      if (!task) continue;
      const start = new Date(task.startDate).getTime();
      const end = new Date(task.endDate).getTime();
      const d = new Date(date).getTime();
      if (d < start || d > end) continue;

      const dailyHours = (a.workHours / Math.max(task.durationDays, 1)) * a.units;
      byResource.set(a.resourceId, (byResource.get(a.resourceId) ?? 0) + dailyHours);
    }

    for (const [resourceId, hours] of byResource) {
      const res = resourceMap.get(resourceId);
      const maxHours = (res?.maxUnits ?? 1) * HOURS_PER_DAY;
      slots.push({
        resourceId,
        date,
        allocatedHours: hours,
        maxHours,
        utilizationPct: Math.round((hours / maxHours) * 100),
        isOverAllocated: hours > maxHours,
      });
    }
  }

  return slots;
}

export type { LevelingSuggestion };

export function suggestResourceLeveling(
  overSlots: AllocationSlot[],
  tasks: Task[],
): LevelingSuggestion[] {
  const suggestions: LevelingSuggestion[] = [];
  const seen = new Set<string>();

  for (const slot of overSlots.filter((s) => s.isOverAllocated)) {
    const key = `${slot.resourceId}-${slot.date}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const movable = tasks.find(
      (t) => !t.isCritical && t.assigneeIds.length > 0 && t.startDate <= slot.date && t.endDate >= slot.date,
    );
    if (!movable) continue;

    const suggestedStart = addDays(slot.date, 1);
    suggestions.push({
      taskId: movable.id,
      resourceId: slot.resourceId,
      currentStart: movable.startDate,
      suggestedStart,
      reason: `Over-allocation on ${slot.date}: ${slot.allocatedHours}h / ${slot.maxHours}h max`,
    });
  }

  return suggestions;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
