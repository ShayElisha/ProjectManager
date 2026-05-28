import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOrgStore } from "@/store/org-store";
import { useAppStore } from "@/store/app-store";
import { useAuthStore } from "@/store/auth-store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import type {
  AuditLogEntry,
  CrmContact,
  CrmDeal,
  Invoice,
  OrgAutomationRule,
  Program,
  SubscriptionPlan,
} from "@nexus/shared";

type Tab = "audit" | "programs" | "invoices" | "crm" | "automation" | "billing" | "security";

export function EnterpriseAdminPanel() {
  const { t } = useTranslation();
  const orgId = useOrgStore((s) => s.activeOrganizationId);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>("audit");
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [rules, setRules] = useState<OrgAutomationRule[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [totpSecret, setTotpSecret] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [programName, setProgramName] = useState("");
  const [clientName, setClientName] = useState("");
  const [contactName, setContactName] = useState("");
  const [dealTitle, setDealTitle] = useState("");
  const [ruleName, setRuleName] = useState("");

  const reload = useCallback(async () => {
    if (!orgId) return;
    try {
      const [a, p, inv, c, d, r, pl] = await Promise.all([
        api.auditLogs(orgId),
        api.programs(orgId),
        api.invoices(orgId),
        api.crmContacts(orgId),
        api.crmDeals(orgId),
        api.orgAutomationRules(orgId),
        api.subscriptionPlans(),
      ]);
      setAudit(a);
      setPrograms(p);
      setInvoices(inv);
      setContacts(c);
      setDeals(d);
      setRules(r);
      setPlans(pl);
    } catch {
      toast.error(t("enterprise.loadError"));
    }
  }, [orgId, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!orgId) {
    return (
      <p className="text-sm text-[var(--muted)]">{t("enterprise.noOrg")}</p>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "audit", label: t("enterprise.tabs.audit") },
    { id: "programs", label: t("enterprise.tabs.programs") },
    { id: "invoices", label: t("enterprise.tabs.invoices") },
    { id: "crm", label: t("enterprise.tabs.crm") },
    { id: "automation", label: t("enterprise.tabs.automation") },
    { id: "billing", label: t("enterprise.tabs.billing") },
    { id: "security", label: t("enterprise.tabs.security") },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{t("enterprise.title")}</h2>
      <div className="flex flex-wrap gap-2">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === id
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "audit" && (
        <ul className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-[var(--border)] p-3 text-sm">
          {audit.length === 0 && <li className="text-[var(--muted)]">{t("enterprise.empty")}</li>}
          {audit.map((e) => (
            <li key={e.id} className="border-b border-[var(--border)] pb-2 last:border-0">
              <span className="font-medium">{e.summary}</span>
              <span className="ms-2 text-xs text-[var(--muted)]">
                {e.userName ?? "—"} · {new Date(e.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}

      {tab === "programs" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              placeholder={t("enterprise.programName")}
            />
            <Button
              size="sm"
              onClick={() => {
                const name = programName.trim();
                if (!name) return;
                void api.createProgram(orgId, { name }).then(() => {
                  setProgramName("");
                  void reload();
                  toast.success(t("enterprise.saved"));
                });
              }}
            >
              {t("enterprise.add")}
            </Button>
          </div>
          <ul className="text-sm space-y-1">
            {programs.map((p) => (
              <li key={p.id} className="rounded border border-[var(--border)] px-3 py-2">
                {p.name}
                {p.projectIds.length > 0 && (
                  <span className="ms-2 text-xs text-[var(--muted)]">
                    ({p.projectIds.length} {t("enterprise.projects")})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "invoices" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder={t("enterprise.clientName")}
            />
            <Button
              size="sm"
              onClick={() => {
                const name = clientName.trim();
                if (!name) return;
                void api
                  .createInvoice(orgId, {
                    clientName: name,
                    lines: [{ description: t("enterprise.defaultLine"), quantity: 1, unitPrice: 0 }],
                  })
                  .then(() => {
                    setClientName("");
                    void reload();
                  });
              }}
            >
              {t("enterprise.add")}
            </Button>
          </div>
          <ul className="text-sm space-y-1">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex justify-between rounded border border-[var(--border)] px-3 py-2">
                <span>{inv.clientName}</span>
                <span>
                  {inv.total} {inv.currency} · {inv.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "crm" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium">{t("enterprise.contacts")}</h3>
            <div className="mb-2 flex gap-2">
              <input
                className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder={t("enterprise.contactName")}
              />
              <Button
                size="sm"
                onClick={() => {
                  const name = contactName.trim();
                  if (!name) return;
                  void api.createCrmContact(orgId, { name }).then(() => {
                    setContactName("");
                    void reload();
                  });
                }}
              >
                +
              </Button>
            </div>
            <ul className="text-sm space-y-1">
              {contacts.map((c) => (
                <li key={c.id} className="rounded border border-[var(--border)] px-2 py-1">
                  {c.name}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">{t("enterprise.deals")}</h3>
            <div className="mb-2 flex gap-2">
              <input
                className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm"
                value={dealTitle}
                onChange={(e) => setDealTitle(e.target.value)}
                placeholder={t("enterprise.dealTitle")}
              />
              <Button
                size="sm"
                onClick={() => {
                  const title = dealTitle.trim();
                  if (!title) return;
                  void api.createCrmDeal(orgId, { title, value: 0 }).then(() => {
                    setDealTitle("");
                    void reload();
                  });
                }}
              >
                +
              </Button>
            </div>
            <ul className="text-sm space-y-1">
              {deals.map((d) => (
                <li key={d.id} className="flex justify-between rounded border border-[var(--border)] px-2 py-1">
                  <span>{d.title}</span>
                  <span className="text-[var(--muted)]">{d.stage}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === "automation" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder={t("enterprise.ruleName")}
            />
            <Button
              size="sm"
              onClick={() => {
                const name = ruleName.trim();
                if (!name) return;
                void api
                  .createOrgAutomationRule(orgId, {
                    name,
                    event: "task.updated",
                    actionType: "notify",
                  })
                  .then(() => {
                    setRuleName("");
                    void reload();
                  });
              }}
            >
              {t("enterprise.add")}
            </Button>
          </div>
          <ul className="text-sm space-y-1">
            {rules.map((r) => (
              <li key={r.id} className="rounded border border-[var(--border)] px-3 py-2">
                {r.name} · {r.event} → {r.actionType}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "billing" && (
        <div className="grid gap-3 sm:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-xl border border-[var(--border)] p-4">
              <h3 className="font-medium">{plan.name}</h3>
              <p className="text-2xl font-semibold">
                {plan.priceMonthly} {plan.currency}
                <span className="text-sm font-normal text-[var(--muted)]">/mo</span>
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {plan.maxProjects} {t("enterprise.projects")} · {plan.maxUsers} users
              </p>
              <Button
                className="mt-3 w-full"
                size="sm"
                variant="outline"
                onClick={() => {
                  void api.billingCheckout(orgId, plan.id).then((r) => {
                    if (r.url) window.location.href = r.url;
                    else toast.info(t("enterprise.billingMock"));
                  });
                }}
              >
                {t("enterprise.subscribe")}
              </Button>
            </div>
          ))}
        </div>
      )}

      {tab === "security" && (
        <div className="space-y-4 rounded-xl border border-[var(--border)] p-4">
          <div>
            <h3 className="text-sm font-medium">{t("enterprise.totpTitle")}</h3>
            <p className="text-xs text-[var(--muted)]">{t("enterprise.totpHint")}</p>
            {totpUri && (
              <p className="mt-2 break-all text-xs font-mono text-[var(--muted)]">{totpUri}</p>
            )}
            {totpSecret && (
              <p className="mt-1 text-xs">
                {t("enterprise.secret")}: <code>{totpSecret}</code>
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void api.setup2fa().then((r) => {
                    setTotpSecret(r.secret);
                    setTotpUri(r.uri);
                  });
                }}
              >
                {t("enterprise.totpSetup")}
              </Button>
              <input
                className="w-28 rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="000000"
                maxLength={6}
              />
              <Button
                size="sm"
                onClick={() => {
                  void api.enable2fa(totpCode).then(() => toast.success(t("enterprise.totpEnabled")));
                }}
              >
                {t("enterprise.totpEnable")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void api.disable2fa(totpCode).then(() => toast.success(t("enterprise.totpDisabled")));
                }}
              >
                {t("enterprise.totpDisable")}
              </Button>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium">{t("enterprise.ssoTitle")}</h3>
            <p className="text-xs text-[var(--muted)]">{t("enterprise.ssoHint")}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => {
                void api.samlMetadata().then((m) => {
                  toast.info(m.enabled ? t("enterprise.ssoOn") : m.hint);
                });
              }}
            >
              {t("enterprise.ssoCheck")}
            </Button>
          </div>
          {activeProjectId && user && (
            <div>
              <h3 className="text-sm font-medium">{t("enterprise.taskPerms")}</h3>
              <p className="text-xs text-[var(--muted)]">{t("enterprise.taskPermsHint")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
