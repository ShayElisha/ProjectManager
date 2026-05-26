import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Package, Plus } from "lucide-react";
import type { BudgetCategory, BudgetLineItem } from "@nexus/shared";
import { MATERIAL_BUDGET_CATEGORIES } from "@nexus/shared";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAT_CATEGORIES = MATERIAL_BUDGET_CATEGORIES as BudgetCategory[];

interface Props {
  projectId: string;
  lines: BudgetLineItem[];
  leafTaskNames: Map<string, string>;
  currency: string;
  loading: boolean;
  onReload: () => Promise<void>;
  onOverview: (overview: import("@nexus/shared").BudgetOverviewReport) => void;
}

export function MaterialsBudgetSection({
  projectId,
  lines,
  leafTaskNames,
  currency,
  loading,
  onReload,
  onOverview,
}: Props) {
  const { t } = useTranslation();
  const [receiptLineId, setReceiptLineId] = useState<string | null>(null);
  const [receiptAmount, setReceiptAmount] = useState("");
  const [receiptNote, setReceiptNote] = useState("");
  const [receiptMonth, setReceiptMonth] = useState(new Date().toISOString().slice(0, 7));

  const materialLines = useMemo(
    () => lines.filter((l) => MAT_CATEGORIES.includes(l.category)),
    [lines],
  );

  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);

  const addMaterialLine = async () => {
    const res = await api.createBudgetLine(projectId, {
      category: "material",
      name: t("budget.materialNewLine"),
      plannedAmount: 0,
      committedAmount: 0,
      actualAmount: 0,
      cashMonth: new Date().toISOString().slice(0, 7),
      source: "manual",
    });
    await api.recalculateBudget(projectId, false);
    await onReload();
    onOverview(await api.getBudget(projectId));
    setReceiptLineId(res.id);
    setReceiptAmount("");
  };

  const submitReceipt = async () => {
    if (!receiptLineId || !receiptAmount) return;
    const { overview } = await api.recordBudgetReceipt(projectId, receiptLineId, {
      amount: Number(receiptAmount),
      cashMonth: receiptMonth,
      note: receiptNote.trim() || undefined,
    });
    onOverview(overview);
    await onReload();
    setReceiptAmount("");
    setReceiptNote("");
    setReceiptLineId(null);
  };

  return (
    <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package size={20} className="text-emerald-600 dark:text-emerald-400" />
          <div>
            <h3 className="font-semibold">{t("budget.materialsSectionTitle")}</h3>
            <p className="text-xs text-[var(--muted)]">{t("budget.materialsSectionHint")}</p>
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void addMaterialLine()}>
          <Plus size={14} />
          {t("budget.addMaterialLine")}
        </Button>
      </div>

      {materialLines.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{t("budget.noMaterialLines")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-[var(--muted)]">
                <th className="py-2 text-start">{t("budget.lineName")}</th>
                <th className="py-2 text-start">{t("budget.category")}</th>
                <th className="py-2 text-start">{t("budget.linkedTask")}</th>
                <th className="py-2 text-end">{t("budget.planned")}</th>
                <th className="py-2 text-end">{t("budget.committed")}</th>
                <th className="py-2 text-end">{t("budget.actual")}</th>
                <th className="py-2 text-end">{t("budget.variance")}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {materialLines.map((line) => {
                const committed = line.committedAmount ?? 0;
                const variance = line.plannedAmount - line.actualAmount;
                return (
                  <tr key={line.id} className="border-t border-[var(--border)]/50">
                    <td className="py-2">
                      <p className="font-medium">{line.name}</p>
                      {line.source === "rfq" && (
                        <span className="text-[10px] text-[var(--muted)]">RFQ</span>
                      )}
                    </td>
                    <td className="py-2">{t(`budget.categories.${line.category}`)}</td>
                    <td className="py-2 text-xs text-[var(--muted)]">
                      {line.taskId ? leafTaskNames.get(line.taskId) ?? line.taskId : "—"}
                    </td>
                    <td className="py-2 text-end tabular-nums">{fmt(line.plannedAmount)}</td>
                    <td className="py-2 text-end tabular-nums">{fmt(committed)}</td>
                    <td className="py-2 text-end tabular-nums">{fmt(line.actualAmount)}</td>
                    <td
                      className={cn(
                        "py-2 text-end tabular-nums",
                        variance < 0 ? "text-red-500" : "text-emerald-600",
                      )}
                    >
                      {fmt(variance)}
                    </td>
                    <td className="py-2 text-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          setReceiptLineId(line.id);
                          setReceiptMonth(line.cashMonth);
                        }}
                      >
                        {t("budget.recordReceipt")}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {receiptLineId && (
        <div className="mt-4 grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 sm:grid-cols-2">
          <p className="sm:col-span-2 text-sm font-medium">{t("budget.receiptFormTitle")}</p>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{t("budget.receiptAmount")}</span>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
              value={receiptAmount}
              onChange={(e) => setReceiptAmount(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">{t("budget.cashMonth")}</span>
            <input
              type="month"
              className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2"
              value={receiptMonth}
              onChange={(e) => setReceiptMonth(e.target.value)}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-[var(--muted)]">{t("budget.receiptNote")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
              value={receiptNote}
              onChange={(e) => setReceiptNote(e.target.value)}
            />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="button" size="sm" disabled={loading || !receiptAmount} onClick={() => void submitReceipt()}>
              {t("budget.receiptSubmit")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setReceiptLineId(null)}>
              {t("confirm.cancel")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
