import { useTranslation } from "react-i18next";
import {
  Briefcase,
  FolderKanban,
  BarChart3,
  Settings,
  ShieldAlert,
  Ban,
  ListTodo,
  LineChart,
  LayoutDashboard,
} from "lucide-react";
import { useAppStore, type AppSection } from "@/store/app-store";
import { cn } from "@/lib/utils";
/** Primary nav (≤5) — secondary sections live under Settings */
const SECTIONS: { id: AppSection; icon: typeof FolderKanban; labelKey: string }[] = [
  { id: "dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { id: "portfolio", icon: Briefcase, labelKey: "nav.portfolio" },
  { id: "project", icon: FolderKanban, labelKey: "nav.projects" },
  { id: "pmo", icon: LineChart, labelKey: "nav.pmo" },
  { id: "controls", icon: ShieldAlert, labelKey: "nav.controls" },
  { id: "rejections", icon: Ban, labelKey: "nav.rejections" },
  { id: "work", icon: ListTodo, labelKey: "nav.work" },
  { id: "reports", icon: BarChart3, labelKey: "nav.reports" },
  { id: "settings", icon: Settings, labelKey: "nav.settings" },
];

export function Sidebar() {
  const { t } = useTranslation();
  const section = useAppStore((s) => s.section);
  const setSection = useAppStore((s) => s.setSection);
  const loadPortfolio = useAppStore((s) => s.loadPortfolio);

  return (
    <aside className="hidden w-14 shrink-0 flex-col items-center gap-2 border-e border-[var(--border)] bg-[var(--card)] py-4 md:flex">
      {SECTIONS.map(({ id, icon: Icon, labelKey }) => (
        <button
          key={id}
          type="button"
          title={t(labelKey)}
          onClick={() => {
            setSection(id);
            if (id === "dashboard" || id === "portfolio") void loadPortfolio();
          }}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
            section === id
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--muted)] hover:bg-[var(--border)]/50",
          )}
        >
          <Icon size={20} />
        </button>
      ))}
    </aside>
  );
}
