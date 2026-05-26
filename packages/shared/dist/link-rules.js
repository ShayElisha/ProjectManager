"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tasksAlreadyLinked = tasksAlreadyLinked;
/** Returns true if any dependency already connects these two tasks (either direction). */
function tasksAlreadyLinked(taskA, taskB, deps) {
    return deps.some((d) => (d.predecessorId === taskA && d.successorId === taskB) ||
        (d.predecessorId === taskB && d.successorId === taskA));
}
//# sourceMappingURL=link-rules.js.map