import type {
  Baseline,
  EVMMetrics,
  OrgDashboardRollup,
  PortfolioOverview,
  Project,
  ProjectHealth,
  Task,
  TaskDependency,
} from "./types";
import { calculateCPM } from "./scheduling/cpm";
import { getProjectFinancials, budgetVarianceAtCompletion } from "./budget";

export type { ProjectHealth };

export interface ProjectHealthInput {
  tasks: Task[];
  evm: EVMMetrics;
  projectEnd?: string;
  budgetCap?: number;
}

export function computeProjectHealth(input: ProjectHealthInput): ProjectHealth {
  const { tasks, evm } = input;
  const today = new Date().toISOString().slice(0, 10);
  const leaf = tasks.filter((t) => !t.isSummary);
  const late = leaf.filter((t) => t.endDate < today && t.percentComplete < 100);

  if (evm.cpi < 0.8 || evm.spi < 0.8 || late.length > 2) return "critical";
  if (evm.cpi < 0.9 || evm.spi < 0.9 || late.length > 0) return "at_risk";
  return "on_track";
}

function daysBetween(start: string, end: string): number {
  const a = new Date(`${start}T12:00:00`).getTime();
  const b = new Date(`${end}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Days project end is after planned contract end (positive = late). */
export function scheduleVarianceDays(projectEnd: string | undefined, cpmEnd: string): number {
  if (!projectEnd) return 0;
  return daysBetween(projectEnd, cpmEnd);
}

export function forecastProjectDelay(
  tasks: Task[],
  dependencies: TaskDependency[],
  projectStart: string,
  projectEnd?: string,
  evm?: EVMMetrics,
): number {
  const today = new Date().toISOString().slice(0, 10);
  const leaf = tasks.filter((t) => !t.isSummary && t.percentComplete < 100);
  const lateDays = leaf
    .filter((t) => t.endDate < today)
    .reduce((max, t) => Math.max(max, daysBetween(t.endDate, today)), 0);

  let cpmDelay = 0;
  if (tasks.length > 0) {
    const { projectEnd: cpmEnd } = calculateCPM(tasks, dependencies, projectStart);
    if (projectEnd) cpmDelay = Math.max(0, daysBetween(projectEnd, cpmEnd));
    else cpmDelay = Math.max(0, daysBetween(today, cpmEnd));
  }

  let spiDelay = 0;
  if (evm && evm.spi > 0 && evm.spi < 1 && projectEnd) {
    const remaining = Math.max(0, daysBetween(today, projectEnd));
    spiDelay = Math.round(remaining * (1 / evm.spi - 1));
  }

  return Math.max(lateDays, cpmDelay, spiDelay);
}

export interface BaselineVarianceRow {
  taskId: string;
  taskName: string;
  wbs: string;
  baselineStart: string;
  baselineEnd: string;
  currentStart: string;
  currentEnd: string;
  startVarianceDays: number;
  endVarianceDays: number;
  baselineCost: number;
  currentCost: number;
  costVariance: number;
  isCritical: boolean;
  percentComplete: number;
}

export interface BaselineVarianceReport {
  projectId: string;
  baselineId: string;
  baselineName: string;
  savedAt: string;
  generatedAt: string;
  summary: {
    taskCount: number;
    lateFinishCount: number;
    avgEndVarianceDays: number;
    totalCostVariance: number;
  };
  rows: BaselineVarianceRow[];
}

export function compareBaselineVariance(
  baseline: Baseline,
  tasks: Task[],
): BaselineVarianceReport {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const rows: BaselineVarianceRow[] = [];

  for (const snap of baseline.tasks) {
    const current = taskMap.get(snap.taskId);
    if (!current || current.isSummary) continue;

    const startVarianceDays = daysBetween(snap.startDate, current.startDate);
    const endVarianceDays = daysBetween(snap.endDate, current.endDate);
    const currentCost = current.plannedCost ?? 0;

    rows.push({
      taskId: snap.taskId,
      taskName: current.name,
      wbs: current.wbs,
      baselineStart: snap.startDate,
      baselineEnd: snap.endDate,
      currentStart: current.startDate,
      currentEnd: current.endDate,
      startVarianceDays,
      endVarianceDays,
      baselineCost: snap.cost,
      currentCost,
      costVariance: currentCost - snap.cost,
      isCritical: current.isCritical,
      percentComplete: current.percentComplete,
    });
  }

  rows.sort((a, b) => b.endVarianceDays - a.endVarianceDays);

  const lateFinishCount = rows.filter((r) => r.endVarianceDays > 0).length;
  const avgEndVarianceDays =
    rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + r.endVarianceDays, 0) / rows.length)
      : 0;
  const totalCostVariance = rows.reduce((s, r) => s + r.costVariance, 0);

  return {
    projectId: baseline.projectId,
    baselineId: baseline.id,
    baselineName: baseline.name,
    savedAt: baseline.savedAt,
    generatedAt: new Date().toISOString(),
    summary: {
      taskCount: rows.length,
      lateFinishCount,
      avgEndVarianceDays,
      totalCostVariance,
    },
    rows,
  };
}

export interface WhatIfImpactRow {
  taskId: string;
  taskName: string;
  wbs: string;
  beforeEnd: string;
  afterEnd: string;
  endDeltaDays: number;
  becameCritical: boolean;
  wasCritical: boolean;
}

export interface WhatIfReport {
  projectId: string;
  taskId: string;
  taskName: string;
  delayDays: number;
  generatedAt: string;
  beforeProjectEnd: string;
  afterProjectEnd: string;
  projectEndDeltaDays: number;
  beforeCriticalCount: number;
  afterCriticalCount: number;
  impactedTasks: WhatIfImpactRow[];
}

export function simulateTaskDelay(
  tasks: Task[],
  dependencies: TaskDependency[],
  projectStart: string,
  taskId: string,
  delayDays: number,
): WhatIfReport {
  const target = tasks.find((t) => t.id === taskId);
  if (!target) throw new Error(`Task ${taskId} not found`);

  const before = calculateCPM(tasks, dependencies, projectStart);
  const beforeMap = new Map(before.tasks.map((t) => [t.id, t]));

  const adjusted = tasks.map((t) => {
    if (t.id !== taskId) return { ...t };
    const newDuration = Math.max(1, t.durationDays + delayDays);
    const newEnd = addDaysIso(t.startDate, newDuration - 1);
    return { ...t, durationDays: newDuration, endDate: newEnd, manuallyScheduled: true };
  });

  const after = calculateCPM(adjusted, dependencies, projectStart);
  const afterMap = new Map(after.tasks.map((t) => [t.id, t]));

  const impactedTasks: WhatIfImpactRow[] = [];
  for (const t of tasks) {
    if (t.isSummary) continue;
    const b = beforeMap.get(t.id);
    const a = afterMap.get(t.id);
    if (!b || !a) continue;
    const endDeltaDays = daysBetween(b.endDate, a.endDate);
    const becameCritical = !b.isCritical && a.isCritical;
    if (endDeltaDays === 0 && !becameCritical && t.id !== taskId) continue;
    impactedTasks.push({
      taskId: t.id,
      taskName: t.name,
      wbs: t.wbs,
      beforeEnd: b.endDate,
      afterEnd: a.endDate,
      endDeltaDays,
      becameCritical,
      wasCritical: b.isCritical,
    });
  }

  impactedTasks.sort((x, y) => Math.abs(y.endDeltaDays) - Math.abs(x.endDeltaDays));

  return {
    projectId: target.projectId,
    taskId,
    taskName: target.name,
    delayDays,
    generatedAt: new Date().toISOString(),
    beforeProjectEnd: before.projectEnd,
    afterProjectEnd: after.projectEnd,
    projectEndDeltaDays: daysBetween(before.projectEnd, after.projectEnd),
    beforeCriticalCount: before.criticalPathIds.length,
    afterCriticalCount: after.criticalPathIds.length,
    impactedTasks,
  };
}

export interface ScheduleCurvePoint {
  month: string;
  plannedCumulativePct: number;
  actualCumulativePct: number;
}

export function buildScheduleSCurve(tasks: Task[], asOfDate: string): ScheduleCurvePoint[] {
  const leaf = tasks.filter((t) => !t.isSummary && !t.isMilestone);
  if (leaf.length === 0) return [];

  const months = new Set<string>();
  for (const t of leaf) {
    months.add(t.startDate.slice(0, 7));
    months.add(t.endDate.slice(0, 7));
    if (t.baselineFinish) months.add(t.baselineFinish.slice(0, 7));
  }
  const sorted = [...months].sort();
  const asOf = new Date(`${asOfDate}T12:00:00`).getTime();

  return sorted.map((month) => {
    let plannedSum = 0;
    let actualSum = 0;
    const monthEnd = new Date(`${month}-28T12:00:00`).getTime();
    for (const t of leaf) {
      const planEnd = new Date(`${(t.baselineFinish ?? t.endDate).slice(0, 10)}T12:00:00`).getTime();
      const planStart = new Date(`${(t.baselineStart ?? t.startDate).slice(0, 10)}T12:00:00`).getTime();
      const planPct = monthEnd >= planEnd ? 1 : monthEnd > planStart ? 0.5 : 0;
      plannedSum += planPct;
      const workPct = Math.min(100, t.percentComplete) / 100;
      const curEnd = new Date(`${t.endDate}T12:00:00`).getTime();
      const curStart = new Date(`${t.startDate}T12:00:00`).getTime();
      let actualPct = 0;
      if (asOf >= curEnd) actualPct = workPct;
      else if (asOf > curStart) actualPct = workPct * 0.5;
      if (monthEnd >= curEnd) actualPct = workPct;
      actualSum += actualPct;
    }
    const n = leaf.length;
    return {
      month,
      plannedCumulativePct: Math.round((plannedSum / n) * 100),
      actualCumulativePct: Math.round((actualSum / n) * 100),
    };
  });
}

export interface ProjectForecastReport {
  projectId: string;
  forecastDelayDays: number;
  scheduleVarianceDays: number;
  health: ProjectHealth;
  messageKey: "on_track" | "delay_forecast";
}

export function buildProjectForecast(
  project: Project,
  tasks: Task[],
  dependencies: TaskDependency[],
  evm: EVMMetrics,
): ProjectForecastReport {
  const cpm = calculateCPM(tasks, dependencies, project.startDate);
  const scheduleVar = scheduleVarianceDays(project.endDate, cpm.projectEnd);
  const forecastDelayDays = forecastProjectDelay(
    tasks,
    dependencies,
    project.startDate,
    project.endDate,
    evm,
  );
  const health = computeProjectHealth({ tasks, evm, projectEnd: project.endDate, budgetCap: project.budgetCap });
  return {
    projectId: project.id,
    forecastDelayDays,
    scheduleVarianceDays: scheduleVar,
    health,
    messageKey: forecastDelayDays > 0 ? "delay_forecast" : "on_track",
  };
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export interface ExecutivePortfolioSummary extends PortfolioOverview {
  generatedAt: string;
  counts: { on_track: number; at_risk: number; critical: number };
  rollup: OrgDashboardRollup;
}
