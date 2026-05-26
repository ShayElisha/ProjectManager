import type { Task } from "@nexus/shared";

export function clampWorkDays(days: number, parentDays: number): number {
  return Math.max(1, Math.min(Math.round(days), parentDays));
}

/** Progress from sub-tasks: average of child percentComplete values. */
export function progressFromChildren(children: Task[]): number {
  if (children.length === 0) return 0;
  const sum = children.reduce((acc, c) => acc + (c.percentComplete ?? 0), 0);
  return Math.round(sum / children.length);
}
