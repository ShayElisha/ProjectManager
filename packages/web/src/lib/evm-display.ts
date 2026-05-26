import type { EVMMetrics } from "@nexus/shared";

export type MetricStatus = "ok" | "warn" | "bad" | "neutral";

/** תקציב בסיס − סכום מתוכנן (זהה ל-`budgetVarianceAtCompletion` ב-shared). */
export function budgetVarianceAtCompletion(
  budgetCap: number | undefined | null,
  totalPlanned: number,
): number | null {
  if (budgetCap == null || budgetCap <= 0) return null;
  return budgetCap - totalPlanned;
}

export function efficiencyStatus(value: number): MetricStatus {
  if (value >= 1) return "ok";
  if (value >= 0.9) return "warn";
  return "bad";
}

export function overLimitStatus(actual: number, limit?: number | null): MetricStatus {
  if (limit == null || limit <= 0) return "neutral";
  return actual > limit ? "bad" : "neutral";
}

export function budgetPlanVarianceStatus(variance: number | null | undefined): MetricStatus {
  if (variance == null) return "neutral";
  if (variance < 0) return "bad";
  if (variance > 0) return "ok";
  return "neutral";
}

export function evmContext(evm: EVMMetrics, budgetCap?: number | null) {
  const budgetAllocated = evm.budgetAllocated ?? budgetCap ?? null;
  const totalPlanned = evm.totalPlanned;
  const budgetVariance =
    evm.budgetVariance ??
    (totalPlanned != null ? budgetVarianceAtCompletion(budgetAllocated, totalPlanned) : null);

  return {
    budgetAllocated,
    totalPlanned,
    totalActual: evm.totalActual ?? evm.ac,
    budgetVariance,
  };
}

export function evmStatuses(
  evm: EVMMetrics,
  ctx: {
    budgetAllocated?: number | null;
    totalPlanned?: number;
    totalActual?: number;
    budgetVariance?: number | null;
  },
) {
  const bac = ctx.budgetAllocated;
  const planned = ctx.totalPlanned;
  const actual = ctx.totalActual ?? evm.ac;
  const budgetVariance =
    ctx.budgetVariance ??
    (planned != null ? budgetVarianceAtCompletion(bac, planned) : null);

  return {
    planned: overLimitStatus(planned ?? 0, bac),
    actual: overLimitStatus(actual, bac),
    budgetVariance: budgetPlanVarianceStatus(budgetVariance),
    ac: evm.ac > evm.pv && evm.pv > 0 ? "bad" : ("neutral" as MetricStatus),
    cpi: efficiencyStatus(evm.cpi),
    spi: efficiencyStatus(evm.spi),
    eac: overLimitStatus(evm.eac, bac),
    evmForecastVac: (evm.vac < 0 ? "bad" : evm.vac > 0 ? "ok" : "neutral") as MetricStatus,
  };
}
