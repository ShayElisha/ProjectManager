import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Cycle } from "@nexus/shared";
import { useAppStore } from "@/store/app-store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function RoadmapView() {
  const { t } = useTranslation();
  const projectId = useAppStore((s) => s.activeProjectId);
  const tasks = useAppStore((s) => s.tasks);
  const updateTask = useAppStore((s) => s.updateTask);
  const setSelectedTaskId = useAppStore((s) => s.setSelectedTaskId);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleName, setCycleName] = useState("");

  useEffect(() => {
    if (!projectId) return;
    void api.cycles(projectId).then(setCycles);
  }, [projectId]);

  const epics = useMemo(
    () => tasks.filter((t) => t.issueType === "epic" || t.isSummary),
    [tasks],
  );

  const timeline = useMemo(() => {
    if (epics.length === 0) return { min: "", max: "", span: 1 };
    const starts = epics.map((e) => e.startDate);
    const ends = epics.map((e) => e.endDate);
    const min = starts.reduce((a, b) => (a < b ? a : b));
    const max = ends.reduce((a, b) => (a > b ? a : b));
    const span = Math.max(
      1,
      Math.round((new Date(max).getTime() - new Date(min).getTime()) / 86400000),
    );
    return { min, max, span };
  }, [epics]);

  const epicOffset = (start: string) => {
    const offset = Math.round(
      (new Date(start).getTime() - new Date(timeline.min).getTime()) / 86400000,
    );
    return Math.max(0, (offset / timeline.span) * 100);
  };

  const epicWidth = (start: string, end: string) => {
    const days = Math.max(
      1,
      Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000),
    );
    return Math.min(100, (days / timeline.span) * 100);
  };

  const createCycle = async () => {
    if (!projectId || !cycleName.trim()) return;
    const start = new Date().toISOString().slice(0, 10);
    const end = new Date();
    end.setMonth(end.getMonth() + 3);
    const c = await api.createCycle(projectId, {
      name: cycleName.trim(),
      startDate: start,
      endDate: end.toISOString().slice(0, 10),
    });
    setCycles((prev) => [...prev, c]);
    setCycleName("");
  };

  if (!projectId) return null;

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      <div className="flex flex-wrap gap-2">
        <input
          className="rounded border border-[var(--border)] px-2 py-1 text-sm"
          placeholder={t("features.newCycle")}
          value={cycleName}
          onChange={(e) => setCycleName(e.target.value)}
        />
        <Button type="button" size="sm" onClick={() => void createCycle()}>
          {t("features.addCycle")}
        </Button>
      </div>

      {epics.length > 0 && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="mb-3 text-sm font-semibold">{t("roadmap.timeline")}</h3>
          <p className="mb-2 text-xs text-[var(--muted)]">
            {timeline.min} → {timeline.max}
          </p>
          <div className="space-y-2">
            {epics.map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  className="w-32 shrink-0 truncate text-start text-[var(--accent)] hover:underline"
                  onClick={() => setSelectedTaskId(e.id)}
                >
                  {e.name}
                </button>
                <div className="relative h-6 min-w-0 flex-1 rounded bg-[var(--border)]/40">
                  <div
                    className="absolute top-0 h-full rounded bg-[var(--accent)]/70"
                    style={{
                      left: `${epicOffset(e.startDate)}%`,
                      width: `${epicWidth(e.startDate, e.endDate)}%`,
                    }}
                    title={`${e.startDate} – ${e.endDate}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cycles.map((cycle) => {
          const inCycle = epics.filter((e) => e.cycleId === cycle.id);
          return (
            <section key={cycle.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <h3 className="font-semibold">{cycle.name}</h3>
              <p className="text-xs text-[var(--muted)]">
                {cycle.startDate} → {cycle.endDate}
              </p>
              <ul className="mt-3 space-y-2">
                {inCycle.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      className="text-sm font-medium text-[var(--accent)] hover:underline"
                      onClick={() => setSelectedTaskId(e.id)}
                    >
                      {e.name}
                    </button>
                  </li>
                ))}
                {epics
                  .filter((e) => !e.cycleId)
                  .slice(0, 3)
                  .map((e) => (
                    <li key={`assign-${e.id}`} className="flex items-center justify-between text-sm">
                      <span className="truncate">{e.name}</span>
                      <Button type="button" size="sm" variant="ghost" onClick={() => void updateTask(e.id, { cycleId: cycle.id })}>
                        +
                      </Button>
                    </li>
                  ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
