import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/app-store";
import type { TaskStatus } from "@nexus/shared";
import { KanbanTaskModal } from "@/components/kanban-task-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { Columns3 } from "lucide-react";

const COLUMNS: TaskStatus[] = ["not_started", "in_progress", "on_hold", "completed"];

export function KanbanView() {
  const { t } = useTranslation();
  const tasks = useAppStore((s) => s.tasks);
  const setCreateTaskDialogOpen = useAppStore((s) => s.setCreateTaskDialogOpen);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const boardTasks = tasks.filter((t) => !t.parentId);

  const childCount = (id: string) => tasks.filter((t) => t.parentId === id).length;

  if (boardTasks.length === 0) {
    return (
      <>
        <EmptyState
          icon={Columns3}
          title={t("ux.emptyKanbanTitle")}
          description={t("ux.emptyKanbanDesc")}
          actionLabel={t("actions.addTask")}
          onAction={() => setCreateTaskDialogOpen(true)}
          className="h-full"
        />
        <KanbanTaskModal taskId={selectedId} onClose={() => setSelectedId(null)} />
      </>
    );
  }

  return (
    <>
      <div className="flex h-full gap-4 overflow-x-auto pb-2">
        {COLUMNS.map((status) => (
          <div
            key={status}
            className="flex w-72 shrink-0 flex-col rounded-xl border border-[var(--border)] bg-[var(--bg)]/30"
          >
            <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-medium">
              {t(`kanban.${status}`)}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2">
              {boardTasks
                .filter((t) => t.status === status)
                .map((task) => {
                  const subs = childCount(task.id);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setSelectedId(task.id)}
                      className={cn(
                        "rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-start text-sm shadow-sm transition-shadow hover:shadow-md hover:ring-2 hover:ring-[var(--accent)]/30",
                      )}
                    >
                      <p className="font-medium">{task.name}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {task.startDate} — {task.endDate}
                      </p>
                      {subs > 0 && (
                        <p className="mt-1 text-xs text-[var(--accent)]">
                          {t("task.subtaskCount", { count: subs })}
                        </p>
                      )}
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                        <div
                          className={cn(
                            "h-full transition-all",
                            task.percentComplete >= 100
                              ? "bg-emerald-500"
                              : task.percentComplete > 0
                                ? "bg-amber-500"
                                : "bg-transparent",
                          )}
                          style={{ width: `${task.percentComplete}%` }}
                        />
                      </div>
                      <p className="mt-1 text-end text-xs tabular-nums text-[var(--muted)]">
                        {task.percentComplete}%
                      </p>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      <KanbanTaskModal taskId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
