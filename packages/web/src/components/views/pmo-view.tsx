import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { GitCompare, LineChart, TrendingDown, RefreshCw } from "lucide-react";
import type {
  BaselineVarianceReport,
  ProjectForecastReport,
  ScheduleCurvePoint,
  WhatIfReport,
} from "@nexus/shared";
import { useAppStore } from "@/store/app-store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ViewSkeleton } from "@/components/ui/view-skeleton";

type Tab = "variance" | "whatif" | "curve" | "forecast";

export function PmoView() {
  const { t } = useTranslation();
  const projects = useAppStore((s) => s.projects);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const selectProject = useAppStore((s) => s.selectProject);
  const tasks = useAppStore((s) => s.tasks);
  const baselines = useAppStore((s) => s.baselines);
  const saveBaseline = useAppStore((s) => s.saveBaseline);

  const [tab, setTab] = useState<Tab>("forecast");
  const [baselineId, setBaselineId] = useState("");
  const [variance, setVariance] = useState<BaselineVarianceReport | null>(null);
  const [curve, setCurve] = useState<ScheduleCurvePoint[]>([]);
  const [forecast, setForecast] = useState<ProjectForecastReport | null>(null);
  const [whatIfTaskId, setWhatIfTaskId] = useState("");
  const [delayDays, setDelayDays] = useState(5);
  const [whatIf, setWhatIf] = useState<WhatIfReport | null>(null);
  const [loading, setLoading] = useState(false);

  const projectId = activeProjectId ?? "";
  const leafTasks = useMemo(() => tasks.filter((t) => !t.isSummary), [tasks]);

  useEffect(() => {
    if (!baselineId && baselines[0]) setBaselineId(baselines[0].id);
  }, [baselines, baselineId]);

  useEffect(() => {
    if (!whatIfTaskId && leafTasks[0]) setWhatIfTaskId(leafTasks[0].id);
  }, [leafTasks, whatIfTaskId]);

  const loadForecast = useCallback(async () => {
    if (!projectId) return;
    setForecast(await api.pmoForecast(projectId));
  }, [projectId]);

  const loadVariance = useCallback(async () => {
    if (!projectId || !baselineId) return;
    setLoading(true);
    try {
      setVariance(await api.pmoBaselineVariance(projectId, baselineId));
    } finally {
      setLoading(false);
    }
  }, [projectId, baselineId]);

  const loadCurve = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      setCurve(await api.pmoScheduleCurve(projectId));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    void loadForecast();
  }, [projectId, loadForecast]);

  useEffect(() => {
    if (!projectId) return;
    if (tab === "variance" && baselineId) void loadVariance();
    if (tab === "curve") void loadCurve();
  }, [projectId, tab, baselineId, loadVariance, loadCurve]);

  const runWhatIf = async () => {
    if (!projectId || !whatIfTaskId) return;
    setLoading(true);
    try {
      setWhatIf(await api.pmoWhatIf(projectId, whatIfTaskId, delayDays));
    } finally {
      setLoading(false);
    }
  };

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-[var(--muted)]">
        {t("pmo.noProject")}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">{t("pmo.title")}</h2>
        <select
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm"
          value={projectId}
          onChange={(e) => void selectProject(e.target.value, { keepSection: true })}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={() => void saveBaseline(`Baseline ${baselines.length + 1}`)}>
          {t("actions.saveBaseline")}
        </Button>
      </div>

      {forecast && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            forecast.forecastDelayDays > 0
              ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
          )}
        >
          {forecast.forecastDelayDays > 0
            ? t("pmo.forecast.delay", { days: forecast.forecastDelayDays })
            : t("pmo.forecast.onTrack")}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["forecast", TrendingDown, t("pmo.tabs.forecast")],
            ["variance", GitCompare, t("pmo.tabs.variance")],
            ["whatif", TrendingDown, t("pmo.tabs.whatif")],
            ["curve", LineChart, t("pmo.tabs.curve")],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium",
              tab === id ? "bg-[var(--accent)] text-white" : "bg-[var(--border)]/40",
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        {loading && tab !== "forecast" && <ViewSkeleton variant="detail" className="mb-4" />}
        {tab === "forecast" && forecast && (
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <Stat label={t("pmo.forecast.health")} value={t(`executive.health_${forecast.health}`)} />
            <Stat label={t("pmo.forecast.scheduleVar")} value={`${forecast.scheduleVarianceDays}d`} />
            <Stat label={t("pmo.forecast.delayDays")} value={`${forecast.forecastDelayDays}d`} />
          </div>
        )}

        {tab === "variance" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <select
                className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm"
                value={baselineId}
                onChange={(e) => setBaselineId(e.target.value)}
              >
                {baselines.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" disabled={loading} onClick={() => void loadVariance()}>
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </Button>
            </div>
            {baselines.length === 0 && <p className="text-amber-600 text-sm">{t("pmo.noBaselines")}</p>}
            {variance && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[var(--muted)]">
                    <th className="py-2 text-start">{t("pmo.colTask")}</th>
                    <th className="py-2">{t("pmo.colEndVar")}</th>
                  </tr>
                </thead>
                <tbody>
                  {variance.rows.slice(0, 50).map((r) => (
                    <tr key={r.taskId} className="border-t border-[var(--border)]/40">
                      <td className="py-2">{r.taskName}</td>
                      <td className={cn("py-2 text-center", r.endVarianceDays > 0 && "text-red-600")}>
                        {r.endVarianceDays > 0 ? "+" : ""}
                        {r.endVarianceDays}d
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === "whatif" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <select
                className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5"
                value={whatIfTaskId}
                onChange={(e) => setWhatIfTaskId(e.target.value)}
              >
                {leafTasks.map((tk) => (
                  <option key={tk.id} value={tk.id}>
                    {tk.wbs} · {tk.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                max={90}
                className="w-20 rounded-lg border border-[var(--border)] px-2 py-1.5"
                value={delayDays}
                onChange={(e) => setDelayDays(Number(e.target.value))}
              />
              <Button disabled={loading} onClick={() => void runWhatIf()}>
                {t("pmo.whatif.run")}
              </Button>
            </div>
            {whatIf && (
              <p className="text-sm">
                {t("pmo.whatif.result", {
                  before: whatIf.beforeProjectEnd,
                  after: whatIf.afterProjectEnd,
                  delta: whatIf.projectEndDeltaDays,
                })}
              </p>
            )}
          </div>
        )}

        {tab === "curve" && (
          <div className="space-y-2">
            {curve.map((p) => (
              <div key={p.month} className="flex items-center gap-3 text-sm">
                <span className="w-16 font-mono text-[var(--muted)]">{p.month}</span>
                <div className="flex-1 h-2 rounded bg-[var(--border)]">
                  <div className="h-full bg-blue-500/60" style={{ width: `${p.plannedCumulativePct}%` }} />
                </div>
                <div className="flex-1 h-2 rounded bg-[var(--border)]">
                  <div className="h-full bg-emerald-500/60" style={{ width: `${p.actualCumulativePct}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
