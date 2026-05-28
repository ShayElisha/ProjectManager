import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProjectWikiPage } from "@nexus/shared";
import { useAppStore } from "@/store/app-store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function DocsView() {
  const { t } = useTranslation();
  const projectId = useAppStore((s) => s.activeProjectId);
  const [pages, setPages] = useState<ProjectWikiPage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const load = useCallback(async () => {
    if (!projectId) return;
    const list = await api.wikiPages(projectId);
    setPages(list);
    const current = activeId ? list.find((p) => p.id === activeId) : list[0];
    if (current) {
      setActiveId(current.id);
      setTitle(current.title);
      setContent(current.content);
    }
  }, [projectId, activeId]);

  useEffect(() => {
    void load();
  }, [projectId]);

  const save = async () => {
    if (!projectId) return;
    const page = await api.saveWikiPage(projectId, {
      id: activeId ?? undefined,
      title: title.trim() || t("hub.wikiDefaultTitle"),
      content,
    });
    setActiveId(page.id);
    await load();
  };

  const newPage = () => {
    setActiveId(null);
    setTitle("");
    setContent("");
  };

  if (!projectId) return null;

  return (
    <div className="flex h-full min-h-0 gap-4">
      <aside className="w-48 shrink-0 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-2">
        <Button type="button" size="sm" variant="outline" className="mb-2 w-full" onClick={newPage}>
          {t("docs.newPage")}
        </Button>
        <ul className="space-y-1 text-sm">
          {pages.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={`w-full rounded px-2 py-1 text-start hover:bg-[var(--accent)]/10 ${
                  activeId === p.id ? "bg-[var(--accent)]/15 font-medium" : ""
                }`}
                onClick={() => {
                  setActiveId(p.id);
                  setTitle(p.title);
                  setContent(p.content);
                }}
              >
                {p.title}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <input
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-semibold"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("hub.wikiTitle")}
        />
        <textarea
          className="min-h-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("hub.wikiContent")}
        />
        <Button type="button" size="sm" className="self-start" onClick={() => void save()}>
          {t("hub.wikiSave")}
        </Button>
      </div>
    </div>
  );
}
