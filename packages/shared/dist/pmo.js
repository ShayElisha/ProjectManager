"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeProjectHealth = computeProjectHealth;
exports.scheduleVarianceDays = scheduleVarianceDays;
exports.forecastProjectDelay = forecastProjectDelay;
exports.compareBaselineVariance = compareBaselineVariance;
exports.simulateTaskDelay = simulateTaskDelay;
exports.buildScheduleSCurve = buildScheduleSCurve;
exports.buildProjectForecast = buildProjectForecast;
const cpm_1 = require("./scheduling/cpm");
function computeProjectHealth(input) {
    const { tasks, evm } = input;
    const today = new Date().toISOString().slice(0, 10);
    const leaf = tasks.filter((t) => !t.isSummary);
    const late = leaf.filter((t) => t.endDate < today && t.percentComplete < 100);
    if (evm.cpi < 0.8 || evm.spi < 0.8 || late.length > 2)
        return "critical";
    if (evm.cpi < 0.9 || evm.spi < 0.9 || late.length > 0)
        return "at_risk";
    return "on_track";
}
function daysBetween(start, end) {
    const a = new Date(`${start}T12:00:00`).getTime();
    const b = new Date(`${end}T12:00:00`).getTime();
    return Math.round((b - a) / 86_400_000);
}
/** Days project end is after planned contract end (positive = late). */
function scheduleVarianceDays(projectEnd, cpmEnd) {
    if (!projectEnd)
        return 0;
    return daysBetween(projectEnd, cpmEnd);
}
function forecastProjectDelay(tasks, dependencies, projectStart, projectEnd, evm) {
    const today = new Date().toISOString().slice(0, 10);
    const leaf = tasks.filter((t) => !t.isSummary && t.percentComplete < 100);
    const lateDays = leaf
        .filter((t) => t.endDate < today)
        .reduce((max, t) => Math.max(max, daysBetween(t.endDate, today)), 0);
    let cpmDelay = 0;
    if (tasks.length > 0) {
        const { projectEnd: cpmEnd } = (0, cpm_1.calculateCPM)(tasks, dependencies, projectStart);
        if (projectEnd)
            cpmDelay = Math.max(0, daysBetween(projectEnd, cpmEnd));
        else
            cpmDelay = Math.max(0, daysBetween(today, cpmEnd));
    }
    let spiDelay = 0;
    if (evm && evm.spi > 0 && evm.spi < 1 && projectEnd) {
        const remaining = Math.max(0, daysBetween(today, projectEnd));
        spiDelay = Math.round(remaining * (1 / evm.spi - 1));
    }
    return Math.max(lateDays, cpmDelay, spiDelay);
}
function compareBaselineVariance(baseline, tasks) {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const rows = [];
    for (const snap of baseline.tasks) {
        const current = taskMap.get(snap.taskId);
        if (!current || current.isSummary)
            continue;
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
    const avgEndVarianceDays = rows.length > 0
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
function simulateTaskDelay(tasks, dependencies, projectStart, taskId, delayDays) {
    const target = tasks.find((t) => t.id === taskId);
    if (!target)
        throw new Error(`Task ${taskId} not found`);
    const before = (0, cpm_1.calculateCPM)(tasks, dependencies, projectStart);
    const beforeMap = new Map(before.tasks.map((t) => [t.id, t]));
    const adjusted = tasks.map((t) => {
        if (t.id !== taskId)
            return { ...t };
        const newDuration = Math.max(1, t.durationDays + delayDays);
        const newEnd = addDaysIso(t.startDate, newDuration - 1);
        return { ...t, durationDays: newDuration, endDate: newEnd, manuallyScheduled: true };
    });
    const after = (0, cpm_1.calculateCPM)(adjusted, dependencies, projectStart);
    const afterMap = new Map(after.tasks.map((t) => [t.id, t]));
    const impactedTasks = [];
    for (const t of tasks) {
        if (t.isSummary)
            continue;
        const b = beforeMap.get(t.id);
        const a = afterMap.get(t.id);
        if (!b || !a)
            continue;
        const endDeltaDays = daysBetween(b.endDate, a.endDate);
        const becameCritical = !b.isCritical && a.isCritical;
        if (endDeltaDays === 0 && !becameCritical && t.id !== taskId)
            continue;
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
function buildScheduleSCurve(tasks, asOfDate) {
    const leaf = tasks.filter((t) => !t.isSummary && !t.isMilestone);
    if (leaf.length === 0)
        return [];
    const months = new Set();
    for (const t of leaf) {
        months.add(t.startDate.slice(0, 7));
        months.add(t.endDate.slice(0, 7));
        if (t.baselineFinish)
            months.add(t.baselineFinish.slice(0, 7));
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
            if (asOf >= curEnd)
                actualPct = workPct;
            else if (asOf > curStart)
                actualPct = workPct * 0.5;
            if (monthEnd >= curEnd)
                actualPct = workPct;
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
function buildProjectForecast(project, tasks, dependencies, evm) {
    const cpm = (0, cpm_1.calculateCPM)(tasks, dependencies, project.startDate);
    const scheduleVar = scheduleVarianceDays(project.endDate, cpm.projectEnd);
    const forecastDelayDays = forecastProjectDelay(tasks, dependencies, project.startDate, project.endDate, evm);
    const health = computeProjectHealth({ tasks, evm, projectEnd: project.endDate, budgetCap: project.budgetCap });
    return {
        projectId: project.id,
        forecastDelayDays,
        scheduleVarianceDays: scheduleVar,
        health,
        messageKey: forecastDelayDays > 0 ? "delay_forecast" : "on_track",
    };
}
function addDaysIso(iso, n) {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
}
//# sourceMappingURL=pmo.js.map