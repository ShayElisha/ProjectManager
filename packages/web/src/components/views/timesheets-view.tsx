import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TimesheetEntry } from "@nexus/shared";
import { useAppStore } from "@/store/app-store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { WorkTimerBar } from "@/components/features/work-timer-bar";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<TimesheetEntry["status"], string> = {
  draft: "bg-[var(--border)] text-[var(--muted)]",
  submitted: "bg-amber-500/15 text-amber-600",
  approved: "bg-emerald-500/15 text-emerald-600",
  rejected: "bg-red-500/15 text-red-600",
};

export function TimesheetsView() {
  const { t } = useTranslation();
  const tasks = useAppStore((s) => s.tasks);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const members = useAppStore((s) => s.members);
  const projectResources = useAppStore((s) => s.projectResources);
  const resourceNames = useAppStore((s) => s.resourceNames);
  const loadTeam = useAppStore((s) => s.loadTeam);
  const refreshBudgetSnapshot = useAppStore((s) => s.refreshBudgetSnapshot);
  const refreshTasks = useAppStore((s) => s.refreshTasks);

  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [taskId, setTaskId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState(8);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const leafTasks = useMemo(() => tasks.filter((t) => !t.isSummary), [tasks]);

  const workerOptions = useMemo(() => {
    if (members.length > 0) {
      return members.map((m) => ({
        resourceId: m.resourceId,
        label: resourceNames[m.resourceId] ?? m.resourceId,
        rate: projectResources.find((r) => r.id === m.resourceId)?.costPerHour ?? 0,
      }));
    }
    return projectResources
      .filter((r) => r.type === "work")
      .map((r) => ({
        resourceId: r.id,
        label: r.name,
        rate: r.costPerHour ?? 0,
      }));
  }, [members, projectResources, resourceNames]);

  const selectedRate = workerOptions.find((w) => w.resourceId === resourceId)?.rate ?? 0;
  const previewCost = hours * selectedRate;

  const taskName = (id: string) => leafTasks.find((t) => t.id === id)?.name ?? id;
  const workerName = (userId: string) =>
    resourceNames[userId] ??
    projectResources.find((r) => r.id === userId)?.name ??
    userId;

  useEffect(() => {
    if (activeProjectId) void loadTeam();
  }, [activeProjectId, loadTeam]);

  useEffect(() => {
    if (!resourceId && workerOptions[0]) setResourceId(workerOptions[0].resourceId);
  }, [workerOptions, resourceId]);

  const load = useCallback(async () => {
    if (!activeProjectId) return;
    setEntries(await api.timesheets(activeProjectId));
  }, [activeProjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const afterBudgetSync = async () => {
    await refreshBudgetSnapshot({ persist: true });
    await refreshTasks();
    await load();
  };

  const submit = async () => {
    if (!activeProjectId || !taskId || !resourceId) return;
    if (selectedRate <= 0) {
      setMsg(t("timesheets.noRate"));
      return;
    }
    setLoading(true);
    try {
      await api.submitTimesheet(activeProjectId, {
        userId: resourceId,
        taskId,
        date,
        hours,
      });
      await afterBudgetSync();
      setMsg(t("timesheets.submitted"));
      setTimeout(() => setMsg(""), 4000);
    } finally {
      setLoading(false);
    }
  };

  const setStatus = async (entryId: string, status: TimesheetEntry["status"]) => {
    if (!activeProjectId) return;
    setLoading(true);
    try {
      await api.updateTimesheetStatus(activeProjectId, entryId, { status });
      await afterBudgetSync();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-6 overflow-auto pb-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
        <h2 className="text-xl font-semibold">{t("timesheets.title")}</h2>
        <WorkTimerBar />
        <p className="text-xs text-[var(--muted)]">{t("timesheets.actualHint")}</p>

        {workerOptions.length === 0 ? (
          <p className="text-sm text-amber-600">{t("timesheets.needTeam")}</p>
        ) : (
          <>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">{t("timesheets.worker")}</span>
              <select
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
              >
                {workerOptions.map((w) => (
                  <option key={w.resourceId} value={w.resourceId}>
                    {w.label}
                    {w.rate > 0 ? ` — ${w.rate} ₪/h` : ` — ${t("timesheets.noRateShort")}`}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="text-[var(--muted)]">{t("timesheets.task")}</span>
              <select
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
              >
                <option value="">—</option>
                {leafTasks.map((tk) => (
                  <option key={tk.id} value={tk.id}>
                    {tk.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="text-[var(--muted)]">{t("timesheets.date")}</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>

            <label className="block text-sm">
              <span className="text-[var(--muted)]">{t("timesheets.hours")}</span>
              <input
                type="number"
                min={0}
                max={24}
                step={0.5}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
              />
            </label>

            {selectedRate > 0 && hours > 0 && (
              <p className="text-sm text-[var(--muted)]">
                {t("timesheets.previewCost", {
                  cost: new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: "ILS",
                    maximumFractionDigits: 0,
                  }).format(previewCost),
                })}
              </p>
            )}

            <Button
              className="w-full"
              onClick={() => void submit()}
              disabled={!taskId || !resourceId || loading || selectedRate <= 0}
            >
              {t("actions.submitHours")}
            </Button>
          </>
        )}
        {msg && (
          <p
            className={cn(
              "text-center text-sm",
              msg.includes("⚠") || msg.includes("תעריף") ? "text-amber-600" : "text-emerald-500",
            )}
          >
            {msg}
          </p>
        )}
      </div>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h3 className="mb-3 font-medium">{t("timesheets.list")}</h3>
        {entries.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t("timesheets.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {[...entries]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((e) => {
                const rate = workerOptions.find((w) => w.resourceId === e.userId)?.rate ?? 0;
                const cost = e.hours * rate;
                return (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)]/60 p-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {workerName(e.userId)} · {taskName(e.taskId)}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {e.date} · {e.hours}h
                        {cost > 0 &&
                          ` · ${new Intl.NumberFormat(undefined, { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(cost)}`}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        STATUS_STYLE[e.status],
                      )}
                    >
                      {t(`timesheets.status.${e.status}`)}
                    </span>
                    {e.status === "submitted" && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loading}
                          onClick={() => void setStatus(e.id, "approved")}
                        >
                          {t("timesheets.approve")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500"
                          disabled={loading}
                          onClick={() => void setStatus(e.id, "rejected")}
                        >
                          {t("timesheets.reject")}
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </section>
    </div>
  );
}
