import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ResourceCapacityRow } from "@nexus/shared";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ResourcesPanelProps {
  overlay?: boolean;
  onClose?: () => void;
}

export function ResourcesPanel({ overlay = false, onClose }: ResourcesPanelProps) {
  const { t } = useTranslation();
  const histogram = useAppStore((s) => s.histogram);
  const leveling = useAppStore((s) => s.leveling);
  const resourceNames = useAppStore((s) => s.resourceNames);
  const applyLeveling = useAppStore((s) => s.applyLeveling);
  const autoLevelAll = useAppStore((s) => s.autoLevelAll);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const [capacity, setCapacity] = useState<ResourceCapacityRow[]>([]);

  useEffect(() => {
    if (!activeProjectId) return;
    const from = new Date().toISOString().slice(0, 10);
    const to = new Date();
    to.setDate(to.getDate() + 28);
    void api
      .resourceCapacity(activeProjectId, from, to.toISOString().slice(0, 10))
      .then(setCapacity)
      .catch(() => setCapacity([]));
  }, [activeProjectId]);

  const overSlots = histogram.filter((s) => s.isOverAllocated);
  const byResource = new Map<string, typeof histogram>();
  for (const slot of histogram) {
    const list = byResource.get(slot.resourceId) ?? [];
    list.push(slot);
    byResource.set(slot.resourceId, list);
  }

  const content = (
    <>
      <div className="flex shrink-0 items-center justify-between">
        <h3 className="text-sm font-semibold">{t("resources.title")}</h3>
        {overlay && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-[var(--border)]/40"
            aria-label={t("actions.close")}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {capacity.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--muted)]">{t("resources.weeklyCapacity")}</p>
          {capacity.slice(0, 8).map((row) => (
            <div key={`${row.resourceId}-${row.weekStart}`} className="text-[10px]">
              <div className="flex justify-between">
                <span className="truncate">{row.resourceName}</span>
                <span className={row.utilizationPct > 100 ? "text-red-500" : ""}>
                  {row.utilizationPct}%
                </span>
              </div>
              <div className="h-1 rounded bg-[var(--border)]">
                <div
                  className={cn(
                    "h-full rounded",
                    row.utilizationPct > 100 ? "bg-red-500" : "bg-blue-500/70",
                  )}
                  style={{ width: `${Math.min(row.utilizationPct, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {[...byResource.entries()].map(([resId, slots]) => {
        const maxUtil = Math.max(...slots.map((s) => s.utilizationPct));
        const isOver = slots.some((s) => s.isOverAllocated);
        return (
          <div key={resId} className="rounded-lg border border-[var(--border)] p-2">
            <div className="flex justify-between text-xs">
              <span className="truncate font-medium">{resourceNames[resId] ?? resId}</span>
              <span className={cn(isOver && "text-red-500 font-semibold")}>{maxUtil}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className={cn("h-full", isOver ? "bg-red-500" : "bg-[var(--accent)]")}
                style={{ width: `${Math.min(maxUtil, 100)}%` }}
              />
            </div>
          </div>
        );
      })}

      {overSlots.length > 0 && (
        <p className="text-xs text-red-500">
          {overSlots.length} {t("resources.overAllocated")}
        </p>
      )}

      {leveling.length > 0 && (
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => void autoLevelAll()}
          >
            {t("actions.autoLevelAll")}
          </Button>
          <p className="text-xs font-medium text-[var(--muted)]">{t("resources.leveling")}</p>
          {leveling.map((s) => (
            <div key={`${s.taskId}-${s.suggestedStart}`} className="rounded-lg bg-[var(--bg)] p-2 text-xs">
              <p className="line-clamp-2">{s.reason}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-7 w-full text-[10px]"
                onClick={() => void applyLeveling(s)}
              >
                {t("actions.applyLeveling")}
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (overlay) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/40 xl:hidden" onClick={onClose} aria-hidden />
        <aside className="fixed inset-y-0 start-0 z-50 flex w-[min(100%,18rem)] flex-col gap-3 overflow-auto border-e border-[var(--border)] bg-[var(--card)] p-4 shadow-2xl xl:hidden">
          {content}
        </aside>
      </>
    );
  }

  return (
    <aside className="hidden w-56 shrink-0 flex-col gap-3 overflow-auto border-s border-[var(--border)] p-4 xl:flex">
      {content}
    </aside>
  );
}
