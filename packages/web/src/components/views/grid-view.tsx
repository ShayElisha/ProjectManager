import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Task } from "@nexus/shared";
import { useAppStore } from "@/store/app-store";
import { TaskDetailDrawer } from "@/components/task-detail-drawer";

export function GridView() {
  const { t } = useTranslation();
  const tasks = useAppStore((s) => s.tasks);
  const updateTask = useAppStore((s) => s.updateTask);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; field: keyof Task } | null>(null);

  const commitEdit = async (task: Task, field: keyof Task, value: string | number) => {
    setEditing(null);
    if (field === "percentComplete") {
      await updateTask(task.id, { percentComplete: Number(value) });
    } else if (field === "durationDays") {
      await updateTask(task.id, { durationDays: Number(value) });
    } else if (field === "name") {
      await updateTask(task.id, { name: String(value) });
    }
  };

  return (
    <>
      <div className="overflow-auto rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg)]/50 text-[var(--muted)]">
              <th className="px-3 py-2 text-start">WBS</th>
              <th className="px-3 py-2 text-start">{t("task.name")}</th>
              <th className="px-3 py-2 text-start">{t("task.start")}</th>
              <th className="px-3 py-2 text-start">{t("task.end")}</th>
              <th className="px-3 py-2 text-start">{t("task.duration")}</th>
              <th className="px-3 py-2 text-start">{t("gantt.colPause")}</th>
              <th className="px-3 py-2 text-start">{t("gantt.colResume")}</th>
              <th className="px-3 py-2 text-start">{t("task.progress")}</th>
              <th className="px-3 py-2 text-start">Float</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr
                key={task.id}
                className={`cursor-pointer border-b border-[var(--border)]/50 hover:bg-[var(--accent)]/5 ${
                  task.status === "on_hold" ? "bg-amber-500/5" : ""
                }`}
                onClick={() => setSelectedId(task.id)}
              >
                <td className="px-3 py-2 font-mono text-xs">{task.wbs}</td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  {editing?.id === task.id && editing.field === "name" ? (
                    <input
                      className="w-full rounded border border-[var(--accent)] bg-[var(--bg)] px-1 py-0.5"
                      defaultValue={task.name}
                      autoFocus
                      onBlur={(e) => void commitEdit(task, "name", e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    />
                  ) : (
                    <span
                      onDoubleClick={() => setEditing({ id: task.id, field: "name" })}
                      className="inline-flex items-center gap-1"
                    >
                      {task.isCritical && <span className="text-red-500">●</span>}
                      {task.name}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums">{task.startDate}</td>
                <td className="px-3 py-2 tabular-nums">{task.endDate}</td>
                <td className="px-3 py-2 tabular-nums" onClick={(e) => e.stopPropagation()}>
                  {editing?.id === task.id && editing.field === "durationDays" ? (
                    <input
                      type="number"
                      className="w-16 rounded border border-[var(--accent)] bg-[var(--bg)] px-1"
                      defaultValue={task.durationDays}
                      autoFocus
                      onBlur={(e) => void commitEdit(task, "durationDays", e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    />
                  ) : (
                    <span onDoubleClick={() => setEditing({ id: task.id, field: "durationDays" })}>
                      {task.durationDays}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {task.status === "on_hold" ? (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                      {t("kanban.on_hold")}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums text-amber-800 dark:text-amber-300">
                  {task.resumeDate ? (
                    <>
                      {task.resumeDate}
                      {task.remainingWorkDays != null && task.remainingWorkDays > 0 && (
                        <span className="text-[var(--muted)]"> · {task.remainingWorkDays}d</span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums" onClick={(e) => e.stopPropagation()}>
                  {editing?.id === task.id && editing.field === "percentComplete" ? (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="w-16 rounded border border-[var(--accent)] bg-[var(--bg)] px-1"
                      defaultValue={task.percentComplete}
                      autoFocus
                      onBlur={(e) => void commitEdit(task, "percentComplete", e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    />
                  ) : (
                    <span
                      onDoubleClick={() => setEditing({ id: task.id, field: "percentComplete" })}
                    >
                      {task.percentComplete}%
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums">{task.totalFloat ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">{t("grid.hint")}</p>
      <TaskDetailDrawer taskId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
