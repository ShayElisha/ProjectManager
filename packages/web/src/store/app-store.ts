import { create } from "zustand";
import type {
  Locale,
  ViewMode,
  Project,
  Task,
  TaskDependency,
  DependencyType,
  EVMMetrics,
  BudgetOverviewReport,
  ExecutivePortfolioSummary,
  Baseline,
  LevelingSuggestion,
  AllocationSlot,
  Notification,
  ProjectMember,
  ResourceAssignment,
  Resource,
} from "@nexus/shared";
import { daysBetween } from "@/lib/dependency-anchors";
import { api } from "@/lib/api";
import { useOrgStore } from "@/store/org-store";
import { useAuthStore } from "@/store/auth-store";
import { tasksAlreadyLinked } from "@/lib/link-rules";
import { toast } from "@/lib/toast";
import { emptyExecutivePortfolio } from "@/lib/empty-portfolio";

export type AppSection =
  | "dashboard"
  | "project"
  | "team"
  | "budget"
  | "portfolio"
  | "pmo"
  | "controls"
  | "rejections"
  | "work"
  | "vendorQuotes"
  | "timesheets"
  | "reports"
  | "settings";

export interface CreateTaskInput {
  name: string;
  startDate: string;
  endDate: string;
  durationDays?: number;
  isPriority?: boolean;
  recurrenceRule?: import("@nexus/shared").RecurrenceRule;
  subtasks?: Array<{
    name: string;
    startDate: string;
    endDate: string;
    durationDays?: number;
    assigneeId?: string;
    kind?: "T" | "M";
  }>;
}

interface AppState {
  locale: Locale;
  theme: "light" | "dark";
  section: AppSection;
  view: ViewMode;
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;
  tasks: Task[];
  dependencies: TaskDependency[];
  members: ProjectMember[];
  projectResources: Resource[];
  assignments: ResourceAssignment[];
  evm: EVMMetrics | null;
  budgetOverview: BudgetOverviewReport | null;
  portfolio: ExecutivePortfolioSummary | null;
  portfolioLoading: boolean;
  baselines: Baseline[];
  histogram: AllocationSlot[];
  leveling: LevelingSuggestion[];
  resourceNames: Record<string, string>;
  notifications: Notification[];
  loading: boolean;
  projectSettingsOpen: boolean;
  linkMode: boolean;
  linkSourceId: string | null;
  selectedTaskId: string | null;
  defaultLinkType: DependencyType;
  linkLagDays: number;
  createTaskDialogOpen: boolean;

