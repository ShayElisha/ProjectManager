"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.daysBetween = daysBetween;
exports.clampDateToRange = clampDateToRange;
exports.isRangeWithinParent = isRangeWithinParent;
exports.isWorkDaysWithinParent = isWorkDaysWithinParent;
exports.clampWorkDays = clampWorkDays;
exports.progressFromChildren = progressFromChildren;
exports.parentStatusFromProgress = parentStatusFromProgress;
exports.dateSpanFromChildren = dateSpanFromChildren;
function daysBetween(a, b) {
    return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}
function clampDateToRange(date, min, max) {
    if (date < min)
        return min;
    if (date > max)
        return max;
    return date;
}
function isRangeWithinParent(start, end, parentStart, parentEnd) {
    return start >= parentStart && end <= parentEnd && start <= end;
}
/** Subtask work days must not exceed parent work days (milestones use 0). */
function isWorkDaysWithinParent(childDays, parentDays, isMilestone = false) {
    if (isMilestone)
        return childDays === 0;
    return childDays >= 1 && childDays <= parentDays;
}
function clampWorkDays(days, parentDays) {
    return Math.max(1, Math.min(Math.round(days), parentDays));
}
/** Progress from sub-tasks: average of child percentComplete values. */
function progressFromChildren(children) {
    if (children.length === 0)
        return 0;
    const sum = children.reduce((acc, c) => acc + (c.percentComplete ?? 0), 0);
    return Math.round(sum / children.length);
}
function parentStatusFromProgress(percent) {
    if (percent >= 100)
        return "completed";
    if (percent > 0)
        return "in_progress";
    return "not_started";
}
function dateSpanFromChildren(children) {
    const starts = children.map((c) => c.startDate);
    const ends = children.map((c) => c.endDate);
    const start = starts.reduce((a, b) => (a < b ? a : b));
    const end = ends.reduce((a, b) => (a > b ? a : b));
    return { start, end };
}
//# sourceMappingURL=task-tree.js.map