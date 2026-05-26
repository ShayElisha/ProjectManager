/** Returns true if any dependency already connects these two tasks (either direction). */
export function tasksAlreadyLinked(
  taskA: string,
  taskB: string,
  deps: Array<{ predecessorId: string; successorId: string }>,
): boolean {
  return deps.some(
    (d) =>
      (d.predecessorId === taskA && d.successorId === taskB) ||
      (d.predecessorId === taskB && d.successorId === taskA),
  );
}
