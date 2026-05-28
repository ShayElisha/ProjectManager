import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutGrid,
  GanttChart as GanttIcon,
  Columns3,
  Calendar,
  GitBranch,
  ListTodo,
  Map,
  StickyNote,
  BookOpen,
  Moon,
  Sun,
  Search,
  RefreshCw,
  LogOut,
  BarChart3,
  Users,
  FolderPlus,
  Radio,
  UsersRound,
} from "lucide-react";
import { ViewMode } from "@nexus/shared";
import { useAppStore } from "@/store/app-store";
import { useAuthStore } from "@/store/auth-store";
import { useIsMobile } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/command-palette";
import { AiCopilot } from "@/components/ai-copilot";
import { EVMPanel } from "@/components/evm-panel";
import { ResourcesPanel } from "@/components/resources-panel";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { ProjectToolbar } from "@/components/project-toolbar";
import { GanttChart } from "@/components/gantt/gantt-chart";
import { GridView } from "@/components/views/grid-view";
import { KanbanView } from "@/components/views/kanban-view";
import { CalendarView } from "@/components/views/calendar-view";
import { TimelineView } from "@/components/views/timeline-view";
import { BacklogView } from "@/components/views/backlog-view";
import { RoadmapView } from "@/components/views/roadmap-view";
import { WhiteboardView } from "@/components/views/whiteboard-view";
import { DocsView } from "@/components/views/docs-view";
import { DashboardView } from "@/components/views/dashboard-view";
import { PortfolioView } from "@/components/views/portfolio-view";
import { PmoView } from "@/components/views/pmo-view";
import { ProjectControlsView } from "@/components/views/project-controls-view";
import { RejectionsView } from "@/components/views/rejections-view";
import { WorkView } from "@/components/views/work-view";
import { TimesheetsView } from "@/components/views/timesheets-view";
import { ReportsView } from "@/components/views/reports-view";
import { BudgetView } from "@/components/views/budget-view";
import { SettingsView } from "@/components/views/settings-view";
import { TeamView } from "@/components/views/team-view";
import { VendorQuotesView } from "@/components/views/vendor-quotes-view";
import { ProjectConfigPanel } from "@/components/project-config-panel";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import i18n, { initI18n } from "@/i18n";
import { useAppUrl } from "@/hooks/use-app-url";
import { SavedViewsBar } from "@/components/features/saved-views-bar";
import { ProjectHubPanel } from "@/components/features/project-hub-panel";

const VIEW_ICONS: Record<ViewMode, typeof GanttIcon> = {
  gantt: GanttIcon,
  grid: LayoutGrid,
  kanban: Columns3,
  calendar: Calendar,
  timeline: GitBranch,
  backlog: ListTodo,
  roadmap: Map,
  whiteboard: StickyNote,
  docs: BookOpen,
};

type SideDrawer = "resources" | "evm" | "hub" | null;

