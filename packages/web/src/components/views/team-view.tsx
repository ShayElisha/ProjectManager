import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail, UserPlus, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { normalizeProjectRole, PROJECT_ROLE_MAX_LEN } from "@/lib/project-role";
import { costsFromMode, type MemberCostMode } from "@/lib/member-cost";
import { MemberCostFields } from "@/components/member-cost-fields";
import { TeamMemberCostEditor } from "@/components/team-member-cost-editor";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
export function TeamView() {
  const { t } = useTranslation();
  const activeProject = useAppStore((s) => s.activeProject);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const projects = useAppStore((s) => s.projects);
  const members = useAppStore((s) => s.members);
  const resourceNames = useAppStore((s) => s.resourceNames);
  const projectResources = useAppStore((s) => s.projectResources);
  const loadTeam = useAppStore((s) => s.loadTeam);
  const addTeamMember = useAppStore((s) => s.addTeamMember);
  const setProjectSettingsOpen = useAppStore((s) => s.setProjectSettingsOpen);
  const selectProject = useAppStore((s) => s.selectProject);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [costMode, setCostMode] = useState<MemberCostMode>("hourly");
  const [costAmount, setCostAmount] = useState(250);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeProjectId) void loadTeam();
  }, [activeProjectId, loadTeam]);

  const resourceById = useMemo(
    () => new Map(projectResources.map((r) => [r.id, r])),
    [projectResources],
  );

  const rows = useMemo(
    () =>
      members.map((m) => ({
        member: m,
        resource: resourceById.get(m.resourceId),
        displayName: resourceNames[m.resourceId] ?? m.resourceId,
      })),
    [members, resourceById, resourceNames],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || role.length < 1) return;
    setSaving(true);
    try {
      const costs = costsFromMode(costMode, costAmount);
      await addTeamMember({
        name: name.trim(),
        email: email.trim() || undefined,
        role: normalizeProjectRole(role),
        hoursPerDay,
        ...costs,
      });
      setName("");
      setEmail("");
      setRole("");
      setHoursPerDay(8);
      setCostMode("hourly");
      setCostAmount(250);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (!activeProjectId || projects.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)]/50 p-10 text-center">
        <Users size={40} className="text-[var(--muted)]" />
        <p className="max-w-md text-[var(--muted)]">{t("team.needProject")}</p>
        <Button onClick={() => setProjectSettingsOpen(true)}>{t("config.createProject")}</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-4 sm:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("team.title")}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {t("team.subtitle", { project: activeProject?.name ?? "" })}
          </p>
        </div>
        {projects.length > 1 && (
          <select
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
            value={activeProjectId}
            onChange={(e) => void selectProject(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3 flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <Users size={18} className="text-[var(--accent)]" />
              {t("team.listTitle")}
            </h2>
            <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">
              {rows.length}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {rows.length === 0 ? (
              <EmptyState
                icon={Users}
                title={t("ux.emptyTeamTitle")}
                description={t("ux.emptyTeamDesc")}
                className="m-4 border-none bg-transparent"
              />
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="sticky top-0 bg-[var(--card)] text-[var(--muted)]">
                  <tr className="border-b border-[var(--border)]">
                    <th className="px-5 py-3 text-start font-medium">{t("team.colName")}</th>
                    <th className="px-3 py-3 text-start font-medium">{t("team.colRole")}</th>
                    <th className="px-3 py-3 text-start font-medium">{t("team.colHours")}</th>
                    <th className="px-3 py-3 text-start font-medium">{t("team.colCost")}</th>
                    <th className="px-5 py-3 text-start font-medium">{t("team.colEmail")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ member, resource, displayName }) => (
                    <MemberRow
                      key={member.id}
                      name={displayName}
                      role={member.role}
                      hours={member.hoursPerDay}
                      member={member}
                      resource={resource}
                      email={resource?.email}
                    />
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </section>

        <section className="lg:col-span-2 rounded-2xl border border-[var(--border)] bg-gradient-to-b from-[var(--card)] to-[var(--bg)] p-5 shadow-sm">
          <h2 className="mb-1 flex items-center gap-2 font-semibold">
            <UserPlus size={18} className="text-[var(--accent)]" />
            {t("team.addTitle")}
          </h2>
          <p className="mb-5 text-xs text-[var(--muted)]">{t("team.addHint")}</p>
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            <label className="block text-sm">
              <span className="text-[var(--muted)]">{t("config.memberName")}</span>
              <input
                required
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("team.namePlaceholder")}
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">{t("team.email")}</span>
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">{t("config.roleCode")}</span>
              <input
                required
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 font-mono uppercase tracking-widest"
                value={role}
                maxLength={PROJECT_ROLE_MAX_LEN}
                onChange={(e) => setRole(normalizeProjectRole(e.target.value))}
                placeholder={t("config.roleCodePlaceholder")}
              />
              <p className="mt-1 text-[10px] text-[var(--muted)]">{t("config.roleCodeHint")}</p>
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">{t("config.hoursPerDay")}</span>
              <input
                type="number"
                min={1}
                max={24}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5"
                value={hoursPerDay}
                onChange={(e) => setHoursPerDay(Number(e.target.value))}
              />
            </label>
            <MemberCostFields
              mode={costMode}
              amount={costAmount}
              onModeChange={setCostMode}
              onAmountChange={setCostAmount}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={saving || !name.trim() || role.length < 1}
            >
              {saving ? t("auth.loading") : t("config.addMember")}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}

function MemberRow({
  name,
  role,
  hours,
  member,
  resource,
  email,
}: {
  name: string;
  role: string;
  hours?: number;
  member: import("@nexus/shared").ProjectMember;
  resource?: import("@nexus/shared").Resource;
  email?: string;
}) {
  return (
    <tr className="border-b border-[var(--border)]/60 transition-colors hover:bg-[var(--accent)]/5">
      <td className="px-5 py-3 font-medium">{name}</td>
      <td className="px-3 py-3">
        <span className="rounded-md bg-[var(--accent)]/10 px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-[var(--accent)]">
          {normalizeProjectRole(role) || role}
        </span>
      </td>
      <td className="px-3 py-3 tabular-nums text-[var(--muted)]">
        {hours != null ? `${hours}h` : "—"}
      </td>
      <td className="px-3 py-3">
        <TeamMemberCostEditor member={member} resource={resource} compact />
      </td>
      <td className="px-5 py-3">
        {email ? (
          <span className="inline-flex items-center gap-1 text-[var(--muted)]">
            <Mail size={14} />
            {email}
          </span>
        ) : (
          <span className="text-[var(--muted)]">—</span>
        )}
      </td>
    </tr>
  );
}
