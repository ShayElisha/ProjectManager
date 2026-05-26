"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.suggestRejectionsFromProject = suggestRejectionsFromProject;
exports.manualEntryToRecord = manualEntryToRecord;
function addSuggestion(out, keys, item) {
    if (keys.has(item.key))
        return;
    keys.add(item.key);
    out.push(item);
}
function suggestRejectionsFromProject(input) {
    const suggestions = [];
    const keySet = new Set(input.existingKeys);
    const today = new Date().toISOString().slice(0, 10);
    const leaf = input.tasks.filter((t) => !t.isSummary);
    const lateTasks = leaf.filter((t) => t.endDate < today && t.percentComplete < 100);
    const onHold = leaf.filter((t) => t.status === "on_hold");
    if (input.forecastDelayDays != null && input.forecastDelayDays > 0 && !keySet.has("forecast:project")) {
        addSuggestion(suggestions, keySet, {
            key: "forecast:project",
            severity: input.forecastDelayDays >= 7 ? "critical" : "warning",
            title: `עיכוב משוער בפרויקט (~${input.forecastDelayDays} ימים)`,
            reason: "תחזית לוח זמנים (EVM/CPM)",
            description: `פרויקט "${input.projectName}" — מומלץ לתעד דחייה ולפתוח שינוי תכולה.`,
            projectId: input.projectId,
            projectName: input.projectName,
            suggestedCategory: "schedule_delay",
            impactScheduleDays: input.forecastDelayDays,
            suggestedRejectedAt: today,
        });
    }
    if (input.lateTaskCount >= 3 && !keySet.has("late:aggregate")) {
        addSuggestion(suggestions, keySet, {
            key: "late:aggregate",
            severity: input.criticalLateCount > 0 ? "critical" : "warning",
            title: `פיגור מערכתי (${input.lateTaskCount} משימות)`,
            reason: `${input.lateTaskCount} משימות באיחור`,
            description: `מתוכן ${input.criticalLateCount} בנתיב קריטי — תיעוד במרשם דחיות.`,
            projectId: input.projectId,
            projectName: input.projectName,
            suggestedCategory: "schedule_delay",
            impactScheduleDays: 5,
            suggestedRejectedAt: today,
        });
    }
    else {
        const sorted = [...lateTasks].sort((a, b) => {
            if (a.isCritical !== b.isCritical)
                return a.isCritical ? -1 : 1;
            return a.endDate.localeCompare(b.endDate);
        });
        for (const t of sorted.slice(0, 5)) {
            const key = `late:${t.id}`;
            addSuggestion(suggestions, keySet, {
                key,
                severity: t.isCritical ? "critical" : "warning",
                title: `איחור: ${t.name}`,
                reason: `סיום מתוכנן ${t.endDate}, ${Math.round(t.percentComplete)}% הושלם`,
                description: "משימה באיחור — שקול תיעוד דחיית לוח זמנים.",
                projectId: input.projectId,
                projectName: input.projectName,
                taskId: t.id,
                taskName: t.name,
                suggestedCategory: "schedule_delay",
                impactScheduleDays: Math.max(1, Math.ceil((100 - t.percentComplete) / 20)),
                suggestedRejectedAt: today,
            });
        }
    }
    for (const t of onHold.slice(0, 4)) {
        const key = `hold:${t.id}`;
        addSuggestion(suggestions, keySet, {
            key,
            severity: "info",
            title: `מושהה: ${t.name}`,
            reason: "משימה בסטטוס on_hold",
            description: t.pausedAt
                ? `הושהה מ-${t.pausedAt}${t.resumeDate ? `, חזרה מתוכננת ${t.resumeDate}` : ""}`
                : "עבודה מושהה — תיעוד דחייה אם רלוונטי.",
            projectId: input.projectId,
            projectName: input.projectName,
            taskId: t.id,
            taskName: t.name,
            suggestedCategory: "schedule_delay",
            suggestedRejectedAt: today,
        });
    }
    if (input.pendingChangeCount > 0 && !keySet.has("cr:pending")) {
        addSuggestion(suggestions, keySet, {
            key: "cr:pending",
            severity: "info",
            title: `${input.pendingChangeCount} בקשות שינוי ממתינות`,
            reason: "CR בסטטוס submitted",
            description: "בקשות שטרם אושרו/נדחו — מעקב לפני דחייה בפועל.",
            projectId: input.projectId,
            projectName: input.projectName,
            suggestedCategory: "scope",
            suggestedRejectedAt: today,
        });
    }
    if (input.pendingTimesheetCount > 0 && !keySet.has("ts:pending")) {
        addSuggestion(suggestions, keySet, {
            key: "ts:pending",
            severity: "info",
            title: `${input.pendingTimesheetCount} דיווחי שעות ממתינים`,
            reason: "Timesheets בסטטוס submitted",
            description: "דיווחים שממתינים לאישור — עלולים להידחות.",
            projectId: input.projectId,
            projectName: input.projectName,
            suggestedCategory: "approval",
            suggestedRejectedAt: today,
        });
    }
    return suggestions.sort((a, b) => {
        const order = { critical: 0, warning: 1, info: 2 };
        return order[a.severity] - order[b.severity];
    });
}
function manualEntryToRecord(entry, projectName, taskName) {
    return {
        id: `manual:${entry.id}`,
        kind: "manual",
        projectId: entry.projectId,
        projectName,
        title: entry.title,
        detail: entry.description,
        rejectedAt: entry.rejectedAt,
        decisionNote: entry.decisionNote,
        impactScheduleDays: entry.impactScheduleDays,
        impactCost: entry.impactCost,
        taskId: entry.taskId,
        taskName,
        manualCategory: entry.category,
    };
}
//# sourceMappingURL=rejections.js.map