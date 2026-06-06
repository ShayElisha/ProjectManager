import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowUpRight,
  Ban,
  CalendarClock,
  CircleDollarSign,
  FileStack,
  LayoutDashboard,
  ShieldAlert,
  Sparkles,
  Timer,
  TrendingUp,
  Users,
} from "lucide-react";
import type {
  ExecutivePortfolioSummary,
  ExecutiveSummary,
  OrgDashboardRollup,
  PortfolioProjectSummary,
  ProjectHealth,
  RejectionRecord,
} from "@nexus/shared";
import { api } from "@/lib/api";
import { emptyExecutivePortfolio } from "@/lib/empty-portfolio";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DonutChart,
  DualMetricChart,
  GroupedBudgetChart,
  VerticalBarChart,
  ProjectScheduleOutlookChart,
  type ScheduleOutlook,
} from "@/components/dashboard/dashboard-charts";
import { DashboardLoading } from "@/components/dashboard/dashboard-loading";

const OUTLOOK_COLORS: Record<ScheduleOutlook, string> = {
  on_time: "#22c55e",
  at_risk: "#f59e0b",
  delayed: "#f97316",
  severe: "#ef4444",
};

function getScheduleOutlook(p: PortfolioProjectSummary): ScheduleOutlook {
  if (p.status === "completed") return "on_time";
  if (p.forecastDelayDays >= 14) return "severe";
  if (p.forecastDelayDays > 0) return "delayed";
  if (p.health === "at_risk" || p.scheduleVarianceDays > 0) return "at_risk";
  return "on_time";
}

const HEALTH_COLORS: Record<ProjectHealth, string> = {
  on_track: "#22c55e",
  at_risk: "#f59e0b",
  critical: "#ef4444",
};

const HEALTH_ROW: Record<ProjectHealth, string> = {
  on_track: "border-emerald-500/25 bg-emerald-500/[0.06]",
  at_risk: "border-amber-500/30 bg-amber-500/[0.06]",
  critical: "border-red-500/35 bg-red-500/[0.06]",
};

const HEALTH_BADGE: Record<ProjectHealth, string> = {
  on_track: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  at_risk: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  critical: "bg-red-500/15 text-red-600 dark:text-red-400",
};

function fallbackOrgRollup(portfolio: ExecutivePortfolioSummary): OrgDashboardRollup {
  const projects = portfolio.projects;
  return {
    totalPv: projects.reduce((s, p) => s + (p.pv ?? 0), 0),
    totalEv: projects.reduce((s, p) => s + (p.ev ?? 0), 0),
    totalAc: projects.reduce((s, p) => s + p.actualCost, 0),
    totalEac: projects.reduce((s, p) => s + (p.eac ?? p.actualCost), 0),
    totalVac: projects.reduce((s, p) => s + (p.vac ?? 0), 0),
    totalCv: 0,
    totalSv: 0,
    totalBudgetCap: projects.reduce((s, p) => s + (p.budgetCap ?? 0), 0),
    avgPercentBudgetUsed: null,
    openRisks: 0,
    highRisks: 0,
    pendingChangeRequests: 0,
    pendingChangeImpactDays: 0,
    pendingChangeImpactCost: 0,
    pendingTimesheets: 0,
    pendingTimesheetHours: 0,
    totalCriticalTasks: projects.reduce((s, p) => s + p.criticalCount, 0),
    onTimeProjects: projects.filter((p) => p.forecastDelayDays === 0).length,
    delayedProjects: projects.filter((p) => p.forecastDelayDays > 0).length,
    resourceConflictCount: portfolio.resourceConflicts.length,
    projectsByStatus: projects.reduce(
      (acc, p) => {
        acc[p.status]++;
        return acc;
      },
      { planning: 0, active: 0, on_hold: 0, completed: 0 },
    ),
    budgetByCategory: [],
  };
}

