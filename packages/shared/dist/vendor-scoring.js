"use strict";
/** RFQ / vendor quote comparison & weighted scoring */
Object.defineProperty(exports, "__esModule", { value: true });
exports.criteriaWeightSum = criteriaWeightSum;
exports.computeCpi = computeCpi;
exports.computeSpi = computeSpi;
exports.budgetVsActual = budgetVsActual;
exports.autoPriceScores = autoPriceScores;
exports.applyAutoPriceScores = applyAutoPriceScores;
exports.autoDeliveryScores = autoDeliveryScores;
exports.applyAutoDeliveryScores = applyAutoDeliveryScores;
exports.runAutoScoring = runAutoScoring;
exports.rankByPrice = rankByPrice;
exports.computeVendorFinalScore = computeVendorFinalScore;
exports.rankVendors = rankVendors;
exports.generateAiRecommendation = generateAiRecommendation;
exports.isApprovalComplete = isApprovalComplete;
function criteriaWeightSum(criteria) {
    return criteria.reduce((s, c) => s + c.weight, 0);
}
/** CPI = EV / AC */
function computeCpi(ev, ac) {
    return ac > 0 ? ev / ac : 1;
}
/** SPI = EV / PV */
function computeSpi(ev, pv) {
    return pv > 0 ? ev / pv : 1;
}
function budgetVsActual(baseline) {
    const variance = baseline.budgetBaseline - baseline.actualCost;
    const percentUsed = baseline.budgetBaseline > 0
        ? (baseline.actualCost / baseline.budgetBaseline) * 100
        : 0;
    return { variance, percentUsed };
}
/** Lowest quoted price → 100; others scaled linearly */
function autoPriceScores(vendors) {
    const withPrice = vendors.filter((v) => v.quotedPrice > 0);
    if (withPrice.length === 0) {
        return Object.fromEntries(vendors.map((v) => [v.id, 0]));
    }
    const min = Math.min(...withPrice.map((v) => v.quotedPrice));
    const max = Math.max(...withPrice.map((v) => v.quotedPrice));
    return Object.fromEntries(vendors.map((v) => {
        if (v.quotedPrice <= 0)
            return [v.id, 0];
        if (max === min)
            return [v.id, 100];
        const ratio = (max - v.quotedPrice) / (max - min);
        return [v.id, Math.round(50 + ratio * 50)];
    }));
}
function applyAutoPriceScores(vendors, criteria) {
    const priceCriterion = criteria.find((c) => c.autoFromPrice || c.name.includes("מחיר") || c.name.toLowerCase().includes("price"));
    if (!priceCriterion)
        return vendors;
    const priceScores = autoPriceScores(vendors);
    return vendors.map((v) => ({
        ...v,
        scores: { ...v.scores, [priceCriterion.id]: priceScores[v.id] ?? 0 },
    }));
}
/** Auto delivery score: faster delivery → higher score (0–100) */
function autoDeliveryScores(vendors) {
    const withDays = vendors.filter((v) => (v.deliveryDays ?? 0) > 0);
    if (withDays.length === 0) {
        return Object.fromEntries(vendors.map((v) => [v.id, 0]));
    }
    const min = Math.min(...withDays.map((v) => v.deliveryDays));
    const max = Math.max(...withDays.map((v) => v.deliveryDays));
    return Object.fromEntries(vendors.map((v) => {
        const d = v.deliveryDays ?? 0;
        if (d <= 0)
            return [v.id, 0];
        if (max === min)
            return [v.id, 100];
        return [v.id, Math.round(((max - d) / (max - min)) * 100)];
    }));
}
function applyAutoDeliveryScores(vendors, criteria) {
    const deliveryCriterion = criteria.find((c) => c.name.includes("אספקה") ||
        c.name.includes("זמן") ||
        c.name.toLowerCase().includes("delivery"));
    if (!deliveryCriterion)
        return vendors;
    const scores = autoDeliveryScores(vendors);
    return vendors.map((v) => ({
        ...v,
        scores: { ...v.scores, [deliveryCriterion.id]: scores[v.id] ?? 0 },
    }));
}
function runAutoScoring(comparison) {
    let vendors = applyAutoPriceScores(comparison.vendors, comparison.criteria);
    vendors = applyAutoDeliveryScores(vendors, comparison.criteria);
    return { ...comparison, vendors };
}
function rankByPrice(vendors) {
    const sorted = [...vendors].sort((a, b) => a.quotedPrice - b.quotedPrice);
    const highest = sorted[sorted.length - 1]?.quotedPrice ?? 0;
    return sorted.map((v, i) => ({
        vendor: v,
        rank: i + 1,
        savingsVsHighest: Math.max(0, highest - v.quotedPrice),
    }));
}
/** Final Score = Σ (weight × score), weights normalized to sum to 100 when needed */
function computeVendorFinalScore(vendor, criteria) {
    if (criteria.length === 0)
        return 0;
    const totalWeight = criteriaWeightSum(criteria);
    const normalizer = totalWeight > 0 ? totalWeight : 100;
    return criteria.reduce((sum, c) => {
        const raw = vendor.scores[c.id] ?? 0;
        const score = Math.min(100, Math.max(0, raw));
        return sum + (c.weight / normalizer) * score;
    }, 0);
}
function rankVendors(vendors, criteria) {
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
/** Rule-based recommendation (no external AI API) */
function generateAiRecommendation(comparison, ranked) {
    if (ranked.length === 0)
        return null;
    const winner = ranked[0];
    const priceRank = rankByPrice(comparison.vendors);
    const cheapest = priceRank[0];
    const deliveryCriterion = comparison.criteria.find((c) => c.name.includes("אספקה") || c.name.toLowerCase().includes("delivery"));
    if (cheapest &&
        winner.vendor.id !== cheapest.vendor.id &&
        deliveryCriterion) {
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
    if (topDelivery &&
        topDelivery.id !== winner.vendor.id &&
        (topDelivery.deliveryDays ?? 0) < (winner.vendor.deliveryDays ?? 999)) {
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
function isApprovalComplete(workflow) {
    return (workflow.length > 0 &&
        workflow.every((s) => s.status === "approved"));
}
//# sourceMappingURL=vendor-scoring.js.map