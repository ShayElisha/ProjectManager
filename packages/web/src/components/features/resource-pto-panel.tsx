import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ResourcePto } from "@nexus/shared";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";

export function ResourcePtoPanel() {
  const { t } = useTranslation();
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const projectResources = useAppStore((s) => s.projectResources);
  const [pto, setPto] = useState<ResourcePto[]>([]);
  const [resourceId, setResourceId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [skillQuery, setSkillQuery] = useState("");
  const [matched, setMatched] = useState<{ id: string; name: string; skills?: string[] }[]>([]);

  const load = useCallback(async () => {
    if (!activeProjectId) return;
    setPto(await api.resourcePto(activeProjectId));
  }, [activeProjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addPto = async () => {
    if (!activeProjectId || !resourceId || !startDate || !endDate) return;
    await api.createResourcePto(activeProjectId, { resourceId, startDate, endDate });
    setStartDate("");
    setEndDate("");
    await load();
  };

  const matchSkills = async () => {
    if (!activeProjectId || !skillQuery.trim()) return;
    setMatched(await api.matchSkills(activeProjectId, skillQuery));
  };

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
      <h3 className="text-sm font-semibold">{t("pto.title")}</h3>
      <div className="flex flex-wrap gap-2">
        <select
          className="rounded border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
          value={resourceId}
          onChange={(e) => setResourceId(e.target.value)}
        >
          <option value="">{t("pto.pickResource")}</option>
          {projectResources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <input type="date" className="rounded border border-[var(--border)] px-2 py-1 text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" className="rounded border border-[var(--border)] px-2 py-1 text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <Button type="button" size="sm" onClick={() => void addPto()}>
          {t("pto.add")}
        </Button>
      </div>
      <ul className="text-sm space-y-1">
        {pto.slice(0, 8).map((p) => (
          <li key={p.id} className="text-[var(--muted)]">
            {projectResources.find((r) => r.id === p.resourceId)?.name ?? p.resourceId}: {p.startDate} → {p.endDate}
          </li>
        ))}
      </ul>
      <div className="border-t border-[var(--border)] pt-3">
        <p className="mb-2 text-xs font-medium text-[var(--muted)]">{t("skills.matchTitle")}</p>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-[var(--border)] px-2 py-1 text-sm"
            placeholder={t("skills.placeholder")}
            value={skillQuery}
            onChange={(e) => setSkillQuery(e.target.value)}
          />
          <Button type="button" size="sm" variant="outline" onClick={() => void matchSkills()}>
            {t("skills.search")}
          </Button>
        </div>
        <ul className="mt-2 text-sm">
          {matched.map((r) => (
            <li key={r.id}>
              {r.name}
              {r.skills?.length ? (
                <span className="ms-2 text-xs text-[var(--muted)]">({r.skills.join(", ")})</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
