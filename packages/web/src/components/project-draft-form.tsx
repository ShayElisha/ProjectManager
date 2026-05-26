import { useTranslation } from "react-i18next";
import type { DependencyType, Project } from "@nexus/shared";
import { cn } from "@/lib/utils";

const LINK_TYPES: DependencyType[] = ["FS", "SS", "FF", "SF"];
const DAY_LABELS_HE = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const DAY_LABELS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function defaultProjectDraft(locale: string): Partial<Project> {
  return {
    name: "",
    description: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: undefined,
    status: "planning",
    currency: locale === "en" ? "USD" : "ILS",
    hoursPerDay: 8,
    workDays: [0, 1, 2, 3, 4],
    defaultLinkType: "FS",
    budgetCap: undefined,
  };
}

interface Props {
  draft: Partial<Project>;
  onChange: (patch: Partial<Project>) => void;
  locale: string;
  section: "project" | "schedule";
}

export function ProjectDraftForm({ draft, onChange, locale, section }: Props) {
  const { t } = useTranslation();
  const workDays = draft.workDays ?? [0, 1, 2, 3, 4];
  const dayLabels = locale === "he" ? DAY_LABELS_HE : DAY_LABELS_EN;

  const toggleWorkDay = (d: number) => {
    const next = workDays.includes(d) ? workDays.filter((x) => x !== d) : [...workDays, d].sort();
    onChange({ workDays: next });
  };

  if (section === "project") {
    return (
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">{t("config.projectName")}</span>
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            value={draft.name ?? ""}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">{t("config.description")}</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            rows={2}
            value={draft.description ?? ""}
            onChange={(e) => onChange({ description: e.target.value || undefined })}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{t("config.startDate")}</span>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2"
              value={draft.startDate ?? ""}
              onChange={(e) => onChange({ startDate: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{t("config.endDate")}</span>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2"
              value={draft.endDate ?? ""}
              onChange={(e) => onChange({ endDate: e.target.value || undefined })}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{t("config.status")}</span>
            <select
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2"
              value={draft.status ?? "planning"}
              onChange={(e) => onChange({ status: e.target.value as Project["status"] })}
            >
              <option value="planning">{t("config.statusPlanning")}</option>
              <option value="active">{t("config.statusActive")}</option>
              <option value="on_hold">{t("config.statusOnHold")}</option>
              <option value="completed">{t("config.statusCompleted")}</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{t("config.currency")}</span>
            <select
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2"
              value={draft.currency ?? "ILS"}
              onChange={(e) => onChange({ currency: e.target.value as Project["currency"] })}
            >
              <option value="ILS">ILS</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">{t("config.budgetCap")}</span>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            placeholder="—"
            value={draft.budgetCap ?? ""}
            onChange={(e) =>
              onChange({
                budgetCap: e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
          />
          <p className="mt-1 text-xs text-[var(--muted)]">{t("config.budgetCapHint")}</p>
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="text-[var(--muted)]">{t("config.hoursPerDay")}</span>
        <input
          type="number"
          min={1}
          max={24}
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
          value={draft.hoursPerDay ?? 8}
          onChange={(e) => onChange({ hoursPerDay: Number(e.target.value) })}
        />
      </label>
      <div>
        <p className="mb-2 text-sm text-[var(--muted)]">{t("config.workDays")}</p>
        <div className="flex flex-wrap gap-2">
          {dayLabels.map((label, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggleWorkDay(i)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm",
                workDays.includes(i)
                  ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--muted)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">{t("config.defaultLink")}</span>
        <select
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2"
          value={draft.defaultLinkType ?? "FS"}
          onChange={(e) => onChange({ defaultLinkType: e.target.value as DependencyType })}
        >
          {LINK_TYPES.map((lt) => (
            <option key={lt} value={lt}>
              {t(`dependencies.${lt}`)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
