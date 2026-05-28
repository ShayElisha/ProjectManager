import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CustomColumn, Task } from "@nexus/shared";
import { evaluateCustomFormula } from "@nexus/shared";
import { useAppStore } from "@/store/app-store";
import { TaskDetailDrawer } from "@/components/task-detail-drawer";
import { api } from "@/lib/api";
import { loadGridColumns, saveGridColumns } from "@/components/features/saved-views-bar";

const BASE_COLS = ["wbs", "name", "startDate", "endDate", "durationDays", "percentComplete", "totalFloat"] as const;

export function GridView() {
  const { t } = useTranslation();
  const tasks = useAppStore((s) => s.tasks);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const updateTask = useAppStore((s) => s.updateTask);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; field: keyof Task } | null>(null);
  const [customCols, setCustomCols] = useState<CustomColumn[]>([]);
  const [visible, setVisible] = useState<string[]>([...BASE_COLS]);

  const loadCols = useCallback(async () => {
    if (!activeProjectId) return;
    const cols = await api.customColumns(activeProjectId);
    setCustomCols(cols);
    const stored = loadGridColumns(activeProjectId);
    const customKeys = cols.map((c) => `custom:${c.key}`);
    setVisible(stored ?? [...BASE_COLS, ...customKeys]);
  }, [activeProjectId]);

  useEffect(() => {
    void loadCols();
  }, [loadCols]);

  useEffect(() => {
    const onCols = (e: Event) => {
      const d = (e as CustomEvent<{ projectId: string; columns: string[] }>).detail;
      if (d.projectId === activeProjectId) setVisible(d.columns);
    };
    window.addEventListener("nexus-grid-cols-applied", onCols);
    return () => window.removeEventListener("nexus-grid-cols-applied", onCols);
  }, [activeProjectId]);

  const allColumns = useMemo(() => {
    const base = BASE_COLS.map((id) => ({
      id,
      label:
        id === "wbs"
          ? "WBS"
          : id === "name"
            ? t("task.name")
            : id === "startDate"
              ? t("task.start")
              : id === "endDate"
                ? t("task.end")
                : id === "durationDays"
                  ? t("task.duration")
                  : id === "percentComplete"
                    ? t("task.progress")
                    : "Float",
    }));
    const custom = customCols.map((c) => ({
      id: `custom:${c.key}`,
      label: c.label,
      col: c,
    }));
    return [...base, ...custom];
  }, [customCols, t]);

  const toggleCol = (id: string) => {
    if (!activeProjectId) return;
    const next = visible.includes(id) ? visible.filter((x) => x !== id) : [...visible, id];
    setVisible(next);
    saveGridColumns(activeProjectId, next);
  };

  const shown = allColumns.filter((c) => visible.includes(c.id));

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

  const cellValue = (task: Task, colId: string): string => {
    if (colId.startsWith("custom:")) {
      const key = colId.slice(7);
      const col = customCols.find((c) => c.key === key);
      if (col?.type === "formula" && col.formula) {
        const v = evaluateCustomFormula(col.formula, task.customFields ?? {});
        return v == null ? "—" : String(v);
      }
      const v = task.customFields?.[key];
      return v == null ? "—" : String(v);
    }
    const v = task[colId as keyof Task];
    if (colId === "percentComplete") return `${task.percentComplete}%`;
    if (v == null) return "—";
    return String(v);
  };

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-[var(--muted)]">{t("hub.gridColumns")}:</span>
        {allColumns.map((c) => (
          <label key={c.id} className="inline-flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={visible.includes(c.id)}
              onChange={() => toggleCol(c.id)}
            />
            {c.label}
          </label>
        ))}
      </div>
      <div className="overflow-auto rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg)]/50 text-[var(--muted)]">
              {shown.map((c) => (
                <th key={c.id} className="px-3 py-2 text-start">
                  {c.label}
                </th>
              ))}
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
                {shown.map((c) => (
                  <td key={c.id} className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    {c.id === "name" && editing?.id === task.id && editing.field === "name" ? (
                      <input
                        className="w-full rounded border border-[var(--accent)] bg-[var(--bg)] px-1 py-0.5"
                        defaultValue={task.name}
                        autoFocus
                        onBlur={(e) => void commitEdit(task, "name", e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      />
                    ) : c.id === "name" ? (
                      <span
                        onDoubleClick={() => setEditing({ id: task.id, field: "name" })}
                        className="inline-flex items-center gap-1"
                      >
                        {task.isCritical && <span className="text-red-500">●</span>}
                        {task.name}
                      </span>
                    ) : (
                      <span className="tabular-nums">{cellValue(task, c.id)}</span>
                    )}
                  </td>
                ))}
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