  setLocale: (locale: Locale) => void;
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
  setSection: (section: AppSection) => void;
  setView: (view: ViewMode) => void;
  setProjectSettingsOpen: (open: boolean) => void;
  setCreateTaskDialogOpen: (open: boolean) => void;
  setLinkMode: (on: boolean) => void;
  setLinkSourceId: (id: string | null) => void;
  setSelectedTaskId: (id: string | null) => void;
  setDefaultLinkType: (type: DependencyType) => void;
  setLinkLagDays: (days: number) => void;
  loadProjects: () => Promise<void>;
  loadPortfolio: () => Promise<void>;
  selectProject: (id: string, options?: { keepSection?: boolean }) => Promise<void>;
  createProject: (input: Partial<Project> & { name: string }) => Promise<void>;
  updateProjectSettings: (patch: Partial<Project>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  recalculate: () => Promise<void>;
  updateTask: (taskId: string, patch: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  pauseTask: (
    taskId: string,
    body: { resumeDate: string; remainingWorkDays?: number; transferToTaskId?: string },
  ) => Promise<void>;
  resumeTask: (taskId: string) => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<void>;
  toggleSubtaskComplete: (parentId: string, taskId: string) => Promise<void>;
  updateSubtaskProgress: (taskId: string, percentComplete: number) => Promise<void>;
  refreshTasks: () => Promise<void>;
  refreshEvm: () => Promise<void>;
  /** טוען תמונת תקציב מעודכנת (תקציב + EVM בפאנל). persist=true שומר עלויות עבודה במשימות. */
  refreshBudgetSnapshot: (options?: { persist?: boolean }) => Promise<void>;
  saveBaseline: (name: string) => Promise<void>;
  loadResources: () => Promise<void>;
  loadTeam: () => Promise<void>;
  addTeamMember: (dto: {
    name: string;
    email?: string;
    role: ProjectMember["role"];
    hoursPerDay?: number;
    costPerHour?: number;
    costPerUnit?: number;
  }) => Promise<void>;
  updateTeamMember: (
    memberId: string,
    dto: {
      role?: ProjectMember["role"];
      hoursPerDay?: number;
      costPerHour?: number | null;
      costPerUnit?: number | null;
    },
  ) => Promise<void>;
  addDependency: (
    predecessorId: string,
    successorId: string,
    type?: DependencyType,
    lagDays?: number,
  ) => Promise<void>;
  removeDependency: (depId: string) => Promise<void>;
  handleLinkClick: (taskId: string) => Promise<void>;
  applyLeveling: (suggestion: LevelingSuggestion) => Promise<void>;
  autoLevelAll: () => Promise<void>;
  importProject: (file: File) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  locale: "he",
  theme: (localStorage.getItem("nexus-theme") as "light" | "dark") ?? "light",
  section: "dashboard",
  view: "gantt",
  projects: [],
  activeProjectId: null,
  activeProject: null,
  tasks: [],
  dependencies: [],
  members: [],
  projectResources: [],
  assignments: [],
  evm: null,
  budgetOverview: null,
  portfolio: null,
  portfolioLoading: false,
  baselines: [],
  histogram: [],
  leveling: [],
  resourceNames: {},
  notifications: [],
  loading: false,
  projectSettingsOpen: false,
  linkMode: false,
  linkSourceId: null,
  selectedTaskId: null,
  defaultLinkType: "FS",
  linkLagDays: 0,
  createTaskDialogOpen: false,

  setLocale: (locale) => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "he" ? "rtl" : "ltr";
    set({ locale });
  },

  setTheme: (theme) => {
    localStorage.setItem("nexus-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    set({ theme });
  },

  toggleTheme: () => get().setTheme(get().theme === "light" ? "dark" : "light"),
  setSection: (section) => {
    set({ section });
    if (section === "budget") void get().refreshBudgetSnapshot();
  },
  setView: (view) => set({ view }),
  setProjectSettingsOpen: (open) => set({ projectSettingsOpen: open }),
  setCreateTaskDialogOpen: (open) => set({ createTaskDialogOpen: open }),
  setLinkMode: (on) => set({ linkMode: on, linkSourceId: null }),
  setLinkSourceId: (id) => set({ linkSourceId: id }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  setDefaultLinkType: (type) => set({ defaultLinkType: type }),
  setLinkLagDays: (days) => set({ linkLagDays: days }),

  loadProjects: async () => {
    set({ loading: true });
    try {
      const orgId = useOrgStore.getState().activeOrganizationId ?? undefined;
      const projects = await api.projects({
        organizationId: orgId,
        isTemplate: false,
      });
      if (projects.length === 0) {
        set({
          projects: [],
          activeProjectId: null,
          activeProject: null,
          tasks: [],
          dependencies: [],
        });
        return;
      }
      set({ projects });
      const current = get().activeProjectId;
      const stillExists = current && projects.some((p) => p.id === current);
      if (stillExists) {
        await get().selectProject(current);
      } else if (!current || !stillExists) {
        await get().selectProject(projects[0].id);
      }
    } catch (err) {
      console.error("[NexusProject] loadProjects failed:", err);
      toast.errorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      set({ loading: false });
    }
  },

  loadPortfolio: async () => {
    set({ portfolioLoading: true });
    const orgId = useOrgStore.getState().activeOrganizationId ?? "";
    const fallback = () => set({ portfolio: emptyExecutivePortfolio(orgId) });
    try {
      const portfolio = await Promise.race([
        api.portfolio(),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("PORTFOLIO_LOAD_TIMEOUT")), 45_000);
        }),
      ]);
      set({ portfolio });
    } catch (err) {
      console.error("[NexusProject] loadPortfolio failed:", err);
      fallback();
    } finally {
      set({ portfolioLoading: false });
    }
  },

  selectProject: async (id, options) => {
    const keepSection = options?.keepSection ?? false;
    const prevSection = get().section;
    set({
      loading: true,
      activeProjectId: id,
      ...(keepSection ? {} : { section: "project" as AppSection }),
    });
    try {
      const userId = useAuthStore.getState().user?.id;
      const [project, { tasks, dependencies }, baselines, notifications, team] =
        await Promise.all([
          api.project(id),
          api.tasks(id),
          api.baselines(id),
          api.notifications(id, userId),
          api.team(id),
        ]);
      const resourceNames = Object.fromEntries(team.resources.map((r) => [r.id, r.name]));
      const normalizedTasks = tasks.map((t) => ({ ...t, isPriority: t.isPriority ?? false }));
      set({
        activeProject: project,
        activeProjectId: id,
        tasks: normalizedTasks,
        dependencies,
        evm: null,
        budgetOverview: null,
        baselines,
        notifications,
        members: team.members,
        projectResources: team.resources,
        assignments: team.assignments,
        resourceNames,
        defaultLinkType: project.defaultLinkType ?? "FS",
        projects: get().projects.map((p) => (p.id === id ? project : p)),
      });
      await Promise.all([get().loadResources(), get().refreshBudgetSnapshot()]);
      if (keepSection) set({ section: prevSection });
    } finally {
      set({ loading: false });
    }
  },

  createProject: async (input) => {
    try {
      const orgId = useOrgStore.getState().activeOrganizationId ?? undefined;
      const project = await api.createProject({
        ...input,
        organizationId: input.organizationId ?? orgId,
        locale: input.locale ?? get().locale,
        startDate: input.startDate ?? new Date().toISOString().slice(0, 10),
      });
      set((s) => ({ projects: [...s.projects, project] }));
      await get().selectProject(project.id);
      toast.success("toast.projectCreated");
    } catch (err) {
      console.error("[NexusProject] createProject failed:", err);
      toast.errorMessage(err instanceof Error ? err.message : String(err));
      throw err;
    }
  },

  updateProjectSettings: async (patch) => {
    const id = get().activeProjectId;
    if (!id) return;
    const updated = await api.updateProject(id, patch);
    set((s) => ({
      activeProject: updated,
      projects: s.projects.map((p) => (p.id === id ? updated : p)),
      defaultLinkType: updated.defaultLinkType ?? s.defaultLinkType,
    }));
    await get().refreshBudgetSnapshot();
  },

  refreshBudgetSnapshot: async (options) => {
    const id = get().activeProjectId;
    if (!id) return;
    if (options?.persist) {
      await api.recalculateBudget(id, false);
      await get().refreshTasks();
    }
    const overview = await api.getBudget(id);
    set({
      budgetOverview: overview,
      evm: overview.evm,
    });
  },

  refreshEvm: async () => {
    await get().refreshBudgetSnapshot();
  },

  deleteProject: async (projectId) => {
    await api.deleteProject(projectId);
    const projects = (await api.projects()).filter((p) => p.id !== projectId);
    const wasActive = get().activeProjectId === projectId;
    set({
      projects,
      activeProjectId: wasActive ? (projects[0]?.id ?? null) : get().activeProjectId,
      projectSettingsOpen: false,
    });
    if (wasActive) {
      if (projects[0]) await get().selectProject(projects[0].id);
      else {
        set({
          activeProject: null,
          tasks: [],
          dependencies: [],
          members: [],
          assignments: [],
          evm: null,
          budgetOverview: null,
          baselines: [],
        });
      }
    }
    toast.success("toast.projectDeleted");
  },

  loadTeam: async () => {
    const id = get().activeProjectId;
    if (!id) return;
    const team = await api.team(id);
    const resourceNames = Object.fromEntries(team.resources.map((r) => [r.id, r.name]));
    set({
      activeProject: team.project,
      members: team.members,
      projectResources: team.resources,
      assignments: team.assignments,
      resourceNames,
    });
  },

  addTeamMember: async (dto) => {
    const id = get().activeProjectId;
    if (!id) return;
    await api.addTeamMember(id, dto);
    await get().loadTeam();
    await get().loadResources();
    await get().refreshBudgetSnapshot({ persist: true });
    toast.success("toast.memberAdded");
  },

  updateTeamMember: async (memberId, dto) => {
    const id = get().activeProjectId;
    if (!id) return;
    await api.updateTeamMember(id, memberId, dto);
    await get().loadTeam();
    await get().loadResources();
    await get().refreshBudgetSnapshot({ persist: true });
  },

  addDependency: async (predecessorId, successorId, type, lagDays = 0) => {
    const id = get().activeProjectId;
    if (!id) return;
    if (predecessorId === successorId) return;
    if (tasksAlreadyLinked(predecessorId, successorId, get().dependencies)) {
      throw new Error(
        get().locale === "he"
          ? "כבר קיים קשר בין שתי המשימות — מותר קשר אחד בלבד"
          : "These tasks are already linked — only one link is allowed",
      );
    }
    try {
      const dep = await api.addDependency(id, {
        predecessorId,
        successorId,
        type: type ?? get().defaultLinkType,
        lagDays,
      });
      set((s) => ({ dependencies: [...s.dependencies, dep] }));
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  },

  removeDependency: async (depId) => {
    const id = get().activeProjectId;
    if (!id) return;
    await api.removeDependency(id, depId);
    set((s) => ({ dependencies: s.dependencies.filter((d) => d.id !== depId) }));
  },

  handleLinkClick: async (taskId) => {
    if (!get().linkMode) {
      set({ selectedTaskId: taskId });
      return;
    }
    const source = get().linkSourceId;
    if (!source) {
      set({ linkSourceId: taskId });
      return;
    }
    if (source === taskId) {
      set({ linkSourceId: null });
      return;
    }
    try {
      await get().addDependency(source, taskId, get().defaultLinkType, get().linkLagDays);
      set({ linkSourceId: null, linkMode: false, linkLagDays: 0 });
      await get().recalculate();
    } catch (err) {
      toast.errorMessage(err instanceof Error ? err.message : String(err));
      set({ linkSourceId: null });
    }
  },

  loadResources: async () => {
    const id = get().activeProjectId;
    if (!id) return;
    const [{ resources }, histogram, leveling] = await Promise.all([
      api.resources(id),
      api.histogram(id, "2026-05-01", "2026-06-30"),
      api.leveling(id, "2026-05-01", "2026-06-30"),
    ]);
    const resourceNames = {
      ...get().resourceNames,
      ...Object.fromEntries(resources.map((r) => [r.id, r.name])),
    };
    set({ histogram, leveling, resourceNames });
  },

  recalculate: async () => {
    const id = get().activeProjectId;
    if (!id) return;
    const result = await api.recalculate(id);
    set({ tasks: result.tasks });
    await api.recalculateBudget(id, false);
    await Promise.all([get().loadResources(), get().refreshBudgetSnapshot()]);
    toast.success("toast.recalculated");
  },

  updateTask: async (taskId, patch) => {
    const id = get().activeProjectId;
    if (!id) return;
    await api.updateTask(id, taskId, patch);
    await get().refreshTasks();
    await get().refreshBudgetSnapshot({ persist: true });
    toast.success("toast.taskUpdated");
  },

  deleteTask: async (taskId) => {
    const id = get().activeProjectId;
    if (!id) return;
    await api.deleteTask(id, taskId);
    set((s) => ({
      selectedTaskId: s.selectedTaskId === taskId ? null : s.selectedTaskId,
    }));
    await get().selectProject(id);
    toast.success("toast.taskDeleted");
  },

  pauseTask: async (taskId, body) => {
    const id = get().activeProjectId;
    if (!id) return;
    await api.pauseTask(id, taskId, body);
    await get().refreshTasks();
    await get().refreshBudgetSnapshot({ persist: true });
  },

  resumeTask: async (taskId) => {
    const id = get().activeProjectId;
    if (!id) return;
    await api.resumeTask(id, taskId);
    await get().refreshTasks();
    await get().refreshBudgetSnapshot({ persist: true });
  },

  refreshTasks: async () => {
    const id = get().activeProjectId;
    if (!id) return;
    const { tasks, dependencies } = await api.tasks(id);
    set({
      tasks: tasks.map((t) => ({ ...t, isPriority: t.isPriority ?? false })),
      dependencies,
    });
  },

  createTask: async (input) => {
    const id = get().activeProjectId;
    if (!id) return;
    const payload = {
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      durationDays:
        input.durationDays ?? daysBetween(input.startDate, input.endDate) + 1,
      isPriority: input.isPriority ?? false,
      subtasks: input.subtasks,
      recurrenceRule: input.recurrenceRule,
    };
    if (input.recurrenceRule && !input.subtasks?.length) {
      const created = await api.createRecurringTasks(id, {
        ...payload,
        recurrenceRule: input.recurrenceRule,
      });
      set((s) => ({ tasks: [...s.tasks, ...created] }));
      toast.success("toast.taskCreated");
      return;
    }
    const result = await api.createTask(id, payload);
    if (result && typeof result === "object" && "parent" in result && "children" in result) {
      set((s) => ({
        tasks: [...s.tasks, result.parent, ...result.children],
      }));
    } else {
      set((s) => ({ tasks: [...s.tasks, result as Task] }));
    }
    toast.success("toast.taskCreated");
  },

  toggleSubtaskComplete: async (_parentId, taskId) => {
    const id = get().activeProjectId;
    if (!id) return;
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;
    const isDone = task.percentComplete >= 100 || task.status === "completed";
    await api.updateTask(id, taskId, {
      status: isDone ? "not_started" : "completed",
      percentComplete: isDone ? 0 : 100,
    });
    await get().refreshTasks();
    await get().refreshBudgetSnapshot({ persist: true });
  },

  updateSubtaskProgress: async (taskId, percentComplete) => {
    const id = get().activeProjectId;
    if (!id) return;
    const pct = Math.max(0, Math.min(100, Math.round(percentComplete)));
    await api.updateTask(id, taskId, { percentComplete: pct });
    await get().refreshTasks();
    await get().refreshBudgetSnapshot({ persist: true });
  },

  saveBaseline: async (name) => {
    const id = get().activeProjectId;
    if (!id) return;
    const baseline = await api.saveBaseline(id, name);
    set((s) => ({ baselines: [...s.baselines, baseline] }));
    toast.success("toast.baselineSaved");
  },

  autoLevelAll: async () => {
    const id = get().activeProjectId;
    if (!id) return;
    await api.autoLevel(id);
    await get().selectProject(id);
  },

  importProject: async (file) => {
    const id = get().activeProjectId;
    if (!id) return;
    const name = file.name.toLowerCase();
    let data: { tasks?: Task[]; dependencies?: TaskDependency[] };
    if (name.endsWith(".json")) {
      const { parseProjectJson } = await import("@/lib/project-excel");
      data = parseProjectJson(await file.text());
    } else {
      const { parseProjectExcel } = await import("@/lib/project-excel");
      data = await parseProjectExcel(file, id);
    }
    await api.importProject(id, data);
    await get().selectProject(id);
    toast.success("toast.importSuccess");
  },

  applyLeveling: async (suggestion) => {
    const duration =
      get().tasks.find((t) => t.id === suggestion.taskId)?.durationDays ?? 1;
    const end = addDays(suggestion.suggestedStart, duration - 1);
    await get().updateTask(suggestion.taskId, {
      startDate: suggestion.suggestedStart,
      endDate: end,
    });
    await get().loadResources();
  },

}));

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
