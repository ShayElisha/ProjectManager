/** RFQ / vendor quote comparison & weighted scoring */

export type QuoteStatus = "pending" | "received" | "rejected" | "approved";
export type RfqStatus = "draft" | "sent" | "closed";
export type ApprovalStepStatus = "pending" | "approved" | "rejected";

export interface NegotiationEntry {
  id: string;
  at: string;
  author: string;
  message: string;
  price?: number;
}

export interface ApprovalStep {
  id: string;
  role: string;
  status: ApprovalStepStatus;
  decidedAt?: string;
  note?: string;
}

export interface VendorCriterion {
  id: string;
  name: string;
  /** Weight as percentage (e.g. 40 = 40%) */
  weight: number;
  /** When true, scores derived from quoted prices (lowest = 100) */
  autoFromPrice?: boolean;
}

export interface VendorQuote {
  id: string;
  name: string;
  quotedPrice: number;
  status: QuoteStatus;
  deliveryDays?: number;
  scores: Record<string, number>;
  negotiationHistory: NegotiationEntry[];
}

export interface VendorRfq {
  id: string;
  rfqNumber: string;
  title: string;
  description: string;
  dueDate: string;
  createdAt: string;
  status: RfqStatus;
}

export interface CostBaseline {
  budgetBaseline: number;
  actualCost: number;
  ev: number;
  pv: number;
  ac: number;
}

export interface VendorComparison {
  id: string;
  name: string;
  rfq: VendorRfq;
  criteria: VendorCriterion[];
  vendors: VendorQuote[];
  approvalWorkflow: ApprovalStep[];
  costBaseline: CostBaseline;
  selectedVendorId: string | null;
  updatedAt: string;
}

export function criteriaWeightSum(criteria: VendorCriterion[]): number {
  return criteria.reduce((s, c) => s + c.weight, 0);
}

/** CPI = EV / AC */
export function computeCpi(ev: number, ac: number): number {
  return ac > 0 ? ev / ac : 1;
}

/** SPI = EV / PV */
export function computeSpi(ev: number, pv: number): number {
  return pv > 0 ? ev / pv : 1;
}

export function budgetVsActual(baseline: CostBaseline): {
  variance: number;
  percentUsed: number;
} {
  const variance = baseline.budgetBaseline - baseline.actualCost;
  const percentUsed =
    baseline.budgetBaseline > 0
      ? (baseline.actualCost / baseline.budgetBaseline) * 100
      : 0;
  return { variance, percentUsed };
}

/** Lowest quoted price → 100; others scaled linearly */
export function autoPriceScores(vendors: VendorQuote[]): Record<string, number> {
  const withPrice = vendors.filter((v) => v.quotedPrice > 0);
  if (withPrice.length === 0) {
    return Object.fromEntries(vendors.map((v) => [v.id, 0]));
  }
  const min = Math.min(...withPrice.map((v) => v.quotedPrice));
  const max = Math.max(...withPrice.map((v) => v.quotedPrice));
  return Object.fromEntries(
    vendors.map((v) => {
      if (v.quotedPrice <= 0) return [v.id, 0];
      if (max === min) return [v.id, 100];
      const ratio = (max - v.quotedPrice) / (max - min);
      return [v.id, Math.round(50 + ratio * 50)];
    }),
  );
}

export function applyAutoPriceScores(
  vendors: VendorQuote[],
  criteria: VendorCriterion[],
): VendorQuote[] {
  const priceCriterion = criteria.find(
    (c) => c.autoFromPrice || c.name.includes("מחיר") || c.name.toLowerCase().includes("price"),
  );
  if (!priceCriterion) return vendors;
  const priceScores = autoPriceScores(vendors);
  return vendors.map((v) => ({
    ...v,
    scores: { ...v.scores, [priceCriterion.id]: priceScores[v.id] ?? 0 },
  }));
}

/** Auto delivery score: faster delivery → higher score (0–100) */
export function autoDeliveryScores(vendors: VendorQuote[]): Record<string, number> {
  const withDays = vendors.filter((v) => (v.deliveryDays ?? 0) > 0);
  if (withDays.length === 0) {
    return Object.fromEntries(vendors.map((v) => [v.id, 0]));
  }
  const min = Math.min(...withDays.map((v) => v.deliveryDays!));
  const max = Math.max(...withDays.map((v) => v.deliveryDays!));
  return Object.fromEntries(
    vendors.map((v) => {
      const d = v.deliveryDays ?? 0;
      if (d <= 0) return [v.id, 0];
      if (max === min) return [v.id, 100];
      return [v.id, Math.round(((max - d) / (max - min)) * 100)];
    }),
  );
}

export function applyAutoDeliveryScores(
  vendors: VendorQuote[],
  criteria: VendorCriterion[],
): VendorQuote[] {
  const deliveryCriterion = criteria.find(
    (c) =>
      c.name.includes("אספקה") ||
      c.name.includes("זמן") ||
      c.name.toLowerCase().includes("delivery"),
  );
  if (!deliveryCriterion) return vendors;
  const scores = autoDeliveryScores(vendors);
  return vendors.map((v) => ({
    ...v,
    scores: { ...v.scores, [deliveryCriterion.id]: scores[v.id] ?? 0 },
  }));
}

