import { Fragment, useEffect, useMemo, useState } from "react";
import type { ExecutiveSummary } from "@nexus/shared";
import { api } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import type { ProjectHealth } from "@nexus/shared";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { ViewSkeleton } from "@/components/ui/view-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { FolderKanban } from "lucide-react";

const HEALTH_STYLES: Record<ProjectHealth, string> = {
  on_track: "bg-emerald-500",
  at_risk: "bg-amber-500",
  critical: "bg-red-500",
};

const HEALTH_ROW: Record<ProjectHealth, string> = {
  on_track: "border-emerald-500/30 bg-emerald-500/5",
  at_risk: "border-amber-500/40 bg-amber-500/8",
  critical: "border-red-500/40 bg-red-500/8",
};

export function PortfolioView() {
  const { t } = useTranslation();
  const portfolio = useAppStore((s) => s.portfolio);
  const allProjects = useAppStore((s) => s.projects);
  const loading = useAppStore((s) => s.loading);
  const loadPortfolio = useAppStore((s) => s.loadPortfolio);
  const selectProject = useAppStore((s) => s.selectProject);

  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);

  useEffect(() => {
    void loadPortfolio();
    void api.executiveSummary().then(setSummary).catch(() => setSummary(null));
  }, [loadPortfolio]);

  if (!portfolio && loading) {
    return <ViewSkeleton variant="cards" className="p-4" />;
  }

  if (!portfolio) {
    return (
      <ViewSkeleton variant="cards" className="p-4" />
    );
  }

  const counts =
    portfolio.counts ??
    portfolio.projects.reduce(
      (acc, p) => {
        acc[p.health]++;
        return acc;
      },
      { on_track: 0, at_risk: 0, critical: 0 } as Record<ProjectHealth, number>,
    );

  const programGroups = useMemo(() => {
    if (!portfolio) return [];
    const groups = new Map<string, typeof portfolio.projects>();
    for (const p of portfolio.projects) {
      const meta = allProjects.find((ap) => ap.id === p.id);
      const parentId = meta?.parentId ?? "root";
      const list = groups.get(parentId) ?? [];
      list.push(p);
      groups.set(parentId, list);
    }
    return Array.from(groups.entries()).map(([parentId, projects]) => ({
      parentId,
      label:
        parentId === "root"
          ? t("program.root")
          : allProjects.find((p) => p.id === parentId)?.name ?? parentId,
      projects,
    }));
  }, [portfolio, allProjects, t]);

  const fmt = (n: number, currency = "ILS") =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="flex flex-col gap-4 p-1 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t("executive.title")}</h2>
          <p className="text-sm text-[var(--muted)]">{portfolio.organizationName}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-700 dark:text-emerald-400">
            {t("executive.countOnTrack", { count: counts.on_track })}
          </span>
          <span className="rounded-full bg-amber-500/15 px-2 py-1 text-amber-700 dark:text-amber-400">
            {t("executive.countAtRisk", { count: counts.at_risk })}
          </span>
          <span className="rounded-full bg-red-500/15 px-2 py-1 text-red-600">
            {t("executive.countCritical", { count: counts.critical })}
          </span>
        </div>
      </div>

      {summary && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm space-y-2">
          <p className="font-medium">{t("executive.aiTitle")}</p>
          {summary.paragraphs.slice(0, 4).map((p, i) => (
            <p key={i} className="text-[var(--muted)]">
              {p}
            </p>
          ))}
          <ul className="list-disc ps-5 text-xs text-[var(--accent)]">
            {summary.actions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {portfolio.resourceConflicts.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <div className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle size={16} />
            {t("portfolio.conflicts")} ({portfolio.resourceConflicts.length})
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--card)]">
            <tr className="border-b border-[var(--border)] text-[var(--muted)]">
              <th className="w-3 px-2 py-3" />
              <th className="px-3 py-3 text-start font-medium">{t("executive.project")}</th>
              <th className="px-3 py-3 text-center font-medium">{t("executive.progress")}</th>
              <th className="px-3 py-3 text-center font-medium">{t("executive.health")}</th>
              <th className="px-3 py-3 text-center font-medium">{t("executive.forecast")}</th>
              <th className="px-3 py-3 text-end font-medium">{t("executive.budgetVar")}</th>
              <th className="px-3 py-3 text-center font-medium">CPI/SPI</th>
            </tr>
          </thead>
          <tbody>
            {programGroups.map((group) => (
              <Fragment key={group.parentId}>
                <tr className="bg-[var(--bg)]/80">
                  <td colSpan={7} className="px-3 py-2 text-xs font-semibold uppercase text-[var(--muted)]">
                    {t("program.group")}: {group.label}
                  </td>
                </tr>
                {group.projects.map((p) => (
              <tr
                key={p.id}
                className={cn(
                  "cursor-pointer border-b border-[var(--border)]/50 transition-colors hover:bg-[var(--accent)]/5",
                  HEALTH_ROW[p.health],
                )}
                onClick={() => void selectProject(p.id)}
              >
                <td className="px-2 py-3">
                  <span
                    className={cn("inline-block h-8 w-1.5 rounded-full", HEALTH_STYLES[p.health])}
                    title={t(`executive.health_${p.health}`)}
                  />
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium">{p.name}</p>
                  {p.lateTaskCount > 0 && (
                    <p className="text-xs text-red-600">
                      {t("executive.lateTasks", { count: p.lateTaskCount })}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3 text-center tabular-nums">
                  <div className="mx-auto h-1.5 w-16 overflow-hidden rounded-full bg-[var(--border)]">
                    <div
                      className="h-full bg-[var(--accent)]"
                      style={{ width: `${p.percentComplete}%` }}
                    />
                  </div>
                  <span className="text-xs">{p.percentComplete}%</span>
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                      p.health === "on_track" && "bg-emerald-500/15 text-emerald-700",
                      p.health === "at_risk" && "bg-amber-500/15 text-amber-700",
                      p.health === "critical" && "bg-red-500/15 text-red-600",
                    )}
                  >
                    {t(`executive.health_${p.health}`)}
                  </span>
                </td>
                <td className="px-3 py-3 text-center tabular-nums">
                  {p.forecastDelayDays > 0 ? (
                    <span className="font-medium text-red-600">
                      +{p.forecastDelayDays}d
                    </span>
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-end tabular-nums">
                  {p.budgetVariance != null ? (
                    <span className={p.budgetVariance < 0 ? "text-red-600" : "text-emerald-600"}>
                      {fmt(p.budgetVariance, p.currency)}
                    </span>
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center text-xs tabular-nums text-[var(--muted)]">
                  {p.cpi}/{p.spi}
                </td>
              </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
        {portfolio.projects.length === 0 && (
          <EmptyState
            icon={FolderKanban}
            title={t("executive.empty")}
            className="m-4 border-none bg-transparent"
          />
        )}
      </div>
    </div>
  );
}
