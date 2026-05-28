import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Copy, Mail } from "lucide-react";
import type {
  ActivityLogEntry,
  AutomationRule,
  ProjectGuest,
  ProjectMessage,
  ProjectWikiPage,
} from "@nexus/shared";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

interface Props {
  onClose: () => void;
}

export function ProjectHubPanel({ onClose }: Props) {
  const { t } = useTranslation();
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<"activity" | "chat" | "wiki" | "guests" | "automation">("activity");
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [wiki, setWiki] = useState<ProjectWikiPage[]>([]);
  const [guests, setGuests] = useState<ProjectGuest[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [chatText, setChatText] = useState("");
  const [wikiTitle, setWikiTitle] = useState("");
  const [wikiContent, setWikiContent] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [emailTo, setEmailTo] = useState("");

  const load = useCallback(async () => {
    if (!activeProjectId) return;
    const [a, m, w, g, r] = await Promise.all([
      api.activityLogs(activeProjectId),
      api.projectMessages(activeProjectId),
      api.wikiPages(activeProjectId),
      api.projectGuests(activeProjectId),
      api.automationRules(activeProjectId),
    ]);
    setActivity(a);
    setMessages(m);
    setWiki(w);
    setGuests(g);
    setRules(r);
    if (w[0]) {
      setWikiTitle(w[0].title);
      setWikiContent(w[0].content);
    }
  }, [activeProjectId]);

  useEffect(() => {
    void load();
  }, [load, tab]);

  if (!activeProjectId) return null;

  const postChat = async () => {
    const text = chatText.trim();
    if (!text || !user) return;
    await api.postProjectMessage(activeProjectId, {
      userId: user.id,
      userName: user.name,
      text,
    });
    setChatText("");
    await load();
  };

  const saveWiki = async () => {
    await api.saveWikiPage(activeProjectId, {
      id: wiki[0]?.id,
      title: wikiTitle.trim() || t("hub.wikiDefaultTitle"),
      content: wikiContent,
    });
    toast.success(t("hub.wikiSaved"));
    await load();
  };

  const inviteGuest = async () => {
    const email = guestEmail.trim();
    if (!email) return;
    const g = await api.inviteProjectGuest(activeProjectId, { email });
    setGuestEmail("");
    toast.success(t("hub.guestInvited"));
    await load();
    const link = `${window.location.origin}/guest/${g.token}`;
    await navigator.clipboard.writeText(link).catch(() => undefined);
    toast.info(t("hub.guestLinkCopied"));
  };

  const addRule = async () => {
    await api.createAutomationRule(activeProjectId, {
      name: t("hub.defaultRuleName"),
      enabled: true,
      triggerField: "status",
      triggerOp: "eq",
      triggerValue: "done",
      actionType: "notify",
    });
    await load();
  };

  const sendTestEmail = async () => {
    const to = emailTo.trim();
    if (!to) return;
    const res = await api.notifyEmail(activeProjectId, {
      to,
      subject: t("hub.emailTestSubject"),
      body: t("hub.emailTestBody"),
    });
    toast[res.sent ? "success" : "info"](res.sent ? t("hub.emailSent") : t("hub.emailNotConfigured"));
  };

  const tabs = [
    { id: "activity" as const, label: t("hub.activity") },
    { id: "chat" as const, label: t("hub.chat") },
    { id: "wiki" as const, label: t("hub.wiki") },
    { id: "guests" as const, label: t("hub.guests") },
    { id: "automation" as const, label: t("hub.automation") },
  ];

  return (
    <div className="fixed inset-y-0 end-0 z-50 flex w-full max-w-md flex-col border-s border-[var(--border)] bg-[var(--card)] shadow-xl">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-sm font-semibold">{t("hub.title")}</h2>
        <Button type="button" variant="ghost" size="icon" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)] px-2 py-2">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={`shrink-0 rounded-lg px-2 py-1 text-xs ${
              tab === tb.id ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "text-[var(--muted)]"
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "activity" && (
          <ul className="space-y-2 text-sm">
            {activity.length === 0 && <li className="text-[var(--muted)]">{t("hub.noActivity")}</li>}
            {activity.map((e) => (
              <li key={e.id} className="rounded-lg bg-[var(--border)]/30 px-2 py-1.5">
                <p>{e.summary}</p>
                <p className="text-[10px] text-[var(--muted)]">{new Date(e.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
        {tab === "chat" && (
          <div className="space-y-3">
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {messages.map((m) => (
                <li key={m.id} className="rounded-lg bg-[var(--border)]/30 px-2 py-1.5">
                  <span className="font-medium">{m.userName}</span>
                  <p>{m.body}</p>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void postChat()}
                placeholder={t("hub.chatPlaceholder")}
              />
              <Button type="button" size="sm" onClick={() => void postChat()}>
                {t("hub.send")}
              </Button>
            </div>
          </div>
        )}
        {tab === "wiki" && (
          <div className="space-y-2">
            <input
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
              value={wikiTitle}
              onChange={(e) => setWikiTitle(e.target.value)}
              placeholder={t("hub.wikiTitle")}
            />
            <textarea
              className="min-h-[200px] w-full rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
              value={wikiContent}
              onChange={(e) => setWikiContent(e.target.value)}
              placeholder={t("hub.wikiContent")}
            />
            <Button type="button" size="sm" onClick={() => void saveWiki()}>
              {t("hub.wikiSave")}
            </Button>
          </div>
        )}
        {tab === "guests" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="email"
                className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder={t("hub.guestEmail")}
              />
              <Button type="button" size="sm" onClick={() => void inviteGuest()}>
                {t("hub.invite")}
              </Button>
            </div>
            <ul className="space-y-2 text-sm">
              {guests.map((g) => {
                const link = `${window.location.origin}/guest/${g.token}`;
                return (
                  <li key={g.id} className="rounded-lg border border-[var(--border)] p-2">
                    <p className="font-medium">{g.email}</p>
                    <p className="truncate text-xs text-[var(--muted)]">{link}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="mt-1"
                      onClick={() => void navigator.clipboard.writeText(link)}
                    >
                      <Copy size={14} />
                      {t("hub.copyLink")}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {tab === "automation" && (
          <div className="space-y-3">
            <ul className="space-y-2 text-sm">
              {rules.map((r) => (
                <li key={r.id} className="rounded-lg bg-[var(--border)]/30 px-2 py-1.5">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {r.triggerField} {r.triggerOp} → {r.actionType}
                  </p>
                </li>
              ))}
            </ul>
            <Button type="button" size="sm" variant="outline" onClick={() => void addRule()}>
              {t("hub.addRule")}
            </Button>
            <div className="border-t border-[var(--border)] pt-3">
              <p className="mb-2 text-xs font-medium text-[var(--muted)]">{t("hub.emailTest")}</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="email@example.com"
                />
                <Button type="button" size="sm" variant="outline" onClick={() => void sendTestEmail()}>
                  <Mail size={14} />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
