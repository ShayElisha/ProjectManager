import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardList } from "lucide-react";
export function WorkView() {
  const { t } = useTranslation();
  const projects = useAppStore((s) => s.projects);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const tasks = useAppStore((s) => s.tasks);
  const members = useAppStore((s) => s.members);
  const updateTask = useAppStore((s) => s.updateTask);
  const setSection = useAppStore((s) => s.setSection);
  const selectProject = useAppStore((s) => s.selectProject);

  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const myResourceId = members[0]?.resourceId;

  const myTasks = useMemo(() => {
    const leaf = tasks.filter((t) => !t.isSummary && t.percentComplete < 100);
    if (!myResourceId) return leaf.slice(0, 30);
    return leaf.filter(
      (t) => t.assigneeIds.length === 0 || t.assigneeIds.includes(myResourceId),
    );
  }, [tasks, myResourceId]);

  const projectId = activeProjectId ?? "";

  const addNote = async (taskId: string) => {
    const text = noteDraft[taskId]?.trim();
    if (!text || !projectId) return;
    const task = tasks.find((t) => t.id === taskId);
    const notes = [...(task?.taskNotes ?? []), text];
    await updateTask(taskId, { taskNotes: notes });
    setNoteDraft((d) => ({ ...d, [taskId]: "" }));
  };

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--muted)]">
        {t("work.noProject")}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">{t("work.title")}</h2>
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
        <Button variant="outline" size="sm" onClick={() => setSection("timesheets")}>
          {t("work.openTimesheets")}
        </Button>
      </div>

      <p className="text-sm text-[var(--muted)]">{t("work.subtitle", { count: myTasks.length })}</p>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto">
        {myTasks.map((task) => (
          <div
            key={task.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {task.wbs} · {task.name}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {task.startDate} → {task.endDate}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={task.percentComplete}
                  onChange={(e) =>
                    void updateTask(task.id, { percentComplete: Number(e.target.value) })
                  }
                  className="w-24"
                />
                <span className="text-sm font-mono w-10">{Math.round(task.percentComplete)}%</span>
              </div>
            </div>
            {(task.taskNotes?.length ?? 0) > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
                {task.taskNotes!.map((n, i) => (
                  <li key={i} className="rounded bg-[var(--border)]/30 px-2 py-1">
                    {n}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex gap-2">
              <input
                className="flex-1 rounded-lg border border-[var(--border)] px-2 py-1 text-sm"
                placeholder={t("work.addNote")}
                value={noteDraft[task.id] ?? ""}
                onChange={(e) =>
                  setNoteDraft((d) => ({ ...d, [task.id]: e.target.value }))
                }
              />
              <Button size="sm" variant="outline" onClick={() => void addNote(task.id)}>
                {t("work.saveNote")}
              </Button>
            </div>
          </div>
        ))}
        {myTasks.length === 0 && (
          <EmptyState
            icon={ClipboardList}
            title={t("ux.emptyWorkTitle")}
            description={t("ux.emptyWorkDesc")}
          />
        )}
      </div>
    </div>
  );
}
