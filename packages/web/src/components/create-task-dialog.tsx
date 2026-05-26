import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Plus, Trash2 } from "lucide-react";
import { addDays, daysBetween } from "@/lib/dependency-anchors";
import { clampWorkDays } from "@/lib/task-tree";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";

export type SubtaskKind = "T" | "M";

export interface SubtaskDraft {
  id: string;
  name: string;
  kind: SubtaskKind;
  startDate: string;
  endDate: string;
  durationDays: number;
  assigneeId: string;
}

function applyMilestoneAtEnd(st: SubtaskDraft, parentEnd: string): SubtaskDraft {
  return {
    ...st,
    kind: "M",
    startDate: parentEnd,
    endDate: parentEnd,
    durationDays: 0,
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
}

function newSubtask(parentStart: string, parentEnd: string, parentWorkDays: number): SubtaskDraft {
  const days = Math.min(parentWorkDays, daysBetween(parentStart, parentEnd) + 1);
  return {
    id: crypto.randomUUID(),
    name: "",
    kind: "T",
    startDate: parentStart,
    endDate: addDays(parentStart, days - 1),
    durationDays: days,
    assigneeId: "",
  };
}

export function CreateTaskDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const createTask = useAppStore((s) => s.createTask);
  const tasks = useAppStore((s) => s.tasks);
  const members = useAppStore((s) => s.members);
  const resourceNames = useAppStore((s) => s.resourceNames);

  const memberOptions = useMemo(
    () =>
      members.map((m) => ({
        id: m.resourceId,
        label: resourceNames[m.resourceId] ?? m.resourceId,
      })),
    [members, resourceNames],
  );

  const defaultStart =
    tasks[tasks.length - 1]?.endDate ?? new Date().toISOString().slice(0, 10);
  const defaultEnd = addDays(defaultStart, 4);
  const defaultWorkDays = daysBetween(defaultStart, defaultEnd) + 1;

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [workDays, setWorkDays] = useState(defaultWorkDays);
  const [isPriority, setIsPriority] = useState(false);
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const calendarDays = daysBetween(startDate, endDate) + 1;

  useEffect(() => {
    if (!open) return;
    setName("");
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setWorkDays(defaultWorkDays);
    setIsPriority(false);
    setSubtasks([]);
  }, [open, defaultStart, defaultEnd, defaultWorkDays]);

  useEffect(() => {
    if (startDate > endDate) setEndDate(startDate);
    const span = daysBetween(startDate, endDate) + 1;
    setWorkDays((d) => Math.min(d, span));
    setSubtasks((list) =>
      list.map((st) => {
        if (st.kind === "M") return applyMilestoneAtEnd(st, endDate);
        let start = st.startDate < startDate ? startDate : st.startDate;
        let end = st.endDate > endDate ? endDate : st.endDate;
        if (start > end) end = start;
        const maxDays = Math.min(workDays, daysBetween(start, end) + 1);
        const durationDays = clampWorkDays(st.durationDays, maxDays);
        return {
          ...st,
          startDate: start,
          endDate: addDays(start, durationDays - 1),
          durationDays,
        };
      }),
    );
  }, [startDate, endDate, workDays]);

  if (!open) return null;

  const addSubtask = () => {
    setSubtasks((list) => [...list, newSubtask(startDate, endDate, workDays)]);
  };

  const updateSubtask = (id: string, patch: Partial<SubtaskDraft>) => {
    setSubtasks((list) =>
      list.map((st) => {
        if (st.id !== id) return st;
        let next = { ...st, ...patch };
        if (patch.kind === "M" || next.kind === "M") {
          return applyMilestoneAtEnd(next, endDate);
        }
        if (next.startDate < startDate) next.startDate = startDate;
        if (next.endDate > endDate) next.endDate = endDate;
        if (next.startDate > next.endDate) next.endDate = next.startDate;
        const spanMax = daysBetween(next.startDate, next.endDate) + 1;
        const cap = Math.min(workDays, spanMax);
        next.durationDays = clampWorkDays(
          patch.durationDays ?? next.durationDays,
          cap,
        );
        next.endDate = addDays(next.startDate, next.durationDays - 1);
        if (next.endDate > endDate) {
          next.endDate = endDate;
          next.durationDays = daysBetween(next.startDate, next.endDate) + 1;
        }
        return next;
      }),
    );
  };

  const onParentWorkDaysChange = (days: number) => {
    const capped = clampWorkDays(days, calendarDays);
    setWorkDays(capped);
    setSubtasks((list) =>
      list.map((st) => {
        if (st.kind === "M") return applyMilestoneAtEnd(st, endDate);
        const durationDays = clampWorkDays(st.durationDays, capped);
        return {
          ...st,
          durationDays,
          endDate: addDays(st.startDate, durationDays - 1),
        };
      }),
    );
  };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createTask({
        name: name.trim(),
        startDate,
        endDate,
        durationDays: workDays,
        isPriority,
        subtasks: subtasks
          .filter((s) => s.name.trim())
          .map((s) => ({
            name: s.name.trim(),
            startDate: s.startDate,
            endDate: s.endDate,
            durationDays: s.durationDays,
            assigneeId: s.assigneeId || undefined,
            kind: s.kind,
          })),
      });
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-lg font-semibold">{t("task.createTitle")}</h2>
            <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--border)]/50">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-5 space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold dark:bg-slate-800">
              <span>{t("task.parentTypeSummary")}</span>
              <span className="rounded bg-slate-600 px-2 py-0.5 font-mono text-xs text-white">S</span>
            </div>

            <label className="block text-sm">
              <span className="text-[var(--muted)]">{t("task.name")}</span>
              <input
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-[var(--muted)]">{t("task.start")}</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--muted)]">{t("task.end")}</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="text-[var(--muted)]">{t("task.workDays")}</span>
              <input
                type="number"
                min={1}
                max={calendarDays}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
                value={workDays}
                onChange={(e) => onParentWorkDaysChange(Number(e.target.value))}
              />
              <p className="mt-1 text-xs text-[var(--muted)]">
                {t("task.calendarSpanDays", { days: calendarDays })}
              </p>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPriority}
                onChange={(e) => setIsPriority(e.target.checked)}
              />
              {t("task.priority")}
            </label>

            <section className="space-y-3 rounded-xl border border-[var(--border)] p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">{t("task.subtasks")}</h3>
                <Button type="button" variant="outline" size="sm" onClick={addSubtask}>
                  <Plus size={14} />
                  {t("task.addSubtask")}
                </Button>
              </div>
              <p className="text-xs text-[var(--muted)]">{t("task.subtaskRulesHint")}</p>

              {subtasks.length === 0 && (
                <p className="text-sm text-[var(--muted)]">{t("task.noSubtasks")}</p>
              )}

              {subtasks.map((st, idx) => (
                <div
                  key={st.id}
                  className="space-y-2 rounded-lg border border-[var(--border)]/60 bg-[var(--bg)]/40 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-[var(--muted)]">{idx + 1}.</span>
                    <select
                      className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm font-mono font-semibold"
                      value={st.kind}
                      onChange={(e) =>
                        updateSubtask(st.id, { kind: e.target.value as SubtaskKind })
                      }
                      title={t("task.subtaskKind")}
                    >
                      <option value="T">{t("task.kindTask")}</option>
                      <option value="M">{t("task.kindMilestone")}</option>
                    </select>
                    <input
                      className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm"
                      placeholder={t("task.subtaskName")}
                      value={st.name}
                      onChange={(e) => updateSubtask(st.id, { name: e.target.value })}
                    />
                    <button
                      type="button"
                      className="rounded p-1 text-red-500 hover:bg-red-500/10"
                      onClick={() => setSubtasks((list) => list.filter((x) => x.id !== st.id))}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {st.kind === "M" ? (
                    <p className="text-xs text-[var(--muted)]">
                      {t("task.milestoneAtEnd")}: {endDate}
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm"
                        value={st.startDate}
                        min={startDate}
                        max={endDate}
                        onChange={(e) => updateSubtask(st.id, { startDate: e.target.value })}
                      />
                      <input
                        type="date"
                        className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm"
                        value={st.endDate}
                        min={st.startDate}
                        max={endDate}
                        onChange={(e) => updateSubtask(st.id, { endDate: e.target.value })}
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {st.kind === "T" && (
                      <label className="block text-xs">
                        <span className="text-[var(--muted)]">{t("task.workDays")}</span>
                        <input
                          type="number"
                          min={1}
                          max={Math.min(
                            workDays,
                            daysBetween(st.startDate, st.endDate) + 1,
                          )}
                          className="mt-0.5 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm"
                          value={st.durationDays}
                          onChange={(e) =>
                            updateSubtask(st.id, { durationDays: Number(e.target.value) })
                          }
                        />
                      </label>
                    )}
                    <label className="block text-xs">
                      <span className="text-[var(--muted)]">{t("task.assignee")}</span>
                      <select
                        className="mt-0.5 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm"
                        value={st.assigneeId}
                        onChange={(e) => updateSubtask(st.id, { assigneeId: e.target.value })}
                      >
                        <option value="">{t("task.assigneeNone")}</option>
                        {memberOptions.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              ))}
            </section>
          </div>

          <div className="flex gap-2 border-t border-[var(--border)] p-4">
            <Button className="flex-1" disabled={saving || !name.trim()} onClick={() => void save()}>
              {t("settings.save")}
            </Button>
            <Button variant="outline" onClick={onClose}>
              {t("settings.cancel")}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
