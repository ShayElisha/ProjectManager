import type { RejectionRecord, VendorComparison } from "@nexus/shared";

/** Rejected vendor quotes / approval steps from browser storage (not on API). */
export function collectVendorRejections(comparisons: VendorComparison[]): RejectionRecord[] {
  const records: RejectionRecord[] = [];

  for (const cmp of comparisons) {
    for (const v of cmp.vendors) {
      if (v.status !== "rejected") continue;
      records.push({
        id: `vq:${cmp.id}:${v.id}`,
        kind: "vendor_quote",
        title: v.name,
        detail: cmp.rfq.title,
        rejectedAt: cmp.updatedAt,
        comparisonId: cmp.id,
        comparisonName: cmp.name,
      });
    }
    for (const step of cmp.approvalWorkflow) {
      if (step.status !== "rejected") continue;
      records.push({
        id: `ap:${cmp.id}:${step.id}`,
        kind: "approval_step",
        title: step.role,
        detail: cmp.rfq.title,
        rejectedAt: step.decidedAt ?? cmp.updatedAt,
        decisionNote: step.note,
        comparisonId: cmp.id,
        comparisonName: cmp.name,
      });
    }
  }

  return records;
}
