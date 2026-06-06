import type { ExecutivePortfolioSummary, OrgDashboardRollup } from "@nexus/shared";

export function emptyOrgDashboardRollup(): OrgDashboardRollup {
  return {
    totalPv: 0,
    totalEv: 0,
    totalAc: 0,
    totalEac: 0,
    totalVac: 0,
    totalCv: 0,
    totalSv: 0,
    totalBudgetCap: 0,
    avgPercentBudgetUsed: null,
    openRisks: 0,
    highRisks: 0,
    pendingChangeRequests: 0,
    pendingChangeImpactDays: 0,
    pendingChangeImpactCost: 0,
    pendingTimesheets: 0,
    pendingTimesheetHours: 0,
    totalCriticalTasks: 0,
    onTimeProjects: 0,
    delayedProjects: 0,
    resourceConflictCount: 0,
    projectsByStatus: { planning: 0, active: 0, on_hold: 0, completed: 0 },
    budgetByCategory: [],
  };
}

export function emptyExecutivePortfolio(
  organizationId = "",
  organizationName = "",
): ExecutivePortfolioSummary {
  return {
    organizationId,
    organizationName,
    projects: [],
    resourceConflicts: [],
    generatedAt: new Date().toISOString(),
    counts: { on_track: 0, at_risk: 0, critical: 0 },
    rollup: emptyOrgDashboardRollup(),
  };
}
