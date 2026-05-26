"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plannedPctForCashMonth = plannedPctForCashMonth;
exports.calculateEVM = calculateEVM;
/** Planned % elapsed for a budget line keyed by cash month (YYYY-MM). */
function plannedPctForCashMonth(cashMonth, asOfDate) {
    const asOfMonth = asOfDate.slice(0, 7);
    if (asOfMonth > cashMonth)
        return 1;
    if (asOfMonth < cashMonth)
        return 0;
    const [y, m] = cashMonth.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const day = Math.max(1, parseInt(asOfDate.slice(8, 10), 10));
    return Math.min(1, day / lastDay);
}
function taskPlannedPct(t, asOf) {
    const start = new Date(t.baselineStart ?? t.startDate).getTime();
    const end = new Date(t.baselineFinish ?? t.endDate).getTime();
    const span = Math.max(end - start, 1);
    if (asOf >= end)
        return 1;
    if (asOf > start)
        return (asOf - start) / span;
    return 0;
}
function taskEarnedValue(t, taskBudget) {
    if (t.earnedValue != null && t.earnedValue >= 0)
        return t.earnedValue;
    return taskBudget * (t.percentComplete / 100);
}
function lineEarnedValue(line) {
    if (line.plannedAmount <= 0) {
        return line.actualAmount > 0 ? line.actualAmount : 0;
    }
    const pct = Math.min(1, line.actualAmount / line.plannedAmount);
    return line.plannedAmount * pct;
}
/**
 * Earned Value Management — tasks (time-weighted PV, progress EV) + general budget lines (by cash month).
 * @param projectBudget BAC: budgetCap or total planned (tasks + lines)
 */
function calculateEVM(tasks, projectBudget, asOfDate = new Date().toISOString().slice(0, 10), budgetLines = []) {
    const asOf = new Date(asOfDate).getTime();
    let pv = 0;
    let ev = 0;
    let ac = 0;
    for (const t of tasks) {
        if (t.isSummary)
            continue;
        const budget = t.plannedCost ?? 0;
        pv += budget * taskPlannedPct(t, asOf);
        ev += taskEarnedValue(t, budget);
        ac += t.actualCost ?? 0;
    }
    for (const line of budgetLines) {
        const planned = line.plannedAmount ?? 0;
        pv += planned * plannedPctForCashMonth(line.cashMonth, asOfDate);
        ev += lineEarnedValue(line);
        ac += line.actualAmount ?? 0;
    }
    const taskPlannedSum = tasks
        .filter((t) => !t.isSummary)
        .reduce((s, t) => s + (t.plannedCost ?? 0), 0);
    const linePlannedSum = budgetLines.reduce((s, l) => s + (l.plannedAmount ?? 0), 0);
    const bac = projectBudget > 0 ? projectBudget : taskPlannedSum + linePlannedSum;
    const cv = ev - ac;
    const sv = ev - pv;
    const cpi = ac > 0 ? ev / ac : 1;
    const spi = pv > 0 ? ev / pv : 1;
    const eac = cpi > 0 ? bac / cpi : bac;
    const etc = eac - ac;
    const vac = bac - eac;
    return { pv, ev, ac, cv, sv, cpi, spi, eac, etc, vac };
}
//# sourceMappingURL=evm.js.map