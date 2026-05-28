import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Paperclip, Send, X } from "lucide-react";
import type { TaskAttachment, TaskComment } from "@nexus/shared";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";

interface Props {
  taskId: string;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}

export function TaskCollaborationSection({ taskId, tags, onTagsChange }: Props) {
  const { t } = useTranslation();
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const user = useAuthStore((s) => s.user);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!activeProjectId) return;
    const [c, a] = await Promise.all([
      api.taskComments(activeProjectId, taskId),
      api.taskAttachments(activeProjectId, taskId),
    ]);
    setComments(c);
    setAttachments(a);
  }, [activeProjectId, taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!activeProjectId) return null;

  const addComment = async () => {
    const body = commentText.trim();
    if (!body) return;
    setBusy(true);
    try {
      await api.addTaskComment(activeProjectId, taskId, body);
      setCommentText("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag || tags.includes(tag)) return;
    onTagsChange([...tags, tag]);
    setTagInput("");
  };

  const uploadFile = async (file: File) => {
    setBusy(true);
    try {
      await api.uploadTaskAttachment(activeProjectId, taskId, file);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 border-t border-[var(--border)] pt-4">
      <div>
        <p className="mb-2 text-xs font-medium text-[var(--muted)]">{t("features.tags")}</p>
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-xs"
            >
              {tag}
              <button
                type="button"
                aria-label={t("features.removeTag")}
                onClick={() => onTagsChange(tags.filter((x) => x !== tag))}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
            placeholder={t("features.tagPlaceholder")}
          />
          <Button type="button" size="sm" variant="outline" onClick={addTag}>
            {t("features.addTag")}
          </Button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-[var(--muted)]">{t("features.comments")}</p>
        <ul className="max-h-32 space-y-2 overflow-y-auto">
          {comments.length === 0 && (
            <li className="text-xs text-[var(--muted)]">{t("features.noComments")}</li>
          )}
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg bg-[var(--border)]/30 px-2 py-1.5 text-sm">
              <span className="font-medium">{c.userName}</span>
              <span className="mx-1 text-[var(--muted)]">·</span>
              <span>{c.body}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <input
            className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={t("features.commentPlaceholder")}
          />
          <Button type="button" size="sm" onClick={() => void addComment()} disabled={busy}>
            <Send size={14} />
          </Button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-[var(--muted)]">{t("features.attachments")}</p>
        <ul className="space-y-1 text-sm">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2">
              <a
                href={api.attachmentDownloadUrl(a.id)}
                className="truncate text-[var(--accent)] hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {a.fileName}
              </a>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  void api
                    .deleteTaskAttachment(activeProjectId, taskId, a.id)
                    .then(() => load())
                }
              >
                <X size={14} />
              </Button>
            </li>
          ))}
        </ul>
        <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm text-[var(--accent)]">
          <Paperclip size={16} />
          {t("features.uploadFile")}
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFile(f);
              e.target.value = "";
            }}
          />
        </label>
        {user && (
          <p className="mt-1 text-[10px] text-[var(--muted)]">
            {t("features.uploadedAs", { name: user.name })}
          </p>
        )}
      </div>
    </div>
  );
}
