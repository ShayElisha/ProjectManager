import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: "Ctrl+K", key: "shortcuts.command" },
  { keys: "/", key: "shortcuts.search" },
  { keys: "?", key: "shortcuts.help" },
  { keys: "G then D", key: "shortcuts.goDashboard" },
  { keys: "G then P", key: "shortcuts.goProject" },
  { keys: "G then R", key: "shortcuts.goReports" },
  { keys: "G then B", key: "shortcuts.goBudget" },
  { keys: "N", key: "shortcuts.newTask" },
];

export function KeyboardShortcutsDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-lg font-semibold">{t("shortcuts.title")}</h2>
        <ul className="space-y-2 text-sm">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex justify-between gap-4">
              <kbd className="rounded bg-[var(--border)]/50 px-2 py-0.5 font-mono text-xs">{s.keys}</kbd>
              <span className="text-[var(--muted)]">{t(s.key)}</span>
            </li>
          ))}
        </ul>
        <Button type="button" className="mt-4 w-full" variant="outline" onClick={onClose}>
          {t("confirm.ok")}
        </Button>
      </div>
    </div>
  );
}
