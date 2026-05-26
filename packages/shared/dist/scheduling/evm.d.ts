import type { BudgetLineItem, EVMMetrics, Task } from "../types";
/** Planned % elapsed for a budget line keyed by cash month (YYYY-MM). */
export declare function plannedPctForCashMonth(cashMonth: string, asOfDate: string): number;
/**
 * Earned Value Management — tasks (time-weighted PV, progress EV) + general budget lines (by cash month).
 * @param projectBudget BAC: budgetCap or total planned (tasks + lines)
 */
export declare function calculateEVM(tasks: Task[], projectBudget: number, asOfDate?: string, budgetLines?: BudgetLineItem[]): EVMMetrics;
//# sourceMappingURL=evm.d.ts.map