import { Injectable } from "@nestjs/common";
import type { ResourceCapacityRow } from "@nexus/shared";
import { detectOverAllocations, suggestResourceLeveling } from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";

@Injectable()
export class ResourcesService {
  constructor(private readonly db: DataStoreService) {}

  listByProject(projectId: string) {
    const project = this.db.getProject(projectId);
    const orgId = project?.organizationId ?? "";
    return {
      resources: this.db.getResources(orgId),
      assignments: this.db.getAssignments(projectId),
    };
  }

  getLevelingSuggestions(projectId: string, from: string, to: string) {
    const histogram = this.getHistogram(projectId, from, to);
    return suggestResourceLeveling(
      histogram.filter((s) => s.isOverAllocated),
      this.db.getTasks(projectId),
    );
  }

  getCapacity(projectId: string, from: string, to: string): ResourceCapacityRow[] {
    const project = this.db.getProject(projectId);
    if (!project) return [];
    const members = this.db.getProjectMembers(projectId);
    const resources = this.db.getResources(project.organizationId);
    const assignments = this.db.getAssignments(projectId);
    const tasks = this.db.getTasks(projectId);
    const histogram = detectOverAllocations(assignments, tasks, resources, this.dateRange(from, to));

    const byResourceWeek = new Map<string, { allocated: number; available: number }>();
    for (const slot of histogram) {
      const weekStart = this.weekStart(slot.date);
      const member = members.find((m) => m.resourceId === slot.resourceId);
      const hoursPerDay = member?.hoursPerDay ?? project.hoursPerDay ?? 8;
      const key = `${slot.resourceId}:${weekStart}`;
      const entry = byResourceWeek.get(key) ?? {
        allocated: 0,
        available: hoursPerDay * 5,
      };
      entry.allocated = Math.max(entry.allocated, slot.allocatedHours);
      byResourceWeek.set(key, entry);
    }

    const rows: ResourceCapacityRow[] = [];
    for (const [key, val] of byResourceWeek) {
      const [resourceId, weekStart] = key.split(":");
      const res = resources.find((r) => r.id === resourceId);
      const util = val.available > 0 ? (val.allocated / val.available) * 100 : 0;
      rows.push({
        resourceId,
        resourceName: res?.name ?? resourceId,
        weekStart,
        availableHours: val.available,
        allocatedHours: Math.round(val.allocated * 10) / 10,
        utilizationPct: Math.round(util),
      });
    }
    return rows.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }

  getHistogram(projectId: string, from: string, to: string) {
    const project = this.db.getProject(projectId);
    const orgId = project?.organizationId ?? "";
    const resources = this.db.getResources(orgId);
    const assignments = this.db.getAssignments(projectId);
    const tasks = this.db.getTasks(projectId);

    return detectOverAllocations(
      assignments,
      tasks,
      resources,
      this.dateRange(from, to),
    );
  }

  private dateRange(from: string, to: string): string[] {
    const dates: string[] = [];
    const start = new Date(from);
    const end = new Date(to);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }

  private weekStart(iso: string): string {
    const d = new Date(iso);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);
  }

  async autoLevel(projectId: string, from: string, to: string) {
    const suggestions = this.getLevelingSuggestions(projectId, from, to);
    const applied: string[] = [];
    for (const s of suggestions) {
      const task = this.db.getTasks(projectId).find((t) => t.id === s.taskId);
      if (!task || task.isCritical) continue;
      const duration = task.durationDays;
      const end = addDays(s.suggestedStart, duration - 1);
      await this.db.updateTask(projectId, s.taskId, {
        startDate: s.suggestedStart,
        endDate: end,
        manuallyScheduled: true,
      });
      applied.push(s.taskId);
    }
    return { applied: applied.length, taskIds: applied };
  }
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
