import { useAppStore } from "@/store/app-store";

export function TimelineView() {
  const tasks = useAppStore((s) => s.tasks);
  const topLevel = tasks.filter((t) => !t.parentId);

  return (
    <div className="space-y-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-8">
      <h3 className="text-lg font-semibold">Executive Timeline</h3>
      <div className="relative border-s-2 border-[var(--accent)] ps-8">
        {topLevel.map((task) => (
          <div key={task.id} className="relative mb-8">
            <span className="absolute -start-[25px] top-1 h-3 w-3 rounded-full bg-[var(--accent)]" />
            <p className="text-lg font-semibold">{task.name}</p>
            <p className="text-sm text-[var(--muted)]">
              {task.startDate} — {task.endDate} · {task.percentComplete}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
