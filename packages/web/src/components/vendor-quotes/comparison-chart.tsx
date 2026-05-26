import { useMemo } from "react";
import type { VendorComparison } from "@nexus/shared";
import { computeVendorFinalScore } from "@nexus/shared";
import { cn } from "@/lib/utils";

interface Props {
  comparison: VendorComparison;
  labels: { price: string; score: string };
}

export function ComparisonChart({ comparison, labels }: Props) {
  const data = useMemo(() => {
    const prices = comparison.vendors.map((v) => v.quotedPrice);
    const scores = comparison.vendors.map((v) =>
      computeVendorFinalScore(v, comparison.criteria),
    );
    const maxPrice = Math.max(...prices, 1);
    const maxScore = Math.max(...scores, 1);
    return comparison.vendors.map((v, i) => ({
      name: v.name,
      pricePct: (prices[i]! / maxPrice) * 100,
      scorePct: (scores[i]! / maxScore) * 100,
      price: prices[i]!,
      score: scores[i]!,
    }));
  }, [comparison]);

  if (comparison.vendors.length === 0) return null;

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="text-sm font-medium">{labels.price}</p>
      <div className="space-y-2">
        {data.map((d) => (
          <div key={`p-${d.name}`} className="grid grid-cols-[6rem_1fr_4rem] items-center gap-2 text-xs">
            <span className="truncate text-[var(--muted)]">{d.name}</span>
            <div className="h-3 overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className="h-full rounded-full bg-blue-500/80 transition-all"
                style={{ width: `${d.pricePct}%` }}
              />
            </div>
            <span className="tabular-nums text-end">{d.price > 0 ? d.price.toLocaleString() : "—"}</span>
          </div>
        ))}
      </div>
      <p className="text-sm font-medium">{labels.score}</p>
      <div className="space-y-2">
        {data.map((d) => (
          <div key={`s-${d.name}`} className="grid grid-cols-[6rem_1fr_4rem] items-center gap-2 text-xs">
            <span className="truncate text-[var(--muted)]">{d.name}</span>
            <div className="h-3 overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className={cn("h-full rounded-full bg-[var(--accent)] transition-all")}
                style={{ width: `${d.scorePct}%` }}
              />
            </div>
            <span className="tabular-nums text-end font-medium">{d.score.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
