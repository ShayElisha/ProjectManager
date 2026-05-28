import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Copy, Mail } from "lucide-react";
import type {
  ActivityLogEntry,
  AutomationRule,
  Goal,
  KeyResult,
  ProjectGuest,
  ProjectIntegrations,
  ProjectMessage,
  ProjectWikiPage,
  WebhookEvent,
  WebhookSubscription,
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
  const [tab, setTab] = useState<
    "activity" | "chat" | "wiki" | "guests" | "automation" | "integrations" | "goals"
  >("activity");
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
  const [integrations, setIntegrations] = useState<ProjectIntegrations | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [slackUrl, setSlackUrl] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [keyResults, setKeyResults] = useState<KeyResult[]>([]);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalPeriod, setGoalPeriod] = useState("");
  const [krTitle, setKrTitle] = useState("");
  const [krTarget, setKrTarget] = useState(100);
  const [selectedGoalId, setSelectedGoalId] = useState("");

  const load = useCallback(async () => {
    if (!activeProjectId) return;
    const [a, m, w, g, r, integ, hooks, gl, kr] = await Promise.all([
      api.activityLogs(activeProjectId),
      api.projectMessages(activeProjectId),
      api.wikiPages(activeProjectId),
      api.projectGuests(activeProjectId),
      api.automationRules(activeProjectId),
      api.projectIntegrations(activeProjectId),
      api.webhooks(activeProjectId),
      api.goals(activeProjectId),
      api.keyResults(activeProjectId),
    ]);
    setActivity(a);
    setMessages(m);
    setWiki(w);
    setGuests(g);
    setRules(r);
    setIntegrations(integ);
    setWebhooks(hooks);
    setSlackUrl(integ.slackWebhookUrl ?? "");
    setGoals(gl);
    setKeyResults(kr);
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
    { id: "integrations" as const, label: t("integrations.title") },
    { id: "goals" as const, label: t("goals.title") },
  ];

  const saveIntegrations = async () => {
    if (!activeProjectId) return;
    const next = await api.updateProjectIntegrations(activeProjectId, {
      slackWebhookUrl: slackUrl.trim() || undefined,
    });
    setIntegrations(next);
    toast.success(t("integrations.saved"));
  };

  const addWebhook = async () => {
    if (!activeProjectId || !webhookUrl.trim()) return;
    const events: WebhookEvent[] = ["task.created", "task.updated"];
    await api.createWebhook(activeProjectId, { url: webhookUrl.trim(), events });
    setWebhookUrl("");
    await load();
  };

  const addGoal = async () => {
    if (!activeProjectId || !goalTitle.trim()) return;
    await api.createGoal(activeProjectId, {
      title: goalTitle.trim(),
      period: goalPeriod.trim() || new Date().getFullYear().toString(),
    });
    setGoalTitle("");
    await load();
  };

  const addKr = async () => {
    if (!activeProjectId || !selectedGoalId || !krTitle.trim()) return;
    await api.createKeyResult(activeProjectId, {
      goalId: selectedGoalId,
      title: krTitle.trim(),
      targetValue: krTarget,
    });
    setKrTitle("");
    await load();
  };

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
        {tab === "integrations" && integrations && (
          <div className="space-y-4 text-sm">
            <div>
              <p className="mb-1 text-xs font-medium text-[var(--muted)]">{t("integrations.slack")}</p>
              <input
                className="w-full rounded border border-[var(--border)] bg-transparent px-2 py-1"
                value={slackUrl}
                onChange={(e) => setSlackUrl(e.target.value)}
                placeholder="https://hooks.slack.com/..."
              />
              <Button type="button" size="sm" className="mt-2" variant="outline" onClick={() => void saveIntegrations()}>
                {t("integrations.saveSlack")}
              </Button>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-[var(--muted)]">{t("integrations.zapier")}</p>
              <code className="block break-all rounded bg-[var(--border)]/30 p-2 text-xs">
                POST {window.location.origin}/api/public/zapier/{integrations.zapierHookToken}
              </code>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-[var(--muted)]">{t("integrations.emailInbound")}</p>
              <code className="block break-all rounded bg-[var(--border)]/30 p-2 text-xs">
                POST /api/public/inbound-email/{activeProjectId}
                <br />
                Header: X-Inbound-Secret: {integrations.emailInboundSecret}
              </code>
            </div>
            <div className="border-t border-[var(--border)] pt-3">
              <p className="mb-2 text-xs font-medium">{t("integrations.webhooks")}</p>
              <ul className="mb-2 space-y-1">
                {webhooks.map((h) => (
                  <li key={h.id} className="truncate text-xs text-[var(--muted)]">
                    {h.url}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded border border-[var(--border)] bg-transparent px-2 py-1"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://..."
                />
                <Button type="button" size="sm" onClick={() => void addWebhook()}>
                  {t("integrations.addWebhook")}
                </Button>
              </div>
            </div>
          </div>
        )}
        {tab === "goals" && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <input
                className="flex-1 rounded border border-[var(--border)] bg-transparent px-2 py-1"
                placeholder={t("goals.goalTitle")}
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
              />
              <input
                className="w-24 rounded border border-[var(--border)] bg-transparent px-2 py-1"
                placeholder={t("goals.period")}
                value={goalPeriod}
                onChange={(e) => setGoalPeriod(e.target.value)}
              />
              <Button type="button" size="sm" onClick={() => void addGoal()}>
                {t("goals.addGoal")}
              </Button>
            </div>
            <ul className="space-y-3">
              {goals.map((g) => {
                const krs = keyResults.filter((k) => k.goalId === g.id);
                const progress =
                  krs.length === 0
                    ? 0
                    : Math.round(
                        krs.reduce((s, k) => s + Math.min(100, (k.currentValue / k.targetValue) * 100), 0) /
                          krs.length,
                      );
                return (
                  <li key={g.id} className="rounded-lg border border-[var(--border)] p-2">
                    <p className="font-medium">{g.title}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {g.period} · {progress}%
                    </p>
                    <ul className="mt-2 space-y-1 ps-2">
                      {krs.map((kr) => (
                        <li key={kr.id} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-2">
                            <span>{kr.title}</span>
                            <span className="tabular-nums text-xs">
                              {kr.currentValue}/{kr.targetValue}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={kr.targetValue}
                            step={kr.targetValue > 100 ? 1 : 0.1}
                            value={kr.currentValue}
                            className="w-full"
                            onChange={(e) => {
                              void api
                                .updateKeyResult(activeProjectId, kr.id, {
                                  currentValue: Number(e.target.value),
                                })
                                .then(() => void load());
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
            {goals.length > 0 && (
              <div className="border-t border-[var(--border)] pt-3">
                <select
                  className="mb-2 w-full rounded border border-[var(--border)] bg-transparent px-2 py-1"
                  value={selectedGoalId}
                  onChange={(e) => setSelectedGoalId(e.target.value)}
                >
                  <option value="">{t("goals.pickGoal")}</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded border border-[var(--border)] bg-transparent px-2 py-1"
                    value={krTitle}
                    onChange={(e) => setKrTitle(e.target.value)}
                    placeholder={t("goals.krTitle")}
                  />
                  <input
                    type="number"
                    className="w-16 rounded border border-[var(--border)] bg-transparent px-2 py-1"
                    value={krTarget}
                    onChange={(e) => setKrTarget(Number(e.target.value))}
                  />
                  <Button type="button" size="sm" onClick={() => void addKr()}>
                    {t("goals.addKr")}
                  </Button>
                </div>
              </div>
            )}
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