function computeRollup(portfolio: ExecutivePortfolioSummary) {
  const { projects } = portfolio;
  const n = projects.length || 1;
  return {
    projectCount: projects.length,
    avgProgress: Math.round(
      projects.reduce((s, p) => s + p.percentComplete, 0) / n,
    ),
    totalPlanned: projects.reduce((s, p) => s + p.plannedBudget, 0),
    totalActual: projects.reduce((s, p) => s + p.actualCost, 0),
    totalLate: projects.reduce((s, p) => s + p.lateTaskCount, 0),
    totalTasks: projects.reduce((s, p) => s + p.taskCount, 0),
    avgCpi: Math.round((projects.reduce((s, p) => s + p.cpi, 0) / n) * 100) / 100,
    avgSpi: Math.round((projects.reduce((s, p) => s + p.spi, 0) / n) * 100) / 100,
    maxForecast: Math.max(0, ...projects.map((p) => p.forecastDelayDays)),
    delayedProjects: projects.filter((p) => p.forecastDelayDays > 0).length,
  };
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  gradient,
  className,
  onClick,
  alert,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof LayoutDashboard;
  gradient: string;
  className?: string;
  onClick?: () => void;
  alert?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "dashboard-glass group relative w-full overflow-hidden rounded-2xl p-4 text-start transition-shadow hover:shadow-lg",
        onClick && "cursor-pointer hover:ring-2 hover:ring-[var(--accent)]/30",
        alert && "ring-1 ring-amber-500/40",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -end-6 -top-6 h-24 w-24 rounded-full opacity-40 blur-2xl transition-opacity group-hover:opacity-60",
          gradient,
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-[var(--muted)]">{sub}</p>}
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-lg",
            gradient,
          )}
        >
          <Icon size={20} />
        </div>
      </div>
    </Tag>
  );
}

function EvmMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "neutral";
}) {
  return (
    <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--bg)]/40 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-lg font-bold tabular-nums",
          tone === "good" && "text-emerald-600",
          tone === "bad" && "text-red-600",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  className,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section
      className={cn("dashboard-glass flex flex-col rounded-2xl p-4 sm:p-5", className)}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-[var(--muted)]">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export function DashboardView() {
  const { t } = useTranslation();
  const rawPortfolio = useAppStore((s) => s.portfolio);
  const loading = useAppStore((s) => s.loading);
  const loadPortfolio = useAppStore((s) => s.loadPortfolio);
  const selectProject = useAppStore((s) => s.selectProject);
  const setSection = useAppStore((s) => s.setSection);

  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [rejections, setRejections] = useState<RejectionRecord[]>([]);

  useEffect(() => {
    void loadPortfolio();
    void api.executiveSummary().then(setSummary).catch(() => setSummary(null));
    void api.listRejections().then(setRejections).catch(() => setRejections([]));
  }, [loadPortfolio]);

  const portfolio = rawPortfolio ?? emptyExecutivePortfolio();

  const counts = useMemo(() => {
    return (
      portfolio.counts ??
      portfolio.projects.reduce(
        (acc, p) => {
          acc[p.health]++;
          return acc;
        },
        { on_track: 0, at_risk: 0, critical: 0 } as Record<ProjectHealth, number>,
      )
    );
  }, [portfolio]);

  const rollup = useMemo(() => computeRollup(portfolio), [portfolio]);

  const scheduleOutlook = useMemo(() => {
    const empty = {
      on_time: 0,
      at_risk: 0,
      delayed: 0,
      severe: 0,
    };
    const emptyLists: Record<ScheduleOutlook, PortfolioProjectSummary[]> = {
      on_time: [],
      at_risk: [],
      delayed: [],
      severe: [],
    };
    const counts = { ...empty };
    const byOutlook = {
      on_time: [] as PortfolioProjectSummary[],
      at_risk: [] as PortfolioProjectSummary[],
      delayed: [] as PortfolioProjectSummary[],
      severe: [] as PortfolioProjectSummary[],
    };
    for (const p of portfolio.projects) {
      const o = getScheduleOutlook(p);
      counts[o]++;
      byOutlook[o].push(p);
    }
    return { counts, byOutlook };
  }, [portfolio]);

  const fmt = (n: number, currency = "ILS") =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);

  if (loading && rawPortfolio === null) {
    return <DashboardLoading />;
  }

  const shortName = (name: string) =>
    name.length > 10 ? `${name.slice(0, 9)}…` : name;

  const progressBars = portfolio.projects.map((p) => ({
    id: p.id,
    label: shortName(p.name),
    value: p.percentComplete,
    color:
      p.health === "critical"
        ? "#ef4444"
        : p.health === "at_risk"
          ? "#f59e0b"
          : "var(--accent)",
  }));

  const budgetBars = portfolio.projects.slice(0, 8).map((p) => ({
    id: p.id,
    label: shortName(p.name),
    planned: p.plannedBudget,
    actual: p.actualCost,
  }));

  const evmBars = portfolio.projects.slice(0, 8).map((p) => ({
    id: p.id,
    label: shortName(p.name),
    cpi: p.cpi,
    spi: p.spi,
  }));

  const delayBars = portfolio.projects
    .filter((p) => p.forecastDelayDays > 0)
    .sort((a, b) => b.forecastDelayDays - a.forecastDelayDays)
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      label: shortName(p.name),
      value: p.forecastDelayDays,
      color: "#ef4444",
    }));

  const primaryCurrency = portfolio.projects[0]?.currency ?? "ILS";
  const org = portfolio.rollup ?? fallbackOrgRollup(portfolio);

  const scheduleBarRows = portfolio.projects.map((p) => ({
    id: p.id,
    label: shortName(p.name),
    outlook: getScheduleOutlook(p),
    delayDays: p.forecastDelayDays,
    scheduleVarianceDays: p.scheduleVarianceDays,
  }));

  return (
    <div className="dashboard-page dashboard-content-enter flex flex-col gap-5 pb-8">
      <header className="dashboard-hero relative overflow-hidden rounded-2xl px-5 py-6 sm:px-8 sm:py-8">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[var(--accent)]">
              <LayoutDashboard size={22} />
              <span className="text-xs font-semibold uppercase tracking-wider">
                {t("dashboard.badge")}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("dashboard.title")}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {portfolio.organizationName} · {t("dashboard.updated", {
                time: portfolio.generatedAt?.slice(11, 16) ?? "—",
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {t("executive.countOnTrack", { count: counts.on_track })}
            </span>
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
              {t("executive.countAtRisk", { count: counts.at_risk })}
            </span>
            <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-medium text-red-600">
              {t("executive.countCritical", { count: counts.critical })}
            </span>
          </div>
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">
          {t("dashboard.priorityTitle")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label={t("dashboard.priority.onTime")}
            value={String(org.onTimeProjects)}
            sub={t("dashboard.priority.delayedSub", { count: org.delayedProjects })}
            icon={CalendarClock}
            gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          />
          <KpiCard
            label={t("dashboard.priority.pendingCr")}
            value={String(org.pendingChangeRequests)}
            sub={
              org.pendingChangeRequests > 0
                ? t("dashboard.priority.crImpact", {
                    days: org.pendingChangeImpactDays,
                    cost: fmt(org.pendingChangeImpactCost, primaryCurrency),
                  })
                : t("dashboard.priority.nonePending")
            }
            icon={FileStack}
            gradient="bg-gradient-to-br from-amber-500 to-orange-600"
            alert={org.pendingChangeRequests > 0}
            onClick={() => setSection("controls")}
          />
          <KpiCard
            label={t("dashboard.priority.pendingTs")}
            value={String(org.pendingTimesheets)}
            sub={
              org.pendingTimesheets > 0
                ? t("dashboard.priority.tsHours", { hours: org.pendingTimesheetHours })
                : t("dashboard.priority.nonePending")
            }
            icon={Timer}
            gradient="bg-gradient-to-br from-sky-500 to-cyan-600"
            alert={org.pendingTimesheets > 0}
            onClick={() => setSection("timesheets")}
          />
          <KpiCard
            label={t("dashboard.priority.risks")}
            value={String(org.openRisks)}
            sub={t("dashboard.priority.highRisks", { count: org.highRisks })}
            icon={ShieldAlert}
            gradient="bg-gradient-to-br from-rose-500 to-red-600"
            alert={org.highRisks > 0}
            onClick={() => setSection("controls")}
          />
          <KpiCard
            label={t("dashboard.priority.conflicts")}
            value={String(org.resourceConflictCount)}
            sub={t("dashboard.priority.criticalTasks", { count: org.totalCriticalTasks })}
            icon={Users}
            gradient="bg-gradient-to-br from-violet-500 to-purple-600"
            alert={org.resourceConflictCount > 0}
          />
          <KpiCard
            label={t("dashboard.priority.rejections")}
            value={String(rejections.length)}
            sub={t("dashboard.priority.rejectionsSub")}
            icon={Ban}
            gradient="bg-gradient-to-br from-red-500 to-rose-600"
            alert={rejections.length > 0}
            onClick={() => setSection("rejections")}
          />
          <KpiCard
            label={t("dashboard.priority.forecastCost")}
            value={fmt(org.totalEac, primaryCurrency)}
            sub={t("dashboard.priority.vac", {
              amount: fmt(org.totalVac, primaryCurrency),
            })}
            icon={CircleDollarSign}
            gradient="bg-gradient-to-br from-indigo-500 to-violet-600"
            alert={org.totalVac < 0}
          />
          <KpiCard
            label={t("dashboard.priority.budgetUsed")}
            value={
              org.avgPercentBudgetUsed != null
                ? `${org.avgPercentBudgetUsed}%`
                : fmt(org.totalAc, primaryCurrency)
            }
            sub={
              org.totalBudgetCap > 0
                ? t("dashboard.priority.cap", { amount: fmt(org.totalBudgetCap, primaryCurrency) })
                : t("dashboard.kpi.planned", {
                    amount: fmt(rollup.totalPlanned, primaryCurrency),
                  })
            }
            icon={TrendingUp}
            gradient="bg-gradient-to-br from-fuchsia-500 to-pink-600"
            alert={(org.avgPercentBudgetUsed ?? 0) >= 90}
            onClick={() => setSection("budget")}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-12">
        <Panel
          title={t("dashboard.scheduleTitle")}
          subtitle={t("dashboard.scheduleSub")}
          className="lg:col-span-5"
        >
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-between">
            <DonutChart
              segments={(
                ["on_time", "at_risk", "delayed", "severe"] as ScheduleOutlook[]
              )
                .filter((k) => scheduleOutlook.counts[k] > 0)
                .map((k) => ({
                  label: t(`dashboard.outlook.${k}`),
                  value: scheduleOutlook.counts[k],
                  color: OUTLOOK_COLORS[k],
                }))}
              centerLabel={String(
                scheduleOutlook.counts.on_time + scheduleOutlook.counts.at_risk,
              )}
              centerSub={t("dashboard.outlook.onTrackSub")}
              size={150}
            />
            <ul className="w-full space-y-2 text-sm sm:max-w-[200px]">
              {(["on_time", "at_risk", "delayed", "severe"] as const).map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: OUTLOOK_COLORS[k] }}
                  />
                  <span className="min-w-0 flex-1 text-[var(--muted)]">
                    {t(`dashboard.outlook.${k}`)}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {scheduleOutlook.counts[k]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel
          title={t("dashboard.scheduleBarsTitle")}
          subtitle={t("dashboard.scheduleBarsSub")}
          className="lg:col-span-7"
        >
          {scheduleBarRows.length > 0 ? (
            <ProjectScheduleOutlookChart
              rows={scheduleBarRows}
              onTimeLabel={t("dashboard.outlook.on_time")}
              formatDelay={(days) => t("dashboard.outlook.delayDays", { days })}
            />
          ) : (
            <p className="text-sm text-[var(--muted)]">{t("dashboard.emptyChart")}</p>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title={t("dashboard.onTimeList")} subtitle={t("dashboard.onTimeListSub")}>
          {scheduleOutlook.byOutlook.on_time.length +
            scheduleOutlook.byOutlook.at_risk.length ===
          0 ? (
            <p className="text-sm text-[var(--muted)]">{t("dashboard.noOnTime")}</p>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {[...scheduleOutlook.byOutlook.on_time, ...scheduleOutlook.byOutlook.at_risk]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-start text-sm transition-colors hover:bg-emerald-500/10"
                      onClick={() => void selectProject(p.id)}
                    >
                      <span className="min-w-0 truncate font-medium">{p.name}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                          getScheduleOutlook(p) === "at_risk"
                            ? "bg-amber-500/15 text-amber-700"
                            : "bg-emerald-500/15 text-emerald-700",
                        )}
                      >
                        {t(`dashboard.outlook.${getScheduleOutlook(p)}`)}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("dashboard.delayedList")} subtitle={t("dashboard.delayedListSub")}>
          {scheduleOutlook.byOutlook.delayed.length +
            scheduleOutlook.byOutlook.severe.length ===
          0 ? (
            <p className="text-sm text-[var(--muted)]">{t("dashboard.noDelayed")}</p>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {[...scheduleOutlook.byOutlook.delayed, ...scheduleOutlook.byOutlook.severe]
                .sort((a, b) => b.forecastDelayDays - a.forecastDelayDays)
                .map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-start text-sm transition-colors hover:bg-red-500/10"
                      onClick={() => void selectProject(p.id)}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        {p.scheduleVarianceDays > 0 && (
                          <p className="text-[10px] text-[var(--muted)]">
                            {t("dashboard.scheduleVariance", {
                              days: p.scheduleVarianceDays,
                            })}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-600">
                        +{p.forecastDelayDays}d
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title={t("dashboard.evmOrgTitle")} subtitle={t("dashboard.evmOrgSub")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <EvmMetric label={t("dashboard.evm.pv")} value={fmt(org.totalPv, primaryCurrency)} />
          <EvmMetric label={t("dashboard.evm.ev")} value={fmt(org.totalEv, primaryCurrency)} />
          <EvmMetric label={t("dashboard.evm.ac")} value={fmt(org.totalAc, primaryCurrency)} />
          <EvmMetric label={t("dashboard.evm.eac")} value={fmt(org.totalEac, primaryCurrency)} />
          <EvmMetric
            label={t("dashboard.evm.vac")}
            value={fmt(org.totalVac, primaryCurrency)}
            tone={org.totalVac >= 0 ? "good" : "bad"}
          />
          <EvmMetric
            label={t("dashboard.evm.cv")}
            value={fmt(org.totalCv, primaryCurrency)}
            tone={org.totalCv >= 0 ? "good" : "bad"}
          />
          <EvmMetric
            label={t("dashboard.evm.sv")}
            value={fmt(org.totalSv, primaryCurrency)}
            tone={org.totalSv >= 0 ? "good" : "bad"}
          />
          <EvmMetric
            label="CPI / SPI"
            value={`${rollup.avgCpi} / ${rollup.avgSpi}`}
            tone={rollup.avgCpi >= 0.9 && rollup.avgSpi >= 0.9 ? "good" : "bad"}
          />
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-12">
        <Panel
          title={t("dashboard.statusTitle")}
          subtitle={t("dashboard.statusSub")}
          className="lg:col-span-3"
        >
          <div className="flex flex-col items-center gap-3">
            <DonutChart
              segments={(
                ["active", "planning", "on_hold", "completed"] as const
              )
                .filter((s) => org.projectsByStatus[s] > 0)
                .map((s) => ({
                  label: t(`dashboard.projectStatus.${s}`),
                  value: org.projectsByStatus[s],
                  color:
                    s === "active"
                      ? "#6366f1"
                      : s === "completed"
                        ? "#22c55e"
                        : s === "on_hold"
                          ? "#f59e0b"
                          : "#94a3b8",
                }))}
              centerLabel={String(rollup.projectCount)}
              centerSub={t("dashboard.projects")}
              size={130}
            />
          </div>
        </Panel>

        <Panel
          title={t("dashboard.categoryTitle")}
          subtitle={t("dashboard.categorySub")}
          className="lg:col-span-5"
        >
          {org.budgetByCategory.length > 0 ? (
            <GroupedBudgetChart
              items={org.budgetByCategory.slice(0, 6).map((c) => ({
                id: c.category,
                label: t(`budget.categories.${c.category}`),
                planned: c.planned,
                actual: c.actual,
              }))}
              formatValue={(n) => fmt(n, primaryCurrency)}
              legendPlanned={t("dashboard.planned")}
              legendActual={t("dashboard.actual")}
            />
          ) : (
            <p className="text-sm text-[var(--muted)]">{t("dashboard.emptyChart")}</p>
          )}
        </Panel>

        <Panel title={t("dashboard.overviewTitle")} className="lg:col-span-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-[var(--bg)]/50 px-3 py-2">
              <p className="text-[var(--muted)]">{t("dashboard.kpi.projects")}</p>
              <p className="text-xl font-bold tabular-nums">{rollup.projectCount}</p>
            </div>
            <div className="rounded-xl bg-[var(--bg)]/50 px-3 py-2">
              <p className="text-[var(--muted)]">{t("dashboard.kpi.progress")}</p>
              <p className="text-xl font-bold tabular-nums">{rollup.avgProgress}%</p>
            </div>
            <div className="rounded-xl bg-[var(--bg)]/50 px-3 py-2">
              <p className="text-[var(--muted)]">{t("dashboard.kpi.late", { count: rollup.totalLate })}</p>
              <p className="text-xl font-bold tabular-nums text-red-600">{rollup.totalLate}</p>
            </div>
            <div className="rounded-xl bg-[var(--bg)]/50 px-3 py-2">
              <p className="text-[var(--muted)]">{t("dashboard.overview.tasks")}</p>
              <p className="text-xl font-bold tabular-nums">{rollup.totalTasks}</p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Panel
          title={t("dashboard.healthTitle")}
          subtitle={t("dashboard.healthSub")}
          className="lg:col-span-4"
        >
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-around">
            <DonutChart
              segments={[
                {
                  label: t("executive.health_on_track"),
                  value: counts.on_track,
                  color: HEALTH_COLORS.on_track,
                },
                {
                  label: t("executive.health_at_risk"),
                  value: counts.at_risk,
                  color: HEALTH_COLORS.at_risk,
                },
                {
                  label: t("executive.health_critical"),
                  value: counts.critical,
                  color: HEALTH_COLORS.critical,
                },
              ]}
              centerLabel={String(rollup.projectCount)}
              centerSub={t("dashboard.projects")}
            />
            <ul className="space-y-2 text-sm">
              {(["on_track", "at_risk", "critical"] as const).map((h) => (
                <li key={h} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: HEALTH_COLORS[h] }}
                  />
                  <span className="text-[var(--muted)]">{t(`executive.health_${h}`)}</span>
                  <span className="ms-auto font-semibold tabular-nums">{counts[h]}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel
          title={t("dashboard.progressTitle")}
          subtitle={t("dashboard.progressSub")}
          className="lg:col-span-5"
        >
          {progressBars.length > 0 ? (
            <VerticalBarChart items={progressBars} maxValue={100} height={160} showValues />
          ) : (
            <p className="text-sm text-[var(--muted)]">{t("dashboard.emptyChart")}</p>
          )}
        </Panel>

        <Panel
          title={t("dashboard.alertsTitle")}
          className="lg:col-span-3"
        >
          <ul className="space-y-3 text-sm">
            {portfolio.resourceConflicts.length > 0 && (
              <li className="flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                <Users size={18} className="shrink-0 text-amber-600" />
                <div>
                  <p className="font-medium">{t("portfolio.conflicts")}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {portfolio.resourceConflicts.length}
                  </p>
                </div>
              </li>
            )}
            {rejections.length > 0 && (
              <li className="flex gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
                <Ban size={18} className="shrink-0 text-red-500" />
                <div>
                  <p className="font-medium">{t("dashboard.rejections")}</p>
                  <p className="text-xs text-[var(--muted)]">{rejections.length}</p>
                </div>
              </li>
            )}
            {rollup.delayedProjects > 0 && (
              <li className="flex gap-2 rounded-xl border border-red-500/25 bg-red-500/5 p-3">
                <CalendarClock size={18} className="shrink-0 text-red-500" />
                <div>
                  <p className="font-medium">{t("dashboard.delayedProjects")}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {rollup.delayedProjects} · +{rollup.maxForecast}d max
                  </p>
                </div>
              </li>
            )}
            {portfolio.resourceConflicts.length === 0 &&
              rejections.length === 0 &&
              rollup.delayedProjects === 0 && (
                <p className="text-[var(--muted)]">{t("dashboard.noAlerts")}</p>
              )}
          </ul>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 w-full"
            onClick={() => setSection("portfolio")}
          >
            {t("dashboard.viewPortfolio")}
            <ArrowUpRight size={14} className="ms-1" />
          </Button>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("dashboard.budgetTitle")} subtitle={t("dashboard.budgetSub")}>
          {budgetBars.length > 0 ? (
            <GroupedBudgetChart
              items={budgetBars}
              formatValue={(n) => fmt(n, primaryCurrency)}
              legendPlanned={t("dashboard.planned")}
              legendActual={t("dashboard.actual")}
            />
          ) : (
            <p className="text-sm text-[var(--muted)]">{t("dashboard.emptyChart")}</p>
          )}
        </Panel>

        <Panel title={t("dashboard.evmTitle")} subtitle={t("dashboard.evmSub")}>
          {evmBars.length > 0 ? (
            <DualMetricChart items={evmBars} height={140} />
          ) : (
            <p className="text-sm text-[var(--muted)]">{t("dashboard.emptyChart")}</p>
          )}
        </Panel>
      </div>

      {delayBars.length > 0 && (
        <Panel title={t("dashboard.forecastTitle")} subtitle={t("dashboard.forecastSub")}>
          <VerticalBarChart
            items={delayBars}
            height={120}
            showValues
            barClassName="!bg-red-500"
          />
        </Panel>
      )}

      {summary && (
        <section className="dashboard-glass rounded-2xl border border-[var(--accent)]/20 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={18} className="text-[var(--accent)]" />
            <h3 className="font-semibold">{t("executive.aiTitle")}</h3>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2 text-sm text-[var(--muted)] lg:col-span-2">
              {summary.paragraphs.slice(0, 3).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <ul className="list-disc space-y-1 ps-5 text-sm text-[var(--accent)]">
              {summary.actions.slice(0, 5).map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <Panel
        title={t("dashboard.tableTitle")}
        subtitle={t("dashboard.tableSub")}
        action={
          <span className="text-xs text-[var(--muted)]">
            {t("dashboard.clickRow")}
          </span>
        }
        className="!p-0 overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg)]/50 text-[var(--muted)]">
                <th className="px-4 py-3 text-start font-medium">{t("executive.project")}</th>
                <th className="px-3 py-3 text-center font-medium">{t("executive.progress")}</th>
                <th className="px-3 py-3 text-center font-medium">{t("executive.health")}</th>
                <th className="px-3 py-3 text-center font-medium">{t("executive.forecast")}</th>
                <th className="px-3 py-3 text-end font-medium">{t("dashboard.planned")}</th>
                <th className="px-3 py-3 text-end font-medium">{t("dashboard.actual")}</th>
                <th className="px-3 py-3 text-end font-medium">{t("dashboard.colEac")}</th>
                <th className="px-3 py-3 text-center font-medium">{t("dashboard.colBudgetUsed")}</th>
                <th className="px-3 py-3 text-center font-medium">CPI/SPI</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {portfolio.projects.map((p) => (
                <tr
                  key={p.id}
                  className={cn(
                    "cursor-pointer border-t border-[var(--border)]/40 transition-colors hover:bg-[var(--accent)]/[0.04]",
                    HEALTH_ROW[p.health],
                  )}
                  onClick={() => void selectProject(p.id)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {p.taskCount} {t("dashboard.tasks")} · {p.status}
                    </p>
                    {p.lateTaskCount > 0 && (
                      <p className="text-xs text-red-600">
                        {t("executive.lateTasks", { count: p.lateTaskCount })}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="mx-auto h-2 w-20 overflow-hidden rounded-full bg-[var(--border)]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                        style={{ width: `${p.percentComplete}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums">{p.percentComplete}%</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        HEALTH_BADGE[p.health],
                      )}
                    >
                      {t(`executive.health_${p.health}`)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center tabular-nums">
                    {p.forecastDelayDays > 0 ? (
                      <span className="font-semibold text-red-600">+{p.forecastDelayDays}d</span>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-end tabular-nums text-[var(--muted)]">
                    {fmt(p.plannedBudget, p.currency)}
                  </td>
                  <td className="px-3 py-3 text-end tabular-nums font-medium">
                    {fmt(p.actualCost, p.currency)}
                  </td>
                  <td className="px-3 py-3 text-end tabular-nums text-[var(--muted)]">
                    {fmt(p.eac ?? p.actualCost, p.currency)}
                  </td>
                  <td className="px-3 py-3 text-center tabular-nums text-xs">
                    {p.percentBudgetUsed != null ? (
                      <span
                        className={cn(
                          "font-medium",
                          p.percentBudgetUsed >= 90 ? "text-red-600" : "text-[var(--fg)]",
                        )}
                      >
                        {p.percentBudgetUsed}%
                      </span>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center text-xs tabular-nums">
                    <span className={p.cpi < 0.9 ? "text-red-600" : "text-emerald-600"}>
                      {p.cpi}
                    </span>
                    <span className="text-[var(--muted)]"> / </span>
                    <span className={p.spi < 0.9 ? "text-red-600" : "text-sky-600"}>
                      {p.spi}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-end">
                    <Button type="button" size="sm" variant="ghost" className="h-8">
                      <ArrowUpRight size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {portfolio.projects.length === 0 && (
            <p className="p-10 text-center text-[var(--muted)]">{t("executive.empty")}</p>
          )}
        </div>
      </Panel>

      {portfolio.resourceConflicts.length > 0 && (
        <Panel
          title={t("dashboard.conflictsTitle")}
          subtitle={t("dashboard.conflictsSub")}
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {portfolio.resourceConflicts.slice(0, 9).map((c, i) => (
              <div
                key={`${c.resourceId}-${c.date}-${i}`}
                className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle size={14} className="text-amber-600" />
                  {c.resourceName}
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {c.date} · {c.allocatedHours}h
                </p>
                <p className="truncate text-xs">{c.projectNames.join(" · ")}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
