import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import type { Task } from "@nexus/shared";
import {
  formatGanttDate,
  ganttTaskType,
  GANTT_GRID_COL_COMPACT,
  GANTT_GRID_COL_FULL,
  ganttGridWidth,
  isParentTaskTitle,
  isSubtaskRow,
  taskHasAlert,
  taskPauseLabel,
  taskResumeDisplay,
  type GanttColLayout,
} from "@/lib/gantt-format";
import { normalizeProjectRole } from "@/lib/project-role";
import { GanttDateCell } from "./gantt-date-cell";
import { cn } from "@/lib/utils";

interface Props {
  task: Task;
  rowNum: number;
  roleCode: string;
  memberName: string;
  isLinkSource: boolean;
  isSelected: boolean;
  linkMode: boolean;
  locale: string;
  isRtl: boolean;
  parentTaskIds: ReadonlySet<string>;
  onRowClick: () => void;
  onPriorityChange: (checked: boolean) => void;
  showPriorityCheckbox: boolean;
  isPriority: boolean;
  compact?: boolean;
}

const cellBase =
  "flex shrink-0 items-center border-e border-slate-200/60 text-[11px] dark:border-slate-700/50";

export function GanttGridRow({
  task,
  rowNum,
  roleCode,
  memberName,
  isLinkSource,
  isSelected,
  linkMode,
  locale,
  isRtl,
  parentTaskIds,
  onRowClick,
  onPriorityChange,
  showPriorityCheckbox,
  isPriority,
  compact = false,
}: Props) {
  const { t } = useTranslation();
  const cols: GanttColLayout = compact ? GANTT_GRID_COL_COMPACT : GANTT_GRID_COL_FULL;
  const gridWidth = ganttGridWidth(cols);
  const type = ganttTaskType(task);
  const parentTitle = isParentTaskTitle(task, parentTaskIds);
  const subtask = isSubtaskRow(task);

  const typeTitle =
    type === "S"
      ? t("gantt.typeSummary")
      : type === "M"
        ? t("gantt.typeMilestone")
        : t("gantt.typeTask");

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={cn(
        "sticky start-0 z-20 flex shrink-0 border-e border-slate-200/70 transition-colors dark:border-slate-700/60",
        parentTitle
          ? "bg-slate-100/90 dark:bg-slate-800/55"
          : "bg-white/95 dark:bg-slate-900/40",
        isLinkSource && "ring-1 ring-inset ring-indigo-400/50",
        isSelected && !linkMode && "bg-indigo-50/70 dark:bg-indigo-950/25",
      )}
      style={{ width: gridWidth, height: "100%" }}
    >
      <div
        className={cn(cellBase, "justify-center text-slate-500")}
        style={{ width: cols.num }}
      >
        {rowNum}
      </div>
      <div
        className={cn(
          cellBase,
          "justify-center font-bold text-slate-600 dark:text-slate-300",
        )}
        style={{ width: cols.type }}
        title={typeTitle}
      >
        {type}
      </div>
      <button
        type="button"
        className={cn(
          "flex min-w-0 shrink-0 items-center gap-1.5 border-e border-slate-200/60 text-start transition-colors hover:bg-slate-100/80 dark:border-slate-700/50 dark:hover:bg-slate-800/50",
          parentTitle && "font-bold text-slate-900 dark:text-slate-100",
          subtask && "font-normal text-slate-600 dark:text-slate-400",
          !parentTitle && !subtask && "font-medium text-slate-800 dark:text-slate-200",
        )}
        style={{
          width: cols.name,
          paddingInlineStart: 8 + (task.wbs.split(".").length - 1) * (compact ? 10 : 14),
        }}
        onClick={onRowClick}
      >
        {showPriorityCheckbox && (
          <input
            type="checkbox"
            checked={isPriority}
            className="shrink-0 rounded border-slate-300"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onPriorityChange(e.target.checked)}
          />
        )}
        <span className="truncate">{task.name}</span>
        {isLinkSource && (
          <span className="shrink-0 text-indigo-500">{isRtl ? "←" : "→"}</span>
        )}
      </button>
      {!compact && (
        <div
          className={cn(cellBase, "justify-center font-mono text-[10px] font-semibold tracking-wide")}
          style={{ width: GANTT_GRID_COL_FULL.role }}
        >
          {roleCode || "—"}
        </div>
      )}
      <div
        className={cn(
          cellBase,
          "truncate px-1.5 text-slate-600 dark:text-slate-400",
          isRtl ? "text-end" : "text-start",
        )}
        style={{ width: cols.member }}
        title={memberName}
      >
        {memberName || "—"}
      </div>
      <div className={cn(cellBase, "justify-center")} style={{ width: cols.alert }}>
        {taskHasAlert(task) && (
          <AlertTriangle size={14} className="text-amber-500" aria-label={t("gantt.colAlert")} />
        )}
      </div>
      <div className={cn(cellBase, "justify-center font-medium")} style={{ width: cols.days }}>
        {task.isMilestone ? 0 : task.durationDays}
      </div>
      <GanttDateCell iso={task.startDate} locale={locale} isRtl={isRtl} width={cols.start} />
      <GanttDateCell iso={task.endDate} locale={locale} isRtl={isRtl} width={cols.end} />
      {!compact && (
        <>
          <div
            className={cn(
              cellBase,
              "justify-center text-[10px] font-semibold",
              task.status === "on_hold" && "text-amber-700 dark:text-amber-400",
            )}
            style={{ width: GANTT_GRID_COL_FULL.pause }}
            title={task.status === "on_hold" ? t("kanban.on_hold") : undefined}
          >
            {taskPauseLabel(task) || "—"}
          </div>
          <div
            className={cn(
              cellBase,
              "truncate px-1 text-[10px] tabular-nums",
              task.resumeDate && "font-medium text-amber-800 dark:text-amber-300",
              isRtl ? "text-end" : "text-start",
            )}
            style={{ width: GANTT_GRID_COL_FULL.resume }}
            title={taskResumeDisplay(task)}
          >
            {task.resumeDate ? formatGanttDate(task.resumeDate, locale) : "—"}
            {task.status === "on_hold" &&
              task.remainingWorkDays != null &&
              task.remainingWorkDays > 0 && (
                <span className="ms-0.5 text-[var(--muted)]">·{task.remainingWorkDays}</span>
              )}
          </div>
        </>
      )}
      <div
        className={cn(
          cellBase,
          "justify-center font-semibold text-indigo-600 dark:text-indigo-400",
        )}
        style={{ width: cols.percent }}
      >
        {task.percentComplete}%
      </div>
    </div>
  );
}

export function resolveTaskRole(
  task: Task,
  assignments: { taskId: string; resourceId: string }[],
  resourceRole: Record<string, string>,
): string {
  const resourceId =
    task.assigneeIds[0] ?? assignments.find((a) => a.taskId === task.id)?.resourceId;
  if (!resourceId) return "";
  const raw = resourceRole[resourceId];
  return raw ? normalizeProjectRole(raw) : "";
}

export function resolveTaskMember(
  task: Task,
  assignments: { taskId: string; resourceId: string }[],
  resourceNames: Record<string, string>,
): string {
  const resourceId =
    task.assigneeIds[0] ?? assignments.find((a) => a.taskId === task.id)?.resourceId;
  if (!resourceId) return "";
  return resourceNames[resourceId] ?? "";
}
