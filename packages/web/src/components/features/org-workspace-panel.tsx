import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOrgStore } from "@/store/org-store";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";

export function OrgWorkspacePanel() {
  const { t } = useTranslation();
  const organizations = useOrgStore((s) => s.organizations);
  const activeOrganizationId = useOrgStore((s) => s.activeOrganizationId);
  const loadOrganizations = useOrgStore((s) => s.loadOrganizations);
  const setActiveOrganization = useOrgStore((s) => s.setActiveOrganization);
  const createOrganization = useOrgStore((s) => s.createOrganization);
  const loadProjects = useAppStore((s) => s.loadProjects);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  const onSwitch = (id: string) => {
    setActiveOrganization(id);
    void loadProjects();
  };

  const onCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    await createOrganization(name);
    setNewName("");
    await loadProjects();
  };

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
      <h3 className="text-sm font-medium text-[var(--muted)]">{t("features.workspaces")}</h3>
      <div className="space-y-2">
        {organizations.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onSwitch(o.id)}
            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm ${
              o.id === activeOrganizationId
                ? "border-[var(--accent)] bg-[var(--accent)]/10"
                : "border-[var(--border)]"
            }`}
          >
            <span>{o.name}</span>
            {o.id === activeOrganizationId && (
              <span className="text-xs text-[var(--accent)]">{t("features.active")}</span>
            )}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t("features.newWorkspace")}
        />
        <Button type="button" size="sm" onClick={() => void onCreate()}>
          {t("features.createWorkspace")}
        </Button>
      </div>
    </section>
  );
}