export default function AppShell() {
  useAppUrl();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const locale = useAppStore((s) => s.locale);
  const theme = useAppStore((s) => s.theme);
  const section = useAppStore((s) => s.section);
  const view = useAppStore((s) => s.view);
  const projects = useAppStore((s) => s.projects);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const loading = useAppStore((s) => s.loading);
  const socketConnected = useAppStore((s) => s.socketConnected);
  const setLocale = useAppStore((s) => s.setLocale);
  const setView = useAppStore((s) => s.setView);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const setCommandOpen = useAppStore((s) => s.setCommandOpen);
  const loadProjects = useAppStore((s) => s.loadProjects);
  const selectProject = useAppStore((s) => s.selectProject);
  const recalculate = useAppStore((s) => s.recalculate);
  const projectSettingsOpen = useAppStore((s) => s.projectSettingsOpen);
  const setProjectSettingsOpen = useAppStore((s) => s.setProjectSettingsOpen);

  const [sideDrawer, setSideDrawer] = useState<SideDrawer>(null);

  useEffect(() => {
    initI18n(locale);
    setLocale(locale);
    document.documentElement.classList.toggle("dark", theme === "dark");
    void loadProjects();
  }, []);

  useEffect(() => {
    i18n.changeLanguage(locale);
  }, [locale]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    setSideDrawer(null);
  }, [section, view, activeProjectId]);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const ViewComponent = {
    gantt: GanttChart,
    grid: GridView,
    kanban: KanbanView,
    calendar: CalendarView,
    timeline: TimelineView,
    backlog: BacklogView,
    roadmap: RoadmapView,
    whiteboard: WhiteboardView,
    docs: DocsView,
  }[view];

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const closeDrawer = () => setSideDrawer(null);

  return (
    <div className="app-shell flex h-[100dvh] flex-col">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--card)] px-3 py-2 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-sm font-bold text-white">
            N
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-none">{t("app.name")}</p>
            <p className="hidden truncate text-[10px] text-[var(--muted)] sm:block">
              {t("app.tagline")}
            </p>
          </div>
        </div>

        {section === "project" && (
          <>
            <div className="flex shrink-0 items-center gap-2">
              <select
                className="max-w-[min(100%,12rem)] rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm sm:max-w-none"
                value={activeProjectId ?? ""}
                onChange={(e) => void selectProject(e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {socketConnected && (
                <span
                  className="hidden items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 sm:inline-flex"
                  title={t("toast.realtimeConnected")}
                >
                  <Radio size={10} className="animate-pulse" />
                  {t("ux.live")}
                </span>
              )}
            </div>

            <nav className="order-last flex w-full min-w-0 items-center gap-0.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] md:order-none md:ms-auto md:w-auto md:pb-0 [&::-webkit-scrollbar]:hidden">
              {(Object.keys(VIEW_ICONS) as ViewMode[]).map((v) => {
                const Icon = VIEW_ICONS[v];
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    title={t(`views.${v}`)}
                    className={cn(
                      "flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors sm:px-3",
                      view === v
                        ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                        : "text-[var(--muted)] hover:bg-[var(--border)]/40",
                    )}
                  >
                    <Icon size={16} />
                    <span className="hidden sm:inline">{t(`views.${v}`)}</span>
                  </button>
                );
              })}
            </nav>
          </>
        )}

        {section !== "project" && (
          <p className="min-w-0 flex-1 truncate text-sm font-medium sm:flex-none">
            {t(`nav.${section}`)}
          </p>
        )}

        <div
          className={cn(
            "flex shrink-0 items-center gap-0.5 sm:gap-1",
            section === "project" ? "ms-auto md:ms-0" : "ms-auto",
          )}
        >
          {section === "project" && projects.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSideDrawer((d) => (d === "hub" ? null : "hub"))}
                title={t("hub.openHub")}
              >
                <UsersRound size={14} />
                <span className="hidden sm:inline">{t("hub.openHub")}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="xl:hidden"
                onClick={() => setSideDrawer((d) => (d === "resources" ? null : "resources"))}
                title={t("resources.title")}
              >
                <Users size={14} />
                <span className="hidden sm:inline">{t("resources.title")}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() => setSideDrawer((d) => (d === "evm" ? null : "evm"))}
                title={t("evm.title")}
              >
                <BarChart3 size={14} />
                <span className="hidden sm:inline">{t("evm.title")}</span>
              </Button>
            </>
          )}
          {section === "project" && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 sm:hidden"
                onClick={() => void recalculate()}
                disabled={loading}
                title={t("actions.recalculate")}
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex"
                onClick={() => void recalculate()}
                disabled={loading}
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                <span className="hidden md:inline">{t("actions.recalculate")}</span>
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => setCommandOpen(true)}>
            <Search size={14} />
            <span className="hidden sm:inline">Ctrl+K</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={toggleTheme}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="hidden px-2 sm:inline-flex"
            onClick={() => setLocale(locale === "he" ? "en" : "he")}
          >
            {t("actions.toggleLocale")}
          </Button>
          {user && (
            <span className="hidden max-w-[100px] truncate text-xs text-[var(--muted)] lg:inline">
              {user.name}
            </span>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout} title={t("auth.logout")}>
            <LogOut size={16} />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="app-main flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2 sm:p-4">
          {section === "project" && (
            <>
              {activeProject && (
                <div className="mb-2 hidden flex-wrap items-center gap-2 text-sm text-[var(--muted)] sm:flex">
                  <span className="truncate">{activeProject.name}</span>
                  <span>·</span>
                  <span>{activeProject.currency}</span>
                  <span>·</span>
                  <span>{activeProject.startDate}</span>
                </div>
              )}
              {projects.length === 0 ? (
                <EmptyState
                  icon={FolderPlus}
                  title={t("ux.emptyProjectsTitle")}
                  description={t("config.noProjectsHint")}
                  actionLabel={t("config.createProject")}
                  onAction={() => setProjectSettingsOpen(true)}
                  className="flex-1"
                />
              ) : (
                <>
                  <ProjectToolbar />
                  <SavedViewsBar />
                  <div className="min-h-0 flex-1">
                    <ViewComponent />
                  </div>
                </>
              )}
            </>
          )}
          {section === "team" && <TeamView />}
          {section === "dashboard" && (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
              <DashboardView />
            </div>
          )}
          {section === "portfolio" && (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
              <PortfolioView />
            </div>
          )}
          {section === "pmo" && <PmoView />}
          {section === "controls" && (
            <div className="min-h-0 flex-1 overflow-hidden">
              <ProjectControlsView />
            </div>
          )}
          {section === "rejections" && (
            <div className="min-h-0 flex-1 overflow-hidden">
              <RejectionsView />
            </div>
          )}
          {section === "work" && <WorkView />}
          {section === "vendorQuotes" && <VendorQuotesView />}
          {section === "budget" && <BudgetView />}
          {section === "reports" && <ReportsView />}
          {section === "timesheets" && <TimesheetsView />}
          {section === "settings" && <SettingsView />}
        </main>
        {section === "project" && projects.length > 0 && (
          <>
            <ResourcesPanel />
            <EVMPanel />
            {sideDrawer === "resources" && (
              <ResourcesPanel overlay onClose={closeDrawer} />
            )}
            {sideDrawer === "evm" && <EVMPanel overlay onClose={closeDrawer} />}
            {sideDrawer === "hub" && <ProjectHubPanel onClose={closeDrawer} />}
          </>
        )}
      </div>

      <MobileBottomNav />
      <CommandPalette />
      <ProjectConfigPanel open={projectSettingsOpen} onClose={() => setProjectSettingsOpen(false)} />
      {section === "project" && <AiCopilot hasBottomNav={isMobile} />}
    </div>
  );
}
