import type { Task } from "./types";

export function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function remainingWorkDaysFromProgress(task: Task): number {
  const left = task.durationDays * (1 - (task.percentComplete ?? 0) / 100);
  return Math.max(1, Math.ceil(left));
}

export function isPausedWithResume(task: Task): boolean {
  return task.status === "on_hold" && !!task.resumeDate && !!task.pausedSegmentEnd;
}
