"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskCostParts = taskCostParts;
exports.syncTaskCostTotals = syncTaskCostTotals;
exports.assignmentLaborCost = assignmentLaborCost;
exports.effectiveAssignmentsForTask = effectiveAssignmentsForTask;
exports.computeTaskLaborPlanned = computeTaskLaborPlanned;
exports.computeAssignmentLaborPlanned = computeAssignmentLaborPlanned;
exports.spreadCostOverTaskMonths = spreadCostOverTaskMonths;
exports.timesheetCountsTowardActual = timesheetCountsTowardActual;
exports.resolveTimesheetHourlyRate = resolveTimesheetHourlyRate;
exports.computeTimesheetLaborActual = computeTimesheetLaborActual;
exports.linkedTaskCategoryExclusions = linkedTaskCategoryExclusions;
exports.taskCostPartsForTotals = taskCostPartsForTotals;
exports.buildBudgetWarnings = buildBudgetWarnings;
exports.rollupTaskCosts = rollupTaskCosts;
exports.isMaterialBudgetCategory = isMaterialBudgetCategory;
exports.rollupTaskCostsFromBudgetLines = rollupTaskCostsFromBudgetLines;
exports.recalculateProjectCosts = recalculateProjectCosts;
exports.recalculateTaskLabor = recalculateTaskLabor;
exports.aggregateByCategory = aggregateByCategory;
exports.buildCashFlow = buildCashFlow;
exports.buildBudgetOverview = buildBudgetOverview;
exports.getProjectFinancials = getProjectFinancials;
exports.budgetVarianceAtCompletion = budgetVarianceAtCompletion;
exports.projectBudgetTotals = projectBudgetTotals;
const types_1 = require("./types");
const evm_1 = require("./scheduling/evm");
const CATEGORIES = [
    "labor",
    "material",
    "equipment",
    "subcontractor",
    "other",
];
function taskCostParts(t) {
    const laborP = t.plannedLaborCost ?? 0;
    const materialP = t.plannedMaterialCost ?? 0;
    const otherP = t.plannedOtherCost ?? 0;
    const laborA = t.actualLaborCost ?? 0;
    const materialA = t.actualMaterialCost ?? 0;
    const otherA = t.actualOtherCost ?? 0;
    const planned = t.plannedCost ?? laborP + materialP + otherP;
    const actual = t.actualCost ?? laborA + materialA + otherA;
    return { laborP, materialP, otherP, laborA, materialA, otherA, planned, actual };
}
function syncTaskCostTotals(task) {
    const { laborP, materialP, otherP, laborA, materialA, otherA } = taskCostParts(task);
    return {
        ...task,
        plannedLaborCost: laborP,
        plannedMaterialCost: materialP,
        plannedOtherCost: otherP,
        actualLaborCost: laborA,
        actualMaterialCost: materialA,
        actualOtherCost: otherA,
        plannedCost: laborP + materialP + otherP,
        actualCost: laborA + materialA + otherA,
    };
}
/** עלות שיבוץ: שעתי (שעות×תעריף) או גלובלי (סכום קבוע למשימה). */
function assignmentLaborCost(resource, workHours, units = 1) {
    if (!resource)
        return 0;
    if (resource.costPerUnit != null && resource.costPerUnit > 0) {
        return resource.costPerUnit * (units ?? 1);
    }
    const rate = resource.costPerHour ?? 0;
    return workHours * rate * (units ?? 1);
}
/** שיבוצים מפורשים + עובדים מ-assigneeIds עם שעות לפי משך המשימה. */
function effectiveAssignmentsForTask(task, assignments, members, defaultHoursPerDay) {
    const explicit = assignments.filter((a) => a.taskId === task.id);
    const byResource = new Map(explicit.map((a) => [a.resourceId, a]));
    const memberByResource = new Map(members.map((m) => [m.resourceId, m]));
    const durationDays = Math.max(1, task.durationDays ?? 1);
    for (const resourceId of task.assigneeIds) {
        if (byResource.has(resourceId))
            continue;
        const member = memberByResource.get(resourceId);
        const hoursPerDay = member?.hoursPerDay ?? defaultHoursPerDay;
        byResource.set(resourceId, {
            id: `implicit-${task.id}-${resourceId}`,
            taskId: task.id,
            resourceId,
            units: 1,
            workHours: durationDays * hoursPerDay,
        });
    }
    return [...byResource.values()];
}
function computeTaskLaborPlanned(task, assignments, resources, members, defaultHoursPerDay) {
    if (task.isSummary)
        return 0;
    const byId = new Map(resources.map((r) => [r.id, r]));
    return effectiveAssignmentsForTask(task, assignments, members, defaultHoursPerDay).reduce((sum, a) => sum + assignmentLaborCost(byId.get(a.resourceId), a.workHours, a.units), 0);
}
function computeAssignmentLaborPlanned(assignments, resources, taskId) {
    const byId = new Map(resources.map((r) => [r.id, r]));
    return assignments
        .filter((a) => a.taskId === taskId)
        .reduce((sum, a) => sum + assignmentLaborCost(byId.get(a.resourceId), a.workHours, a.units), 0);
}
/** מפזר עלות ליניארית לפי ימים בלוח השנה בין תאריך התחלה לסיום. */
function spreadCostOverTaskMonths(startDate, endDate, totalCost) {
    if (totalCost <= 0)
        return new Map();
    const start = new Date(startDate.slice(0, 10));
    const end = new Date(endDate.slice(0, 10));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return new Map([[startDate.slice(0, 7), totalCost]]);
    }
    if (end < start) {
        return new Map([[startDate.slice(0, 7), totalCost]]);
    }
    const dayMs = 86400000;
    const dayCounts = new Map();
    let totalDays = 0;
    for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
        const month = new Date(t).toISOString().slice(0, 7);
        dayCounts.set(month, (dayCounts.get(month) ?? 0) + 1);
        totalDays += 1;
    }
    if (totalDays === 0)
        return new Map([[startDate.slice(0, 7), totalCost]]);
    const out = new Map();
    for (const [month, days] of dayCounts) {
        out.set(month, (days / totalDays) * totalCost);
    }
    return out;
}
/** Submitted + approved count toward actual labor; rejected/draft do not. */
function timesheetCountsTowardActual(status) {
    return status === "approved" || status === "submitted";
}
/** Resolve worker on a timesheet to a resource id and hourly rate. */
function resolveTimesheetHourlyRate(entry, taskId, assignments, resources, members, assigneeIds) {
    const byId = new Map(resources.map((r) => [r.id, r]));
    let resourceId = entry.userId;
    if (!byId.has(resourceId)) {
        const member = members.find((m) => m.id === entry.userId || m.resourceId === entry.userId);
        if (member)
            resourceId = member.resourceId;
    }
    const fromAssignment = assignments.find((a) => a.taskId === taskId && a.resourceId === resourceId);
    if (fromAssignment) {
        const res = byId.get(resourceId);
        if (res?.costPerHour && res.costPerHour > 0)
            return res.costPerHour;
    }
    const direct = byId.get(resourceId);
    if (direct?.costPerHour && direct.costPerHour > 0)
        return direct.costPerHour;
    for (const aid of assigneeIds) {
        const r = byId.get(aid);
        if (r?.costPerHour && r.costPerHour > 0)
            return r.costPerHour;
    }
    for (const a of assignments.filter((x) => x.taskId === taskId)) {
        const r = byId.get(a.resourceId);
        if (r?.costPerHour && r.costPerHour > 0)
            return r.costPerHour;
    }
    for (const m of members) {
        const r = byId.get(m.resourceId);
        if (r?.costPerHour && r.costPerHour > 0)
            return r.costPerHour;
    }
    return 0;
}
function computeTimesheetLaborActual(taskId, timesheets, assignments, resources, assigneeIds, members = []) {
    const billable = timesheets.filter((e) => e.taskId === taskId && timesheetCountsTowardActual(e.status));
    if (billable.length === 0)
        return 0;
    let total = 0;
    for (const entry of billable) {
        const rate = resolveTimesheetHourlyRate(entry, taskId, assignments, resources, members, assigneeIds);
        total += entry.hours * rate;
    }
    return total;
}
/** Map budget line category to cash-flow bucket (labor | material | other). */
function lineCategoryBucket(cat) {
    if (cat === "labor")
        return "labor";
    if (cat === "material")
        return "material";
    return "other";
}
/** Task categories covered by budget lines linked via taskId (avoid double counting). */
function linkedTaskCategoryExclusions(lines) {
    const map = new Map();
    for (const line of lines) {
        if (!line.taskId)
            continue;
        const set = map.get(line.taskId) ?? new Set();
        set.add(line.category);
        map.set(line.taskId, set);
    }
    return map;
}
function taskCostPartsForTotals(t, excludeCategories) {
    const p = taskCostParts(t);
    if (!excludeCategories?.size)
        return p;
    return {
        ...p,
        laborP: excludeCategories.has("labor") ? 0 : p.laborP,
        laborA: excludeCategories.has("labor") ? 0 : p.laborA,
        materialP: excludeCategories.has("material") ? 0 : p.materialP,
        materialA: excludeCategories.has("material") ? 0 : p.materialA,
        otherP: excludeCategories.has("other") ||
            excludeCategories.has("equipment") ||
            excludeCategories.has("subcontractor")
            ? 0
            : p.otherP,
        otherA: excludeCategories.has("other") ||
            excludeCategories.has("equipment") ||
            excludeCategories.has("subcontractor")
            ? 0
            : p.otherA,
        planned: (excludeCategories.has("labor") ? 0 : p.laborP) +
            (excludeCategories.has("material") ? 0 : p.materialP) +
            (excludeCategories.has("other") ||
                excludeCategories.has("equipment") ||
                excludeCategories.has("subcontractor")
                ? 0
                : p.otherP),
        actual: (excludeCategories.has("labor") ? 0 : p.laborA) +
            (excludeCategories.has("material") ? 0 : p.materialA) +
            (excludeCategories.has("other") ||
                excludeCategories.has("equipment") ||
                excludeCategories.has("subcontractor")
                ? 0
                : p.otherA),
    };
}
function buildBudgetWarnings(tasks, lines) {
    const warnings = [];
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    for (const line of lines) {
        if (!line.taskId)
            continue;
        const task = taskById.get(line.taskId);
        if (!task) {
            warnings.push(`Budget line "${line.name}" links to missing task ${line.taskId}`);
            continue;
        }
        warnings.push(`Line "${line.name}" → task "${task.name}" (${line.category}): task ${line.category} excluded from totals`);
    }
    return warnings;
}
function rollupTaskCosts(tasks) {
    const byParent = new Map();
    for (const t of tasks) {
        const key = t.parentId;
        if (!byParent.has(key))
            byParent.set(key, []);
        byParent.get(key).push(t);
    }
    const result = new Map(tasks.map((t) => [t.id, { ...t }]));
    const roll = (taskId) => {
        const children = tasks.filter((t) => t.parentId === taskId);
        for (const c of children)
            roll(c.id);
        const task = result.get(taskId);
        if (!task?.isSummary)
            return;
        let laborP = 0;
        let materialP = 0;
        let otherP = 0;
        let laborA = 0;
        let materialA = 0;
        let otherA = 0;
        for (const child of children) {
            const c = result.get(child.id);
            const p = taskCostParts(c);
            laborP += p.laborP;
            materialP += p.materialP;
            otherP += p.otherP;
            laborA += p.laborA;
            materialA += p.materialA;
            otherA += p.otherA;
        }
        result.set(taskId, syncTaskCostTotals({
            ...task,
            plannedLaborCost: laborP,
            plannedMaterialCost: materialP,
            plannedOtherCost: otherP,
            actualLaborCost: laborA,
            actualMaterialCost: materialA,
            actualOtherCost: otherA,
        }));
    };
    const roots = tasks.filter((t) => !t.parentId);
    for (const r of roots)
        roll(r.id);
    return tasks.map((t) => result.get(t.id) ?? t);
}
function isMaterialBudgetCategory(cat) {
    return types_1.MATERIAL_BUDGET_CATEGORIES.includes(cat);
}
/** Push linked budget-line totals onto task material / other cost fields. */
function rollupTaskCostsFromBudgetLines(tasks, lines) {
    const materialByTask = new Map();
    const otherByTask = new Map();
    for (const line of lines) {
        if (!line.taskId || !isMaterialBudgetCategory(line.category))
            continue;
        const map = line.category === "material" ? materialByTask : otherByTask;
        const cur = map.get(line.taskId) ?? { planned: 0, actual: 0 };
        cur.planned += line.plannedAmount;
        cur.actual += line.actualAmount;
        map.set(line.taskId, cur);
    }
    const withCosts = tasks.map((t) => {
        if (t.isSummary)
            return t;
        const m = materialByTask.get(t.id);
        const o = otherByTask.get(t.id);
        if (!m && !o)
            return t;
        return syncTaskCostTotals({
            ...t,
            plannedMaterialCost: m?.planned ?? t.plannedMaterialCost ?? 0,
            actualMaterialCost: m?.actual ?? t.actualMaterialCost ?? 0,
            plannedOtherCost: o?.planned ?? t.plannedOtherCost ?? 0,
            actualOtherCost: o?.actual ?? t.actualOtherCost ?? 0,
        });
    });
    return rollupTaskCosts(withCosts);
}
function recalculateProjectCosts(tasks, lines, assignments, resources, timesheets, overwriteManual, members = [], hoursPerDay = 8) {
    const withLabor = tasks.map((t) => t.isSummary
        ? t
        : recalculateTaskLabor(t, assignments, resources, timesheets, overwriteManual, members, hoursPerDay));
    return rollupTaskCostsFromBudgetLines(withLabor, lines);
}
function recalculateTaskLabor(task, assignments, resources, timesheets, overwriteManual, members = [], defaultHoursPerDay = 8) {
    if (task.isSummary)
        return task;
    const plannedLabor = computeTaskLaborPlanned(task, assignments, resources, members, defaultHoursPerDay);
    const fromTimesheets = computeTimesheetLaborActual(task.id, timesheets, assignments, resources, task.assigneeIds, members);
    const source = task.laborCostSource ?? "auto";
    let actualLabor;
    if (source === "manual" && !overwriteManual) {
        actualLabor = task.actualLaborCost ?? plannedLabor;
    }
    else if (fromTimesheets > 0) {
        actualLabor = fromTimesheets;
    }
    else if (source === "timesheet") {
        actualLabor = overwriteManual ? plannedLabor : (task.actualLaborCost ?? 0);
    }
    else if (overwriteManual) {
        actualLabor = plannedLabor;
    }
    else {
        actualLabor = task.actualLaborCost ?? plannedLabor;
    }
    const next = {
        ...task,
        plannedLaborCost: plannedLabor,
        actualLaborCost: actualLabor,
        laborCostSource: fromTimesheets > 0 ? "timesheet" : (task.laborCostSource ?? "auto"),
    };
    if (overwriteManual) {
        next.plannedMaterialCost = task.plannedMaterialCost ?? 0;
        next.plannedOtherCost = task.plannedOtherCost ?? 0;
        next.actualMaterialCost = task.actualMaterialCost ?? 0;
        next.actualOtherCost = task.actualOtherCost ?? 0;
    }
    return syncTaskCostTotals(next);
}
function aggregateByCategory(tasks, lines) {
    const sums = new Map();
    for (const cat of CATEGORIES)
        sums.set(cat, { planned: 0, actual: 0 });
    const exclusions = linkedTaskCategoryExclusions(lines);
    for (const t of tasks) {
        if (t.isSummary)
            continue;
        const p = taskCostPartsForTotals(t, exclusions.get(t.id));
        const labor = sums.get("labor");
        labor.planned += p.laborP;
        labor.actual += p.laborA;
        const material = sums.get("material");
        material.planned += p.materialP;
        material.actual += p.materialA;
        const other = sums.get("other");
        other.planned += p.otherP;
        other.actual += p.otherA;
    }
    for (const line of lines) {
        const cat = line.category;
        const entry = sums.get(cat) ?? { planned: 0, actual: 0 };
        entry.planned += line.plannedAmount;
        entry.actual += line.actualAmount;
        sums.set(cat, entry);
    }
    return CATEGORIES.map((category) => {
        const { planned, actual } = sums.get(category) ?? { planned: 0, actual: 0 };
        return { category, planned, actual, variance: planned - actual };
    });
}
function buildCashFlow(tasks, lines, ctx) {
    const byMonth = new Map();
    const add = (month, planned, actual, bucket) => {
        const entry = byMonth.get(month) ?? {
            planned: 0,
            actual: 0,
            laborPlanned: 0,
            materialPlanned: 0,
            otherPlanned: 0,
            laborActual: 0,
            materialActual: 0,
            otherActual: 0,
        };
        entry.planned += planned;
        entry.actual += actual;
        if (bucket === "labor") {
            entry.laborPlanned += planned;
            entry.laborActual += actual;
        }
        else if (bucket === "material") {
            entry.materialPlanned += planned;
            entry.materialActual += actual;
        }
        else {
            entry.otherPlanned += planned;
            entry.otherActual += actual;
        }
        byMonth.set(month, entry);
    };
    const resourceById = ctx ? new Map(ctx.resources.map((r) => [r.id, r])) : null;
    const members = ctx?.members ?? [];
    const hoursPerDay = ctx?.hoursPerDay ?? 8;
    const tasksById = new Map(tasks.map((t) => [t.id, t]));
    for (const t of tasks) {
        if (t.isSummary)
            continue;
        const month = t.startDate.slice(0, 7);
        const p = taskCostParts(t);
        if (ctx && resourceById) {
            const effective = effectiveAssignmentsForTask(t, ctx.assignments, members, hoursPerDay);
            if (effective.length > 0) {
                for (const a of effective) {
                    const cost = assignmentLaborCost(resourceById.get(a.resourceId), a.workHours, a.units);
                    for (const [m, amount] of spreadCostOverTaskMonths(t.startDate, t.endDate, cost)) {
                        add(m, amount, 0, "labor");
                    }
                }
            }
            else if (p.laborP > 0) {
                for (const [m, amount] of spreadCostOverTaskMonths(t.startDate, t.endDate, p.laborP)) {
                    add(m, amount, 0, "labor");
                }
            }
        }
        else {
            for (const [m, amount] of spreadCostOverTaskMonths(t.startDate, t.endDate, p.laborP)) {
                add(m, amount, 0, "labor");
            }
            for (const [m, amount] of spreadCostOverTaskMonths(t.startDate, t.endDate, p.laborA)) {
                add(m, 0, amount, "labor");
            }
        }
        for (const [m, amount] of spreadCostOverTaskMonths(t.startDate, t.endDate, p.materialP)) {
            add(m, amount, 0, "material");
        }
        for (const [m, amount] of spreadCostOverTaskMonths(t.startDate, t.endDate, p.materialA)) {
            add(m, 0, amount, "material");
        }
        for (const [m, amount] of spreadCostOverTaskMonths(t.startDate, t.endDate, p.otherP)) {
            add(m, amount, 0, "other");
        }
        for (const [m, amount] of spreadCostOverTaskMonths(t.startDate, t.endDate, p.otherA)) {
            add(m, 0, amount, "other");
        }
    }
    if (ctx && resourceById) {
        const members = ctx.members ?? [];
        for (const entry of ctx.timesheets) {
            if (!timesheetCountsTowardActual(entry.status))
                continue;
            const task = tasksById.get(entry.taskId);
            if (!task || task.isSummary)
                continue;
            const rate = resolveTimesheetHourlyRate(entry, entry.taskId, ctx.assignments, ctx.resources, members, task.assigneeIds);
            if (rate <= 0)
                continue;
            add(entry.date.slice(0, 7), 0, entry.hours * rate, "labor");
        }
    }
    for (const line of lines) {
        const bucket = lineCategoryBucket(line.category);
        add(line.cashMonth, line.plannedAmount, line.actualAmount, bucket);
    }
    let cumP = 0;
    let cumA = 0;
    return [...byMonth.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, v]) => {
        cumP += v.planned;
        cumA += v.actual;
        return {
            month,
            planned: v.planned,
            actual: v.actual,
            laborPlanned: v.laborPlanned,
            materialPlanned: v.materialPlanned,
            otherPlanned: v.otherPlanned,
            laborActual: v.laborActual,
            materialActual: v.materialActual,
            otherActual: v.otherActual,
            cumulativePlanned: cumP,
            cumulativeActual: cumA,
        };
    });
}
function buildBudgetOverview(input) {
    const { projectId, currency, budgetCap, tasks, lines, assignments, resources, timesheets, members = [], hoursPerDay = 8, } = input;
    const rolled = recalculateProjectCosts(tasks, lines, assignments, resources, timesheets, false, members, hoursPerDay);
    const leaf = rolled.filter((t) => !t.isSummary);
    const exclusions = linkedTaskCategoryExclusions(lines);
    const totalPlanned = leaf.reduce((s, t) => s + taskCostPartsForTotals(t, exclusions.get(t.id)).planned, 0) +
        lines.reduce((s, l) => s + l.plannedAmount, 0);
    const totalActual = leaf.reduce((s, t) => s + taskCostPartsForTotals(t, exclusions.get(t.id)).actual, 0) +
        lines.reduce((s, l) => s + l.actualAmount, 0);
    const bac = budgetCap ?? totalPlanned;
    const budgetVariance = budgetVarianceAtCompletion(budgetCap, totalPlanned);
    const evm = {
        ...(0, evm_1.calculateEVM)(rolled, bac, new Date().toISOString().slice(0, 10), lines),
        totalPlanned,
        totalActual,
        budgetAllocated: budgetCap ?? null,
        budgetVariance,
    };
    const warnings = buildBudgetWarnings(rolled, lines);
    const byTask = leaf.map((t) => {
        const p = taskCostPartsForTotals(t, exclusions.get(t.id));
        return {
            taskId: t.id,
            taskName: t.name,
            labor: p.laborP,
            material: p.materialP,
            other: p.otherP,
            planned: p.planned,
            actual: p.actual,
        };
    });
    return {
        projectId,
        currency,
        budgetCap,
        totalPlanned,
        totalActual,
        variance: totalPlanned - totalActual,
        budgetVariance: budgetVariance ?? undefined,
        percentUsed: budgetCap && budgetCap > 0 ? (totalActual / budgetCap) * 100 : undefined,
        byCategory: aggregateByCategory(rolled, lines),
        byTask,
        cashFlow: buildCashFlow(rolled, lines, {
            assignments,
            resources,
            timesheets,
            members,
            hoursPerDay,
        }),
        evm,
        generatedAt: new Date().toISOString(),
        warnings: warnings.length > 0 ? warnings : undefined,
    };
}
function getProjectFinancials(input) {
    return buildBudgetOverview(input);
}
/** תקציב בסיס פחות סכום מתוכנן (צפי הוצאה מכל המשימות). */
function budgetVarianceAtCompletion(budgetCap, totalPlanned) {
    if (budgetCap == null || budgetCap <= 0)
        return null;
    return budgetCap - totalPlanned;
}
function projectBudgetTotals(tasks, lines) {
    const rolled = rollupTaskCosts(tasks);
    const leaf = rolled.filter((t) => !t.isSummary);
    const exclusions = linkedTaskCategoryExclusions(lines);
    const planned = leaf.reduce((s, t) => s + taskCostPartsForTotals(t, exclusions.get(t.id)).planned, 0) +
        lines.reduce((s, l) => s + l.plannedAmount, 0);
    const actual = leaf.reduce((s, t) => s + taskCostPartsForTotals(t, exclusions.get(t.id)).actual, 0) +
        lines.reduce((s, l) => s + l.actualAmount, 0);
    return { planned, actual, tasks: rolled };
}
//# sourceMappingURL=budget.js.map