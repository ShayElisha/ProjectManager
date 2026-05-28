import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SavedView, ViewMode } from "@nexus/shared";
import { Bookmark, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

const GRID_COLS_KEY = "nexus-grid-cols";

export function loadGridColumns(projectId: string): string[] | null {
  try {
    const raw = localStorage.getItem(`${GRID_COLS_KEY}:${projectId}`);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

export function saveGridColumns(projectId: string, cols: string[]) {
  localStorage.setItem(`${GRID_COLS_KEY}:${projectId}`, JSON.stringify(cols));
}

interface Props {
  gridColumns?: string[];
  onApplyColumns?: (cols: string[]) => void;
}

export function SavedViewsBar({ gridColumns, onApplyColumns }: Props) {
  const { t } = useTranslation();
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const user = useAuthStore((s) => s.user);
  const [views, setViews] = useState<SavedView[]>([]);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    if (!activeProjectId) return;
    setViews(await api.savedViews(activeProjectId, user?.id));
  }, [activeProjectId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!activeProjectId) return null;

  const saveCurrent = async () => {
    const label = name.trim() || `${t(`views.${view}`)} ${new Date().toLocaleDateString()}`;
    await api.createSavedView(activeProjectId, {
      name: label,
      viewMode: view,
      userId: user?.id,
      columns: gridColumns,
    });
    setName("");
    toast.success(t("hub.savedViewCreated"));
    await load();
  };

  const apply = (sv: SavedView) => {
    setView(sv.viewMode as ViewMode);
    if (sv.columns?.length) {
      saveGridColumns(activeProjectId, sv.columns);
      onApplyColumns?.(sv.columns);
      window.dispatchEvent(
        new CustomEvent("nexus-grid-cols-applied", {
          detail: { projectId: activeProjectId, columns: sv.columns },
        }),
      );
    }
    toast.info(t("hub.savedViewApplied", { name: sv.name }));
  };

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5">
      <Bookmark size={14} className="shrink-0 text-[var(--muted)]" />
      <select
        className="max-w-[10rem] rounded border border-[var(--border)] bg-transparent px-2 py-1 text-xs sm:max-w-xs sm:text-sm"
        defaultValue=""
        onChange={(e) => {
          const id = e.target.value;
          if (!id) return;
          const sv = views.find((v) => v.id === id);
          if (sv) apply(sv);
          e.target.value = "";
        }}
      >
        <option value="">{t("hub.savedViews")}</option>
        {views.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
      <input
        className="min-w-0 flex-1 rounded border border-[var(--border)] bg-transparent px-2 py-1 text-xs sm:text-sm"
        placeholder={t("hub.savedViewName")}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button type="button" size="sm" variant="outline" onClick={() => void saveCurrent()}>
        <Plus size={14} />
        {t("hub.saveView")}
      </Button>
    </div>
  );
}
