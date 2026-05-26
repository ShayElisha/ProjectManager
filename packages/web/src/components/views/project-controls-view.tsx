import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  RISK_TEMPLATES,
  riskPriority,
  riskScore,
  type ChangeRequest,
  type ProjectRisk,
  type RiskCategory,
  type RiskLevel,
  type RiskStatus,
  type RiskSuggestion,
} from "@nexus/shared";
import { useAppStore } from "@/store/app-store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tab = "risks" | "changes";

const LEVELS: RiskLevel[] = ["low", "medium", "high"];
const CATEGORIES: RiskCategory[] = [
  "schedule",
  "budget",
  "resource",
  "technical",
  "scope",
  "external",
];
const MATRIX: Record<RiskLevel, Record<RiskLevel, string>> = {
  low: { low: "bg-emerald-500/30", medium: "bg-emerald-500/20", high: "bg-amber-500/30" },
  medium: { low: "bg-emerald-500/20", medium: "bg-amber-500/35", high: "bg-amber-500/50" },
  high: { low: "bg-amber-500/35", medium: "bg-red-500/35", high: "bg-red-500/55" },
};

const PRIORITY_CLASS = {
  low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  medium: "bg-amber-500/15 text-amber-800 dark:text-amber-400",
  high: "bg-red-500/15 text-red-700 dark:text-red-400",
};

interface RiskFormState {
  title: string;
  description: string;
  category: RiskCategory;
  probability: RiskLevel;
  impact: RiskLevel;
  ownerResourceId: string;
  responsePlan: string;
}

const defaultRiskForm = (): RiskFormState => ({
  title: "",
  description: "",
  category: "schedule",
  probability: "medium",
  impact: "medium",
  ownerResourceId: "",
  responsePlan: "",
});

