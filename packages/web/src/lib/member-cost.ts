import type { Resource } from "@nexus/shared";

export type MemberCostMode = "hourly" | "global";

export function getMemberCostMode(resource?: Pick<Resource, "costPerHour" | "costPerUnit">): MemberCostMode {
  if (resource?.costPerUnit != null && resource.costPerUnit > 0) return "global";
  return "hourly";
}

export function formatMemberCost(
  resource: Pick<Resource, "costPerHour" | "costPerUnit"> | undefined,
  currency: string,
  locale: string,
): string {
  if (!resource) return "—";
  const mode = getMemberCostMode(resource);
  const fmt = new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  if (mode === "global" && resource.costPerUnit != null) {
    return fmt.format(resource.costPerUnit);
  }
  if (resource.costPerHour != null) {
    return `${fmt.format(resource.costPerHour)}/h`;
  }
  return "—";
}

export function costsFromMode(
  mode: MemberCostMode,
  amount: number,
): { costPerHour?: number; costPerUnit?: number } {
  if (mode === "global") {
    return { costPerUnit: amount, costPerHour: undefined };
  }
  return { costPerHour: amount, costPerUnit: undefined };
}

/** Payload for PATCH when switching cost mode (clears the other field). */
export function costsPatchFromMode(
  mode: MemberCostMode,
  amount: number,
): { costPerHour: number | null; costPerUnit: number | null } {
  if (mode === "global") {
    return { costPerHour: null, costPerUnit: amount };
  }
  return { costPerHour: amount, costPerUnit: null };
}
