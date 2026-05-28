import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, Square } from "lucide-react";
import type { ActiveTimer } from "@nexus/shared";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";

export function WorkTimerBar() {
  const { t } = useTranslation();
  const projectId = useAppStore((s) => s.activeProjectId);
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
  const user = useAuthStore((s) => s.user);
  const [timer, setTimer] = useState<ActiveTimer | null>(null);
  const [busy, setBusy] = useState(false);

  const userId = user?.id;

  const refresh = async () => {
    if (!projectId) return;
    const active = await api.activeTimer(projectId, userId);
    setTimer(active);
  };

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
  }, [projectId, userId]);

  if (!projectId) return null;

  const start = async () => {
    setBusy(true);
    try {
      const t0 = await api.startTimer(projectId, selectedTaskId ?? undefined, userId);
      setTimer(t0);
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      await api.stopTimer(projectId, userId);
      setTimer(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
      <span className="text-[var(--muted)]">{t("features.timer")}</span>
      {timer ? (
        <>
          <span className="font-mono text-emerald-600">
            {t("features.timerRunning", { since: new Date(timer.startedAt).toLocaleTimeString() })}
          </span>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void stop()}>
            <Square size={14} className="me-1" />
            {t("features.timerStop")}
          </Button>
        </>
      ) : (
        <Button type="button" size="sm" disabled={busy} onClick={() => void start()}>
          <Play size={14} className="me-1" />
          {t("features.timerStart")}
        </Button>
      )}
    </div>
  );
}