export function ProjectControlsView() {
  const { t } = useTranslation();
  const riskTitleId = useId();
  const projects = useAppStore((s) => s.projects);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const members = useAppStore((s) => s.members);
  const resourceNames = useAppStore((s) => s.resourceNames);
  const selectProject = useAppStore((s) => s.selectProject);

  const [tab, setTab] = useState<Tab>("risks");
  const [risks, setRisks] = useState<ProjectRisk[]>([]);
  const [suggestions, setSuggestions] = useState<RiskSuggestion[]>([]);
  const [changes, setChanges] = useState<ChangeRequest[]>([]);
  const [form, setForm] = useState<RiskFormState>(defaultRiskForm);
  const [changeTitle, setChangeTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [riskFormOpen, setRiskFormOpen] = useState(false);
  const [changeFormOpen, setChangeFormOpen] = useState(false);

  const projectId = activeProjectId ?? "";
  const liveScore = useMemo(
    () => riskScore(form.probability, form.impact),
    [form.probability, form.impact],
  );
  const livePriority = riskPriority(liveScore);

  const load = useCallback(async () => {
    if (!projectId) return;
    const [r, c, sug] = await Promise.all([
      api.listRisks(projectId),
      api.listChanges(projectId),
      api.riskSuggestions(projectId),
    ]);
    setRisks(r);
    setChanges(c);
    setSuggestions(sug);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => setForm(defaultRiskForm());

  const addRisk = async () => {
    if (!projectId) return;
    if (!form.title.trim()) {
      setError(t("controls.titleRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.createRisk(projectId, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
        probability: form.probability,
        impact: form.impact,
        source: "manual",
        ownerResourceId: form.ownerResourceId || undefined,
        responsePlan: form.responsePlan.trim() || undefined,
      });
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const addFromSuggestion = async (s: RiskSuggestion) => {
    if (!projectId) return;
    setSaving(true);
    setError(null);
    try {
      await api.createRiskFromSuggestion(projectId, s);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const applyTemplate = (templateId: string) => {
    const tpl = RISK_TEMPLATES.find((x) => x.id === templateId);
    if (!tpl) return;
    setRiskFormOpen(true);
    setForm({
      title: t(tpl.titleKey),
      description: t(tpl.descriptionKey),
      category: tpl.category,
      probability: tpl.defaultProbability,
      impact: tpl.defaultImpact,
      ownerResourceId: form.ownerResourceId,
      responsePlan: t(tpl.defaultResponseKey),
    });
    setError(null);
  };

  const patchRiskStatus = async (riskId: string, status: RiskStatus) => {
    if (!projectId) return;
    await api.updateRisk(projectId, riskId, { status });
    await load();
  };

  const addChange = async () => {
    if (!projectId) return;
    if (!changeTitle.trim()) {
      setError(t("controls.titleRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.createChange(projectId, {
        title: changeTitle.trim(),
        impactScheduleDays: 0,
        impactCost: 0,
      });
      setChangeTitle("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--muted)]">
        {t("controls.noProject")}
      </div>
    );
  }

  const riskCounts = risks.reduce(
    (m, r) => {
      const k = `${r.probability}:${r.impact}`;
      m[k] = (m[k] ?? 0) + 1;
      return m;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pb-4">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">{t("controls.title")}</h2>
        <select
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm"
          value={projectId}
          onChange={(e) => void selectProject(e.target.value, { keepSection: true })}
          aria-label={t("controls.projectSelect")}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex shrink-0 gap-2">
        {(["risks", "changes"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setError(null);
            }}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium",
              tab === id ? "bg-[var(--accent)] text-white" : "bg-[var(--border)]/40",
            )}
          >
            {t(`controls.tabs.${id}`)}
          </button>
        ))}
      </div>

      {tab === "risks" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-3 text-sm">
            <p className="font-medium text-[var(--fg)]">{t("controls.methodologyTitle")}</p>
            <ul className="mt-2 list-disc space-y-1 ps-5 text-[var(--muted)]">
              <li>{t("controls.methodology1")}</li>
              <li>{t("controls.methodology2")}</li>
              <li>{t("controls.methodology3")}</li>
            </ul>
          </div>

          {suggestions.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
              <p className="mb-2 text-sm font-medium">{t("controls.suggestedTitle")}</p>
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <div
                    key={s.key}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[var(--border)]/60 bg-[var(--card)] p-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{s.title}</p>
                      <p className="text-xs text-[var(--muted)]">{s.reason}</p>
                      <p className="mt-1 text-xs">{s.description}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={saving}
                      onClick={() => void addFromSuggestion(s)}
                    >
                      {t("controls.addSuggested")}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
            <p className="mb-2 text-xs font-medium text-[var(--muted)]">{t("controls.templatesTitle")}</p>
            <div className="flex flex-wrap gap-2">
              {RISK_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs hover:bg-[var(--border)]/30"
                  onClick={() => applyTemplate(tpl.id)}
                >
                  {t(tpl.titleKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--card)]">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 p-4 text-start"
              aria-expanded={riskFormOpen}
              onClick={() => setRiskFormOpen((o) => !o)}
            >
              <span className="text-sm font-medium">{t("controls.manualRiskTitle")}</span>
              <span className="flex items-center gap-2">
                {riskFormOpen && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      PRIORITY_CLASS[livePriority],
                    )}
                  >
                    {t("controls.scoreLabel", { score: liveScore })} ·{" "}
                    {t(`controls.priority.${livePriority}`)}
                  </span>
                )}
                <ChevronDown
                  size={18}
                  className={cn(
                    "shrink-0 text-[var(--muted)] transition-transform",
                    riskFormOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </span>
            </button>
            {riskFormOpen && (
              <div className="border-t border-[var(--border)]/60 px-4 pb-4 pt-3">
                {error && (
                  <p className="mb-2 text-sm text-red-600 dark:text-red-400" role="alert">
                    {error}
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor={riskTitleId} className="mb-1 block text-xs font-medium">
                  {t("controls.riskTitle")} *
                </label>
                <input
                  id={riskTitleId}
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium">{t("controls.description")}</label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">{t("controls.category")}</label>
                <select
                  className="w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value as RiskCategory }))
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`controls.category.${c}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">{t("controls.owner")}</label>
                <select
                  className="w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                  value={form.ownerResourceId}
                  onChange={(e) => setForm((f) => ({ ...f, ownerResourceId: e.target.value }))}
                >
                  <option value="">{t("controls.ownerUnset")}</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.resourceId}>
                      {resourceNames[m.resourceId] ?? m.resourceId}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">{t("controls.probability")}</label>
                <select
                  className="w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                  value={form.probability}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, probability: e.target.value as RiskLevel }))
                  }
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {t(`controls.level.${l}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">{t("controls.impact")}</label>
                <select
                  className="w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                  value={form.impact}
                  onChange={(e) => setForm((f) => ({ ...f, impact: e.target.value as RiskLevel }))}
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {t(`controls.level.${l}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium">{t("controls.responsePlan")}</label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                  value={form.responsePlan}
                  onChange={(e) => setForm((f) => ({ ...f, responsePlan: e.target.value }))}
                />
              </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button type="button" disabled={saving} onClick={() => void addRisk()}>
                    {saving ? t("controls.saving") : t("controls.addRisk")}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 xl:flex-row">
            <div className="shrink-0 rounded-xl border border-[var(--border)] p-3 xl:w-[200px]">
              <p className="mb-2 text-xs font-medium text-[var(--muted)]">{t("controls.matrix")}</p>
              <div className="grid grid-cols-4 gap-0.5 text-[10px]">
                <div />
                {LEVELS.map((imp) => (
                  <div key={imp} className="text-center text-[var(--muted)]">
                    {t(`controls.level.${imp}`)}
                  </div>
                ))}
                {LEVELS.map((pr) => [
                  <div key={`l-${pr}`} className="text-[var(--muted)]">
                    {t(`controls.level.${pr}`)}
                  </div>,
                  ...LEVELS.map((im) => (
                    <div
                      key={`${pr}-${im}`}
                      className={cn(
                        "flex h-8 items-center justify-center rounded",
                        MATRIX[pr][im],
                      )}
                      title={t("controls.matrixCell", { count: riskCounts[`${pr}:${im}`] ?? 0 })}
                    >
                      {riskCounts[`${pr}:${im}`] ?? ""}
                    </div>
                  )),
                ])}
              </div>
            </div>

            <div className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--card)]">
                  <tr className="text-[var(--muted)]">
                    <th className="px-3 py-2 text-start">{t("controls.colTitle")}</th>
                    <th className="px-3 py-2">{t("controls.colCategory")}</th>
                    <th className="px-3 py-2">{t("controls.colScore")}</th>
                    <th className="px-3 py-2">{t("controls.colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {risks.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-[var(--muted)]">
                        {t("controls.noRisks")}
                      </td>
                    </tr>
                  ) : (
                    risks.map((r) => (
                      <tr key={r.id} className="border-t border-[var(--border)]/40">
                        <td className="px-3 py-2">
                          <p className="font-medium">{r.title}</p>
                          {r.description && (
                            <p className="text-xs text-[var(--muted)]">{r.description}</p>
                          )}
                          {r.source !== "manual" && (
                            <span className="text-[10px] text-[var(--muted)]">
                              {t(`controls.source.${r.source}`)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">{t(`controls.category.${r.category}`)}</td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-xs font-medium",
                              PRIORITY_CLASS[riskPriority(r.riskScore)],
                            )}
                          >
                            {r.riskScore}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            className="rounded border border-[var(--border)] px-1 py-0.5 text-xs"
                            value={r.status}
                            onChange={(e) =>
                              void patchRiskStatus(r.id, e.target.value as RiskStatus)
                            }
                          >
                            {(["open", "mitigated", "closed"] as const).map((st) => (
                              <option key={st} value={st}>
                                {t(`controls.riskStatus.${st}`)}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "changes" && (
        <div className="flex flex-col gap-4">
          <div className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--card)]">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 p-3 text-start"
              aria-expanded={changeFormOpen}
              onClick={() => setChangeFormOpen((o) => !o)}
            >
              <span className="text-sm font-medium">{t("controls.addChange")}</span>
              <ChevronDown
                size={18}
                className={cn(
                  "shrink-0 text-[var(--muted)] transition-transform",
                  changeFormOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>
            {changeFormOpen && (
              <div className="border-t border-[var(--border)]/60 px-3 pb-3 pt-2">
                {error && (
                  <p className="mb-2 text-sm text-red-600 dark:text-red-400" role="alert">
                    {error}
                  </p>
                )}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <label className="mb-1 block text-xs font-medium">{t("controls.changeTitle")}</label>
                    <input
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                      value={changeTitle}
                      onChange={(e) => setChangeTitle(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9"
                    disabled={saving}
                    onClick={() => void addChange()}
                  >
                    {saving ? t("controls.saving") : t("controls.addChange")}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--card)]">
                <tr className="text-[var(--muted)]">
                  <th className="px-3 py-2 text-start">{t("controls.colTitle")}</th>
                  <th className="px-3 py-2">{t("controls.colImpact")}</th>
                  <th className="px-3 py-2">{t("controls.colStatus")}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => (
                  <tr key={c.id} className="border-t border-[var(--border)]/40">
                    <td className="px-3 py-2">{c.title}</td>
                    <td className="px-3 py-2 text-center text-xs">
                      {c.impactScheduleDays}d / {c.impactCost}
                    </td>
                    <td className="px-3 py-2 text-center">{t(`controls.changeStatus.${c.status}`)}</td>
                    <td className="px-3 py-2 text-end">
                      {c.status === "draft" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void api.submitChange(projectId, c.id).then(load)}
                        >
                          {t("controls.submit")}
                        </Button>
                      )}
                      {c.status === "submitted" && (
                        <span className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void api.approveChange(projectId, c.id).then(load)}
                          >
                            {t("controls.approve")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => void api.rejectChange(projectId, c.id).then(load)}
                          >
                            {t("controls.reject")}
                          </Button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
