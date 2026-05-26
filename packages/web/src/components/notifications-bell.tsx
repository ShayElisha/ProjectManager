import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, CheckCircle2 } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";

export function NotificationsBell() {
  const { t } = useTranslation();
  const notifications = useAppStore((s) => s.notifications);
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

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
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
                <CheckCircle2 size={28} className="text-emerald-500" />
                <p className="text-sm font-medium text-[var(--fg)]">
                  {t("ux.notificationsAllClear")}
                </p>
                <p className="text-xs text-[var(--muted)]">{t("ux.notificationsAllClearDesc")}</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm transition-colors",
                    !n.read && "bg-[var(--accent)]/10",
                  )}
                >
                  <p className="font-medium">{n.title}</p>
                  <p className="text-xs text-[var(--muted)]">{n.body}</p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
