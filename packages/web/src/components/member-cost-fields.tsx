import { useTranslation } from "react-i18next";
import type { MemberCostMode } from "@/lib/member-cost";
import { cn } from "@/lib/utils";

interface Props {
  mode: MemberCostMode;
  amount: number;
  onModeChange: (mode: MemberCostMode) => void;
  onAmountChange: (amount: number) => void;
  compact?: boolean;
  className?: string;
}

export function MemberCostFields({
  mode,
  amount,
  onModeChange,
  onAmountChange,
  compact = false,
  className,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs text-[var(--muted)]">{t("team.costType")}</p>
      <div className="flex gap-2">
        {(["hourly", "global"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onModeChange(id)}
            className={cn(
              "flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
              mode === id
                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]",
            )}
          >
            {id === "hourly" ? t("team.costHourly") : t("team.costGlobal")}
          </button>
        ))}
      </div>
      <label className={cn("block", compact ? "text-xs" : "text-sm")}>
        <span className="text-[var(--muted)]">
          {mode === "hourly" ? t("team.costPerHour") : t("team.costGlobalAmount")}
        </span>
        <input
          type="number"
          min={0}
          step={mode === "hourly" ? 1 : 100}
          className={cn(
            "mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)]",
            compact ? "px-2 py-2 text-sm" : "px-3 py-2.5",
          )}
          value={amount}
          onChange={(e) => onAmountChange(Number(e.target.value))}
        />
      </label>
    </div>
  );
}
