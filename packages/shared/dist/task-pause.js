"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addDaysIso = addDaysIso;
exports.remainingWorkDaysFromProgress = remainingWorkDaysFromProgress;
exports.isPausedWithResume = isPausedWithResume;
function addDaysIso(iso, n) {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
}
function remainingWorkDaysFromProgress(task) {
    const left = task.durationDays * (1 - (task.percentComplete ?? 0) / 100);
    return Math.max(1, Math.ceil(left));
}
function isPausedWithResume(task) {
    return task.status === "on_hold" && !!task.resumeDate && !!task.pausedSegmentEnd;
}
//# sourceMappingURL=task-pause.js.map