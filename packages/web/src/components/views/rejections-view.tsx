import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Ban,
  ChevronDown,
  ExternalLink,
  FileX2,
  Clock,
  Users,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import type {
  ManualRejectionCategory,
  RejectionKind,
  RejectionRecord,
  RejectionSuggestion,
} from "@nexus/shared";
import { useAppStore } from "@/store/app-store";
import { useVendorQuotesStore } from "@/store/vendor-quotes-store";
import { api } from "@/lib/api";
import { collectVendorRejections } from "@/lib/vendor-rejections";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ViewSkeleton } from "@/components/ui/view-skeleton";
import { EmptyState } from "@/components/ui/empty-state";

const KIND_ICONS: Record<RejectionKind, typeof Ban> = {
  change_request: FileX2,
  timesheet: Clock,
  vendor_quote: Users,
  approval_step: ShieldAlert,
  manual: Ban,
};

const MANUAL_CATEGORIES: ManualRejectionCategory[] = [
  "schedule_delay",
  "supply_delay",
  "approval",
  "scope",
  "other",
];

const SEVERITY_CLASS: Record<RejectionSuggestion["severity"], string> = {
  critical: "border-red-500/50 bg-red-500/5",
  warning: "border-amber-500/40 bg-amber-500/5",
  info: "border-blue-500/30 bg-blue-500/5",
};

type FilterKind = "all" | RejectionKind;

