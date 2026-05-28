/** Simple formula evaluator for custom fields: numbers, + - * /, and {fieldKey} refs. */
export function evaluateCustomFormula(
  expression: string,
  fields: Record<string, string | number | boolean | null | undefined>,
): number | string | null {
  const trimmed = expression.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith("=")) return trimmed;

  let expr = trimmed.slice(1).trim();
  expr = expr.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    const v = fields[key];
    if (v == null || v === "") return "0";
    if (typeof v === "boolean") return v ? "1" : "0";
    return String(Number(v) || 0);
  });

  if (!/^[\d\s+\-*/().]+$/.test(expr)) return null;

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`"use strict"; return (${expr});`) as () => number;
    const result = fn();
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}
