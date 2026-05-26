import { useTranslation } from "react-i18next";
import {
  FolderKanban,
  Settings,
  ListTodo,
  LineChart,
  LayoutDashboard,
} from "lucide-react";
import { useAppStore, type AppSection } from "@/store/app-store";
import { cn } from "@/lib/utils";

const SECTIONS: { id: AppSection; icon: typeof FolderKanban; labelKey: string }[] = [
  { id: "dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { id: "project", icon: FolderKanban, labelKey: "nav.projects" },
  { id: "pmo", icon: LineChart, labelKey: "nav.pmo" },
  { id: "work", icon: ListTodo, labelKey: "nav.work" },
  { id: "settings", icon: Settings, labelKey: "nav.settings" },
];

export function MobileBottomNav() {
  const { t } = useTranslation();
  const section = useAppStore((s) => s.section);
  const setSection = useAppStore((s) => s.setSection);
  const loadPortfolio = useAppStore((s) => s.loadPortfolio);

  return (
    <nav
      className="app-bottom-nav fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-md md:hidden"
      aria-label={t("layout.mainNav")}
    >
      {SECTIONS.map(({ id, icon: Icon, labelKey }) => (
        <button
          key={id}
          type="button"
          onClick={() => {
            setSection(id);
            if (id === "dashboard") void loadPortfolio();
          }}
          className={cn(
            "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors",
            section === id ? "text-[var(--accent)]" : "text-[var(--muted)]",
          )}
        >
          <Icon size={20} strokeWidth={section === id ? 2.5 : 2} />
          <span className="max-w-full truncate">{t(labelKey)}</span>
        </button>
      ))}
    </nav>
  );
}