export function RejectionsView() {
  const { t } = useTranslation();
  const projects = useAppStore((s) => s.projects);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const tasks = useAppStore((s) => s.tasks);
  const selectProject = useAppStore((s) => s.selectProject);
  const setSection = useAppStore((s) => s.setSection);

  const comparisons = useVendorQuotesStore((s) => s.comparisons);
  const hydrateVendor = useVendorQuotesStore((s) => s.hydrate);
  const vendorHydrated = useVendorQuotesStore((s) => s.hydrated);

  const [projectFilter, setProjectFilter] = useState<string>("");
  const [kindFilter, setKindFilter] = useState<FilterKind>("all");
  const [apiRecords, setApiRecords] = useState<RejectionRecord[]>([]);
  const [suggestions, setSuggestions] = useState<RejectionSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const formProjectId = projectFilter || activeProjectId || "";
  const today = new Date().toISOString().slice(0, 10);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ManualRejectionCategory>("schedule_delay");
  const [rejectedAt, setRejectedAt] = useState(today);
  const [decisionNote, setDecisionNote] = useState("");
  const [impactDays, setImpactDays] = useState("");
  const [impactCost, setImpactCost] = useState("");
  const [taskId, setTaskId] = useState("");

  const leafTasks = useMemo(
    () => (formProjectId === activeProjectId ? tasks.filter((t) => !t.isSummary) : []),
    [formProjectId, activeProjectId, tasks],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listRejections(projectFilter || undefined);
      setApiRecords(list);
    } finally {
      setLoading(false);
    }
  }, [projectFilter]);

  const loadSuggestions = useCallback(async () => {
    if (!formProjectId) {
      setSuggestions([]);
      return;
    }
    try {
      const list = await api.rejectionSuggestions(formProjectId);
      setSuggestions(list);
    } catch {
      setSuggestions([]);
    }
  }, [formProjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);

  useEffect(() => {
    if (!vendorHydrated) hydrateVendor();
  }, [vendorHydrated, hydrateVendor]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("schedule_delay");
    setRejectedAt(today);
    setDecisionNote("");
    setImpactDays("");
    setImpactCost("");
    setTaskId("");
  };

  const applySuggestion = (s: RejectionSuggestion) => {
    setTitle(s.title);
    setDescription(s.description);
    setCategory(s.suggestedCategory);
    setRejectedAt(s.suggestedRejectedAt ?? today);
    setImpactDays(s.impactScheduleDays != null ? String(s.impactScheduleDays) : "");
    setImpactCost(s.impactCost != null ? String(s.impactCost) : "");
    setTaskId(s.taskId ?? "");
    setFormOpen(true);
  };

  const submitManual = async (overrides?: Partial<{
    title: string;
    description: string;
    category: ManualRejectionCategory;
    rejectedAt: string;
    impactScheduleDays?: number;
    impactCost?: number;
    taskId?: string;
  }>) => {
    if (!formProjectId) return;
    const finalTitle = (overrides?.title ?? title).trim();
    if (!finalTitle) return;
    setSaving(true);
    try {
      await api.createRejection({
        projectId: formProjectId,
        title: finalTitle,
        description: (overrides?.description ?? description).trim() || undefined,
        category: overrides?.category ?? category,
        rejectedAt: overrides?.rejectedAt ?? rejectedAt,
        decisionNote: decisionNote.trim() || undefined,
        impactScheduleDays:
          overrides?.impactScheduleDays ??
          (impactDays ? Number(impactDays) : undefined),
        impactCost:
          overrides?.impactCost ?? (impactCost ? Number(impactCost) : undefined),
        taskId: overrides?.taskId ?? (taskId || undefined),
      });
      resetForm();
      await load();
      await loadSuggestions();
    } finally {
      setSaving(false);
    }
  };

  const addFromSuggestion = async (s: RejectionSuggestion) => {
    if (!formProjectId) return;
    setSaving(true);
    try {
      await api.createRejection({
        projectId: formProjectId,
        title: s.title,
        description: s.description,
        category: s.suggestedCategory,
        rejectedAt: s.suggestedRejectedAt ?? today,
        impactScheduleDays: s.impactScheduleDays,
        impactCost: s.impactCost,
        taskId: s.taskId,
      });
      await load();
      await loadSuggestions();
    } finally {
      setSaving(false);
    }
  };

  const removeManual = async (r: RejectionRecord) => {
    if (r.kind !== "manual") return;
    setSaving(true);
    try {
      await api.deleteRejection(r.id);
      await load();
      await loadSuggestions();
    } finally {
      setSaving(false);
    }
  };

  const allRecords = useMemo(() => {
    const vendor = collectVendorRejections(comparisons);
    const merged = [...apiRecords, ...vendor];
    const filtered =
      kindFilter === "all" ? merged : merged.filter((r) => r.kind === kindFilter);
    return filtered.sort((a, b) => b.rejectedAt.localeCompare(a.rejectedAt));
  }, [apiRecords, comparisons, kindFilter]);

  const counts = useMemo(() => {
    const merged = [...apiRecords, ...collectVendorRejections(comparisons)];
    const m: Record<string, number> = { all: merged.length };
    for (const r of merged) {
      m[r.kind] = (m[r.kind] ?? 0) + 1;
    }
    return m;
  }, [apiRecords, comparisons]);

  const openRelated = (r: RejectionRecord) => {
    if (r.kind === "vendor_quote" || r.kind === "approval_step") {
      setSection("vendorQuotes");
      return;
    }
    if (r.projectId) {
      void selectProject(r.projectId, { keepSection: false });
      setSection(r.kind === "timesheet" ? "timesheets" : "controls");
    }
  };

  const kindFilters = [
    "all",
    "manual",
    "change_request",
    "timesheet",
    "vendor_quote",
    "approval_step",
  ] as const;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pb-4">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Ban size={22} className="text-red-500" />
          <h2 className="text-xl font-semibold">{t("rejections.title")}</h2>
        </div>
        <p className="w-full text-sm text-[var(--muted)] sm:w-auto">{t("rejections.subtitle")}</p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        <select
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          aria-label={t("rejections.filterProject")}
        >
          <option value="">{t("rejections.allProjects")}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1">
          {kindFilters.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKindFilter(k)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium",
                kindFilter === k ? "bg-[var(--accent)] text-white" : "bg-[var(--border)]/40",
              )}
            >
              {t(`rejections.kind.${k}`)}
              {counts[k] != null ? ` (${counts[k]})` : ""}
            </button>
          ))}
        </div>
      </div>

      {!formProjectId ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] px-4 py-3 text-sm text-[var(--muted)]">
          {t("rejections.selectProjectForForm")}
        </p>
      ) : (
        <>
          {suggestions.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
              <p className="mb-2 text-sm font-medium">{t("rejections.suggestedTitle")}</p>
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <div
                    key={s.key}
                    className={cn(
                      "flex flex-wrap items-start justify-between gap-2 rounded-lg border p-2 text-sm",
                      SEVERITY_CLASS[s.severity],
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{s.title}</p>
                      <p className="text-xs text-[var(--muted)]">{s.reason}</p>
                      <p className="mt-1 text-xs">{s.description}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={saving}
                        onClick={() => applySuggestion(s)}
                      >
                        {t("rejections.openInForm")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        onClick={() => void addFromSuggestion(s)}
                      >
                        {t("rejections.addSuggested")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--card)]">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 p-4 text-start"
              aria-expanded={formOpen}
              onClick={() => setFormOpen((o) => !o)}
            >
              <span className="text-sm font-medium">{t("rejections.manualTitle")}</span>
              <ChevronDown
                size={18}
                className={cn(
                  "shrink-0 text-[var(--muted)] transition-transform",
                  formOpen && "rotate-180",
                )}
              />
            </button>
            {formOpen && (
              <form
                className="space-y-3 border-t border-[var(--border)] px-4 pb-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitManual();
                }}
              >
                <label className="block text-xs text-[var(--muted)]">
                  {t("rejections.fieldTitle")}
                  <input
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </label>
                <label className="block text-xs text-[var(--muted)]">
                  {t("rejections.fieldDescription")}
                  <textarea
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-[var(--muted)]">
                    {t("rejections.fieldCategory")}
                    <select
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                      value={category}
                      onChange={(e) =>
                        setCategory(e.target.value as ManualRejectionCategory)
                      }
                    >
                      {MANUAL_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {t(`rejections.category.${c}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs text-[var(--muted)]">
                    {t("rejections.fieldRejectedAt")}
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                      value={rejectedAt}
                      onChange={(e) => setRejectedAt(e.target.value)}
                      required
                    />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-[var(--muted)]">
                    {t("rejections.fieldImpactDays")}
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                      value={impactDays}
                      onChange={(e) => setImpactDays(e.target.value)}
                    />
                  </label>
                  <label className="block text-xs text-[var(--muted)]">
                    {t("rejections.fieldImpactCost")}
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                      value={impactCost}
                      onChange={(e) => setImpactCost(e.target.value)}
                    />
                  </label>
                </div>
                <label className="block text-xs text-[var(--muted)]">
                  {t("rejections.fieldDecisionNote")}
                  <input
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                  />
                </label>
                {leafTasks.length > 0 && (
                  <label className="block text-xs text-[var(--muted)]">
                    {t("rejections.fieldTask")}
                    <select
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                      value={taskId}
                      onChange={(e) => setTaskId(e.target.value)}
                    >
                      <option value="">{t("rejections.noTask")}</option>
                      {leafTasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.wbs} · {task.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <Button type="submit" size="sm" disabled={saving || !title.trim()}>
                  {t("rejections.saveManual")}
                </Button>
              </form>
            )}
          </div>
        </>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
        {loading ? (
          <div className="p-4">
            <ViewSkeleton variant="table" />
          </div>
        ) : allRecords.length === 0 ? (
          <EmptyState
            icon={FileX2}
            title={t("rejections.empty")}
            className="m-4 border-none bg-transparent"
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                <th className="px-3 py-2 text-start">{t("rejections.colType")}</th>
                <th className="px-3 py-2 text-start">{t("rejections.colTitle")}</th>
                <th className="px-3 py-2 text-start">{t("rejections.colProject")}</th>
                <th className="px-3 py-2">{t("rejections.colDate")}</th>
                <th className="px-3 py-2 text-start">{t("rejections.colNote")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {allRecords.map((r) => {
                const Icon = KIND_ICONS[r.kind];
                return (
                  <tr key={r.id} className="border-t border-[var(--border)]/50">
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-700 dark:text-red-400">
                        <Icon size={12} />
                        {t(`rejections.kind.${r.kind}`)}
                      </span>
                      {r.manualCategory && (
                        <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                          {t(`rejections.category.${r.manualCategory}`)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium">{r.title}</p>
                      {r.detail && <p className="text-xs text-[var(--muted)]">{r.detail}</p>}
                      {(r.kind === "change_request" || r.kind === "manual") &&
                        (r.impactScheduleDays != null || r.impactCost != null) && (
                          <p className="text-xs text-[var(--muted)]">
                            {t("rejections.impact", {
                              days: r.impactScheduleDays ?? 0,
                              cost: r.impactCost ?? 0,
                            })}
                          </p>
                        )}
                      {r.kind === "timesheet" && r.hours != null && (
                        <p className="text-xs text-[var(--muted)]">
                          {t("rejections.hours", { hours: r.hours, date: r.date ?? "" })}
                        </p>
                      )}
                      {(r.kind === "vendor_quote" || r.kind === "approval_step") &&
                        r.comparisonName && (
                          <p className="text-xs text-[var(--muted)]">{r.comparisonName}</p>
                        )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.projectName ?? r.comparisonName ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-center text-xs whitespace-nowrap">
                      {r.rejectedAt.slice(0, 10)}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-xs text-[var(--muted)]">
                      {r.decisionNote ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-end">
                      <div className="flex justify-end gap-1">
                        {r.kind === "manual" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 text-red-600"
                            disabled={saving}
                            onClick={() => void removeManual(r)}
                            aria-label={t("rejections.deleteManual")}
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1"
                          onClick={() => openRelated(r)}
                        >
                          <ExternalLink size={14} />
                          {t("rejections.open")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!projectFilter && activeProjectId && (
        <p className="text-xs text-[var(--muted)]">{t("rejections.vendorLocalHint")}</p>
      )}
    </div>
  );
}
