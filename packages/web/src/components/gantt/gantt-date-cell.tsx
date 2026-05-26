import { formatGanttDate } from "@/lib/gantt-format";
import { cn } from "@/lib/utils";

interface Props {
  iso: string;
  locale: string;
  isRtl: boolean;
  width: number;
  className?: string;
}

export function GanttDateCell({ iso, locale, isRtl, width, className }: Props) {
  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={cn(
        "flex shrink-0 items-center border-e border-slate-200/70 px-1 text-[10px] tabular-nums dark:border-slate-700/60",
        isRtl ? "justify-end text-end" : "justify-start text-start",
        className,
      )}
      style={{ width }}
    >
      <span className="whitespace-nowrap">{formatGanttDate(iso, locale)}</span>
    </div>
  );
}
