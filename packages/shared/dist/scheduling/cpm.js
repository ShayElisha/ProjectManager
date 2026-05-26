"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCPM = calculateCPM;
exports.addDays = addDays;
const MS_PER_DAY = 86_400_000;
function parseDate(iso) {
    return new Date(iso).getTime();
}
function formatDate(ms) {
    return new Date(ms).toISOString().slice(0, 10);
}
function addDays(iso, days) {
    return formatDate(parseDate(iso) + days * MS_PER_DAY);
}
function durationMs(task) {
    return task.durationDays * MS_PER_DAY;
}
function buildGraph(tasks, deps) {
    const nodes = new Map();
    for (const t of tasks) {
        nodes.set(t.id, { task: t, preds: [], succs: [] });
    }
    for (const d of deps) {
        const pred = nodes.get(d.predecessorId);
        const succ = nodes.get(d.successorId);
        if (!pred || !succ)
            continue;
        pred.succs.push({ taskId: d.successorId, type: d.type, lagDays: d.lagDays });
        succ.preds.push({ taskId: d.predecessorId, type: d.type, lagDays: d.lagDays });
    }
    return nodes;
}
function topologicalSort(nodes) {
    const inDegree = new Map();
    for (const [id, n] of nodes)
        inDegree.set(id, n.preds.length);
    const queue = [];
    for (const [id, deg] of inDegree)
        if (deg === 0)
            queue.push(id);
    const order = [];
    while (queue.length > 0) {
        const id = queue.shift();
        order.push(id);
        const node = nodes.get(id);
        for (const s of node.succs) {
            const d = (inDegree.get(s.taskId) ?? 0) - 1;
            inDegree.set(s.taskId, d);
            if (d === 0)
                queue.push(s.taskId);
        }
    }
    return order;
}
function applyDependency(predES, predEF, predDur, succDur, type, lagMs) {
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
/**
 * Critical Path Method — forward/backward pass with FS/SS/FF/SF + lag.
 * Targets <200ms for 5k tasks (pure computation; client should batch UI).
 */
function calculateCPM(tasks, dependencies, projectStart) {
    if (tasks.length === 0) {
        return { tasks: [], projectEnd: projectStart, criticalPathIds: [] };
    }
    const nodes = buildGraph(tasks, dependencies);
    const order = topologicalSort(nodes);
    const projectStartMs = parseDate(projectStart);
    const earlyStart = new Map();
    const earlyFinish = new Map();
    for (const id of order) {
        const node = nodes.get(id);
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
            const predDur = durationMs(nodes.get(p.taskId).task);
            const lagMs = p.lagDays * MS_PER_DAY;
            const { es: candidateES } = applyDependency(predES, predEF, predDur, dur, p.type, lagMs);
            es = Math.max(es, candidateES);
        }
        earlyStart.set(id, es);
        earlyFinish.set(id, es + dur);
    }
    let projectEndMs = projectStartMs;
    for (const ef of earlyFinish.values())
        projectEndMs = Math.max(projectEndMs, ef);
    const lateFinish = new Map();
    const lateStart = new Map();
    for (const id of [...order].reverse()) {
        const node = nodes.get(id);
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
        }
        else {
            for (const s of node.succs) {
                const succLS = lateStart.get(s.taskId) ?? projectEndMs;
                const succLF = lateFinish.get(s.taskId) ?? projectEndMs;
                const succDur = durationMs(nodes.get(s.taskId).task);
                const lagMs = s.lagDays * MS_PER_DAY;
                let candidateLF;
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
        lateFinish.set(id, lf);
        lateStart.set(id, lf - dur);
    }
    const criticalPathIds = [];
    const updatedTasks = tasks.map((t) => {
        const es = earlyStart.get(t.id) ?? parseDate(t.startDate);
        const ef = earlyFinish.get(t.id) ?? parseDate(t.endDate);
        const ls = lateStart.get(t.id) ?? es;
        const lf = lateFinish.get(t.id) ?? ef;
        const totalFloat = Math.round((ls - es) / MS_PER_DAY);
        const isCritical = totalFloat <= 0 && !t.isSummary;
        if (isCritical)
            criticalPathIds.push(t.id);
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
//# sourceMappingURL=cpm.js.map