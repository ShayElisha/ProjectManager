import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { WhiteboardItem } from "@nexus/shared";
import { useAppStore } from "@/store/app-store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

const COLORS = ["#fef08a", "#bfdbfe", "#bbf7d0", "#fecaca", "#e9d5ff"];

export function WhiteboardView() {
  const { t } = useTranslation();
  const projectId = useAppStore((s) => s.activeProjectId);
  const [items, setItems] = useState<WhiteboardItem[]>([]);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    if (!projectId) return;
    setItems(await api.whiteboard(projectId));
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addNote = async () => {
    if (!projectId || !draft.trim()) return;
    const item = await api.saveWhiteboardItem(projectId, {
      x: 40 + items.length * 24,
      y: 40 + items.length * 24,
      text: draft.trim(),
      color: COLORS[items.length % COLORS.length],
    });
    setItems((prev) => [...prev, item]);
    setDraft("");
  };

  if (!projectId) return null;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
          placeholder={t("whiteboard.notePlaceholder")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void addNote()}
        />
        <Button type="button" size="sm" onClick={() => void addNote()}>
          {t("whiteboard.addNote")}
        </Button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg)]/50">
        {items.map((item) => (
          <div
            key={item.id}
            className="absolute rounded-lg border border-[var(--border)] p-3 shadow-sm"
            style={{
              left: item.x,
              top: item.y,
              width: item.width,
              minHeight: item.height,
              background: item.color,
            }}
          >
            <p className="whitespace-pre-wrap text-sm">{item.text}</p>
            <button
              type="button"
              className="mt-2 text-xs text-red-600 hover:underline"
              onClick={() =>
                void api.deleteWhiteboardItem(projectId, item.id).then(() => load())
              }
            >
              {t("whiteboard.remove")}
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="p-8 text-center text-sm text-[var(--muted)]">{t("whiteboard.empty")}</p>
        )}
      </div>
    </div>
  );
}
