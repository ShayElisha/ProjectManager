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
