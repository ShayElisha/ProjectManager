import { useTranslation } from "react-i18next";
import {
  GANTT_GRID_COL_COMPACT,
  GANTT_GRID_COL_FULL,
  ganttGridWidth,
  type GanttColLayout,
} from "@/lib/gantt-format";
import { cn } from "@/lib/utils";

const cell = (isRtl: boolean) =>
  cn(
    "flex shrink-0 items-center border-e border-white/10 px-1 text-[10px] font-semibold tracking-wide text-white/90",
    isRtl ? "justify-center" : "justify-center",
  );

interface Props {
  height: number;
  isRtl: boolean;
  compact?: boolean;
}

export function GanttGridHeader({ height, isRtl, compact = false }: Props) {
  const { t } = useTranslation();
  const cols: GanttColLayout = compact ? GANTT_GRID_COL_COMPACT : GANTT_GRID_COL_FULL;
  const gridWidth = ganttGridWidth(cols);

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="sticky start-0 z-30 flex shrink-0 border-e border-slate-200/80 bg-gradient-to-b from-slate-800 to-slate-900 shadow-sm dark:border-slate-700"
      style={{ width: gridWidth, minHeight: height }}
    >
      <div className={cell(isRtl)} style={{ width: cols.num }}>
        {t("gantt.colNum")}
      </div>
      <div className={cell(isRtl)} style={{ width: cols.type }}>
        {t("gantt.colType")}
      </div>
      <div
        className={cn(
          "flex shrink-0 items-center border-e border-white/10 px-2 text-[10px] font-semibold text-white/90",
          isRtl ? "justify-end text-end" : "justify-start text-start",
        )}
        style={{ width: cols.name }}
      >
        {t("gantt.colDesc")}
      </div>
      {!compact && (
        <div className={cell(isRtl)} style={{ width: GANTT_GRID_COL_FULL.role }}>
          {t("gantt.colRole")}
        </div>
      )}
      <div
        className={cn(
          "flex shrink-0 items-center border-e border-white/10 px-2 text-[10px] font-semibold text-white/90",
          isRtl ? "justify-end text-end" : "justify-start text-start",
        )}
        style={{ width: cols.member }}
      >
        {t("gantt.colMember")}
      </div>
      <div className={cell(isRtl)} style={{ width: cols.alert }} title={t("gantt.colAlert")} />
      <div className={cell(isRtl)} style={{ width: cols.days }}>
        {t("gantt.colDays")}
      </div>
      <div className={cell(isRtl)} style={{ width: cols.start }}>
        {t("gantt.colStart")}
      </div>
      <div className={cell(isRtl)} style={{ width: cols.end }}>
        {t("gantt.colEnd")}
      </div>
      {!compact && (
        <>
          <div
            className={cell(isRtl)}
            style={{ width: GANTT_GRID_COL_FULL.pause }}
            title={t("gantt.colPause")}
          >
            {t("gantt.colPause")}
          </div>
          <div className={cell(isRtl)} style={{ width: GANTT_GRID_COL_FULL.resume }}>
            {t("gantt.colResume")}
          </div>
        </>
      )}
      <div className={cell(isRtl)} style={{ width: cols.percent }}>
        %
      </div>
    </div>
  );
}
