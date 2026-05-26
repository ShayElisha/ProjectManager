import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import type { BudgetCategory, BudgetLineItem, BudgetOverviewReport } from "@nexus/shared";
import { useAppStore } from "@/store/app-store";
import { api } from "@/lib/api";
import { confirmAction } from "@/lib/confirm";
import { exportBudgetLinesToExcel } from "@/lib/project-excel";
import { Button } from "@/components/ui/button";
import { EvmDashboard } from "@/components/evm-dashboard";
import { MaterialsBudgetSection } from "@/components/budget/materials-budget-section";
import { cn } from "@/lib/utils";
import { ViewSkeleton } from "@/components/ui/view-skeleton";

const CATEGORIES: BudgetCategory[] = [
  "labor",
  "material",
  "equipment",
  "subcontractor",
  "other",
];

const emptyLine = (): Omit<BudgetLineItem, "id" | "projectId"> => ({
  category: "material",
  name: "",
  plannedAmount: 0,
  committedAmount: 0,
  actualAmount: 0,
  cashMonth: new Date().toISOString().slice(0, 7),
  taskId: undefined,
  source: "manual",
});

export function BudgetView() {
  const { t } = useTranslation();
  const projects = useAppStore((s) => s.projects);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const activeProject = useAppStore((s) => s.activeProject);
  const selectProject = useAppStore((s) => s.selectProject);
  const setSection = useAppStore((s) => s.setSection);
  const storedOverview = useAppStore((s) => s.budgetOverview);
  const refreshBudgetSnapshot = useAppStore((s) => s.refreshBudgetSnapshot);

  const [overview, setOverview] = useState<BudgetOverviewReport | null>(null);
  const [lines, setLines] = useState<BudgetLineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [lineForm, setLineForm] = useState<Omit<BudgetLineItem, "id" | "projectId"> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const projectId = activeProjectId ?? "";
  const currency = overview?.currency ?? activeProject?.currency ?? "ILS";
  const tasks = useAppStore((s) => s.tasks);
  const leafTasks = useMemo(() => tasks.filter((t) => !t.isSummary), [tasks]);
  const leafTaskNames = useMemo(
    () => new Map(leafTasks.map((t) => [t.id, t.name])),
    [leafTasks],
  );

  const fmt = useCallback(
    (n: number) =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(n),
    [currency],
  );

  const loadLines = useCallback(async (id: string) => {
    if (!id) return;
    const l = await api.listBudgetLines(id);
    setLines(l);
  }, []);

  const load = useCallback(
    async (id: string) => {
      if (!id) return;
      setLoading(true);
      try {
        await refreshBudgetSnapshot();
        await loadLines(id);
      } finally {
        setLoading(false);
      }
    },
    [refreshBudgetSnapshot, loadLines],
  );

  useEffect(() => {
    if (storedOverview?.projectId === projectId) {
      setOverview(storedOverview);
    }
  }, [storedOverview, projectId]);

  useEffect(() => {
    if (projectId) void load(projectId);
    else {
      setOverview(null);
      setLines([]);
    }
  }, [projectId, load]);

  const recalculate = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      await refreshBudgetSnapshot({ persist: true });
      await loadLines(projectId);
    } finally {
      setLoading(false);
    }
  };

  const saveLine = async () => {
    if (!projectId || !lineForm || !lineForm.name.trim()) return;
    setLoading(true);
    try {
      if (editingId) {
        await api.updateBudgetLine(projectId, editingId, lineForm);
      } else {
        await api.createBudgetLine(projectId, lineForm);
      }
      setLineForm(null);
      setEditingId(null);
      await load(projectId);
    } finally {
      setLoading(false);
    }
  };

  const removeLine = async (line: BudgetLineItem) => {
    const ok = await confirmAction({
      title: t("budget.deleteLineTitle"),
      message: t("budget.deleteLineMessage", { name: line.name }),
      confirmLabel: t("confirm.confirmDelete"),
      destructive: true,
    });
    if (!ok || !projectId) return;
    await api.deleteBudgetLine(projectId, line.id);
    await load(projectId);
  };

  if (!projectId || projects.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-[var(--muted)]">{t("budget.noProject")}</p>
        <Button variant="outline" onClick={() => setSection("project")}>
          {t("budget.goToProjects")}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full space-y-6 overflow-auto pb-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">{t("budget.title")}</h2>
        <select
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm"
          value={projectId}
          onChange={(e) => void selectProject(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => void recalculate()}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {t("budget.recalculate")}
        </Button>
        {lines.length > 0 && activeProject && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportBudgetLinesToExcel(lines, activeProject.name)}
          >
            {t("budget.exportLines")}
          </Button>
        )}
      </div>

      {loading && !overview && <ViewSkeleton variant="detail" />}

      {overview && (
        <>
          {overview.warnings && overview.warnings.length > 0 && (
            <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
              <h3 className="mb-2 font-medium text-amber-700 dark:text-amber-400">
                {t("budget.warningsTitle")}
              </h3>
              <ul className="list-inside list-disc space-y-1 text-[var(--muted)]">
                {overview.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
            <EvmDashboard
              evm={overview.evm}
              currency={currency}
              budgetAllocated={overview.budgetCap}
              totalPlanned={overview.totalPlanned}
              totalActual={overview.totalActual}
              budgetVariance={overview.budgetVariance}
            />
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
            <h3 className="mb-4 font-semibold">{t("budget.byCategory")}</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-sm">
                <thead>
                  <tr className="text-[var(--muted)]">
                    <th className="py-2 text-start">{t("budget.category")}</th>
                    <th className="py-2 text-start">{t("budget.planned")}</th>
                    <th className="py-2 text-start">{t("budget.actual")}</th>
                    <th className="py-2 text-start">{t("budget.executionVariance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.byCategory.map((row) => (
                    <tr key={row.category} className="border-t border-[var(--border)]/50">
                      <td className="py-2">{t(`budget.categories.${row.category}`)}</td>
                      <td className="py-2 tabular-nums">{fmt(row.planned)}</td>
                      <td className="py-2 tabular-nums">{fmt(row.actual)}</td>
                      <td
                        className={cn(
                          "py-2 tabular-nums",
                          row.variance < 0 ? "text-red-500" : "text-emerald-600",
                        )}
                      >
                        {fmt(row.variance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <MaterialsBudgetSection
            projectId={projectId}
            lines={lines}
            leafTaskNames={leafTaskNames}
            currency={currency}
            loading={loading}
            onReload={async () => {
              await load(projectId);
            }}
            onOverview={(o) => setOverview(o)}
          />

          {overview.cashFlow.length > 0 && (
            <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
              <h3 className="mb-1 font-semibold">{t("budget.cashflow")}</h3>
              <p className="mb-4 text-xs text-[var(--muted)]">{t("budget.cashflowLaborHint")}</p>
              <div className="space-y-4">
                {overview.cashFlow.map((p) => {
                  const max = Math.max(p.planned, p.actual, 1);
                  return (
                    <div key={p.month}>
                      <div className="mb-1 flex flex-wrap justify-between gap-1 text-xs text-[var(--muted)]">
                        <span>{p.month}</span>
                        <span>
                          {fmt(p.planned)} / {fmt(p.actual)} · {t("budget.cumulative")}{" "}
                          {fmt(p.cumulativePlanned)}
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
                      <p className="mt-1 text-[10px] text-[var(--muted)]">
                        {t("budget.labor")}: {fmt(p.laborPlanned)} / {fmt(p.laborActual)} ·{" "}
                        {t("budget.material")}: {fmt(p.materialPlanned)} · {t("budget.other")}:{" "}
                        {fmt(p.otherPlanned)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{t("budget.lines")}</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setLineForm(emptyLine());
                }}
              >
                <Plus size={14} />
                {t("budget.addLine")}
              </Button>
            </div>

            {lineForm && (
              <div className="mb-4 grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="text-[var(--muted)]">{t("budget.lineName")}</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2"
                    value={lineForm.name}
                    onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">{t("budget.category")}</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-2"
                    value={lineForm.category}
                    onChange={(e) =>
                      setLineForm({ ...lineForm, category: e.target.value as BudgetCategory })
                    }
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {t(`budget.categories.${c}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">{t("budget.cashMonth")}</span>
                  <input
                    type="month"
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-2"
                    value={lineForm.cashMonth}
                    onChange={(e) => setLineForm({ ...lineForm, cashMonth: e.target.value })}
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="text-[var(--muted)]">{t("budget.linkedTask")}</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-2"
                    value={lineForm.taskId ?? ""}
                    onChange={(e) =>
                      setLineForm({
                        ...lineForm,
                        taskId: e.target.value || undefined,
                      })
                    }
                  >
                    <option value="">{t("budget.noLinkedTask")}</option>
                    {leafTasks.map((tk) => (
                      <option key={tk.id} value={tk.id}>
                        {tk.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-[var(--muted)]">{t("budget.linkedTaskHint")}</p>
                </label>
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">{t("budget.planned")}</span>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2"
                    value={lineForm.plannedAmount}
                    onChange={(e) =>
                      setLineForm({ ...lineForm, plannedAmount: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">{t("budget.committed")}</span>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2"
                    value={lineForm.committedAmount ?? 0}
                    onChange={(e) =>
                      setLineForm({ ...lineForm, committedAmount: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">{t("budget.actual")}</span>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2"
                    value={lineForm.actualAmount}
                    onChange={(e) =>
                      setLineForm({ ...lineForm, actualAmount: Number(e.target.value) })
                    }
                  />
                </label>
                <div className="flex gap-2 sm:col-span-2">
                  <Button size="sm" disabled={!lineForm.name.trim() || loading} onClick={() => void saveLine()}>
                    {t("confirm.confirmSave")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setLineForm(null);
                      setEditingId(null);
                    }}
                  >
                    {t("confirm.cancel")}
                  </Button>
                </div>
              </div>
            )}

            {lines.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">{t("budget.noLines")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="text-[var(--muted)]">
                      <th className="py-2 text-start">{t("budget.lineName")}</th>
                      <th className="py-2 text-start">{t("budget.category")}</th>
                      <th className="py-2 text-start">{t("budget.cashMonth")}</th>
                      <th className="py-2 text-start">{t("budget.planned")}</th>
                      <th className="py-2 text-start">{t("budget.actual")}</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.id} className="border-t border-[var(--border)]/50">
                        <td className="py-2">{line.name}</td>
                        <td className="py-2">{t(`budget.categories.${line.category}`)}</td>
                        <td className="py-2">{line.cashMonth}</td>
                        <td className="py-2 tabular-nums">{fmt(line.plannedAmount)}</td>
                        <td className="py-2 tabular-nums">{fmt(line.actualAmount)}</td>
                        <td className="py-2 text-end">
                          <button
                            type="button"
                            className="me-2 text-xs text-[var(--accent)] hover:underline"
                            onClick={() => {
                              setEditingId(line.id);
                              setLineForm({
                                category: line.category,
                                name: line.name,
                                description: line.description,
                                plannedAmount: line.plannedAmount,
                                committedAmount: line.committedAmount ?? 0,
                                actualAmount: line.actualAmount,
                                cashMonth: line.cashMonth,
                                taskId: line.taskId,
                                source: line.source,
                                sourceRef: line.sourceRef,
                              });
                            }}
                          >
                            {t("budget.edit")}
                          </button>
                          <button
                            type="button"
                            className="text-red-500 hover:text-red-400"
                            onClick={() => void removeLine(line)}
                            aria-label={t("budget.delete")}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {overview.byTask.length > 0 && (
            <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
              <h3 className="mb-4 font-semibold">{t("budget.byTask")}</h3>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="sticky top-0 bg-[var(--card)] text-[var(--muted)]">
                      <th className="py-2 text-start">{t("task.name")}</th>
                      <th className="py-2 text-start">{t("budget.labor")}</th>
                      <th className="py-2 text-start">{t("budget.material")}</th>
                      <th className="py-2 text-start">{t("budget.other")}</th>
                      <th className="py-2 text-start">{t("budget.planned")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.byTask.slice(0, 50).map((row) => (
                      <tr key={row.taskId} className="border-t border-[var(--border)]/50">
                        <td className="py-2">{row.taskName}</td>
                        <td className="py-2 tabular-nums">{fmt(row.labor)}</td>
                        <td className="py-2 tabular-nums">{fmt(row.material)}</td>
                        <td className="py-2 tabular-nums">{fmt(row.other)}</td>
                        <td className="py-2 tabular-nums">{fmt(row.planned)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
