import type { Task, TaskDependency, DependencyType } from "../types";

const MS_PER_DAY = 86_400_000;

function parseDate(iso: string): number {
  return new Date(iso).getTime();
}

function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  return formatDate(parseDate(iso) + days * MS_PER_DAY);
}

function durationMs(task: Task): number {
  return task.durationDays * MS_PER_DAY;
}

interface GraphNode {
  task: Task;
  preds: Array<{ taskId: string; type: DependencyType; lagDays: number }>;
  succs: Array<{ taskId: string; type: DependencyType; lagDays: number }>;
}

function buildGraph(tasks: Task[], deps: TaskDependency[]): Map<string, GraphNode> {
  const nodes = new Map<string, GraphNode>();
  for (const t of tasks) {
    nodes.set(t.id, { task: t, preds: [], succs: [] });
  }
  for (const d of deps) {
    const pred = nodes.get(d.predecessorId);
    const succ = nodes.get(d.successorId);
    if (!pred || !succ) continue;
    pred.succs.push({ taskId: d.successorId, type: d.type, lagDays: d.lagDays });
    succ.preds.push({ taskId: d.predecessorId, type: d.type, lagDays: d.lagDays });
  }
  return nodes;
}

function topologicalSort(nodes: Map<string, GraphNode>): string[] {
  const inDegree = new Map<string, number>();
  for (const [id, n] of nodes) inDegree.set(id, n.preds.length);

  const queue: string[] = [];
  for (const [id, deg] of inDegree) if (deg === 0) queue.push(id);

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    const node = nodes.get(id)!;
    for (const s of node.succs) {
      const d = (inDegree.get(s.taskId) ?? 0) - 1;
      inDegree.set(s.taskId, d);
      if (d === 0) queue.push(s.taskId);
    }
  }
  return order;
}

function applyScheduleConstraint(
  es: number,
  ef: number,
  dur: number,
  constraint: Task["constraint"],
  constraintDate: string | undefined,
): { es: number; ef: number } {
  if (!constraint || constraint === "ASAP") return { es, ef };
  const cd = constraintDate ? parseDate(constraintDate) : null;
  if (cd == null && constraint !== "ALAP") return { es, ef };

  switch (constraint) {
    case "MSO":
      return { es: cd!, ef: cd! + dur };
    case "MFO":
      return { es: cd! - dur, ef: cd! };
    case "SNET":
      return { es: Math.max(es, cd!), ef: Math.max(es, cd!) + dur };
    case "SNLT":
      return { es: Math.min(es, cd!), ef: Math.min(es, cd!) + dur };
    case "FNET":
      return { es: Math.max(ef, cd!) - dur, ef: Math.max(ef, cd!) };
    case "FNLT":
      return { es: Math.min(ef, cd!) - dur, ef: Math.min(ef, cd!) };
    default:
      return { es, ef };
  }
}

function applyDependency(
  predES: number,
  predEF: number,
  predDur: number,
  succDur: number,
  type: DependencyType,
  lagMs: number,
): { es: number; ef: number } {
  switch (type) {
    case "FS":
      return { es: predEF + lagMs, ef: predEF + lagMs + succDur };
    case "SS":
      return { es: predES + lagMs, ef: predES + lagMs + succDur };
    case "FF":
      return { ef: predEF + lagMs, es: predEF + lagMs - succDur };
    case "SF":
      return { es: predEF + lagMs - succDur, ef: predES + lagMs };
    default:
      return { es: predEF + lagMs, ef: predEF + lagMs + succDur };
  }
}

export interface CPMResult {
  tasks: Task[];
  projectEnd: string;
  criticalPathIds: string[];
}

/**
 * Critical Path Method — forward/backward pass with FS/SS/FF/SF + lag.
 * Targets <200ms for 5k tasks (pure computation; client should batch UI).
 */
