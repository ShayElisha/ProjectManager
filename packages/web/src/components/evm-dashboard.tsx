import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EVMMetrics } from "@nexus/shared";
import { cn } from "@/lib/utils";
import {
  budgetPlanVarianceStatus,
  evmContext,
  evmStatuses,
  overLimitStatus,
  type MetricStatus,
} from "@/lib/evm-display";

function statusClass(status?: MetricStatus) {
  return cn(
    status === "bad" && "text-red-500",
    status === "warn" && "text-amber-500",
    status === "ok" && "text-emerald-600",
  );
}

function MetricCard({
  label,
  hint,
  value,
  status,
  compact,
}: {
  label: string;
  hint?: string;
  value: string;
  status?: MetricStatus;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--border)] bg-[var(--card)]",
        compact ? "p-2.5" : "p-3",
      )}
    >
      <p className="text-xs text-[var(--muted)]">{label}</p>
      {hint && <p className="mt-0.5 text-[10px] leading-tight text-[var(--muted)]/80">{hint}</p>}
      <p
        className={cn(
          "mt-1 font-semibold tabular-nums",
          compact ? "text-base" : "text-lg",
          statusClass(status),
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Section({
  title,
  compact,
  children,
}: {
  title: string;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h4 className={cn("font-medium text-[var(--muted)]", compact ? "text-[11px]" : "text-xs")}>
        {title}
      </h4>
      <div className={cn("grid gap-2", compact ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-4")}>
        {children}
      </div>
    </div>
  );
}

export interface EvmDashboardProps {
  evm?: EVMMetrics | null;
  currency: string;
  budgetAllocated?: number | null;
  totalPlanned?: number;
  totalActual?: number;
  budgetVariance?: number | null;
  compact?: boolean;
  showEvmDetails?: boolean;
  className?: string;
}

export function EvmDashboard({
  evm,
  currency,
  budgetAllocated,
  totalPlanned,
  totalActual,
  budgetVariance: budgetVarianceProp,
  compact = false,
  showEvmDetails = false,
  className,
}: EvmDashboardProps) {
  const { t } = useTranslation();
  const [evmOpen, setEvmOpen] = useState(showEvmDetails);

  const fmt = useMemo(
    () => (n: number) =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(Math.round(n)),
    [currency],
  );

  const ctx = evm ? evmContext(evm, budgetAllocated) : {
    budgetAllocated: budgetAllocated ?? null,
    totalPlanned,
    totalActual,
    budgetVariance: budgetVarianceProp ?? null,
  };
  const planned = totalPlanned ?? ctx.totalPlanned;
  const actual = totalActual ?? ctx.totalActual;
  const bac = ctx.budgetAllocated;
  const budgetVariance = budgetVarianceProp ?? ctx.budgetVariance;
  const summaryStatuses = {
    planned: overLimitStatus(planned ?? 0, bac),
    actual: overLimitStatus(actual ?? 0, bac),
    budgetVariance: budgetPlanVarianceStatus(budgetVariance),
  };
  const evmDetailStatuses = evm
    ? evmStatuses(evm, { budgetAllocated: bac, totalPlanned: planned, totalActual: actual, budgetVariance })
    : null;

  return (
    <div className={cn("space-y-4", className)}>
      <Section title={t("budget.summary")} compact={compact}>
        {bac != null && bac > 0 ? (
          <MetricCard
            label={t("evm.bac")}
            hint={t("evm.bacHint")}
            value={fmt(bac)}
            compact={compact}
          />
        ) : (
          <MetricCard label={t("evm.bac")} hint={t("evm.bacUnset")} value="—" compact={compact} />
        )}
        {planned != null && (
          <MetricCard
            label={t("evm.totalPlanned")}
            hint={t("evm.plannedHint")}
            value={fmt(planned)}
            status={summaryStatuses.planned}
            compact={compact}
          />
        )}
        {actual != null && (
          <MetricCard
            label={t("evm.totalActual")}
            hint={t("evm.actualHint")}
            value={fmt(actual)}
            status={summaryStatuses.actual}
            compact={compact}
          />
        )}
        {budgetVariance != null ? (
          <MetricCard
            label={t("evm.budgetVariance")}
            hint={t("evm.budgetVarianceHint")}
            value={fmt(budgetVariance)}
            status={summaryStatuses.budgetVariance}
            compact={compact}
          />
        ) : (
          <MetricCard
            label={t("evm.budgetVariance")}
            hint={t("evm.budgetVarianceUnset")}
            value="—"
            compact={compact}
          />
        )}
      </Section>

      {evm && (
        <div className="border-t border-[var(--border)] pt-3">
          <button
            type="button"
            onClick={() => setEvmOpen((o) => !o)}
            className="flex w-full items-center justify-between text-xs font-medium text-[var(--muted)] hover:text-[var(--fg)]"
          >
            {t("evm.sectionAdvanced")}
            <ChevronDown size={14} className={cn("transition-transform", evmOpen && "rotate-180")} />
          </button>
          {evmOpen && evmDetailStatuses && (
            <div className="mt-3 space-y-4">
              <Section title={t("evm.sectionPerformance")} compact={compact}>
                <MetricCard label={t("evm.pv")} hint={t("evm.pvHint")} value={fmt(evm.pv)} compact={compact} />
                <MetricCard label={t("evm.ev")} value={fmt(evm.ev)} compact={compact} />
                <MetricCard
                  label={t("evm.ac")}
                  hint={t("evm.acHint")}
                  value={fmt(evm.ac)}
                  status={evmDetailStatuses.ac}
                  compact={compact}
                />
              </Section>
              <Section title={t("evm.sectionEfficiency")} compact={compact}>
                <MetricCard
                  label={t("evm.cpi")}
                  hint={t("evm.cpiHint")}
                  value={evm.cpi.toFixed(2)}
                  status={evmDetailStatuses.cpi}
                  compact={compact}
                />
                <MetricCard
                  label={t("evm.spi")}
                  hint={t("evm.spiHint")}
                  value={evm.spi.toFixed(2)}
                  status={evmDetailStatuses.spi}
                  compact={compact}
                />
              </Section>
              <Section title={t("evm.sectionForecast")} compact={compact}>
                <MetricCard
                  label={t("evm.eac")}
                  value={fmt(evm.eac)}
                  status={evmDetailStatuses.eac}
                  compact={compact}
                />
                <MetricCard
                  label={t("evm.evmForecastVac")}
                  hint={t("evm.evmForecastVacHint")}
                  value={fmt(evm.vac)}
                  status={evmDetailStatuses.evmForecastVac}
                  compact={compact}
                />
              </Section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
