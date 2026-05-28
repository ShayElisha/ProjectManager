import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardList } from "lucide-react";

interface TaskDailyNote {
  id: string;
  date: string;
  text: string;
  done: boolean;
  createdAt: string;
  category?: "planning" | "execution" | "followup" | "blocker";
  priority?: "low" | "medium" | "high";
  estimateMinutes?: number;
  timeSlot?: "morning" | "noon" | "afternoon" | "evening";
  details?: string;
}

const DAILY_PREFIX = "[daily]";

function encodeDailyNote(note: TaskDailyNote): string {
  return `${DAILY_PREFIX}${JSON.stringify(note)}`;
}

function toDailyNotes(raw: string[] | undefined): TaskDailyNote[] {
  if (!raw || raw.length === 0) return [];
  return raw.map((item, index) => {
    if (!item.startsWith(DAILY_PREFIX)) {
      return {
        id: `legacy-${index}`,
        date: "",
        text: item,
        done: false,
        createdAt: "",
      };
    }
    try {
      return JSON.parse(item.slice(DAILY_PREFIX.length)) as TaskDailyNote;
    } catch {
      return {
        id: `legacy-${index}`,
        date: "",
        text: item,
        done: false,
        createdAt: "",
      };
    }
  });
}

function startOfWeekIso(dateIso: string): string {
  const d = new Date(dateIso);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function isoDateShift(dateIso: string, days: number): string {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoToWeekInput(iso: string): string {
  const d = new Date(iso);
  const dayNr = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dayNr + 3);
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const firstDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
  const weekNo = 1 + Math.round((d.getTime() - firstThursday.getTime()) / 604800000);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function weekInputToIsoStart(week: string): string {
  const [yearPart, weekPart] = week.split("-W");
  const year = Number(yearPart);
  const weekNo = Number(weekPart);
  const simple = new Date(year, 0, 1 + (weekNo - 1) * 7);
  const dow = simple.getDay();
  const weekStart = new Date(simple);
  if (dow <= 4) weekStart.setDate(simple.getDate() - dow + 1);
  else weekStart.setDate(simple.getDate() + 8 - dow);
  weekStart.setDate(weekStart.getDate() - 1); // Sunday start for project locale
  return weekStart.toISOString().slice(0, 10);
}

export function WorkView() {
  const { t, i18n } = useTranslation();
  const projects = useAppStore((s) => s.projects);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const tasks = useAppStore((s) => s.tasks);
  const members = useAppStore((s) => s.members);
  const updateTask = useAppStore((s) => s.updateTask);
  const setSection = useAppStore((s) => s.setSection);
  const selectProject = useAppStore((s) => s.selectProject);

  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [detailDraft, setDetailDraft] = useState<Record<string, string>>({});
  const [categoryDraft, setCategoryDraft] = useState<
    Record<string, TaskDailyNote["category"]>
  >({});
  const [priorityDraft, setPriorityDraft] = useState<
    Record<string, TaskDailyNote["priority"]>
  >({});
  const [estimateDraft, setEstimateDraft] = useState<Record<string, number>>({});
  const [timeSlotDraft, setTimeSlotDraft] = useState<
    Record<string, TaskDailyNote["timeSlot"]>
  >({});
  const [lastAdded, setLastAdded] = useState<Record<string, TaskDailyNote | null>>({});
  const [editingTarget, setEditingTarget] = useState<{ taskId: string; noteId: string } | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<TaskDailyNote>>({});
  const [weekStart, setWeekStart] = useState(() => startOfWeekIso(new Date().toISOString().slice(0, 10)));
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [applyToWholeWeek, setApplyToWholeWeek] = useState(false);
  const myResourceId = members[0]?.resourceId;
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => isoDateShift(weekStart, i)), [weekStart]);
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language === "he" ? "he-IL" : "en-US", { day: "2-digit", month: "2-digit" }),
    [i18n.language],
  );

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
    const notes = [
      ...toDailyNotes(task?.taskNotes),
      ...(applyToWholeWeek
        ? weekDates.map(
            (day) =>
              ({
                id: crypto.randomUUID(),
                date: day,
                text,
                done: false,
                createdAt: new Date().toISOString(),
                category: categoryDraft[taskId] ?? "execution",
                priority: priorityDraft[taskId] ?? "medium",
                estimateMinutes: Math.max(5, Number(estimateDraft[taskId] ?? 30)),
                timeSlot: timeSlotDraft[taskId] ?? "morning",
                details: detailDraft[taskId]?.trim() || undefined,
              }) satisfies TaskDailyNote,
          )
        : [
            {
              id: crypto.randomUUID(),
              date: selectedDate,
              text,
              done: false,
              createdAt: new Date().toISOString(),
              category: categoryDraft[taskId] ?? "execution",
              priority: priorityDraft[taskId] ?? "medium",
              estimateMinutes: Math.max(5, Number(estimateDraft[taskId] ?? 30)),
              timeSlot: timeSlotDraft[taskId] ?? "morning",
              details: detailDraft[taskId]?.trim() || undefined,
            } satisfies TaskDailyNote,
          ]),
    ].map(encodeDailyNote);
    await updateTask(taskId, { taskNotes: notes });
    const preview: TaskDailyNote = {
      id: "preview",
      date: applyToWholeWeek ? weekStart : selectedDate,
      text,
      done: false,
      createdAt: new Date().toISOString(),
      category: categoryDraft[taskId] ?? "execution",
      priority: priorityDraft[taskId] ?? "medium",
      estimateMinutes: Math.max(5, Number(estimateDraft[taskId] ?? 30)),
      timeSlot: timeSlotDraft[taskId] ?? "morning",
      details: detailDraft[taskId]?.trim() || undefined,
    };
    setLastAdded((s) => ({ ...s, [taskId]: preview }));
    setNoteDraft((d) => ({ ...d, [taskId]: "" }));
    setDetailDraft((d) => ({ ...d, [taskId]: "" }));
  };

  const toggleDailyItem = async (taskId: string, noteId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const notes = toDailyNotes(task.taskNotes).map((note) =>
      note.id === noteId ? { ...note, done: !note.done } : note,
    ).map(encodeDailyNote);
    await updateTask(taskId, { taskNotes: notes });
  };

  const deleteDailyItem = async (taskId: string, noteId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const notes = toDailyNotes(task.taskNotes)
      .filter((note) => note.id !== noteId)
      .map(encodeDailyNote);
    await updateTask(taskId, { taskNotes: notes });
  };

  const startEditDailyItem = (taskId: string, note: TaskDailyNote) => {
    setEditingTarget({ taskId, noteId: note.id });
    setEditDraft(note);
  };

  const saveEditDailyItem = async () => {
    if (!editingTarget) return;
    const { taskId, noteId } = editingTarget;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const notes = toDailyNotes(task.taskNotes).map((note) =>
      note.id === noteId
        ? {
            ...note,
            text: editDraft.text?.trim() || note.text,
            details: editDraft.details?.trim() || undefined,
            priority: editDraft.priority ?? note.priority,
            category: editDraft.category ?? note.category,
            estimateMinutes: editDraft.estimateMinutes ?? note.estimateMinutes,
            timeSlot: editDraft.timeSlot ?? note.timeSlot,
          }
        : note,
    );
    await updateTask(taskId, { taskNotes: notes.map(encodeDailyNote) });
    setEditingTarget(null);
    setEditDraft({});
  };

  const exportWeekPdf = () => {
    const lines: string[] = [];
    for (const task of myTasks) {
      const notes = toDailyNotes(task.taskNotes).filter((n) => weekDates.includes(n.date));
      if (notes.length === 0) continue;
      lines.push(`<h3>${task.wbs} - ${task.name}</h3>`);
      lines.push("<ul>");
      for (const n of notes) {
        const meta = [
          n.priority ? `Priority: ${n.priority}` : "",
          n.category ? `Category: ${n.category}` : "",
          n.estimateMinutes ? `${n.estimateMinutes}m` : "",
          n.timeSlot ? `Slot: ${n.timeSlot}` : "",
        ]
          .filter(Boolean)
          .join(" | ");
        lines.push(
          `<li><strong>${n.date}</strong> - ${n.done ? "[Done]" : "[Open]"} ${n.text}${
            meta ? ` <em>(${meta})</em>` : ""
          }${n.details ? `<br/><small>${n.details}</small>` : ""}</li>`,
        );
      }
      lines.push("</ul>");
    }

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html>
        <head>
          <title>Weekly Plan</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { margin: 0 0 8px; font-size: 20px; }
            h2 { margin: 0 0 20px; font-size: 14px; color: #555; font-weight: normal; }
            h3 { margin: 18px 0 8px; font-size: 14px; }
            ul { margin: 0 0 12px 16px; padding: 0; }
            li { margin: 6px 0; line-height: 1.4; }
            small { color: #666; }
            em { color: #555; }
          </style>
        </head>
        <body>
          <h1>Weekly Tasks</h1>
          <h2>${weekStart} - ${weekDates[6]}</h2>
          ${lines.join("") || "<p>No weekly items</p>"}
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
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
        <Button variant="outline" size="sm" onClick={exportWeekPdf}>
          {t("work.exportPdf")}
        </Button>
        <label className="ms-auto flex items-center gap-2 text-sm text-[var(--muted)]">
          {t("work.week")}
          <input
            type="week"
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm"
            value={isoToWeekInput(weekStart)}
            onChange={(e) => {
              const start = weekInputToIsoStart(e.target.value);
              setWeekStart(start);
              setSelectedDate(start);
            }}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
          {t("work.day")}
          <input
            type="date"
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm"
            value={selectedDate}
            onChange={(e) => {
              const next = e.target.value;
              setSelectedDate(next);
              setWeekStart(startOfWeekIso(next));
            }}
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            checked={applyToWholeWeek}
            onChange={(e) => setApplyToWholeWeek(e.target.checked)}
          />
          {t("work.applyToWholeWeek")}
        </label>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {weekDates.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setSelectedDate(d)}
            className={`rounded-lg border px-3 py-1.5 text-xs ${
              d === selectedDate
                ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {t(`projectSettings.day${new Date(d).getDay()}`)} · {dateFmt.format(new Date(d))}
          </button>
        ))}
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
            <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--muted)]">
              <span className="rounded bg-[var(--border)]/40 px-2 py-0.5">
                {t("work.totalItems")}: {toDailyNotes(task.taskNotes).filter((n) => weekDates.includes(n.date)).length}
              </span>
              <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                {t("work.doneItems")}: {toDailyNotes(task.taskNotes).filter((n) => weekDates.includes(n.date) && n.done).length}
              </span>
              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-300">
                {t("work.openItems")}: {toDailyNotes(task.taskNotes).filter((n) => weekDates.includes(n.date) && !n.done).length}
              </span>
            </div>
            <div className="mt-2 space-y-2">
              {weekDates.map((d) => {
                const dayNotes = toDailyNotes(task.taskNotes).filter((n) => n.date === d || n.date === "");
                if (dayNotes.length === 0) return null;
                return (
                  <div key={d} className="rounded-lg border border-[var(--border)]/80 px-2 py-2">
                    <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-[var(--muted)]">
                      <p>
                        {t(`projectSettings.day${new Date(d).getDay()}`)} · {dateFmt.format(new Date(d))}
                      </p>
                      <p>
                        {dayNotes.filter((n) => n.done).length}/{dayNotes.length}
                      </p>
                    </div>
                    <ul className="space-y-1 text-xs text-[var(--muted)]">
                      {dayNotes.map((n) => (
                        <li key={n.id} className="rounded-lg border border-[var(--border)]/70 bg-[var(--card)] px-2 py-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={n.done}
                              onChange={() => void toggleDailyItem(task.id, n.id)}
                            />
                            <span className={n.done ? "line-through opacity-70" : ""}>{n.text}</span>
                            <span className="ms-auto text-[10px] opacity-70">
                              {(n.priority ?? "medium").toUpperCase()} · {(n.estimateMinutes ?? 0) || 0}m
                            </span>
                          </div>
                          {(n.category || n.timeSlot || n.details) && (
                            <div className="mt-1 ps-6 text-[10px] opacity-80">
                              {[n.category, n.timeSlot].filter(Boolean).join(" · ")}
                              {n.details ? ` — ${n.details}` : ""}
                            </div>
                          )}
                          <div className="mt-2 flex gap-2 ps-6 text-[10px]">
                            <button
                              type="button"
                              className="rounded border border-[var(--border)] px-2 py-0.5 hover:bg-[var(--border)]/40"
                              onClick={() => startEditDailyItem(task.id, n)}
                            >
                              {t("work.editItem")}
                            </button>
                            <button
                              type="button"
                              className="rounded border border-red-400/40 px-2 py-0.5 text-red-600 hover:bg-red-500/10"
                              onClick={() => void deleteDailyItem(task.id, n.id)}
                            >
                              {t("work.deleteItem")}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            {editingTarget?.taskId === task.id && (
              <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/30 p-2 text-xs">
                <p className="mb-2 font-semibold text-[var(--muted)]">{t("work.editTitle")}</p>
                <input
                  className="mb-2 w-full rounded border border-[var(--border)] px-2 py-1"
                  value={editDraft.text ?? ""}
                  onChange={(e) => setEditDraft((s) => ({ ...s, text: e.target.value }))}
                />
                <textarea
                  className="mb-2 w-full rounded border border-[var(--border)] px-2 py-1"
                  rows={2}
                  value={editDraft.details ?? ""}
                  onChange={(e) => setEditDraft((s) => ({ ...s, details: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="rounded border border-[var(--border)] px-2 py-1"
                    value={editDraft.priority ?? "medium"}
                    onChange={(e) =>
                      setEditDraft((s) => ({
                        ...s,
                        priority: e.target.value as TaskDailyNote["priority"],
                      }))
                    }
                  >
                    <option value="low">{t("work.priorityLow")}</option>
                    <option value="medium">{t("work.priorityMedium")}</option>
                    <option value="high">{t("work.priorityHigh")}</option>
                  </select>
                  <select
                    className="rounded border border-[var(--border)] px-2 py-1"
                    value={editDraft.category ?? "execution"}
                    onChange={(e) =>
                      setEditDraft((s) => ({
                        ...s,
                        category: e.target.value as TaskDailyNote["category"],
                      }))
                    }
                  >
                    <option value="planning">{t("work.categoryPlanning")}</option>
                    <option value="execution">{t("work.categoryExecution")}</option>
                    <option value="followup">{t("work.categoryFollowup")}</option>
                    <option value="blocker">{t("work.categoryBlocker")}</option>
                  </select>
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded border border-[var(--border)] px-2 py-1"
                    onClick={() => {
                      setEditingTarget(null);
                      setEditDraft({});
                    }}
                  >
                    {t("settings.cancel")}
                  </button>
                  <button
                    type="button"
                    className="rounded bg-[var(--accent)] px-2 py-1 text-white"
                    onClick={() => void saveEditDailyItem()}
                  >
                    {t("settings.save")}
                  </button>
                </div>
              </div>
            )}
            <div className="mt-2 rounded-xl border border-[var(--border)]/80 bg-[var(--bg)]/30 p-3">
              <p className="mb-2 text-xs font-medium text-[var(--muted)]">{t("work.detailedForm")}</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  <span className="mb-1 block font-medium text-[var(--muted)]">{t("work.fieldPriority")}</span>
                  <select
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs"
                    value={priorityDraft[task.id] ?? "medium"}
                    onChange={(e) =>
                      setPriorityDraft((d) => ({
                        ...d,
                        [task.id]: e.target.value as TaskDailyNote["priority"],
                      }))
                    }
                  >
                    <option value="low">{t("work.priorityLow")}</option>
                    <option value="medium">{t("work.priorityMedium")}</option>
                    <option value="high">{t("work.priorityHigh")}</option>
                  </select>
                </label>
                <label className="text-xs">
                  <span className="mb-1 block font-medium text-[var(--muted)]">{t("work.fieldCategory")}</span>
                  <select
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs"
                    value={categoryDraft[task.id] ?? "execution"}
                    onChange={(e) =>
                      setCategoryDraft((d) => ({
                        ...d,
                        [task.id]: e.target.value as TaskDailyNote["category"],
                      }))
                    }
                  >
                    <option value="planning">{t("work.categoryPlanning")}</option>
                    <option value="execution">{t("work.categoryExecution")}</option>
                    <option value="followup">{t("work.categoryFollowup")}</option>
                    <option value="blocker">{t("work.categoryBlocker")}</option>
                  </select>
                </label>
                <label className="text-xs">
                  <span className="mb-1 block font-medium text-[var(--muted)]">{t("work.fieldEstimate")}</span>
                  <input
                    type="number"
                    min={5}
                    step={5}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs"
                    placeholder={t("work.estimateMinutes")}
                    value={estimateDraft[task.id] ?? 30}
                    onChange={(e) =>
                      setEstimateDraft((d) => ({
                        ...d,
                        [task.id]: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="text-xs">
                  <span className="mb-1 block font-medium text-[var(--muted)]">{t("work.fieldTimeSlot")}</span>
                  <select
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs"
                    value={timeSlotDraft[task.id] ?? "morning"}
                    onChange={(e) =>
                      setTimeSlotDraft((d) => ({
                        ...d,
                        [task.id]: e.target.value as TaskDailyNote["timeSlot"],
                      }))
                    }
                  >
                    <option value="morning">{t("work.slotMorning")}</option>
                    <option value="noon">{t("work.slotNoon")}</option>
                    <option value="afternoon">{t("work.slotAfternoon")}</option>
                    <option value="evening">{t("work.slotEvening")}</option>
                  </select>
                </label>
              </div>
              <label className="mt-2 block text-xs">
                <span className="mb-1 block font-medium text-[var(--muted)]">{t("work.fieldDetails")}</span>
                <textarea
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs"
                  rows={2}
                  placeholder={t("work.detailsPlaceholder")}
                  value={detailDraft[task.id] ?? ""}
                  onChange={(e) =>
                    setDetailDraft((d) => ({ ...d, [task.id]: e.target.value }))
                  }
                />
              </label>
              {lastAdded[task.id] && (
                <div className="mt-2 rounded-lg bg-emerald-500/10 px-2 py-2 text-[11px] text-emerald-700 dark:text-emerald-300">
                  <p className="font-semibold">{t("work.previewTitle")}</p>
                  <p>
                    {t("work.previewWhatShown", {
                      date: lastAdded[task.id]!.date,
                      priority: lastAdded[task.id]!.priority,
                      category: lastAdded[task.id]!.category,
                      minutes: lastAdded[task.id]!.estimateMinutes,
                      slot: lastAdded[task.id]!.timeSlot,
                    })}
                  </p>
                </div>
              )}
              <div className="mt-2 flex gap-2">
              <input
                className="flex-1 rounded-lg border border-[var(--border)] px-2 py-1 text-sm"
                placeholder={t("work.addDailyItem")}
                value={noteDraft[task.id] ?? ""}
                onChange={(e) =>
                  setNoteDraft((d) => ({ ...d, [task.id]: e.target.value }))
                }
              />
              <Button size="sm" variant="outline" onClick={() => void addNote(task.id)}>
                {t("work.saveDailyItem")}
              </Button>
              </div>
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