export function calculateCPM(
  tasks: Task[],
  dependencies: TaskDependency[],
  projectStart: string,
): CPMResult {
  if (tasks.length === 0) {
    return { tasks: [], projectEnd: projectStart, criticalPathIds: [] };
  }

  const nodes = buildGraph(tasks, dependencies);
  const order = topologicalSort(nodes);
  const projectStartMs = parseDate(projectStart);

  const earlyStart = new Map<string, number>();
  const earlyFinish = new Map<string, number>();

  for (const id of order) {
    const node = nodes.get(id)!;
    const t = node.task;
    const dur = durationMs(t);

    if (t.manuallyScheduled) {
      earlyStart.set(id, parseDate(t.startDate));
      earlyFinish.set(id, parseDate(t.endDate));
      continue;
    }

    let es = projectStartMs;
    for (const p of node.preds) {
      const predES = earlyStart.get(p.taskId) ?? projectStartMs;
      const predEF = earlyFinish.get(p.taskId) ?? projectStartMs;
      const predDur = durationMs(nodes.get(p.taskId)!.task);
      const lagMs = p.lagDays * MS_PER_DAY;
      const { es: candidateES } = applyDependency(predES, predEF, predDur, dur, p.type, lagMs);
      es = Math.max(es, candidateES);
    }
    const constrained = applyScheduleConstraint(es, es + dur, dur, t.constraint, t.constraintDate);
    earlyStart.set(id, constrained.es);
    earlyFinish.set(id, constrained.ef);
  }

  let projectEndMs = projectStartMs;
  for (const ef of earlyFinish.values()) projectEndMs = Math.max(projectEndMs, ef);

  const lateFinish = new Map<string, number>();
  const lateStart = new Map<string, number>();

  for (const id of [...order].reverse()) {
    const node = nodes.get(id)!;
    const t = node.task;
    const dur = durationMs(t);

    if (t.manuallyScheduled) {
      lateStart.set(id, parseDate(t.startDate));
      lateFinish.set(id, parseDate(t.endDate));
      continue;
    }

    let lf = projectEndMs;
    if (node.succs.length === 0) {
      lf = earlyFinish.get(id) ?? projectEndMs;
    } else {
      for (const s of node.succs) {
        const succLS = lateStart.get(s.taskId) ?? projectEndMs;
        const succLF = lateFinish.get(s.taskId) ?? projectEndMs;
        const succDur = durationMs(nodes.get(s.taskId)!.task);
        const lagMs = s.lagDays * MS_PER_DAY;
        let candidateLF: number;
        switch (s.type) {
          case "FS":
            candidateLF = succLS - lagMs;
            break;
          case "SS":
            candidateLF = succLS - lagMs + dur;
            break;
          case "FF":
            candidateLF = succLF - lagMs;
            break;
          case "SF":
            candidateLF = succLF - lagMs + dur;
            break;
          default:
            candidateLF = succLS - lagMs;
        }
        lf = Math.min(lf, candidateLF);
      }
    }
    let ls: number;
    if (t.constraint === "ALAP" && t.constraintDate) {
      const cd = parseDate(t.constraintDate);
      ls = cd;
      lf = cd + dur;
    } else {
      ls = lf - dur;
    }
    lateFinish.set(id, lf);
    lateStart.set(id, ls);
  }

  const criticalPathIds: string[] = [];
  const updatedTasks = tasks.map((t) => {
    const es = earlyStart.get(t.id) ?? parseDate(t.startDate);
    const ef = earlyFinish.get(t.id) ?? parseDate(t.endDate);
    const ls = lateStart.get(t.id) ?? es;
    const lf = lateFinish.get(t.id) ?? ef;
    const totalFloat = Math.round((ls - es) / MS_PER_DAY);
    const isCritical = totalFloat <= 0 && !t.isSummary;

    if (isCritical) criticalPathIds.push(t.id);

    if (t.manuallyScheduled) {
      return { ...t, isCritical, totalFloat, freeFloat: totalFloat };
    }

    return {
      ...t,
      startDate: formatDate(es),
      endDate: formatDate(ef),
      earlyStart: formatDate(es),
      earlyFinish: formatDate(ef),
      lateStart: formatDate(ls),
      lateFinish: formatDate(lf),
      totalFloat,
      freeFloat: totalFloat,
      isCritical,
    };
  });

  return {
    tasks: updatedTasks,
    projectEnd: formatDate(projectEndMs),
    criticalPathIds,
  };
}

export { addDays };
