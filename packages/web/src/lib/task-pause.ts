import type { Task } from "@nexus/shared";

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

export type PauseBarSegment = {
  start: string;
  end: string;
  kind: "worked" | "planned";
};

export function pauseBarSegments(task: Task): PauseBarSegment[] {
  if (!isPausedWithResume(task) || !task.resumeDate || !task.remainingWorkDays) {
    return [{ start: task.startDate, end: task.endDate, kind: "worked" }];
  }
  const plannedEnd = addDaysIso(task.resumeDate, task.remainingWorkDays - 1);
  return [
    { start: task.startDate, end: task.pausedSegmentEnd!, kind: "worked" },
    { start: task.resumeDate, end: plannedEnd, kind: "planned" },
  ];
}

/** Latest calendar day shown for a task (includes planned segment after pause). */
export function taskTimelineEnd(task: Task): string {
  if (isPausedWithResume(task) && task.resumeDate && task.remainingWorkDays) {
    return addDaysIso(task.resumeDate, task.remainingWorkDays - 1);
  }
  return task.endDate;
}
