import { useMemo } from "react";
import { useAppStore } from "@/store/app-store";

export function CalendarView() {
  const tasks = useAppStore((s) => s.tasks);
  const projects = useAppStore((s) => s.projects);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const start =
    projects.find((p) => p.id === activeProjectId)?.startDate ?? "2026-05-01";

  const weeks = useMemo(() => {
    const days = Array.from({ length: 35 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
    const chunks: string[][] = [];
    for (let i = 0; i < days.length; i += 7) chunks.push(days.slice(i, i + 7));
    return chunks;
  }, [start]);

  const tasksOn = (date: string) =>
    tasks.filter((t) => t.startDate <= date && t.endDate >= date && !t.isSummary);

  return (
    <div className="overflow-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <h3 className="mb-4 text-lg font-semibold">{start.slice(0, 7)}</h3>
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((date) => (
          <div
            key={date}
            className="min-h-24 rounded-lg border border-[var(--border)]/60 p-2 text-xs"
          >
            <span className="font-medium text-[var(--muted)]">{date.slice(8)}</span>
            <div className="mt-1 space-y-1">
              {tasksOn(date).slice(0, 3).map((t) => (
                <div
                  key={t.id}
                  className={`truncate rounded px-1 py-0.5 text-[10px] text-white ${t.isCritical ? "bg-red-500" : "bg-[var(--accent)]"}`}
                >
                  {t.name}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
