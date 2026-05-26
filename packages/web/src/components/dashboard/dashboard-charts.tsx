import { cn } from "@/lib/utils";

export interface ChartSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: ChartSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSub?: string;
  className?: string;
}

export function DonutChart({
  segments,
  size = 160,
  strokeWidth = 22,
  centerLabel,
  centerSub,
  className,
}: DonutChartProps) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - strokeWidth) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className={cn("relative inline-flex", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
          opacity={0.35}
        />
        {segments.map((seg, i) => {
          const len = (seg.value / total) * circ;
          const dash = `${len} ${circ - len}`;
          const el = (
            <circle
              key={i}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      {(centerLabel || centerSub) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {centerLabel && (
            <span className="text-2xl font-bold tabular-nums tracking-tight">{centerLabel}</span>
          )}
          {centerSub && <span className="text-[10px] text-[var(--muted)]">{centerSub}</span>}
        </div>
      )}
    </div>
  );
}

export interface BarChartItem {
  id: string;
  label: string;
  value: number;
  subLabel?: string;
  color?: string;
}

interface VerticalBarChartProps {
  items: BarChartItem[];
  maxValue?: number;
  height?: number;
  barClassName?: string;
  showValues?: boolean;
  className?: string;
}

export function VerticalBarChart({
  items,
  maxValue,
  height = 140,
  barClassName,
  showValues = true,
  className,
}: VerticalBarChartProps) {
  const max = maxValue ?? Math.max(...items.map((i) => i.value), 1);

  return (
    <div className={cn("flex items-end justify-between gap-2", className)} style={{ height }}>
      {items.map((item) => {
        const pct = Math.max(4, (item.value / max) * 100);
        return (
          <div
            key={item.id}
            className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
            title={`${item.label}: ${item.value}`}
          >
            {showValues && (
              <span className="text-[10px] font-medium tabular-nums text-[var(--muted)]">
                {item.value}
              </span>
            )}
            <div
              className="w-full max-w-[48px] overflow-hidden rounded-t-lg bg-[var(--border)]/40"
              style={{ height: `${height - 36}px` }}
            >
              <div
                className={cn(
                  "w-full rounded-t-lg transition-all duration-700 ease-out",
                  barClassName,
                )}
                style={{
                  height: `${pct}%`,
                  background: item.color ?? "var(--accent)",
                }}
              />
            </div>
            <span className="max-w-full truncate text-center text-[10px] text-[var(--muted)]">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface GroupedBarItem {
  id: string;
  label: string;
  planned: number;
  actual: number;
}

interface GroupedBudgetChartProps {
  items: GroupedBarItem[];
  formatValue: (n: number) => string;
  legendPlanned: string;
  legendActual: string;
  height?: number;
  className?: string;
}

export function GroupedBudgetChart({
  items,
  formatValue,
  legendPlanned,
  legendActual,
  height = 160,
  className,
}: GroupedBudgetChartProps) {
  const max = Math.max(...items.flatMap((i) => [i.planned, i.actual]), 1);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-end justify-between gap-3" style={{ height }}>
        {items.map((item) => {
          const pH = Math.max(6, (item.planned / max) * (height - 40));
          const aH = Math.max(6, (item.actual / max) * (height - 40));
          return (
            <div key={item.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex items-end gap-0.5" style={{ height: height - 28 }}>
                <div
                  className="w-3 rounded-t bg-indigo-500/80 sm:w-4"
                  style={{ height: pH }}
                  title={formatValue(item.planned)}
                />
                <div
                  className="w-3 rounded-t bg-violet-500 sm:w-4"
                  style={{ height: aH }}
                  title={formatValue(item.actual)}
                />
              </div>
              <span className="max-w-full truncate text-center text-[10px] text-[var(--muted)]">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center gap-4 text-[10px] text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500/80" />
          {legendPlanned}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-violet-500" />
          {legendActual}
        </span>
      </div>
    </div>
  );
}

interface DualMetricChartProps {
  items: { id: string; label: string; cpi: number; spi: number }[];
  height?: number;
  className?: string;
}

export function DualMetricChart({ items, height = 120, className }: DualMetricChartProps) {
  const max = 1.5;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-end justify-between gap-2" style={{ height }}>
        {items.map((item) => {
          const cH = Math.min(100, Math.max(8, (item.cpi / max) * 100));
          const sH = Math.min(100, Math.max(8, (item.spi / max) * 100));
          return (
            <div key={item.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex items-end gap-0.5" style={{ height: height - 24 }}>
                <div
                  className="w-2.5 rounded-t bg-emerald-500/90 sm:w-3"
                  style={{ height: `${cH}%` }}
                  title={`CPI ${item.cpi}`}
                />
                <div
                  className="w-2.5 rounded-t bg-sky-500/90 sm:w-3"
                  style={{ height: `${sH}%` }}
                  title={`SPI ${item.spi}`}
                />
              </div>
              <span className="max-w-full truncate text-[9px] text-[var(--muted)]">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center gap-4 text-[10px] text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-emerald-500" />
          CPI
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-sky-500" />
          SPI
        </span>
      </div>
    </div>
  );
}

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  className?: string;
}

export type ScheduleOutlook = "on_time" | "at_risk" | "delayed" | "severe";

const OUTLOOK_BAR: Record<ScheduleOutlook, string> = {
  on_time: "#22c55e",
  at_risk: "#f59e0b",
  delayed: "#f97316",
  severe: "#ef4444",
};

export interface ScheduleBarRow {
  id: string;
  label: string;
  outlook: ScheduleOutlook;
  delayDays: number;
  scheduleVarianceDays: number;
}

interface ProjectScheduleOutlookChartProps {
  rows: ScheduleBarRow[];
  onTimeLabel: string;
  formatDelay: (days: number) => string;
  className?: string;
}

export function ProjectScheduleOutlookChart({
  rows,
  onTimeLabel,
  formatDelay,
  className,
}: ProjectScheduleOutlookChartProps) {
  const maxDelay = Math.max(...rows.map((r) => r.delayDays), 1);

  return (
    <div className={cn("space-y-2.5", className)}>
      {rows.map((row) => {
        const delayPct =
          row.delayDays > 0
            ? Math.min(92, 12 + (row.delayDays / maxDelay) * 80)
            : row.outlook === "at_risk"
              ? 22
              : 0;
        const onPct = 100 - delayPct;
        return (
          <div key={row.id} className="group">
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate font-medium">{row.label}</span>
              <span className="shrink-0 tabular-nums text-[var(--muted)]">
                {row.delayDays > 0 ? (
                  <span className="font-semibold text-red-600">
                    {formatDelay(row.delayDays)}
                  </span>
                ) : (
                  <span className="text-emerald-600">{onTimeLabel}</span>
                )}
              </span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-[var(--border)]/50">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${onPct}%`,
                  background: OUTLOOK_BAR[row.outlook === "at_risk" ? "at_risk" : "on_time"],
                }}
                title={onTimeLabel}
              />
              {delayPct > 0 && (
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${delayPct}%`,
                    background: OUTLOOK_BAR[row.outlook === "severe" ? "severe" : "delayed"],
                  }}
                  title={`+${row.delayDays}d`}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Sparkline({
  values,
  width = 120,
  height = 36,
  stroke = "var(--accent)",
  className,
}: SparklineProps) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const pts = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * w;
      const y = pad + h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className={className}>
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
      <polyline
        fill="url(#spark-fill)"
        stroke="none"
        points={`${pad},${height - pad} ${pts} ${width - pad},${height - pad}`}
        opacity={0.15}
      />
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
    </svg>
  );
}
