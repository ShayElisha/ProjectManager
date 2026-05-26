import { useTranslation } from "react-i18next";
import type { DependencyType } from "@nexus/shared";
import { Link2, Settings2 } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LINK_STYLE } from "@/lib/gantt-link-path";

const LINK_TYPES: DependencyType[] = ["FS", "SS", "FF", "SF"];

export type PriorityFilter = "all" | "priority" | "non_priority";

interface GanttToolbarProps {
  priorityFilter: PriorityFilter;
  onPriorityFilterChange: (filter: PriorityFilter) => void;
  linkCount?: number;
  showBaseline?: boolean;
  onShowBaselineChange?: (v: boolean) => void;
}

export function GanttToolbar({
  priorityFilter,
  onPriorityFilterChange,
  linkCount = 0,
  showBaseline = false,
  onShowBaselineChange,
}: GanttToolbarProps) {
  const { t } = useTranslation();
  const linkMode = useAppStore((s) => s.linkMode);
  const linkSourceId = useAppStore((s) => s.linkSourceId);
  const defaultLinkType = useAppStore((s) => s.defaultLinkType);
  const activeProject = useAppStore((s) => s.activeProject);
  const setLinkMode = useAppStore((s) => s.setLinkMode);
  const setDefaultLinkType = useAppStore((s) => s.setDefaultLinkType);
  const setProjectSettingsOpen = useAppStore((s) => s.setProjectSettingsOpen);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--bg)]/40 px-3 py-2">
      <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-0.5">
        {LINK_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            title={t(`deps.${type}`)}
            onClick={() => setDefaultLinkType(type)}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
              defaultLinkType === type
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted)] hover:bg-[var(--border)]/50",
            )}
          >
            {type}
          </button>
        ))}
      </div>

      <Button
        variant={linkMode ? "default" : "outline"}
        size="sm"
        onClick={() => setLinkMode(!linkMode)}
      >
        <Link2 size={14} />
        {linkMode ? t("gantt.linkingActive") : t("gantt.addLink")}
      </Button>

      {linkMode && (
        <span className="text-xs text-[var(--muted)]">
          {linkSourceId ? t("gantt.pickSuccessor") : t("gantt.pickPredecessor")}
          {" · "}
          {t("gantt.oneLinkHint")}
          {" · "}
          {t("gantt.clickToDelete")}
        </span>
      )}

      {linkCount > 0 && (
        <span className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <Link2 size={12} />
          {t("gantt.linkCount", { count: linkCount })}
        </span>
      )}

      <div className="hidden items-center gap-2 sm:flex">
        {LINK_TYPES.map((type) => (
          <span key={type} className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
            <span
              className="inline-block h-0.5 w-4 rounded"
              style={{ background: LINK_STYLE[type].stroke }}
            />
            {type}
          </span>
        ))}
      </div>

      {onShowBaselineChange && (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showBaseline}
            onChange={(e) => onShowBaselineChange(e.target.checked)}
            className="rounded"
          />
          <span className="text-[var(--muted)]">{t("gantt.showBaseline")}</span>
        </label>
      )}

      <label className="flex items-center gap-2 text-sm">
        <span className="text-[var(--muted)]">{t("gantt.priorityFilter")}</span>
        <select
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm"
          value={priorityFilter}
          onChange={(e) => onPriorityFilterChange(e.target.value as PriorityFilter)}
        >
          <option value="all">{t("gantt.filterAll")}</option>
          <option value="priority">{t("gantt.filterPriority")}</option>
          <option value="non_priority">{t("gantt.filterNonPriority")}</option>
        </select>
      </label>

      <div className="ms-auto flex items-center gap-2 text-xs text-[var(--muted)]">
        {activeProject?.hoursPerDay != null && (
          <span>
            {t("gantt.hoursPerDay", { hours: activeProject.hoursPerDay })}
          </span>
        )}
        <Button variant="outline" size="sm" onClick={() => setProjectSettingsOpen(true)}>
          <Settings2 size={14} />
          {t("gantt.projectSettings")}
        </Button>
      </div>
    </div>
  );
}
