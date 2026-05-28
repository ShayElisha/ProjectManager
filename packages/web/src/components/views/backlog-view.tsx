import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { IssueType, Sprint, SprintVelocity } from "@nexus/shared";
import { useAppStore } from "@/store/app-store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

const ISSUE_TYPES: IssueType[] = ["epic", "story", "task", "bug"];

export function BacklogView() {
  const { t } = useTranslation();
  const projectId = useAppStore((s) => s.activeProjectId);
  const tasks = useAppStore((s) => s.tasks);
  const updateTask = useAppStore((s) => s.updateTask);
  const setSelectedTaskId = useAppStore((s) => s.setSelectedTaskId);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [activeSprintId, setActiveSprintId] = useState<string>("");
  const [velocity, setVelocity] = useState<SprintVelocity | null>(null);
  const [sprintName, setSprintName] = useState("");

  useEffect(() => {
    if (!projectId) return;
    void api.sprints(projectId).then(setSprints);
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !activeSprintId) {
      setVelocity(null);
      return;
    }
    void api.sprintVelocity(projectId, activeSprintId).then(setVelocity);
  }, [projectId, activeSprintId]);

  const backlog = useMemo(
    () => tasks.filter((t) => !t.isSummary && !t.sprintId),
    [tasks],
  );
  const sprintTasks = useMemo(
    () => tasks.filter((t) => t.sprintId === activeSprintId),
    [tasks, activeSprintId],
  );

  const createSprint = async () => {
    if (!projectId || !sprintName.trim()) return;
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date();
    end.setDate(end.getDate() + 14);
    const s = await api.createSprint(projectId, {
      name: sprintName.trim(),
      startDate: today,
      endDate: end.toISOString().slice(0, 10),
    });
    setSprints((prev) => [...prev, s]);
    setActiveSprintId(s.id);
    setSprintName("");
  };

  const assignSprint = async (taskId: string, sprintId: string) => {
    await updateTask(taskId, { sprintId: sprintId || undefined });
  };

  if (!projectId) return null;

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="text-[var(--muted)]">{t("features.sprint")}</span>
          <select
            className="ms-2 rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1"
            value={activeSprintId}
            onChange={(e) => setActiveSprintId(e.target.value)}
          >
            <option value="">{t("features.noSprint")}</option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <input
          className="rounded border border-[var(--border)] px-2 py-1 text-sm"
          placeholder={t("features.newSprint")}
          value={sprintName}
          onChange={(e) => setSprintName(e.target.value)}
        />
        <Button type="button" size="sm" onClick={() => void createSprint()}>
          {t("features.addSprint")}
        </Button>
        {velocity && (
          <span className="text-sm text-[var(--muted)]">
            {t("features.velocity", {
              done: velocity.completedPoints,
              total: velocity.committedPoints,
            })}
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="mb-3 font-semibold">{t("features.backlog")}</h3>
          <ul className="space-y-2">
            {backlog.map((task) => (
              <li
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              >
                <button type="button" className="text-start font-medium hover:text-[var(--accent)]" onClick={() => setSelectedTaskId(task.id)}>
                  {task.name}
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase text-[var(--muted)]">{task.issueType ?? "task"}</span>
                  {task.storyPoints != null && (
                    <span className="rounded bg-[var(--accent)]/15 px-1.5 text-xs">{task.storyPoints} SP</span>
                  )}
                  {activeSprintId && (
                    <Button type="button" size="sm" variant="outline" onClick={() => void assignSprint(task.id, activeSprintId)}>
                      →
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="mb-3 font-semibold">{t("features.sprintBoard")}</h3>
          {!activeSprintId ? (
            <p className="text-sm text-[var(--muted)]">{t("features.pickSprint")}</p>
          ) : (
            <ul className="space-y-2">
              {sprintTasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <button type="button" onClick={() => setSelectedTaskId(task.id)} className="font-medium hover:text-[var(--accent)]">
                    {task.name}
                  </button>
                  <select
                    className="rounded border border-[var(--border)] text-xs"
                    value={task.issueType ?? "task"}
                    onChange={(e) => void updateTask(task.id, { issueType: e.target.value as IssueType })}
                  >
                    {ISSUE_TYPES.map((it) => (
                      <option key={it} value={it}>
                        {it}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
