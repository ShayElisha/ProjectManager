import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, CheckCircle2 } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export function NotificationsBell() {
  const { t } = useTranslation();
  const notifications = useAppStore((s) => s.notifications);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(notifications);
  const unread = local.filter((n) => !n.read).length;

  useEffect(() => {
    setLocal(notifications);
  }, [notifications]);

  const sync = (next: typeof notifications) => {
    setLocal(next);
    useAppStore.setState({ notifications: next });
  };

  const markRead = async (id: string) => {
    if (!activeProjectId) return;
    await api.markNotificationRead(activeProjectId, id);
    sync(local.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    if (!activeProjectId) return;
    await api.markAllNotificationsRead(activeProjectId);
    sync(local.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--border)]/50"
        aria-label={t("nav.notifications")}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute end-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-12 end-0 z-50 w-72 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-xl">
            {local.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
                <CheckCircle2 size={28} className="text-emerald-500" />
                <p className="text-sm font-medium text-[var(--fg)]">
                  {t("ux.notificationsAllClear")}
                </p>
                <p className="text-xs text-[var(--muted)]">{t("ux.notificationsAllClearDesc")}</p>
              </div>
            ) : (
              <>
                {unread > 0 && (
                  <button
                    type="button"
                    className="mb-2 w-full rounded-lg px-2 py-1 text-xs text-[var(--accent)] hover:bg-[var(--accent)]/10"
                    onClick={() => void markAllRead()}
                  >
                    {t("features.markAllRead")}
                  </button>
                )}
                {local.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => !n.read && void markRead(n.id)}
                    className={cn(
                      "w-full rounded-lg px-3 py-2 text-start text-sm transition-colors",
                      !n.read && "bg-[var(--accent)]/10",
                    )}
                  >
                    <p className="font-medium">{n.title}</p>
                    <p className="text-xs text-[var(--muted)]">{n.body}</p>
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
