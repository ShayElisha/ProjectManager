import type { Task, TaskDependency } from "@nexus/shared";
import { dependencyAnchors } from "./dependency-anchors";

const ROW_HEIGHT = 36;

export const LINK_STYLE: Record<
  TaskDependency["type"],
  { stroke: string; gradient: [string, string]; glow: string }
> = {
  FS: { stroke: "#6366f1", gradient: ["#818cf8", "#6366f1"], glow: "rgba(99,102,241,0.45)" },
  SS: { stroke: "#10b981", gradient: ["#34d399", "#059669"], glow: "rgba(16,185,129,0.45)" },
  FF: { stroke: "#a855f7", gradient: ["#c084fc", "#9333ea"], glow: "rgba(168,85,247,0.45)" },
  SF: { stroke: "#f59e0b", gradient: ["#fbbf24", "#d97706"], glow: "rgba(245,158,11,0.45)" },
};

export interface GanttLinkPath {
  depId: string;
  type: TaskDependency["type"];
  d: string;
  hitD: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
}

/** Smooth modern connector (cubic bezier). */
export function buildModernGanttLinkPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  const dx = x2 - x1;
  const curve = Math.min(Math.max(Math.abs(dx) * 0.35, 28), 72);
  const sign = dx >= 0 ? 1 : -1;
  const c1x = x1 + curve * sign;
  const c2x = x2 - curve * sign;
  if (Math.abs(y1 - y2) < 3) {
    return `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;
  }
  return `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;
}

export function computeGanttLinkPaths(params: {
  dependencies: TaskDependency[];
  tasks: Task[];
  taskIndex: Map<string, number>;
  rangeStart: string;
  toX: (day: number) => number;
  displayTask: (task: Task) => Task;
  taskName: (id: string) => string;
  /** Y offset when the SVG is placed below the timeline header */
  yOffset?: number;
}): GanttLinkPath[] {
  const { dependencies, tasks, taskIndex, rangeStart, toX, displayTask, taskName, yOffset = 0 } =
    params;
  const paths: GanttLinkPath[] = [];

  for (const dep of dependencies) {
    const predIdx = taskIndex.get(dep.predecessorId);
    const succIdx = taskIndex.get(dep.successorId);
    if (predIdx === undefined || succIdx === undefined) continue;

    const pred = displayTask(tasks[predIdx]);
    const succ = displayTask(tasks[succIdx]);
    const { predDay, succDay } = dependencyAnchors(dep, pred, succ, rangeStart);

    const x1 = toX(predDay);
    const x2 = toX(succDay);
    const y1 = yOffset + predIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
    const y2 = yOffset + succIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
    const d = buildModernGanttLinkPath(x1, y1, x2, y2);

    paths.push({
      depId: dep.id,
      type: dep.type,
      x1,
      y1,
      x2,
      y2,
      d,
      hitD: d,
      label: `${taskName(dep.predecessorId)} → ${taskName(dep.successorId)} (${dep.type})`,
    });
  }

  return paths;
}