export function runAutoScoring(comparison: VendorComparison): VendorComparison {
  let vendors = applyAutoPriceScores(comparison.vendors, comparison.criteria);
  vendors = applyAutoDeliveryScores(vendors, comparison.criteria);
  return { ...comparison, vendors };
}

export interface PriceRank {
  vendor: VendorQuote;
  rank: number;
  savingsVsHighest: number;
}

export function rankByPrice(vendors: VendorQuote[]): PriceRank[] {
  const sorted = [...vendors].sort((a, b) => a.quotedPrice - b.quotedPrice);
  const highest = sorted[sorted.length - 1]?.quotedPrice ?? 0;
  return sorted.map((v, i) => ({
    vendor: v,
    rank: i + 1,
    savingsVsHighest: Math.max(0, highest - v.quotedPrice),
  }));
}

/** Final Score = Σ (weight × score), weights normalized to sum to 100 when needed */
export function computeVendorFinalScore(
  vendor: VendorQuote,
  criteria: VendorCriterion[],
): number {
  if (criteria.length === 0) return 0;
  const totalWeight = criteriaWeightSum(criteria);
  const normalizer = totalWeight > 0 ? totalWeight : 100;
  return criteria.reduce((sum, c) => {
    const raw = vendor.scores[c.id] ?? 0;
    const score = Math.min(100, Math.max(0, raw));
    return sum + (c.weight / normalizer) * score;
  }, 0);
}

export interface RankedVendor {
  vendor: VendorQuote;
  finalScore: number;
  rank: number;
  isWinner: boolean;
}

export function rankVendors(
  vendors: VendorQuote[],
  criteria: VendorCriterion[],
): RankedVendor[] {
  const scored = vendors.map((v) => ({
    vendor: v,
    finalScore: computeVendorFinalScore(v, criteria),
  }));
  scored.sort((a, b) => b.finalScore - a.finalScore);
  const top = scored[0]?.finalScore ?? -1;
  return scored.map((item, i) => ({
    ...item,
    rank: i + 1,
    isWinner: vendors.length > 0 && item.finalScore === top && top > 0,
  }));
}

export interface AiRecommendation {
  vendorId: string;
  vendorName: string;
  message: string;
  reason: string;
}

/** Rule-based recommendation (no external AI API) */
export function generateAiRecommendation(
  comparison: VendorComparison,
  ranked: RankedVendor[],
): AiRecommendation | null {
  if (ranked.length === 0) return null;
  const winner = ranked[0]!;
  const priceRank = rankByPrice(comparison.vendors);
  const cheapest = priceRank[0];
  const deliveryCriterion = comparison.criteria.find(
    (c) => c.name.includes("אספקה") || c.name.toLowerCase().includes("delivery"),
  );

  if (
    cheapest &&
    winner.vendor.id !== cheapest.vendor.id &&
    deliveryCriterion
  ) {
    const winnerDelivery = winner.vendor.deliveryDays ?? 999;
    const cheapDelivery = cheapest.vendor.deliveryDays ?? 999;
    if (winnerDelivery < cheapDelivery) {
      return {
        vendorId: winner.vendor.id,
        vendorName: winner.vendor.name,
        message: `${winner.vendor.name} עדיף בגלל זמן אספקה`,
        reason: "delivery",
      };
    }
  }

  if (cheapest && winner.vendor.id === cheapest.vendor.id) {
    return {
      vendorId: winner.vendor.id,
      vendorName: winner.vendor.name,
      message: `${winner.vendor.name} עדיף בשילוב מחיר תחרותי וציון משוקלל גבוה`,
      reason: "price_score",
    };
  }

  const topDelivery = [...comparison.vendors]
    .filter((v) => (v.deliveryDays ?? 0) > 0)
    .sort((a, b) => (a.deliveryDays ?? 0) - (b.deliveryDays ?? 0))[0];

  if (
    topDelivery &&
    topDelivery.id !== winner.vendor.id &&
    (topDelivery.deliveryDays ?? 0) < (winner.vendor.deliveryDays ?? 999)
  ) {
    return {
      vendorId: topDelivery.id,
      vendorName: topDelivery.name,
      message: `${topDelivery.name} עדיף בגלל זמן אספקה`,
      reason: "delivery",
    };
  }

  return {
    vendorId: winner.vendor.id,
    vendorName: winner.vendor.name,
    message: `${winner.vendor.name} מוביל בציון המשוקלל הסופי`,
    reason: "weighted_score",
  };
}

export function isApprovalComplete(workflow: ApprovalStep[]): boolean {
  return (
    workflow.length > 0 &&
    workflow.every((s) => s.status === "approved")
  );
}
