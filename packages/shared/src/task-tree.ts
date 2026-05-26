import type { Task } from "./types";

export function daysBetween(a: string, b: string): number {
  return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

export function clampDateToRange(date: string, min: string, max: string): string {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

export function isRangeWithinParent(
  start: string,
  end: string,
  parentStart: string,
  parentEnd: string,
): boolean {
  return start >= parentStart && end <= parentEnd && start <= end;
}

/** Subtask work days must not exceed parent work days (milestones use 0). */
export function isWorkDaysWithinParent(
  childDays: number,
  parentDays: number,
  isMilestone = false,
): boolean {
  if (isMilestone) return childDays === 0;
  return childDays >= 1 && childDays <= parentDays;
}

export function clampWorkDays(days: number, parentDays: number): number {
  return Math.max(1, Math.min(Math.round(days), parentDays));
}

/** Progress from sub-tasks: average of child percentComplete values. */
export function progressFromChildren(children: Task[]): number {
  if (children.length === 0) return 0;
  const sum = children.reduce((acc, c) => acc + (c.percentComplete ?? 0), 0);
  return Math.round(sum / children.length);
}

export function parentStatusFromProgress(percent: number): Task["status"] {
  if (percent >= 100) return "completed";
  if (percent > 0) return "in_progress";
  return "not_started";
}

export function dateSpanFromChildren(children: Task[]): { start: string; end: string } {
  const starts = children.map((c) => c.startDate);
  const ends = children.map((c) => c.endDate);
  const start = starts.reduce((a, b) => (a < b ? a : b));
  const end = ends.reduce((a, b) => (a > b ? a : b));
  return { start, end };
}
