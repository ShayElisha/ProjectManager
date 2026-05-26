import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Check } from "lucide-react";
import type { Task } from "@nexus/shared";
import { progressFromChildren } from "@/lib/task-tree";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  taskId: string | null;
  onClose: () => void;
}

function subtaskRowClasses(percent: number): string {
  if (percent >= 100) {
    return "border-emerald-500/40 bg-emerald-500/15";
  }
  if (percent > 0) {
    return "border-amber-500/40 bg-amber-500/15";
  }
  return "border-[var(--border)] bg-[var(--bg)]/30";
}

export function KanbanTaskModal({ taskId, onClose }: Props) {
  const { t } = useTranslation();
  const tasks = useAppStore((s) => s.tasks);
  const toggleSubtaskComplete = useAppStore((s) => s.toggleSubtaskComplete);
  const updateSubtaskProgress = useAppStore((s) => s.updateSubtaskProgress);
  const [draftPercent, setDraftPercent] = useState<Record<string, number>>({});

  const parent = tasks.find((t) => t.id === taskId);
  const children = useMemo(
    () =>
      taskId
        ? tasks
            .filter((t) => t.parentId === taskId)
            .sort((a, b) => a.wbs.localeCompare(b.wbs, undefined, { numeric: true }))
        : [],
    [tasks, taskId],
  );

  if (!taskId || !parent) return null;

  const progress =
    children.length > 0 ? progressFromChildren(children) : parent.percentComplete;

  const displayPercent = (task: Task) => draftPercent[task.id] ?? task.percentComplete;

  const commitProgress = (task: Task) => {
    const draft = draftPercent[task.id];
    if (draft === undefined || draft === task.percentComplete) {
      setDraftPercent((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
      return;
    }
    void updateSubtaskProgress(task.id, draft);
    setDraftPercent((prev) => {
      const next = { ...prev };
      delete next[task.id];
      return next;
    });
  };

  const renderRow = (task: Task) => {
    const pct = displayPercent(task);
    const done = pct >= 100;

    return (
      <div
        key={task.id}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
          subtaskRowClasses(pct),
        )}
      >
        <button
          type="button"
          title={done ? t("task.markIncomplete") : t("task.markComplete")}
          onClick={() => void toggleSubtaskComplete(parent.id, task.id)}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            done
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-[var(--muted)] bg-transparent hover:border-emerald-500/60",
          )}
        >
          {done && <Check size={16} />}
        </button>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-medium",
              done && "text-emerald-700 dark:text-emerald-400",
              pct > 0 && pct < 100 && "text-amber-800 dark:text-amber-300",
            )}
          >
            {task.name}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {task.startDate} — {task.endDate}
          </p>
        </div>

        <div
          className="flex w-28 shrink-0 flex-col items-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-xs font-medium tabular-nums">{pct}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={pct}
            aria-label={t("task.setProgress")}
            className="h-1.5 w-full cursor-pointer accent-amber-500"
            onChange={(e) =>
              setDraftPercent((prev) => ({
                ...prev,
                [task.id]: Number(e.target.value),
              }))
            }
            onMouseUp={() => commitProgress(task)}
            onTouchEnd={() => commitProgress(task)}
            onKeyUp={() => commitProgress(task)}
          />
          <span className="text-[10px] text-[var(--muted)]">{t("task.setProgress")}</span>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold">{parent.name}</h2>
              <p className="text-sm text-[var(--muted)]">
                {parent.startDate} — {parent.endDate}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 hover:bg-[var(--border)]/50"
            >
              <X size={18} />
            </button>
          </div>

          <div className="px-5 py-3">
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-[var(--muted)]">{t("task.progress")}</span>
              <span className="font-medium tabular-nums">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  progress >= 100
                    ? "bg-emerald-500"
                    : progress > 0
                      ? "bg-amber-500"
                      : "bg-transparent",
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-auto px-5 pb-5">
            <p className="text-sm font-medium text-[var(--muted)]">
              {children.length > 0 ? t("task.subtasksList") : t("task.noSubtasksKanban")}
            </p>
            {children.length > 0 ? children.map((c) => renderRow(c)) : renderRow(parent)}
          </div>

          <div className="border-t border-[var(--border)] p-4">
            <Button variant="outline" className="w-full" onClick={onClose}>
              {t("settings.cancel")}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
