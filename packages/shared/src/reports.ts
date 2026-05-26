import type { BudgetCategory, EVMMetrics } from "./types";

export interface ProjectStatusReport {
  projectId: string;
  projectName: string;
  generatedAt: string;
  health: "on_track" | "at_risk" | "critical";
  percentComplete: number;
  criticalTaskCount: number;
  lateTaskCount: number;
  evm: EVMMetrics;
  plannedBudget: number;
  actualCost: number;
  forecastEAC: number;
  topRisks: Array<{ taskName: string; reason: string }>;
}

export interface ResourceLoadReport {
  projectId: string;
  generatedAt: string;
  resources: Array<{
    name: string;
    peakUtilizationPct: number;
    overAllocationDays: number;
    totalAssignedHours: number;
  }>;
}

export interface CashFlowPoint {
  month: string;
  planned: number;
  actual: number;
}

export interface CashFlowReport {
  projectId: string;
  generatedAt: string;
  points: CashFlowPoint[];
}

export interface BudgetCategoryBreakdown {
  category: BudgetCategory;
  planned: number;
  actual: number;
  variance: number;
}

export interface BudgetTaskBreakdown {
  taskId: string;
  taskName: string;
  labor: number;
  material: number;
  other: number;
  planned: number;
  actual: number;
}

export interface BudgetCashFlowPoint extends CashFlowPoint {
  laborPlanned: number;
  materialPlanned: number;
  otherPlanned: number;
  laborActual: number;
  materialActual: number;
  otherActual: number;
  cumulativePlanned: number;
  cumulativeActual: number;
}

export interface BudgetOverviewReport {
  projectId: string;
  currency: string;
  budgetCap?: number;
  totalPlanned: number;
  totalActual: number;
  /** מתוכנן − בפועל (ביצוע). */
  variance: number;
  /** תקציב בסיס − סכום מתוכנן (כשהוגדר תקציב לפרויקט). */
  budgetVariance?: number;
  percentUsed?: number;
  byCategory: BudgetCategoryBreakdown[];
  byTask: BudgetTaskBreakdown[];
  cashFlow: BudgetCashFlowPoint[];
  evm: EVMMetrics;
  generatedAt: string;
  /** Non-blocking warnings (e.g. linked budget lines excluding task costs) */
  warnings?: string[];
}
