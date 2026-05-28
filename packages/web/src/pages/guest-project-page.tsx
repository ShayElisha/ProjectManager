import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Project, ProjectGuest, Task } from "@nexus/shared";
import { api } from "@/lib/api";

export function GuestProjectPage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const [guest, setGuest] = useState<ProjectGuest | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .guestProject(token)
      .then((data) => {
        setGuest(data.guest);
        setProject(data.project);
        setTasks(data.tasks);
      })
      .catch(() => setError(true));
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4">
        <p className="text-[var(--muted)]">{t("hub.guestInvalid")}</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] p-4 sm:p-8">
      <header className="mb-6">
        <p className="text-xs text-[var(--muted)]">{t("hub.guestView")}</p>
        <h1 className="text-2xl font-bold">{project.name}</h1>
        {guest && (
          <p className="text-sm text-[var(--muted)]">
            {guest.email} · {guest.role}
          </p>
        )}
      </header>
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg)]/50 text-[var(--muted)]">
              <th className="px-3 py-2 text-start">WBS</th>
              <th className="px-3 py-2 text-start">{t("task.name")}</th>
              <th className="px-3 py-2 text-start">{t("task.progress")}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-b border-[var(--border)]/50">
                <td className="px-3 py-2 font-mono text-xs">{task.wbs}</td>
                <td className="px-3 py-2">{task.name}</td>
                <td className="px-3 py-2">{task.percentComplete}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
