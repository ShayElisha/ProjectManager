/**
 * One link per unordered task pair (A↔B). Other pairs (A↔C, B↔D) are still allowed.
 */
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
