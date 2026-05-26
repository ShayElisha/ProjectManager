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
export declare function criteriaWeightSum(criteria: VendorCriterion[]): number;
/** CPI = EV / AC */
export declare function computeCpi(ev: number, ac: number): number;
/** SPI = EV / PV */
export declare function computeSpi(ev: number, pv: number): number;
export declare function budgetVsActual(baseline: CostBaseline): {
    variance: number;
    percentUsed: number;
};
/** Lowest quoted price → 100; others scaled linearly */
export declare function autoPriceScores(vendors: VendorQuote[]): Record<string, number>;
export declare function applyAutoPriceScores(vendors: VendorQuote[], criteria: VendorCriterion[]): VendorQuote[];
/** Auto delivery score: faster delivery → higher score (0–100) */
export declare function autoDeliveryScores(vendors: VendorQuote[]): Record<string, number>;
export declare function applyAutoDeliveryScores(vendors: VendorQuote[], criteria: VendorCriterion[]): VendorQuote[];
export declare function runAutoScoring(comparison: VendorComparison): VendorComparison;
export interface PriceRank {
    vendor: VendorQuote;
    rank: number;
    savingsVsHighest: number;
}
export declare function rankByPrice(vendors: VendorQuote[]): PriceRank[];
/** Final Score = Σ (weight × score), weights normalized to sum to 100 when needed */
export declare function computeVendorFinalScore(vendor: VendorQuote, criteria: VendorCriterion[]): number;
export interface RankedVendor {
    vendor: VendorQuote;
    finalScore: number;
    rank: number;
    isWinner: boolean;
}
export declare function rankVendors(vendors: VendorQuote[], criteria: VendorCriterion[]): RankedVendor[];
export interface AiRecommendation {
    vendorId: string;
    vendorName: string;
    message: string;
    reason: string;
}
/** Rule-based recommendation (no external AI API) */
export declare function generateAiRecommendation(comparison: VendorComparison, ranked: RankedVendor[]): AiRecommendation | null;
export declare function isApprovalComplete(workflow: ApprovalStep[]): boolean;
//# sourceMappingURL=vendor-scoring.d.ts.map