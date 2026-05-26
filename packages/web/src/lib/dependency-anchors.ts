import type { Task, TaskDependency } from "@nexus/shared";

export function daysBetween(a: string, b: string): number {
  return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Day offsets on the timeline for dependency link endpoints */
export function dependencyAnchors(
  dep: TaskDependency,
  pred: Task,
  succ: Task,
  rangeStart: string,
): { predDay: number; succDay: number } {
  const predStart = daysBetween(rangeStart, pred.startDate);
  const predEnd = daysBetween(rangeStart, pred.endDate) + 1;
  const succStart = daysBetween(rangeStart, succ.startDate);
  const succEnd = daysBetween(rangeStart, succ.endDate) + 1;

  switch (dep.type) {
    case "SS":
      return { predDay: predStart, succDay: succStart };
    case "FF":
      return { predDay: predEnd, succDay: succEnd };
    case "SF":
      return { predDay: predStart, succDay: succEnd };
    case "FS":
    default:
      return { predDay: predEnd, succDay: succStart };
  }
}
