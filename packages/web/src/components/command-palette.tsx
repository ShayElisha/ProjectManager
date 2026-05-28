import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Command } from "cmdk";
import { useAppStore } from "@/store/app-store";
import { ViewMode, type SearchHit } from "@nexus/shared";
import { api } from "@/lib/api";
import { useOrgStore } from "@/store/org-store";

export function CommandPalette() {
  const { t } = useTranslation();
  const open = useAppStore((s) => s.commandOpen);
  const setOpen = useAppStore((s) => s.setCommandOpen);
  const setView = useAppStore((s) => s.setView);
  const setSection = useAppStore((s) => s.setSection);
  const loadPortfolio = useAppStore((s) => s.loadPortfolio);
  const recalculate = useAppStore((s) => s.recalculate);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const tasks = useAppStore((s) => s.tasks);
  const setSelectedTaskId = useAppStore((s) => s.setSelectedTaskId);
  const setCreateTaskDialogOpen = useAppStore((s) => s.setCreateTaskDialogOpen);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const selectProject = useAppStore((s) => s.selectProject);
  const section = useAppStore((s) => s.section);
  const orgId = useOrgStore((s) => s.activeOrganizationId);
  const [query, setQuery] = useState("");
  const [globalHits, setGlobalHits] = useState<SearchHit[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setGlobalHits([]);
      return;
    }
    const timer = setTimeout(() => {
      void api.search(q, orgId ?? undefined).then(setGlobalHits).catch(() => setGlobalHits([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, orgId]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, setOpen]);

  if (!open) return null;

  const views = ["gantt", "grid", "kanban", "calendar", "timeline", "backlog", "roadmap"] as ViewMode[];
  const searchableTasks = tasks
    .filter((t) => !t.isSummary)
    .slice(0, 40);

  const goProject = () => {
    setSection("project");
    setOpen(false);
  };

  return (
    <div
      className="command-palette-overlay fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[18vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <Command
        shouldFilter={false}
        className="command-palette-panel w-full max-w-lg overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command.Input
          placeholder={t("actions.commandPalette") + " (Ctrl+K)"}
          value={query}
          onValueChange={setQuery}
          className="w-full border-b border-[var(--border)] bg-transparent px-4 py-3 text-sm outline-none"
        />
        <Command.List className="max-h-80 overflow-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-[var(--muted)]">
            —
          </Command.Empty>
          {globalHits.length > 0 && (
            <Command.Group heading={t("features.globalSearch")}>
              {globalHits.map((hit) => (
                <Command.Item
                  key={`${hit.type}-${hit.id}`}
                  value={`${hit.title} ${hit.subtitle ?? ""}`}
                  className="cursor-pointer rounded-lg px-3 py-2 text-sm aria-selected:bg-[var(--accent)]/15"
                  onSelect={() => {
                    if (hit.type === "project") {
                      void selectProject(hit.id);
                    } else if (hit.projectId) {
                      void selectProject(hit.projectId).then(() => setSelectedTaskId(hit.id));
                    }
                    setOpen(false);
                  }}
                >
                  <span className="font-medium">{hit.title}</span>
                  {hit.subtitle && (
                    <span className="ms-2 text-xs text-[var(--muted)]">{hit.subtitle}</span>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          )}
          {activeProjectId && searchableTasks.length > 0 && query.length < 2 && (
            <Command.Group heading={t("ux.commandSearchTasks")}>
              {searchableTasks.map((task) => (
                <Command.Item
                  key={task.id}
                  value={`${task.name} ${task.wbs}`}
                  className="cursor-pointer rounded-lg px-3 py-2 text-sm aria-selected:bg-[var(--accent)]/15"
                  onSelect={() => {
                    goProject();
                    setSelectedTaskId(task.id);
                  }}
                >
                  <span className="font-medium">{task.name}</span>
                  <span className="ms-2 text-xs text-[var(--muted)]">{task.wbs}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}
          <Command.Group heading={t("nav.projects")}>
            {views.map((v) => (
              <Command.Item
                key={v}
                value={t(`views.${v}`)}
                className="cursor-pointer rounded-lg px-3 py-2 text-sm aria-selected:bg-[var(--accent)]/15"
                onSelect={() => {
                  goProject();
                  setView(v);
                }}
              >
                {t(`views.${v}`)}
              </Command.Item>
            ))}
            {activeProjectId && (
              <Command.Item
                value={t("ux.commandAddTask")}
                className="cursor-pointer rounded-lg px-3 py-2 text-sm aria-selected:bg-[var(--accent)]/15"
                onSelect={() => {
                  goProject();
                  setCreateTaskDialogOpen(true);
                }}
              >
                {t("ux.commandAddTask")}
              </Command.Item>
            )}
          </Command.Group>
          <Command.Group heading={t("nav.dashboard")}>
            <Command.Item
              className="cursor-pointer rounded-lg px-3 py-2 text-sm aria-selected:bg-[var(--accent)]/15"
              onSelect={() => {
                setSection("dashboard");
                void loadPortfolio();
                setOpen(false);
              }}
            >
              {t("dashboard.title")}
            </Command.Item>
            <Command.Item
              className="cursor-pointer rounded-lg px-3 py-2 text-sm aria-selected:bg-[var(--accent)]/15"
              onSelect={() => {
                setSection("portfolio");
                void loadPortfolio();
                setOpen(false);
              }}
            >
              {t("portfolio.title")}
            </Command.Item>
            <Command.Item
              className="cursor-pointer rounded-lg px-3 py-2 text-sm aria-selected:bg-[var(--accent)]/15"
              onSelect={() => {
                setSection("budget");
                setOpen(false);
              }}
            >
              {t("ux.commandGoBudget")}
            </Command.Item>
            <Command.Item
              className="cursor-pointer rounded-lg px-3 py-2 text-sm aria-selected:bg-[var(--accent)]/15"
              onSelect={() => {
                setSection("reports");
                setOpen(false);
              }}
            >
              {t("reports.title")}
            </Command.Item>
            <Command.Item
              className="cursor-pointer rounded-lg px-3 py-2 text-sm aria-selected:bg-[var(--accent)]/15"
              onSelect={() => {
                setSection("timesheets");
                setOpen(false);
              }}
            >
              {t("timesheets.title")}
            </Command.Item>
            <Command.Item
              className="cursor-pointer rounded-lg px-3 py-2 text-sm aria-selected:bg-[var(--accent)]/15"
              onSelect={() => {
                setSection("settings");
                setOpen(false);
              }}
            >
              {t("settings.title")}
            </Command.Item>
          </Command.Group>
          <Command.Group heading="Actions">
            {section === "project" && activeProjectId && (
              <Command.Item
                className="cursor-pointer rounded-lg px-3 py-2 text-sm aria-selected:bg-[var(--accent)]/15"
                onSelect={() => {
                  void recalculate();
                  setOpen(false);
                }}
              >
                {t("actions.recalculate")}
              </Command.Item>
            )}
            <Command.Item
              className="cursor-pointer rounded-lg px-3 py-2 text-sm aria-selected:bg-[var(--accent)]/15"
              onSelect={() => {
                toggleTheme();
                setOpen(false);
              }}
            >
              {t("actions.toggleTheme")}
            </Command.Item>
            <Command.Item
              className="cursor-pointer rounded-lg px-3 py-2 text-sm aria-selected:bg-[var(--accent)]/15"
              onSelect={() => {
                setLocale(locale === "he" ? "en" : "he");
                setOpen(false);
              }}
            >
              {t("actions.toggleLocale")}
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
