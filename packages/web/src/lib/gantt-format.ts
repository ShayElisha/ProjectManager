import type { Task } from "@nexus/shared";

const HEBREW_WEEKDAY = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export type GanttColKey = keyof typeof GANTT_GRID_COL_FULL;

export const GANTT_GRID_COL_FULL = {
  num: 36,
  type: 34,
  name: 168,
  role: 44,
  member: 100,
  alert: 30,
  days: 52,
  start: 78,
  end: 78,
  pause: 52,
  resume: 78,
  percent: 44,
} as const;

/** Fewer columns on tablet/mobile — horizontal scroll stays usable */
export const GANTT_GRID_COL_COMPACT = {
  num: 32,
  type: 30,
  name: 140,
  member: 88,
  alert: 28,
  days: 44,
  start: 72,
  end: 72,
  percent: 40,
} as const;

export type GanttColLayout = Record<string, number>;

export function ganttGridWidth(cols: GanttColLayout): number {
  return Object.values(cols).reduce((a, b) => a + b, 0);
}

/** @deprecated use ganttGridWidth(GANTT_GRID_COL_FULL) */
export const GANTT_GRID_COL = GANTT_GRID_COL_FULL;

export const GANTT_GRID_WIDTH = ganttGridWidth(GANTT_GRID_COL_FULL);

export function localeIsRtl(locale: string): boolean {
  return locale === "he";
}

export function formatGanttDate(iso: string, locale: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (locale === "he") {
    return new Intl.DateTimeFormat("he-IL", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    }).format(d);
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(d);
}

export function formatGanttMonth(iso: string, locale: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (locale === "he") {
    const label = new Intl.DateTimeFormat("he-IL", {
      month: "short",
      year: "2-digit",
    }).format(d);
    return label.replace(/\s/g, "\u00a0");
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
  })
    .format(d)
    .replace(", ", "-")
    .replace(" ", "-");
}

export function ganttDayLabel(iso: string, locale: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (locale === "he") return HEBREW_WEEKDAY[d.getDay()];
  return String(d.getDate());
}

export function ganttTaskType(task: Task): "S" | "T" | "M" {
  if (task.isMilestone) return "M";
  if (task.isSummary) return "S";
  return "T";
}

export function isParentTaskTitle(task: Task, parentIds: ReadonlySet<string>): boolean {
  return task.isSummary || parentIds.has(task.id);
}

export function isSubtaskRow(task: Task): boolean {
  return !!task.parentId && !task.isSummary;
}

export function taskHasAlert(task: Task): boolean {
  return task.isCritical || (task.totalFloat !== undefined && task.totalFloat <= 0);
}

export function taskPauseLabel(task: Task): string {
  if (task.status !== "on_hold") return "";
  return "⏸";
}

export function taskResumeDisplay(task: Task): string {
  if (task.status !== "on_hold" || !task.resumeDate) return "";
  const days = task.remainingWorkDays ?? 0;
  return days > 0 ? `${task.resumeDate} (${days}d)` : task.resumeDate;
}
