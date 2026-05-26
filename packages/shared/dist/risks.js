"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RISK_TEMPLATES = void 0;
exports.riskScore = riskScore;
exports.riskPriority = riskPriority;
exports.suggestRisksFromProject = suggestRisksFromProject;
const LEVEL_SCORE = { low: 1, medium: 2, high: 3 };
/** P×I score 1–9 (standard qualitative matrix). */
function riskScore(probability, impact) {
    return LEVEL_SCORE[probability] * LEVEL_SCORE[impact];
}
function riskPriority(score) {
    if (score >= 6)
        return "high";
    if (score >= 3)
        return "medium";
    return "low";
}
function daysBetween(start, end) {
    const a = new Date(`${start}T12:00:00`).getTime();
    const b = new Date(`${end}T12:00:00`).getTime();
    return Math.round((b - a) / 86_400_000);
}
exports.RISK_TEMPLATES = [
    {
        id: "supplier_delay",
        category: "schedule",
        titleKey: "risks.templates.supplierDelay.title",
        descriptionKey: "risks.templates.supplierDelay.desc",
        defaultProbability: "medium",
        defaultImpact: "high",
        defaultResponseKey: "risks.templates.supplierDelay.response",
    },
    {
        id: "budget_overrun",
        category: "budget",
        titleKey: "risks.templates.budgetOverrun.title",
        descriptionKey: "risks.templates.budgetOverrun.desc",
        defaultProbability: "medium",
        defaultImpact: "medium",
        defaultResponseKey: "risks.templates.budgetOverrun.response",
    },
    {
        id: "resource_unavailable",
        category: "resource",
        titleKey: "risks.templates.resourceUnavailable.title",
        descriptionKey: "risks.templates.resourceUnavailable.desc",
        defaultProbability: "medium",
        defaultImpact: "high",
        defaultResponseKey: "risks.templates.resourceUnavailable.response",
    },
    {
        id: "scope_creep",
        category: "scope",
        titleKey: "risks.templates.scopeCreep.title",
        descriptionKey: "risks.templates.scopeCreep.desc",
        defaultProbability: "high",
        defaultImpact: "medium",
        defaultResponseKey: "risks.templates.scopeCreep.response",
    },
    {
        id: "integration",
        category: "technical",
        titleKey: "risks.templates.integration.title",
        descriptionKey: "risks.templates.integration.desc",
        defaultProbability: "medium",
        defaultImpact: "high",
        defaultResponseKey: "risks.templates.integration.response",
    },
];
function addSuggestion(suggestions, keySet, item) {
    if (keySet.has(item.key))
        return;
    suggestions.push({
        ...item,
        score: riskScore(item.probability, item.impact),
    });
}
function suggestRisksFromProject(input) {
    const suggestions = [];
    const keySet = new Set(input.existingKeys);
    const today = new Date().toISOString().slice(0, 10);
    const leaf = input.tasks.filter((t) => !t.isSummary);
    const lateTasks = leaf.filter((t) => t.endDate < today && t.percentComplete < 100);
    if (input.lateTaskCount >= 3 && !keySet.has("late:aggregate")) {
        const prob = input.criticalLateCount > 0 ? "high" : "medium";
        const imp = input.criticalLateCount > 0 ? "high" : "medium";
        addSuggestion(suggestions, keySet, {
            key: "late:aggregate",
            title: `פיגור מערכתי בלוח זמנים (${input.lateTaskCount} משימות)`,
            description: `${input.lateTaskCount} משימות באיחור, מתוכן ${input.criticalLateCount} בנתיב קריטי.`,
            category: "schedule",
            probability: prob,
            impact: imp,
            responsePlan: "סקירת נתיב קריטי, צמצום היקף, או אישור תאריך סיום חדש.",
            source: "auto_schedule",
            reason: `${input.lateTaskCount} משימות באיחור`,
        });
    }
    else {
        const sortedLate = [...lateTasks].sort((a, b) => {
            if (a.isCritical !== b.isCritical)
                return a.isCritical ? -1 : 1;
            return a.endDate.localeCompare(b.endDate);
        });
        for (const t of sortedLate.slice(0, 5)) {
            const key = `late:${t.id}`;
            const prob = t.isCritical ? "high" : "medium";
            const imp = t.isCritical ? "high" : "medium";
            addSuggestion(suggestions, keySet, {
                key,
                title: `איחור: ${t.name}`,
                description: `משימה "${t.name}" אמורה להסתיים ב-${t.endDate}, התקדמות ${Math.round(t.percentComplete)}%.`,
                category: "schedule",
                probability: prob,
                impact: imp,
                responsePlan: "הקצאת משאבים, עדכון לוח זמנים או צמצום היקף.",
                source: "auto_schedule",
                reason: "משימה באיחור",
                taskId: t.id,
            });
        }
    }
    const criticalOpen = leaf.filter((t) => t.isCritical && t.percentComplete < 100 && t.endDate >= today);
    if (criticalOpen.length > 0 && !keySet.has("schedule:critical-path")) {
        const prob = criticalOpen.length >= 3 ? "high" : "medium";
        const imp = "high";
        const names = criticalOpen
            .slice(0, 3)
            .map((t) => t.name)
            .join(", ");
        addSuggestion(suggestions, keySet, {
            key: "schedule:critical-path",
            title: "משימות קריטיות בנתיב (עדיין בלוח)",
            description: `${criticalOpen.length} משימות קריטיות פתוחות, למשל: ${names}.`,
            category: "schedule",
            probability: prob,
            impact: imp,
            responsePlan: "מעקב יומי, הקצאת משאבים מיידית, הכנת תוכנית חלופית.",
            source: "auto_schedule",
            reason: "נתיב קריטי",
        });
    }
    const dueSoon = leaf
        .filter((t) => {
        if (t.percentComplete >= 100)
            return false;
        const left = daysBetween(today, t.endDate);
        return left >= 0 && left <= 7;
    })
        .sort((a, b) => a.endDate.localeCompare(b.endDate));
    for (const t of dueSoon.slice(0, 3)) {
        const daysLeft = daysBetween(today, t.endDate);
        const prob = daysLeft <= 2 ? "high" : "medium";
        const imp = t.isCritical ? "high" : "medium";
        addSuggestion(suggestions, keySet, {
            key: `due:${t.id}`,
            title: `דדליין קרוב: ${t.name}`,
            description: `סיום מתוכנן בעוד ${daysLeft} ימים (${t.endDate}), התקדמות ${Math.round(t.percentComplete)}%.`,
            category: "schedule",
            probability: prob,
            impact: imp,
            responsePlan: "הקצאת משאבים, עדכון תאריך או צמצום היקף.",
            source: "auto_schedule",
            reason: `דדליין בעוד ${daysLeft} ימים`,
            taskId: t.id,
        });
    }
    if (input.forecastDelayDays != null && input.forecastDelayDays >= 5 && !keySet.has("schedule:forecast")) {
        const prob = input.forecastDelayDays >= 14 ? "high" : "medium";
        const imp = "high";
        addSuggestion(suggestions, keySet, {
            key: "schedule:forecast",
            title: "תחזית עיכוב בפרויקט",
            description: `תחזית עיכוב של כ-${input.forecastDelayDays} ימים מול לוח הזמנים / CPM / SPI.`,
            category: "schedule",
            probability: prob,
            impact: imp,
            responsePlan: "בדיקת נתיב קריטי, מהלך התאוששות, או עדכון תאריך סיום מאושר.",
            source: "auto_schedule",
            reason: `תחזית ${input.forecastDelayDays} ימים`,
        });
    }
    if (input.baselineLateFinishCount != null &&
        input.baselineLateFinishCount >= 2 &&
        !keySet.has("baseline:drift")) {
        const prob = input.baselineLateFinishCount >= 5 ? "high" : "medium";
        const imp = "high";
        addSuggestion(suggestions, keySet, {
            key: "baseline:drift",
            title: "סטייה מ-Baseline",
            description: `${input.baselineLateFinishCount} משימות עם סיום מאוחר מול baseline${input.baselineAvgEndVarianceDays != null
                ? ` (ממוצע ${input.baselineAvgEndVarianceDays} ימים).`
                : "."}`,
            category: "schedule",
            probability: prob,
            impact: imp,
            responsePlan: "השוואת baseline, אישור תוכנית התאוששות או rebaseline.",
            source: "auto_baseline",
            reason: "סטיית baseline",
        });
    }
    if (input.projectHealth && input.projectHealth !== "on_track") {
        const key = `health:${input.projectHealth}`;
        if (!keySet.has(key)) {
            const prob = input.projectHealth === "critical" ? "high" : "medium";
            const imp = "high";
            addSuggestion(suggestions, keySet, {
                key,
                title: input.projectHealth === "critical"
                    ? "בריאות פרויקט: קריטי"
                    : "בריאות פרויקט: בסיכון",
                description: "שילוב של מדדי EVM (SPI/CPI), משימות באיחור וחריגות תקציב מצביע על מצב בסיכון.",
                category: "schedule",
                probability: prob,
                impact: imp,
                responsePlan: "סקירת הנהלה, תוכנית התאוששות, הקצאת משאבים נוספים.",
                source: "auto_schedule",
                reason: input.projectHealth === "critical" ? "מצב קריטי" : "בסיכון",
            });
        }
    }
    if (input.evm) {
        if (input.evm.spi < 0.9 && !keySet.has("evm:spi")) {
            const prob = input.evm.spi < 0.8 ? "high" : "medium";
            const imp = "high";
            addSuggestion(suggestions, keySet, {
                key: "evm:spi",
                title: "פיגור בלוח זמנים (SPI)",
                description: `SPI=${input.evm.spi.toFixed(2)} — ביצוע איטי מהמתוכנן.`,
                category: "schedule",
                probability: prob,
                impact: imp,
                responsePlan: "בדיקת נתיב קריטי, החלפת משאבים, או אישור תאריך סיום חדש.",
                source: "auto_evm",
                reason: `SPI ${input.evm.spi.toFixed(2)}`,
            });
        }
        if (input.evm.cpi < 0.9 && !keySet.has("evm:cpi")) {
            const prob = input.evm.cpi < 0.8 ? "high" : "medium";
            const imp = "high";
            addSuggestion(suggestions, keySet, {
                key: "evm:cpi",
                title: "חריגת עלות (CPI)",
                description: `CPI=${input.evm.cpi.toFixed(2)} — עלות בפועל גבוהה מהמתוכנן.`,
                category: "budget",
                probability: prob,
                impact: imp,
                responsePlan: "סקירת תקציב, הקפאת שינויי תכולה, אופטימיזציית משאבים.",
                source: "auto_evm",
                reason: `CPI ${input.evm.cpi.toFixed(2)}`,
            });
        }
        if (input.evm.sv < 0 && !keySet.has("evm:sv")) {
            addSuggestion(suggestions, keySet, {
                key: "evm:sv",
                title: "פיגור בערך מתוכנן (SV)",
                description: `SV=${input.evm.sv.toFixed(0)} — ערך מתוכנן גבוה מהושג.`,
                category: "schedule",
                probability: "medium",
                impact: "high",
                responsePlan: "האצת משימות קריטיות, בדיקת תלויות ומשאבים.",
                source: "auto_evm",
                reason: "SV שלילי",
            });
        }
        const cap = input.evm.budgetAllocated;
        if (cap != null && cap > 0 && input.evm.eac > cap * 1.02 && !keySet.has("evm:budget-cap")) {
            addSuggestion(suggestions, keySet, {
                key: "evm:budget-cap",
                title: "חריגה צפויה מתקציב מאושר",
                description: `EAC=${Math.round(input.evm.eac)} מול תקציב ${Math.round(cap)}.`,
                category: "budget",
                probability: "high",
                impact: "high",
                responsePlan: "אישור תוספת תקציב, צמצום היקף, או אופטימיזציית עלויות.",
                source: "auto_evm",
                reason: "EAC מעל תקציב",
            });
        }
        if (input.evm.vac < 0 && !keySet.has("evm:vac")) {
            addSuggestion(suggestions, keySet, {
                key: "evm:vac",
                title: "חריגת עלות בסיום (VAC)",
                description: `VAC=${Math.round(input.evm.vac)} — תחזית עלות גבוהה מהתקציב הבסיסי.`,
                category: "budget",
                probability: "medium",
                impact: "high",
                responsePlan: "סקירת EAC, הקפאת שינויים, בקרת רכש ושעות.",
                source: "auto_evm",
                reason: "VAC שלילי",
            });
        }
    }
    if (input.pendingChangeCount != null && input.pendingChangeCount > 0 && !keySet.has("scope:pending-cr")) {
        addSuggestion(suggestions, keySet, {
            key: "scope:pending-cr",
            title: "שינויי תכולה ממתינים לאישור",
            description: `${input.pendingChangeCount} בקשות שינוי בסטטוס "ממתין" — סיכון להתרחבות היקף.`,
            category: "scope",
            probability: "medium",
            impact: "medium",
            responsePlan: "טיפול ב-CR, הערכת השפעה על לוח ותקציב לפני ביצוע.",
            source: "auto_scope",
            reason: `${input.pendingChangeCount} CR ממתינים`,
        });
    }
    if (input.unassignedCriticalCount != null &&
        input.unassignedCriticalCount > 0 &&
        !keySet.has("resource:unassigned-critical")) {
        addSuggestion(suggestions, keySet, {
            key: "resource:unassigned-critical",
            title: "משימות קריטיות ללא מוקצים",
            description: `${input.unassignedCriticalCount} משימות בנתיב קריטי ללא עובד/שיבוץ מוגדר.`,
            category: "resource",
            probability: "high",
            impact: "high",
            responsePlan: "הקצאת אחראי ומשאבים למשימות קריטיות מיידית.",
            source: "auto_resource",
            reason: "ללא מוקצים",
        });
    }
    const overloaded = input.overloadedResources ?? [];
    for (const r of overloaded) {
        const key = `resource:${r.resourceId}`;
        if (keySet.has(key))
            continue;
        addSuggestion(suggestions, keySet, {
            key,
            title: `עומס יתר: ${r.resourceName}`,
            description: `ניצול מקסימלי של כ-${r.maxUtilizationPct}% מול קיבולת בשבועות הקרובים.`,
            category: "resource",
            probability: "medium",
            impact: "high",
            responsePlan: "החלקת עומס, גיוס משאב נוסף, או דחיית משימות לא קריטיות.",
            source: "auto_resource",
            reason: `ניצול ${r.maxUtilizationPct}%`,
        });
    }
    if (input.hasResourceOverload &&
        overloaded.length === 0 &&
        !keySet.has("resource:overload")) {
        addSuggestion(suggestions, keySet, {
            key: "resource:overload",
            title: "הקצאת יתר למשאבים",
            description: "לפחות משאב אחד מוקצה מעל קיבולת בשבועות הקרובים.",
            category: "resource",
            probability: "medium",
            impact: "high",
            responsePlan: "החלקת עומס, גיוס משאב נוסף, או דחיית משימות לא קריטיות.",
            source: "auto_resource",
            reason: "עומס משאבים",
        });
    }
    return suggestions.sort((a, b) => b.score - a.score).slice(0, 12);
}
//# sourceMappingURL=risks.js.map