import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProjectStatusReport, ResourceLoadReport, CashFlowReport } from "@nexus/shared";
import { useAppStore } from "@/store/app-store";
import { api } from "@/lib/api";
import { EvmDashboard } from "@/components/evm-dashboard";
import { cn } from "@/lib/utils";
import { ViewSkeleton } from "@/components/ui/view-skeleton";

export function ReportsView() {
  const { t } = useTranslation();
  const projects = useAppStore((s) => s.projects);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const selectProject = useAppStore((s) => s.selectProject);
  const setSection = useAppStore((s) => s.setSection);
  const [projectId, setProjectId] = useState(activeProjectId ?? "");
  const selectedProject = projects.find((p) => p.id === projectId);
  const [status, setStatus] = useState<ProjectStatusReport | null>(null);
  const [resources, setResources] = useState<ResourceLoadReport | null>(null);
  const [cashflow, setCashflow] = useState<CashFlowReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeProjectId) setProjectId(activeProjectId);
  }, [activeProjectId]);

  const load = async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const [s, r, c] = await Promise.all([
        api.reportStatus(id),
        api.reportResources(id),
        api.reportCashflow(id),
      ]);
      setStatus(s);
      setResources(r);
      setCashflow(c);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) void load(projectId);
  }, [projectId]);

  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: selectedProject?.currency ?? "ILS",
      maximumFractionDigits: 0,
    }).format(n);

  const healthColor = {
    on_track: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
    at_risk: "text-amber-600 bg-amber-500/10 border-amber-500/30",
    critical: "text-red-500 bg-red-500/10 border-red-500/30",
  };

  return (
    <div className="h-full space-y-6 overflow-auto">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-xl font-semibold">{t("reports.title")}</h2>
        <select
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="text-sm text-[var(--accent)] hover:underline"
          onClick={() => projectId && void selectProject(projectId)}
        >
          {t("reports.openProject")}
        </button>
        <button
          type="button"
          className="text-sm text-[var(--accent)] hover:underline"
          onClick={() => {
            if (projectId) void selectProject(projectId);
            setSection("budget");
          }}
        >
          {t("reports.openBudget")}
        </button>
      </div>

      {loading && !status && <ViewSkeleton variant="detail" />}

      {status && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold">{t("reports.statusReport")}</h3>
              <p className="text-sm text-[var(--muted)]">{status.projectName}</p>
            </div>
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-sm font-medium capitalize",
                healthColor[status.health],
              )}
            >
              {t(`status.${status.health}`)}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs text-[var(--muted)]">{t("portfolio.progress")}</p>
              <p className="text-2xl font-bold">{status.percentComplete}%</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">{t("portfolio.critical")}</p>
              <p className="text-2xl font-bold text-red-500">{status.criticalTaskCount}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">{t("reports.lateTasks")}</p>
              <p className="text-2xl font-bold">{status.lateTaskCount}</p>
            </div>
          </div>
          <div className="mt-6 border-t border-[var(--border)] pt-6">
            <EvmDashboard
              evm={{
                ...status.evm,
                eac: status.forecastEAC,
                totalPlanned: status.plannedBudget,
                totalActual: status.actualCost,
              }}
              currency={selectedProject?.currency ?? "ILS"}
              budgetAllocated={selectedProject?.budgetCap}
              totalPlanned={status.plannedBudget}
              totalActual={status.actualCost}
              budgetVariance={status.evm.budgetVariance}
            />
          </div>
          {status.topRisks.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-[var(--border)] pt-4 text-sm">
              {status.topRisks.map((r, i) => (
                <li key={i}>
                  <strong>{r.taskName}</strong> — {r.reason}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {resources && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h3 className="mb-4 font-semibold">{t("reports.resourceReport")}</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--muted)]">
                <th className="py-2 text-start">{t("resources.utilization")}</th>
                <th className="py-2 text-start">Peak %</th>
                <th className="py-2 text-start">{t("resources.overAllocated")}</th>
                <th className="py-2 text-start">Hours</th>
              </tr>
            </thead>
            <tbody>
              {resources.resources.map((r) => (
                <tr key={r.name} className="border-t border-[var(--border)]/50">
                  <td className="py-2">{r.name}</td>
                  <td className={cn("py-2", r.peakUtilizationPct > 100 && "text-red-500 font-semibold")}>
                    {r.peakUtilizationPct}%
                  </td>
                  <td className="py-2">{r.overAllocationDays} days</td>
                  <td className="py-2 tabular-nums">{r.totalAssignedHours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {cashflow && cashflow.points.length > 0 && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h3 className="mb-4 font-semibold">{t("reports.cashflow")}</h3>
          <div className="space-y-3">
            {cashflow.points.map((p) => {
              const max = Math.max(p.planned, p.actual, 1);
              return (
                <div key={p.month}>
                  <div className="mb-1 flex justify-between text-xs text-[var(--muted)]">
                    <span>{p.month}</span>
                    <span>
                      {fmt(p.planned)} / {fmt(p.actual)}
                    </span>
                  </div>
                  <div className="flex h-3 gap-1 overflow-hidden rounded-full bg-[var(--border)]">
                    <div
                      className="h-full bg-[var(--accent)]/60"
                      style={{ width: `${(p.planned / max) * 100}%` }}
                    />
                    <div
                      className="h-full bg-emerald-500/80"
                      style={{ width: `${(p.actual / max) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
