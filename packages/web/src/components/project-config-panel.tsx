import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import type { Project } from "@nexus/shared";
import { normalizeProjectRole, PROJECT_ROLE_MAX_LEN } from "@/lib/project-role";
import { useAppStore } from "@/store/app-store";
import { confirmAction } from "@/lib/confirm";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProjectDraftForm, defaultProjectDraft } from "@/components/project-draft-form";
import { MemberCostFields } from "@/components/member-cost-fields";
import { TeamMemberCostEditor } from "@/components/team-member-cost-editor";
import { costsFromMode, type MemberCostMode } from "@/lib/member-cost";
import { api } from "@/lib/api";
import { useOrgStore } from "@/store/org-store";
import { ProjectAgileSettings } from "@/components/features/project-agile-settings";

type Tab = "project" | "team" | "schedule" | "links";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ProjectConfigPanel({ open, onClose }: Props) {
  const { t } = useTranslation();
  const locale = useAppStore((s) => s.locale);
  const activeProject = useAppStore((s) => s.activeProject);
  const dependencies = useAppStore((s) => s.dependencies);
  const tasks = useAppStore((s) => s.tasks);
  const resourceNames = useAppStore((s) => s.resourceNames);
  const projectResources = useAppStore((s) => s.projectResources);
  const members = useAppStore((s) => s.members);
  const updateProjectSettings = useAppStore((s) => s.updateProjectSettings);
  const deleteProject = useAppStore((s) => s.deleteProject);
  const projects = useAppStore((s) => s.projects);
  const removeDependency = useAppStore((s) => s.removeDependency);
  const addTeamMember = useAppStore((s) => s.addTeamMember);
  const createProject = useAppStore((s) => s.createProject);
  const loadProjects = useAppStore((s) => s.loadProjects);
  const loadTeam = useAppStore((s) => s.loadTeam);
  const orgId = useOrgStore((s) => s.activeOrganizationId);
  const [templates, setTemplates] = useState<Project[]>([]);

  const project = activeProject;
  const [tab, setTab] = useState<Tab>("project");
  const [draft, setDraft] = useState<Partial<Project>>({});
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [memberHours, setMemberHours] = useState(8);
  const [memberCostMode, setMemberCostMode] = useState<MemberCostMode>("hourly");
  const [memberCostAmount, setMemberCostAmount] = useState(250);
  const [createDraft, setCreateDraft] = useState<Partial<Project>>(() => defaultProjectDraft(locale));
  const [showAnotherCreate, setShowAnotherCreate] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);

  useEffect(() => {
    if (project) setDraft(project);
  }, [project]);

  useEffect(() => {
    if (open && project) void loadTeam();
  }, [open, project, loadTeam]);

  useEffect(() => {
    if (!open || !orgId) return;
    void api.projects({ organizationId: orgId, isTemplate: true }).then(setTemplates);
  }, [open, orgId]);

  useEffect(() => {
    if (open && !project) {
      setCreateDraft(defaultProjectDraft(locale));
      setTab("project");
    }
  }, [open, project, locale]);

  if (!open) return null;

  const submitCreate = async (draftToCreate: Partial<Project>) => {
    const name = draftToCreate.name?.trim();
    if (!name) return;
    setCreateBusy(true);
    try {
      await createProject({ ...draftToCreate, name });
      if (memberName.trim() && memberRole.length >= 1) {
        await addTeamMember({
          name: memberName.trim(),
          role: normalizeProjectRole(memberRole),
          hoursPerDay: memberHours,
          ...costsFromMode(memberCostMode, memberCostAmount),
        });
        setMemberName("");
        setMemberRole("");
      }
      setCreateDraft(defaultProjectDraft(locale));
      setShowAnotherCreate(false);
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setCreateBusy(false);
    }
  };

  if (!project) {
    const createTabs: Tab[] = ["project", "schedule", "team"];
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
        <div className="fixed inset-y-0 z-50 flex w-full max-w-2xl flex-col border-[var(--border)] bg-[var(--card)] shadow-2xl end-0">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold">{t("config.createProject")}</h2>
              <p className="text-sm text-[var(--muted)]">{t("config.noProjectsHint")}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-[var(--border)]/40">
              <X size={20} />
            </button>
          </div>
          <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)] px-4">
            {createTabs.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "px-3 py-2 text-sm border-b-2 -mb-px transition-colors",
                  tab === id
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--fg)]",
                )}
              >
                {t(`config.tabs.${id}`)}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-auto p-5">
            {tab === "project" && (
              <ProjectDraftForm
                draft={createDraft}
                onChange={(patch) => setCreateDraft((d) => ({ ...d, ...patch }))}
                locale={locale}
                section="project"
              />
            )}
            {tab === "schedule" && (
              <ProjectDraftForm
                draft={createDraft}
                onChange={(patch) => setCreateDraft((d) => ({ ...d, ...patch }))}
                locale={locale}
                section="schedule"
              />
            )}
            {tab === "team" && (
              <>
                <p className="mb-3 text-sm text-[var(--muted)]">{t("config.teamOnCreateHint")}</p>
                <div className="rounded-xl border border-[var(--border)] p-4 space-y-3">
                  <input
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                    placeholder={t("config.memberName")}
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2 font-mono text-sm uppercase"
                      placeholder={t("config.roleCodePlaceholder")}
                      value={memberRole}
                      maxLength={PROJECT_ROLE_MAX_LEN}
                      onChange={(e) => setMemberRole(normalizeProjectRole(e.target.value))}
                    />
                    <input
                      type="number"
                      min={1}
                      max={24}
                      className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2 text-sm"
                      value={memberHours}
                      onChange={(e) => setMemberHours(Number(e.target.value))}
                    />
                  </div>
                  <MemberCostFields
                    compact
                    mode={memberCostMode}
                    amount={memberCostAmount}
                    onModeChange={setMemberCostMode}
                    onAmountChange={setMemberCostAmount}
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex gap-2 border-t border-[var(--border)] p-4">
            <Button
              className="flex-1"
              disabled={!createDraft.name?.trim() || createBusy}
              onClick={() => void submitCreate(createDraft)}
            >
              {t("config.createProject")}
            </Button>
            <Button variant="outline" onClick={onClose}>
              {t("settings.cancel")}
            </Button>
          </div>
        </div>
      </>
    );
  }

  const projectChanged =
    project &&
    (draft.name !== project.name ||
      draft.description !== project.description ||
      draft.status !== project.status ||
      draft.currency !== project.currency ||
      draft.startDate !== project.startDate ||
      draft.endDate !== project.endDate ||
      JSON.stringify(draft.workDays) !== JSON.stringify(project.workDays) ||
      draft.hoursPerDay !== project.hoursPerDay ||
      draft.defaultLinkType !== project.defaultLinkType ||
      draft.budgetCap !== project.budgetCap);

  const saveProject = async () => {
    if (projectChanged) {
      const ok = await confirmAction({
        title: t("confirm.saveProjectTitle"),
        message: t("confirm.saveProjectMessage", { name: draft.name ?? project!.name }),
        confirmLabel: t("confirm.confirmSave"),
      });
      if (!ok) return;
    }
    await updateProjectSettings(draft);
    onClose();
  };

  const removeProject = async () => {
    if (!project) return;
    const ok = await confirmAction({
      title: t("confirm.deleteProjectTitle"),
      message: t("confirm.deleteProjectMessage", { name: project.name }),
      confirmLabel: t("confirm.confirmDelete"),
      destructive: true,
    });
    if (!ok) return;
    await deleteProject(project.id);
    onClose();
  };

  const taskName = (id: string) => tasks.find((t) => t.id === id)?.name ?? id.slice(0, 8);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-y-0 z-50 flex w-full max-w-2xl flex-col border-[var(--border)] bg-[var(--card)] shadow-2xl start-auto end-0">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">{t("config.title")}</h2>
            <p className="text-sm text-[var(--muted)]">{project.name}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-[var(--border)]/40">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)] px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(["project", "team", "schedule", "links"] as Tab[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "px-3 py-2 text-sm border-b-2 -mb-px transition-colors",
                tab === id
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--fg)]",
              )}
            >
              {t(`config.tabs.${id}`)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4">
          {tab === "project" && (
            <>
              <ProjectDraftForm
                draft={draft}
                onChange={(patch) => setDraft({ ...draft, ...patch })}
                locale={locale}
                section="project"
              />
              <label className="block text-sm">
                <span className="text-[var(--muted)]">{t("features.parentFolder")}</span>
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2"
                  value={draft.parentId ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, parentId: e.target.value || null })
                  }
                >
                  <option value="">{t("features.folderRoot")}</option>
                  {projects
                    .filter((p) => p.id !== project.id && !p.isTemplate)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void api.saveAsTemplate(project.id).then(() => void loadProjects())
                  }
                >
                  {t("features.saveAsTemplate")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const name = window.prompt(t("features.duplicateName"), `${project.name} copy`);
                    if (!name?.trim()) return;
                    void api
                      .duplicateProject(project.id, { name: name.trim(), organizationId: orgId ?? undefined })
                      .then(() => void loadProjects());
                  }}
                >
                  {t("features.duplicateProject")}
                </Button>
              </div>
              <ProjectAgileSettings />
              {templates.length > 0 && (
                <div className="rounded-lg border border-[var(--border)] p-3 space-y-2">
                  <p className="text-xs font-medium text-[var(--muted)]">
                    {t("features.createFromTemplate")}
                  </p>
                  {templates.map((tpl) => (
                    <Button
                      key={tpl.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() =>
                        void api
                          .createFromTemplate(tpl.id, {
                            name: `${tpl.name} copy`,
                            organizationId: orgId ?? undefined,
                            parentId: draft.parentId ?? null,
                          })
                          .then(() => void loadProjects())
                      }
                    >
                      {tpl.name}
                    </Button>
                  ))}
                </div>
              )}
              <div className="mt-6 rounded-xl border border-[var(--border)] p-4">
                <button
                  type="button"
                  className="text-sm font-medium text-[var(--accent)] hover:underline"
                  onClick={() => {
                    setShowAnotherCreate((v) => !v);
                    if (!showAnotherCreate) setCreateDraft(defaultProjectDraft(locale));
                  }}
                >
                  {showAnotherCreate ? t("config.hideNewProject") : t("config.newProject")}
                </button>
                {showAnotherCreate && (
                  <div className="mt-4 space-y-4">
                    <ProjectDraftForm
                      draft={createDraft}
                      onChange={(patch) => setCreateDraft((d) => ({ ...d, ...patch }))}
                      locale={locale}
                      section="project"
                    />
                    <ProjectDraftForm
                      draft={createDraft}
                      onChange={(patch) => setCreateDraft((d) => ({ ...d, ...patch }))}
                      locale={locale}
                      section="schedule"
                    />
                    <Button
                      size="sm"
                      disabled={!createDraft.name?.trim() || createBusy}
                      onClick={() => void submitCreate(createDraft)}
                    >
                      {t("config.createProject")}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === "team" && (
            <>
              <p className="text-sm text-[var(--muted)]">{t("config.teamHint")}</p>
              <ul className="space-y-2">
                {members.map((m: import("@nexus/shared").ProjectMember) => {
                  const name = resourceNames[m.resourceId] ?? m.resourceId;
                  const resource = projectResources.find((r) => r.id === m.resourceId);
                  return (
                    <li
                      key={m.id}
                      className="rounded-lg border border-[var(--border)] px-3 py-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{name}</span>
                        <span className="flex items-center gap-2 text-[var(--muted)]">
                          <span className="rounded bg-[var(--border)]/60 px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wide">
                            {normalizeProjectRole(m.role) || m.role}
                          </span>
                          {m.hoursPerDay != null && <span>{m.hoursPerDay}h</span>}
                        </span>
                      </div>
                      <TeamMemberCostEditor member={m} resource={resource} compact />
                    </li>
                  );
                })}
              </ul>
              <div className="rounded-xl border border-[var(--border)] p-4 space-y-3">
                <p className="text-sm font-medium">{t("config.addMember")}</p>
                <input
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                  placeholder={t("config.memberName")}
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2 font-mono text-sm uppercase tracking-widest"
                      placeholder={t("config.roleCodePlaceholder")}
                      value={memberRole}
                      maxLength={PROJECT_ROLE_MAX_LEN}
                      onChange={(e) => setMemberRole(normalizeProjectRole(e.target.value))}
                      title={t("config.roleCodeHint")}
                      aria-label={t("config.roleCode")}
                    />
                    <p className="mt-1 text-[10px] text-[var(--muted)]">{t("config.roleCodeHint")}</p>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2 text-sm"
                    value={memberHours}
                    onChange={(e) => setMemberHours(Number(e.target.value))}
                    title={t("config.hoursPerDay")}
                  />
                </div>
                <MemberCostFields
                  compact
                  mode={memberCostMode}
                  amount={memberCostAmount}
                  onModeChange={setMemberCostMode}
                  onAmountChange={setMemberCostAmount}
                />
                <Button
                  size="sm"
                  disabled={!memberName.trim() || memberRole.length < 1}
                  onClick={() => {
                    void addTeamMember({
                      name: memberName.trim(),
                      role: normalizeProjectRole(memberRole),
                      hoursPerDay: memberHours,
                      ...costsFromMode(memberCostMode, memberCostAmount),
                    }).then(() => {
                      setMemberName("");
                      setMemberRole("");
                    });
                  }}
                >
                  {t("config.addMember")}
                </Button>
              </div>
            </>
          )}

          {tab === "schedule" && (
            <ProjectDraftForm
              draft={draft}
              onChange={(patch) => setDraft({ ...draft, ...patch })}
              locale={locale}
              section="schedule"
            />
          )}

          {tab === "links" && (
            <>
              <p className="text-sm text-[var(--muted)]">{t("config.linksHint")}</p>
              <ul className="max-h-64 space-y-2 overflow-auto">
                {dependencies.length === 0 && (
                  <li className="text-sm text-[var(--muted)]">{t("config.noLinks")}</li>
                )}
                {dependencies.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                  >
                    <span className="truncate">
                      {taskName(d.predecessorId)} → {taskName(d.successorId)}{" "}
                      <span className="text-[var(--muted)]">
                        ({t(`dependencies.${d.type}`)}
                        {d.lagDays ? ` +${d.lagDays}d` : ""})
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void removeDependency(d.id)}
                    >
                      ×
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--border)] p-4">
          <div className="flex gap-2">
            {(tab === "project" || tab === "schedule") && (
              <Button className="flex-1" onClick={() => void saveProject()}>
                {t("settings.save")}
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              {t("settings.cancel")}
            </Button>
          </div>
          {tab === "project" && projects.length > 0 && (
            <Button
              variant="outline"
              className="w-full border-red-500/40 text-red-600 hover:bg-red-500/10 dark:text-red-400"
              onClick={() => void removeProject()}
            >
              {t("settings.delete")} — {project.name}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
