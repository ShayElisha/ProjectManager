import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, X } from "lucide-react";
import type { DependencyType, IssueType, ScheduleConstraint, Task, TaskDependency } from "@nexus/shared";

const CONSTRAINTS: ScheduleConstraint[] = [
  "ASAP",
  "ALAP",
  "MSO",
  "MFO",
  "SNET",
  "SNLT",
  "FNET",
  "FNLT",
];
import { api } from "@/lib/api";
import { daysBetween } from "@/lib/dependency-anchors";
import { tasksAlreadyLinked } from "@/lib/link-rules";
import { clampWorkDays } from "@/lib/task-tree";
import { remainingWorkDaysFromProgress } from "@/lib/task-pause";
import { useAppStore } from "@/store/app-store";
import { confirmAction } from "@/lib/confirm";
import { Button } from "@/components/ui/button";
import { TaskCollaborationSection } from "@/components/features/task-collaboration-section";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

const ISSUE_TYPES: IssueType[] = ["epic", "story", "task", "bug"];

const LINK_TYPES: DependencyType[] = ["FS", "SS", "FF", "SF"];

interface Props {
  taskId: string | null;
  onClose: () => void;
}

export function TaskDetailDrawer({ taskId, onClose }: Props) {
  const { t } = useTranslation();
  const tasks = useAppStore((s) => s.tasks);
  const projects = useAppStore((s) => s.projects);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const selectProject = useAppStore((s) => s.selectProject);
  const dependencies = useAppStore((s) => s.dependencies);
  const defaultLinkType = useAppStore((s) => s.defaultLinkType);
  const updateTask = useAppStore((s) => s.updateTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const pauseTask = useAppStore((s) => s.pauseTask);
  const resumeTask = useAppStore((s) => s.resumeTask);
  const addDependency = useAppStore((s) => s.addDependency);
  const removeDependency = useAppStore((s) => s.removeDependency);
  const recalculate = useAppStore((s) => s.recalculate);
  const members = useAppStore((s) => s.members);
  const resourceNames = useAppStore((s) => s.resourceNames);
  const task = tasks.find((t) => t.id === taskId);
  const [draft, setDraft] = useState<Partial<Task>>({});
  const parentTask = task?.parentId ? tasks.find((t) => t.id === task.parentId) : undefined;

  const memberOptions = useMemo(
    () =>
      members.map((m) => ({
        id: m.resourceId,
        label: resourceNames[m.resourceId] ?? m.resourceId,
      })),
    [members, resourceNames],
  );

  const maxWorkDays = parentTask
    ? parentTask.durationDays
    : (draft.startDate ?? task?.startDate) && (draft.endDate ?? task?.endDate)
      ? daysBetween(draft.startDate ?? task!.startDate, draft.endDate ?? task!.endDate) + 1
      : 999;
  const [succId, setSuccId] = useState("");
  const [predId, setPredId] = useState("");
  const [newType, setNewType] = useState<DependencyType>(defaultLinkType);
  const [lagDays, setLagDays] = useState(0);
  const [resumeDate, setResumeDate] = useState("");
  const [remainingDays, setRemainingDays] = useState(1);
  const [transferToTaskId, setTransferToTaskId] = useState("");
  const [pauseBusy, setPauseBusy] = useState(false);

  const tomorrowIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const canPause = task && !task.isSummary && !task.isMilestone && task.status !== "on_hold";
  const isPaused = task?.status === "on_hold";

  const transferOptions = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.id !== task?.id &&
          !t.isSummary &&
          !t.isMilestone &&
          t.status !== "on_hold",
      ),
    [tasks, task?.id],
  );

  useEffect(() => {
    if (task) setDraft(task);
  }, [task]);

  useEffect(() => {
    if (!task) return;
    setResumeDate(tomorrowIso);
    setRemainingDays(remainingWorkDaysFromProgress(task));
    setTransferToTaskId("");
  }, [task?.id, tomorrowIso]);

  useEffect(() => {
    setNewType(defaultLinkType);
  }, [defaultLinkType]);

  if (!taskId || !task) return null;

  const preds = dependencies.filter((d) => d.successorId === task.id);
  const succs = dependencies.filter((d) => d.predecessorId === task.id);
  const taskName = (id: string) => tasks.find((t) => t.id === id)?.name ?? id.slice(0, 8);
  const canLinkTo = (otherId: string) =>
    otherId !== task.id && !tasksAlreadyLinked(task.id, otherId, dependencies);

  const childCount = tasks.filter((t) => t.parentId === task.id).length;

  const draftKeys = [
    "name",
    "startDate",
    "endDate",
    "durationDays",
    "percentComplete",
    "status",
    "manuallyScheduled",
    "isPriority",
    "constraint",
    "plannedLaborCost",
    "plannedMaterialCost",
    "plannedOtherCost",
    "actualLaborCost",
    "actualMaterialCost",
    "actualOtherCost",
    "tags",
    "description",
    "descriptionHtml",
    "issueType",
    "storyPoints",
    "sprintId",
    "cycleId",
    "customFields",
  ] as const;
  const hasDraftChanges = draftKeys.some((k) => draft[k] !== undefined && draft[k] !== task[k]);

  const save = async () => {
    if (hasDraftChanges) {
      const ok = await confirmAction({
        title: t("confirm.saveTaskTitle"),
        message: t("confirm.saveTaskMessage", { name: draft.name ?? task.name }),
        confirmLabel: t("confirm.confirmSave"),
      });
      if (!ok) return;
    }
    await updateTask(task.id, draft);
    onClose();
  };

  const removeTask = async () => {
    const ok = await confirmAction({
      title: t("confirm.deleteTaskTitle"),
      message: t("confirm.deleteTaskMessage", {
        name: task.name,
        children: childCount > 0 ? t("confirm.deleteTaskChildren") : "",
      }),
      confirmLabel: t("confirm.confirmDelete"),
      destructive: true,
    });
    if (!ok) return;
    await deleteTask(task.id);
    onClose();
  };

  const addAsPredecessor = async () => {
    if (!predId || predId === task.id) return;
    try {
      await addDependency(predId, task.id, newType, lagDays);
      setPredId("");
      await recalculate();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const addAsSuccessor = async () => {
    if (!succId || succId === task.id) return;
    try {
      await addDependency(task.id, succId, newType, lagDays);
      setSuccId("");
      await recalculate();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const DepRow = ({ dep, label }: { dep: TaskDependency; label: string }) => (
    <li className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm">
      <span className="rounded bg-[var(--accent)]/15 px-1.5 text-xs font-medium text-[var(--accent)]">
        {dep.type}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {dep.lagDays !== 0 && (
        <span className="text-xs text-[var(--muted)]">+{dep.lagDays}d</span>
      )}
      <button
        type="button"
        className="rounded p-1 text-red-500 hover:bg-red-500/10"
        onClick={async () => {
          const ok = await confirmAction({
            title: t("confirm.deleteDependencyTitle"),
            message: t("confirm.deleteDependencyMessage"),
            confirmLabel: t("confirm.confirmDelete"),
            destructive: true,
          });
          if (!ok) return;
          await removeDependency(dep.id);
          await recalculate();
        }}
      >
        <Trash2 size={14} />
      </button>
    </li>
  );

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside className="fixed top-0 bottom-0 z-50 flex w-96 max-w-[95vw] flex-col border-[var(--border)] bg-[var(--card)] shadow-2xl end-0">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h3 className="font-semibold">{t("task.details")}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-[var(--border)]/50"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{t("task.name")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
              value={draft.name ?? ""}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-[var(--muted)]">{t("features.issueType")}</span>
              <select
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2"
                value={draft.issueType ?? task.issueType ?? "task"}
                onChange={(e) => setDraft({ ...draft, issueType: e.target.value as IssueType })}
              >
                {ISSUE_TYPES.map((it) => (
                  <option key={it} value={it}>
                    {it}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">{t("features.storyPoints")}</span>
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2"
                value={draft.storyPoints ?? task.storyPoints ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    storyPoints: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{t("features.descriptionRich")}</span>
            <div className="mt-1">
              <RichTextEditor
                value={draft.descriptionHtml ?? task.descriptionHtml ?? ""}
                onChange={(html) => setDraft({ ...draft, descriptionHtml: html })}
              />
            </div>
          </label>
          {projects.length > 1 && activeProjectId && (
            <label className="block text-sm">
              <span className="text-[var(--muted)]">{t("features.moveToProject")}</span>
              <select
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2"
                defaultValue=""
                onChange={(e) => {
                  const target = e.target.value;
                  if (!target || !task) return;
                  void api.moveTask(activeProjectId, task.id, target).then(() => {
                    void selectProject(target);
                    onClose();
                  });
                  e.target.value = "";
                }}
              >
                <option value="">—</option>
                {projects
                  .filter((p) => p.id !== activeProjectId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-[var(--muted)]">{t("task.start")}</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2"
                value={draft.startDate ?? ""}
                onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">{t("task.end")}</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2"
                value={draft.endDate ?? ""}
                onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{t("task.workDays")}</span>
            <input
              type="number"
              min={1}
              max={maxWorkDays}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
              value={draft.durationDays ?? 1}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  durationDays: clampWorkDays(Number(e.target.value), maxWorkDays),
                })
              }
            />
            {parentTask && (
              <p className="mt-1 text-xs text-[var(--muted)]">
                {t("task.subtaskWorkDaysMax", { max: parentTask.durationDays })}
              </p>
            )}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-[var(--muted)]">{t("task.constraint")}</span>
              <select
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2"
                value={draft.constraint ?? task.constraint ?? "ASAP"}
                onChange={(e) =>
                  setDraft({ ...draft, constraint: e.target.value as ScheduleConstraint })
                }
              >
                {CONSTRAINTS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">{t("task.constraintDate")}</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2"
                value={draft.constraintDate ?? task.constraintDate ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    constraintDate: e.target.value || undefined,
                  })
                }
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{t("task.assignee")}</span>
            <select
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2"
              value={draft.assigneeIds?.[0] ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  assigneeIds: e.target.value ? [e.target.value] : [],
                })
              }
            >
              <option value="">{t("task.assigneeNone")}</option>
              {memberOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{t("task.progress")}</span>
            <input
              type="range"
              min={0}
              max={100}
              className="mt-2 w-full"
              value={draft.percentComplete ?? 0}
              onChange={(e) => setDraft({ ...draft, percentComplete: Number(e.target.value) })}
            />
            <span className="text-xs tabular-nums">{draft.percentComplete ?? 0}%</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.manuallyScheduled ?? false}
              onChange={(e) => setDraft({ ...draft, manuallyScheduled: e.target.checked })}
            />
            {t("task.manuallyScheduled")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.isPriority ?? false}
              onChange={(e) => setDraft({ ...draft, isPriority: e.target.checked })}
            />
            {t("task.priority")}
          </label>

          {!task.isSummary && (
            <section className="space-y-3 rounded-lg border border-[var(--border)] p-3">
              <h4 className="text-sm font-medium">{t("task.costs")}</h4>
              <label className="block text-sm">
                <span className="text-[var(--muted)]" title={t("task.laborCostHint")}>
                  {t("task.laborCost")}
                </span>
                <input
                  type="number"
                  readOnly
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)]/50 px-3 py-2 tabular-nums"
                  value={draft.plannedLaborCost ?? task.plannedLaborCost ?? 0}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">{t("task.materialCost")}</span>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
                    value={draft.plannedMaterialCost ?? task.plannedMaterialCost ?? 0}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        plannedMaterialCost: Number(e.target.value),
                        actualMaterialCost:
                          draft.actualMaterialCost ?? task.actualMaterialCost ?? Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">{t("task.otherCost")}</span>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
                    value={draft.plannedOtherCost ?? task.plannedOtherCost ?? 0}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        plannedOtherCost: Number(e.target.value),
                        actualOtherCost:
                          draft.actualOtherCost ?? task.actualOtherCost ?? Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <p className="text-xs text-[var(--muted)]">
                {t("task.totalCost")}:{" "}
                {(
                  (draft.plannedLaborCost ?? task.plannedLaborCost ?? 0) +
                  (draft.plannedMaterialCost ?? task.plannedMaterialCost ?? 0) +
                  (draft.plannedOtherCost ?? task.plannedOtherCost ?? 0)
                ).toLocaleString()}
              </p>
            </section>
          )}

          {task.isCritical && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {t("task.critical")}
            </p>
          )}

          {(canPause || isPaused) && (
            <section className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <h4 className="text-sm font-medium">{t("task.pauseSection")}</h4>
              {isPaused ? (
                <>
                  <p className="text-xs text-[var(--muted)]">
                    {t("task.pausedSince", { date: task.pausedAt ?? "—" })}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {t("task.resumePlanned", {
                      date: task.resumeDate ?? "—",
                      days: task.remainingWorkDays ?? 0,
                    })}
                  </p>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={pauseBusy}
                    onClick={async () => {
                      setPauseBusy(true);
                      try {
                        await resumeTask(task.id);
                        onClose();
                      } catch (err) {
                        alert(err instanceof Error ? err.message : String(err));
                      } finally {
                        setPauseBusy(false);
                      }
                    }}
                  >
                    {t("task.resumeWork")}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-xs text-[var(--muted)]">{t("task.pauseHint")}</p>
                  <label className="block text-sm">
                    <span className="text-[var(--muted)]">{t("task.resumeDate")}</span>
                    <input
                      type="date"
                      min={tomorrowIso}
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2"
                      value={resumeDate}
                      onChange={(e) => setResumeDate(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-[var(--muted)]">{t("task.remainingWorkDays")}</span>
                    <input
                      type="number"
                      min={1}
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
                      value={remainingDays}
                      onChange={(e) =>
                        setRemainingDays(Math.max(1, Number(e.target.value) || 1))
                      }
                    />
                  </label>
                  {transferOptions.length > 0 && (
                    <label className="block text-sm">
                      <span className="text-[var(--muted)]">{t("task.transferTeamTo")}</span>
                      <select
                        className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2"
                        value={transferToTaskId}
                        onChange={(e) => setTransferToTaskId(e.target.value)}
                      >
                        <option value="">{t("task.transferNone")}</option>
                        {transferOptions.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.wbs} {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-amber-500/50 text-amber-800 dark:text-amber-200"
                    disabled={pauseBusy || !resumeDate}
                    onClick={async () => {
                      setPauseBusy(true);
                      try {
                        await pauseTask(task.id, {
                          resumeDate,
                          remainingWorkDays: remainingDays,
                          transferToTaskId: transferToTaskId || undefined,
                        });
                        onClose();
                      } catch (err) {
                        alert(err instanceof Error ? err.message : String(err));
                      } finally {
                        setPauseBusy(false);
                      }
                    }}
                  >
                    {t("task.pauseWork")}
                  </Button>
                </>
              )}
            </section>
          )}

          <section className="space-y-3 border-t border-[var(--border)] pt-4">
            <h4 className="text-sm font-medium">{t("deps.title")}</h4>

            {preds.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-[var(--muted)]">{t("deps.predecessors")}</p>
                <ul className="space-y-1">
                  {preds.map((d) => (
                    <DepRow key={d.id} dep={d} label={taskName(d.predecessorId)} />
                  ))}
                </ul>
              </div>
            )}

            {succs.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-[var(--muted)]">{t("deps.successors")}</p>
                <ul className="space-y-1">
                  {succs.map((d) => (
                    <DepRow key={d.id} dep={d} label={taskName(d.successorId)} />
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg border border-[var(--border)] p-3 space-y-2">
              <div className="flex gap-2">
                {LINK_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setNewType(type)}
                    className={`rounded px-2 py-1 text-xs font-medium ${
                      newType === type
                        ? "bg-[var(--accent)] text-white"
                        : "border border-[var(--border)]"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-[var(--muted)]">{t("deps.lag")}</span>
                <input
                  type="number"
                  className="w-16 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1"
                  value={lagDays}
                  onChange={(e) => setLagDays(Number(e.target.value))}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--muted)]">{t("deps.addPredecessor")}</span>
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2"
                  value={predId}
                  onChange={(e) => setPredId(e.target.value)}
                >
                  <option value="">—</option>
                  {tasks
                    .filter((t) => !t.isSummary && canLinkTo(t.id))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.wbs} {t.name}
                      </option>
                    ))}
                </select>
              </label>
              <Button size="sm" variant="outline" className="w-full" onClick={() => void addAsPredecessor()}>
                {t("deps.linkPredecessor")}
              </Button>
              <label className="block text-sm">
                <span className="text-[var(--muted)]">{t("deps.addSuccessor")}</span>
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2"
                  value={succId}
                  onChange={(e) => setSuccId(e.target.value)}
                >
                  <option value="">—</option>
                  {tasks
                    .filter((t) => !t.isSummary && canLinkTo(t.id))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.wbs} {t.name}
                      </option>
                    ))}
                </select>
              </label>
              <Button size="sm" variant="outline" className="w-full" onClick={() => void addAsSuccessor()}>
                {t("deps.linkSuccessor")}
              </Button>
            </div>
          </section>

          <TaskCollaborationSection
            taskId={task.id}
            tags={draft.tags ?? task.tags ?? []}
            onTagsChange={(tags) => setDraft((d) => ({ ...d, tags }))}
          />
        </div>
        <div className="border-t border-[var(--border)] p-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => void save()}>
              {t("settings.save")}
            </Button>
            <Button variant="outline" onClick={onClose}>
              {t("settings.cancel")}
            </Button>
          </div>
          <Button
            variant="outline"
            className="w-full border-red-500/40 text-red-600 hover:bg-red-500/10 dark:text-red-400"
            onClick={() => void removeTask()}
          >
            <Trash2 size={16} className="me-1" />
            {t("settings.delete")}
          </Button>
        </div>
      </aside>
    </>
  );
}
