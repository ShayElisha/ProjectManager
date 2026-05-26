import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Trash2,
  Trophy,
  Scale,
  AlertCircle,
  Sparkles,
  FileDown,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  Ban,
} from "lucide-react";
import {
  criteriaWeightSum,
  computeVendorFinalScore,
  computeCpi,
  computeSpi,
  budgetVsActual,
  rankVendors,
  rankByPrice,
  generateAiRecommendation,
  isApprovalComplete,
  type QuoteStatus,
  type ApprovalStepStatus,
} from "@nexus/shared";
import { useAppStore } from "@/store/app-store";
import { useVendorQuotesStore } from "@/store/vendor-quotes-store";
import { api } from "@/lib/api";
import { ComparisonChart } from "@/components/vendor-quotes/comparison-chart";
import { exportVendorQuotesPdf } from "@/lib/vendor-quotes-pdf";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TabId = "rfq" | "scoring" | "analytics" | "history" | "approval";

const QUOTE_STATUS: QuoteStatus[] = ["pending", "received", "rejected", "approved"];

const STATUS_ICON: Record<QuoteStatus, typeof Clock> = {
  pending: Clock,
  received: CheckCircle2,
  rejected: Ban,
  approved: CheckCircle2,
};

export function VendorQuotesView() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>("rfq");
  const [negVendorId, setNegVendorId] = useState<string | null>(null);
  const [negMessage, setNegMessage] = useState("");
  const [negPrice, setNegPrice] = useState("");

  const hydrated = useVendorQuotesStore((s) => s.hydrated);
  const comparisons = useVendorQuotesStore((s) => s.comparisons);
  const activeId = useVendorQuotesStore((s) => s.activeId);
  const hydrate = useVendorQuotesStore((s) => s.hydrate);
  const setActive = useVendorQuotesStore((s) => s.setActive);
  const addComparison = useVendorQuotesStore((s) => s.addComparison);
  const removeComparison = useVendorQuotesStore((s) => s.removeComparison);
  const renameComparison = useVendorQuotesStore((s) => s.renameComparison);
  const updateRfq = useVendorQuotesStore((s) => s.updateRfq);
  const addCriterion = useVendorQuotesStore((s) => s.addCriterion);
  const updateCriterion = useVendorQuotesStore((s) => s.updateCriterion);
  const removeCriterion = useVendorQuotesStore((s) => s.removeCriterion);
  const addVendor = useVendorQuotesStore((s) => s.addVendor);
  const updateVendor = useVendorQuotesStore((s) => s.updateVendor);
  const setVendorScore = useVendorQuotesStore((s) => s.setVendorScore);
  const setVendorStatus = useVendorQuotesStore((s) => s.setVendorStatus);
  const removeVendor = useVendorQuotesStore((s) => s.removeVendor);
  const runAutoScoring = useVendorQuotesStore((s) => s.runAutoScoring);
  const addNegotiationEntry = useVendorQuotesStore((s) => s.addNegotiationEntry);
  const updateApprovalStep = useVendorQuotesStore((s) => s.updateApprovalStep);
  const updateCostBaseline = useVendorQuotesStore((s) => s.updateCostBaseline);
  const selectVendor = useVendorQuotesStore((s) => s.selectVendor);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const refreshBudgetSnapshot = useAppStore((s) => s.refreshBudgetSnapshot);

  const handleVendorStatus = async (vendorId: string, status: QuoteStatus) => {
    setVendorStatus(vendorId, status);
    if (status !== "approved" || !activeProjectId || !active) return;
    const vendor = active.vendors.find((v) => v.id === vendorId);
    if (!vendor?.quotedPrice) return;
    try {
      await api.syncBudgetFromRfq(activeProjectId, {
        comparisonId: active.id,
        vendorId: vendor.id,
        vendorName: vendor.name,
        rfqTitle: active.rfq.title,
        quotedPrice: vendor.quotedPrice,
        category: "material",
      });
      await refreshBudgetSnapshot({ persist: true });
    } catch {
      /* budget sync optional if API down */
    }
  };

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const active = comparisons.find((c) => c.id === activeId) ?? comparisons[0];

  const weightSum = useMemo(
    () => (active ? criteriaWeightSum(active.criteria) : 0),
    [active],
  );
  const weightsOk = Math.abs(weightSum - 100) < 0.01;

  const ranked = useMemo(
    () => (active ? rankVendors(active.vendors, active.criteria) : []),
    [active],
  );

  const priceRanked = useMemo(
    () => (active ? rankByPrice(active.vendors) : []),
    [active],
  );

  const aiRec = useMemo(
    () => (active ? generateAiRecommendation(active, ranked) : null),
    [active, ranked],
  );

  const cpi = active ? computeCpi(active.costBaseline.ev, active.costBaseline.ac) : 1;
  const spi = active ? computeSpi(active.costBaseline.ev, active.costBaseline.pv) : 1;
  const bva = active ? budgetVsActual(active.costBaseline) : { variance: 0, percentUsed: 0 };

  const tabs: { id: TabId; label: string }[] = [
    { id: "rfq", label: t("vendorQuotes.tabs.rfq") },
    { id: "scoring", label: t("vendorQuotes.tabs.scoring") },
    { id: "analytics", label: t("vendorQuotes.tabs.analytics") },
    { id: "history", label: t("vendorQuotes.tabs.history") },
    { id: "approval", label: t("vendorQuotes.tabs.approval") },
  ];

  if (!hydrated || !active) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--muted)]">
        {t("vendorQuotes.loading")}
      </div>
    );
  }

  const fmtScore = (n: number) => n.toFixed(2);
  const fmtMoney = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);

  const handleExportPdf = () => {
    const labels: Record<string, string> = {
      criteria: t("vendorQuotes.criterion"),
      ranking: t("vendorQuotes.ranking"),
      vendor: t("vendorQuotes.vendor"),
      status: t("vendorQuotes.quoteStatus"),
      price: t("vendorQuotes.quotedPrice"),
      delivery: t("vendorQuotes.deliveryDays"),
      score: t("vendorQuotes.finalScore"),
      "status.pending": t("vendorQuotes.status.pending"),
      "status.received": t("vendorQuotes.status.received"),
      "status.rejected": t("vendorQuotes.status.rejected"),
      "status.approved": t("vendorQuotes.status.approved"),
    };
    exportVendorQuotesPdf(active, ranked, labels);
  };

  const submitNegotiation = () => {
    if (!negVendorId || !negMessage.trim()) return;
    addNegotiationEntry(negVendorId, {
      author: t("vendorQuotes.negotiationAuthor"),
      message: negMessage.trim(),
      price: negPrice ? Number(negPrice) : undefined,
    });
    setNegMessage("");
    setNegPrice("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-2 lg:w-52">
        <div className="flex items-center gap-2">
          <Scale size={20} className="text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">{t("vendorQuotes.title")}</h2>
        </div>
        <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {comparisons.map((c) => (
            <li key={c.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(c.id)}
                className={cn(
                  "w-full min-w-[8rem] rounded-lg border px-3 py-2 text-start text-sm lg:min-w-0",
                  c.id === activeId
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border)] hover:bg-[var(--border)]/30",
                )}
              >
                <span className="block truncate font-medium">{c.name}</span>
                <span className="text-[10px] text-[var(--muted)]">{c.rfq.rfqNumber}</span>
              </button>
            </li>
          ))}
        </ul>
        <Button variant="outline" size="sm" onClick={() => addComparison()}>
          <Plus size={14} />
          {t("vendorQuotes.newRfq")}
        </Button>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-lg font-semibold"
            value={active.name}
            onChange={(e) => renameComparison(active.id, e.target.value)}
          />
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <FileDown size={14} />
            {t("vendorQuotes.exportPdf")}
          </Button>
          {comparisons.length > 1 && (
            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => removeComparison(active.id)}>
              <Trash2 size={14} />
            </Button>
          )}
        </div>

        <nav className="flex gap-1 overflow-x-auto border-b border-[var(--border)] pb-px">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "shrink-0 border-b-2 px-3 py-2 text-sm transition-colors",
                tab === id
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--fg)]",
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-auto space-y-4 pb-4">
          {tab === "rfq" && (
            <>
              <section className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-[var(--muted)]">{t("vendorQuotes.rfqNumber")}</label>
                  <input
                    className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm font-mono"
                    value={active.rfq.rfqNumber}
                    onChange={(e) => updateRfq({ rfqNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">{t("vendorQuotes.rfqStatus")}</label>
                  <select
                    className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm"
                    value={active.rfq.status}
                    onChange={(e) => updateRfq({ status: e.target.value as typeof active.rfq.status })}
                  >
                    <option value="draft">{t("vendorQuotes.rfq.draft")}</option>
                    <option value="sent">{t("vendorQuotes.rfq.sent")}</option>
                    <option value="closed">{t("vendorQuotes.rfq.closed")}</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-[var(--muted)]">{t("vendorQuotes.rfqTitle")}</label>
                  <input
                    className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5"
                    value={active.rfq.title}
                    onChange={(e) => updateRfq({ title: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-[var(--muted)]">{t("vendorQuotes.rfqDescription")}</label>
                  <textarea
                    className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm"
                    rows={2}
                    value={active.rfq.description}
                    onChange={(e) => updateRfq({ description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">{t("vendorQuotes.dueDate")}</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm"
                    value={active.rfq.dueDate}
                    onChange={(e) => updateRfq({ dueDate: e.target.value })}
                  />
                </div>
              </section>

              <div className="flex items-center justify-between">
                <h3 className="font-medium">{t("vendorQuotes.vendors")}</h3>
                <Button variant="outline" size="sm" onClick={() => addVendor()}>
                  <Plus size={14} />
                  {t("vendorQuotes.addVendor")}
                </Button>
              </div>

              <div className="space-y-2">
                {active.vendors.map((v) => {
                  const Icon = STATUS_ICON[v.status];
                  return (
                    <div
                      key={v.id}
                      className={cn(
                        "grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_auto_auto_auto_auto]",
                        active.selectedVendorId === v.id && "ring-1 ring-[var(--accent)]",
                      )}
                    >
                      <input
                        className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 font-medium"
                        value={v.name}
                        onChange={(e) => updateVendor(v.id, { name: e.target.value })}
                      />
                      <input
                        type="number"
                        min={0}
                        className="w-28 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm tabular-nums"
                        placeholder={t("vendorQuotes.quotedPrice")}
                        value={v.quotedPrice || ""}
                        onChange={(e) => updateVendor(v.id, { quotedPrice: Number(e.target.value) || 0 })}
                      />
                      <input
                        type="number"
                        min={0}
                        className="w-20 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
                        placeholder={t("vendorQuotes.deliveryDays")}
                        value={v.deliveryDays ?? ""}
                        onChange={(e) => updateVendor(v.id, { deliveryDays: Number(e.target.value) || 0 })}
                      />
                      <select
                        className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
                        value={v.status}
                        onChange={(e) =>
                          void handleVendorStatus(v.id, e.target.value as QuoteStatus)
                        }
                      >
                        {QUOTE_STATUS.map((s) => (
                          <option key={s} value={s}>
                            {t(`vendorQuotes.status.${s}`)}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-1">
                        <Button
                          variant={active.selectedVendorId === v.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => selectVendor(active.selectedVendorId === v.id ? null : v.id)}
                        >
                          <Icon size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500"
                          disabled={active.vendors.length <= 1}
                          onClick={() => removeVendor(v.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {priceRanked.length > 0 && priceRanked[0]!.vendor.quotedPrice > 0 && (
                <p className="text-sm text-[var(--muted)]">
                  {t("vendorQuotes.cheapest")}: <strong>{priceRanked[0]!.vendor.name}</strong> —{" "}
                  {fmtMoney(priceRanked[0]!.vendor.quotedPrice)}
                </p>
              )}
            </>
          )}

          {tab === "scoring" && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button variant="default" size="sm" onClick={() => runAutoScoring()}>
                  <RefreshCw size={14} />
                  {t("vendorQuotes.autoScore")}
                </Button>
                <p className="flex items-center gap-1 text-xs text-[var(--muted)]">
                  {weightsOk ? null : <AlertCircle size={14} className="text-amber-500" />}
                  {t("vendorQuotes.weightSum", { sum: weightSum.toFixed(1) })}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ranked.map(({ vendor, finalScore, rank, isWinner }) => (
                  <div
                    key={vendor.id}
                    className={cn(
                      "relative rounded-xl border p-4",
                      isWinner && "border-emerald-500/50 bg-emerald-500/10",
                    )}
                  >
                    {isWinner && (
                      <span className="absolute end-3 top-3 flex items-center gap-1 text-xs text-emerald-600">
                        <Trophy size={12} />
                        {t("vendorQuotes.bestDeal")}
                      </span>
                    )}
                    <p className="font-semibold">{vendor.name}</p>
                    <p className="text-xs text-[var(--muted)]">{t("vendorQuotes.rank", { rank })}</p>
                    <p className="mt-2 text-3xl font-bold tabular-nums text-[var(--accent)]">{fmtScore(finalScore)}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)]">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg)]/50">
                      <th className="px-3 py-2 text-start">{t("vendorQuotes.criterion")}</th>
                      <th className="w-20 px-2 py-2 text-center">{t("vendorQuotes.weight")}</th>
                      <th className="w-16 px-2 py-2 text-center">{t("vendorQuotes.auto")}</th>
                      {active.vendors.map((v) => (
                        <th key={v.id} className="min-w-[5rem] px-2 py-2 text-center">
                          {v.name}
                        </th>
                      ))}
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {active.criteria.map((cr) => (
                      <tr key={cr.id} className="border-b border-[var(--border)]/50">
                        <td className="px-3 py-2">
                          <input
                            className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1"
                            value={cr.name}
                            onChange={(e) => updateCriterion(cr.id, { name: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            className="w-14 rounded border border-[var(--border)] bg-[var(--bg)] px-1 py-1 text-center"
                            value={cr.weight}
                            onChange={(e) => updateCriterion(cr.id, { weight: Number(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={!!cr.autoFromPrice}
                            onChange={(e) => updateCriterion(cr.id, { autoFromPrice: e.target.checked })}
                          />
                        </td>
                        {active.vendors.map((v) => (
                          <td key={v.id} className="px-2 py-2 text-center">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              className="w-14 rounded border border-[var(--border)] bg-[var(--bg)] px-1 py-1 text-center"
                              value={v.scores[cr.id] ?? 0}
                              onChange={(e) =>
                                setVendorScore(v.id, cr.id, Number(e.target.value) || 0)
                              }
                            />
                          </td>
                        ))}
                        <td className="px-2">
                          <button type="button" onClick={() => removeCriterion(cr.id)} disabled={active.criteria.length <= 1}>
                            <Trash2 size={14} className="text-[var(--muted)]" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[var(--bg)]/30 font-medium">
                      <td colSpan={3} className="px-3 py-2">
                        {t("vendorQuotes.finalScore")}
                      </td>
                      {active.vendors.map((v) => (
                        <td key={v.id} className="px-2 py-2 text-center tabular-nums">
                          {fmtScore(computeVendorFinalScore(v, active.criteria))}
                        </td>
                      ))}
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
              <Button variant="outline" size="sm" onClick={() => addCriterion()}>
                <Plus size={14} />
                {t("vendorQuotes.addCriterion")}
              </Button>
            </>
          )}

          {tab === "analytics" && (
            <>
              {aiRec && (
                <div className="flex gap-3 rounded-xl border border-violet-500/30 bg-violet-500/10 p-4">
                  <Sparkles className="shrink-0 text-violet-500" size={22} />
                  <div>
                    <p className="text-sm font-medium">{t("vendorQuotes.aiTitle")}</p>
                    <p className="mt-1 text-sm">{aiRec.message}</p>
                  </div>
                </div>
              )}

              <ComparisonChart
                comparison={active}
                labels={{ price: t("vendorQuotes.chartPrice"), score: t("vendorQuotes.chartScore") }}
              />

              <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <h3 className="mb-3 font-medium">{t("vendorQuotes.pmMetrics")}</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {(
                    [
                      ["ev", active.costBaseline.ev],
                      ["pv", active.costBaseline.pv],
                      ["ac", active.costBaseline.ac],
                    ] as const
                  ).map(([key, val]) => (
                    <div key={key}>
                      <label className="text-xs uppercase text-[var(--muted)]">{key}</label>
                      <input
                        type="number"
                        className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
                        value={val || ""}
                        onChange={(e) =>
                          updateCostBaseline({ [key]: Number(e.target.value) || 0 })
                        }
                      />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-[var(--muted)]">{t("vendorQuotes.budgetBaseline")}</label>
                    <input
                      type="number"
                      className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
                      value={active.costBaseline.budgetBaseline || ""}
                      onChange={(e) =>
                        updateCostBaseline({ budgetBaseline: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">{t("vendorQuotes.actualCost")}</label>
                    <input
                      type="number"
                      className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
                      value={active.costBaseline.actualCost || ""}
                      onChange={(e) =>
                        updateCostBaseline({ actualCost: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard label="CPI = EV / AC" value={cpi.toFixed(2)} ok={cpi >= 1} />
                  <MetricCard label="SPI = EV / PV" value={spi.toFixed(2)} ok={spi >= 1} />
                  <MetricCard
                    label={t("vendorQuotes.budgetVariance")}
                    value={fmtMoney(bva.variance)}
                    ok={bva.variance >= 0}
                  />
                  <MetricCard
                    label={t("vendorQuotes.budgetUsed")}
                    value={`${bva.percentUsed.toFixed(0)}%`}
                    ok={bva.percentUsed <= 100}
                  />
                </div>
              </section>
            </>
          )}

          {tab === "history" && (
            <>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
                <h3 className="font-medium">{t("vendorQuotes.addNegotiation")}</h3>
                <select
                  className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm"
                  value={negVendorId ?? ""}
                  onChange={(e) => setNegVendorId(e.target.value || null)}
                >
                  <option value="">{t("vendorQuotes.selectVendor")}</option>
                  {active.vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                <textarea
                  className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm"
                  rows={2}
                  placeholder={t("vendorQuotes.negotiationPlaceholder")}
                  value={negMessage}
                  onChange={(e) => setNegMessage(e.target.value)}
                />
                <input
                  type="number"
                  className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm"
                  placeholder={t("vendorQuotes.newPriceOptional")}
                  value={negPrice}
                  onChange={(e) => setNegPrice(e.target.value)}
                />
                <Button size="sm" onClick={submitNegotiation} disabled={!negVendorId || !negMessage.trim()}>
                  {t("vendorQuotes.saveNegotiation")}
                </Button>
              </div>

              {active.vendors.map((v) =>
                v.negotiationHistory.length > 0 ? (
                  <div key={v.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                    <h4 className="mb-2 font-medium">{v.name}</h4>
                    <ul className="space-y-2 text-sm">
                      {[...v.negotiationHistory]
                        .sort((a, b) => b.at.localeCompare(a.at))
                        .map((e) => (
                          <li key={e.id} className="border-s-2 border-[var(--accent)] ps-3">
                            <span className="text-xs text-[var(--muted)]">
                              {new Date(e.at).toLocaleString()}
                            </span>
                            <p>{e.message}</p>
                            {e.price != null && (
                              <p className="text-xs tabular-nums">{fmtMoney(e.price)}</p>
                            )}
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </>
          )}

          {tab === "approval" && (
            <>
              <div
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  isApprovalComplete(active.approvalWorkflow)
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-amber-500/10 text-amber-600",
                )}
              >
                {isApprovalComplete(active.approvalWorkflow)
                  ? t("vendorQuotes.approvalComplete")
                  : t("vendorQuotes.approvalPending")}
              </div>
              <ul className="space-y-2">
                {active.approvalWorkflow.map((step) => (
                  <li
                    key={step.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
                  >
                    <span className="min-w-[8rem] font-medium">{step.role}</span>
                    <select
                      className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
                      value={step.status}
                      onChange={(e) =>
                        updateApprovalStep(step.id, {
                          status: e.target.value as ApprovalStepStatus,
                        })
                      }
                    >
                      <option value="pending">{t("vendorQuotes.approval.pending")}</option>
                      <option value="approved">{t("vendorQuotes.approval.approved")}</option>
                      <option value="rejected">{t("vendorQuotes.approval.rejected")}</option>
                    </select>
                    {step.status === "approved" && <CheckCircle2 size={16} className="text-emerald-500" />}
                    {step.status === "rejected" && <XCircle size={16} className="text-red-500" />}
                  </li>
                ))}
              </ul>
              {active.selectedVendorId && (
                <p className="text-sm text-[var(--muted)]">
                  {t("vendorQuotes.selectedVendor")}:{" "}
                  <strong>{active.vendors.find((v) => v.id === active.selectedVendorId)?.name}</strong>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)]/50 p-3">
      <p className="text-[10px] text-[var(--muted)]">{label}</p>
      <p className={cn("mt-1 text-xl font-bold tabular-nums", ok ? "text-emerald-600" : "text-amber-600")}>
        {value}
      </p>
    </div>
  );
}
