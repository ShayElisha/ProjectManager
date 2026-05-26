import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Task } from "@nexus/shared";
import { pauseBarSegments, taskTimelineEnd } from "@/lib/task-pause";
import { useAppStore } from "@/store/app-store";
import { useVirtualList } from "@/hooks/use-virtual-list";
import { cn } from "@/lib/utils";
import { daysBetween } from "@/lib/dependency-anchors";
import { computeGanttLinkPaths, LINK_STYLE } from "@/lib/gantt-link-path";
import { confirmAction } from "@/lib/confirm";
import { GanttToolbar, type PriorityFilter } from "./gantt-toolbar";
import { TaskDetailDrawer } from "@/components/task-detail-drawer";
import { GanttGridHeader } from "./gantt-grid-header";
import {
  GanttGridRow,
  resolveTaskMember,
  resolveTaskRole,
} from "./gantt-grid-row";
import {
  formatGanttMonth,
  ganttDayLabel,
  GANTT_GRID_COL_COMPACT,
  GANTT_GRID_COL_FULL,
  ganttGridWidth,
} from "@/lib/gantt-format";
import { useIsTablet } from "@/hooks/use-media-query";

const DAY_WIDTH = 28;
const ROW_HEIGHT = 32;
const OVERSCAN = 12;
const MONTH_ROW_HEIGHT = 22;
const DAY_ROW_HEIGHT = 20;
const TIMELINE_HEADER_HEIGHT = MONTH_ROW_HEIGHT + DAY_ROW_HEIGHT;

interface MonthColumn {
  key: string;
  label: string;
  dayCount: number;
}

interface DayColumn {
  key: string;
  label: string;
  isMonthStart: boolean;
}

function buildTimelineColumns(
  rangeStart: string,
  totalDays: number,
  locale: string,
): { monthColumns: MonthColumn[]; dayColumns: DayColumn[] } {
  const months: MonthColumn[] = [];
  const days: DayColumn[] = [];

  for (let i = 0; i < totalDays; i++) {
    const dateStr = addDays(rangeStart, i);
    const d = new Date(`${dateStr}T12:00:00`);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    days.push({
      key: dateStr,
      label: ganttDayLabel(dateStr, locale),
      isMonthStart: d.getDate() === 1,
    });

    const last = months[months.length - 1];
    if (!last || last.key !== monthKey) {
      months.push({
        key: monthKey,
        label: formatGanttMonth(dateStr, locale),
        dayCount: 1,
      });
    } else {
      last.dayCount += 1;
    }
  }

  return { monthColumns: months, dayColumns: days };
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function toX(dayOffset: number, isRtl: boolean, timelineWidth: number): number {
  const x = dayOffset * DAY_WIDTH;
  return isRtl ? timelineWidth - x : x;
}

type DragMode = "move" | "resize";

interface DragState {
  taskId: string;
  mode: DragMode;
  startX: number;
  origStart: string;
  origDuration: number;
}

const LINK_TYPES = ["FS", "SS", "FF", "SF"] as const;

export function GanttChart() {
  const { t } = useTranslation();
  const tasks = useAppStore((s) => s.tasks);
  const dependencies = useAppStore((s) => s.dependencies);
  const locale = useAppStore((s) => s.locale);
  const linkMode = useAppStore((s) => s.linkMode);
  const linkSourceId = useAppStore((s) => s.linkSourceId);
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
  const updateTask = useAppStore((s) => s.updateTask);
  const handleLinkClick = useAppStore((s) => s.handleLinkClick);
  const removeDependency = useAppStore((s) => s.removeDependency);
  const recalculate = useAppStore((s) => s.recalculate);
  const setSelectedTaskId = useAppStore((s) => s.setSelectedTaskId);
  const members = useAppStore((s) => s.members);
  const assignments = useAppStore((s) => s.assignments);
  const resourceNames = useAppStore((s) => s.resourceNames);
  const isRtl = locale === "he";
  const isTablet = useIsTablet();
  const gridCompact = isTablet;
  const gridWidth = ganttGridWidth(
    gridCompact ? GANTT_GRID_COL_COMPACT : GANTT_GRID_COL_FULL,
  );

  const resourceRole = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of members) {
      map[m.resourceId] = m.role;
    }
    return map;
  }, [members]);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [showBaseline, setShowBaseline] = useState(false);
  const [preview, setPreview] = useState<{ taskId: string; start: string; duration: number } | null>(
    null,
  );

  const filteredTasks = useMemo(() => {
    if (priorityFilter === "priority") return tasks.filter((t) => t.isPriority);
    if (priorityFilter === "non_priority") return tasks.filter((t) => !t.isPriority);
    return tasks;
  }, [tasks, priorityFilter]);

  const parentTaskIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of filteredTasks) {
      if (t.parentId) ids.add(t.parentId);
    }
    return ids;
  }, [filteredTasks]);

  const visibleTaskIds = useMemo(
    () => new Set(filteredTasks.map((t) => t.id)),
    [filteredTasks],
  );

  const filteredDependencies = useMemo(
    () =>
      dependencies.filter(
        (d) => visibleTaskIds.has(d.predecessorId) && visibleTaskIds.has(d.successorId),
      ),
    [dependencies, visibleTaskIds],
  );

  const { start, end, offsetY, totalHeight } = useVirtualList(
    filteredTasks.length,
    ROW_HEIGHT,
    scrollRef,
    OVERSCAN,
  );

  const visibleTasks = useMemo(
    () => filteredTasks.slice(start, end),
    [filteredTasks, start, end],
  );

  const taskIndex = useMemo(
    () => new Map(filteredTasks.map((t, i) => [t.id, i])),
    [filteredTasks],
  );

  const { rangeStart, totalDays, monthColumns, dayColumns } = useMemo(() => {
    const empty = {
      rangeStart: "2026-05-01",
      totalDays: 60,
      monthColumns: [] as MonthColumn[],
      dayColumns: [] as DayColumn[],
    };
    if (filteredTasks.length === 0) {
      const built = buildTimelineColumns(empty.rangeStart, empty.totalDays, locale);
      return { ...empty, ...built };
    }
    const starts = filteredTasks.map((t) => new Date(t.startDate).getTime());
    const ends = filteredTasks.map((t) => new Date(taskTimelineEnd(t)).getTime());
    const min = new Date(Math.min(...starts)).toISOString().slice(0, 10);
    const max = new Date(Math.max(...ends)).toISOString().slice(0, 10);
    const total = daysBetween(min, max) + 14;
    const built = buildTimelineColumns(min, total, locale);
    return { rangeStart: min, totalDays: total, ...built };
  }, [filteredTasks, locale]);

  const timelineWidth = totalDays * DAY_WIDTH;
  const todayDayIndex = daysBetween(rangeStart, todayIso);
  const showTodayColumn = todayDayIndex >= 0 && todayDayIndex < totalDays;

  const displayTask = useCallback(
    (task: Task) => {
      if (preview?.taskId === task.id) {
        return {
          ...task,
          startDate: preview.start,
          endDate: addDays(preview.start, preview.duration - 1),
          durationDays: preview.duration,
        };
      }
      return task;
    },
    [preview],
  );

  const barStyleForRange = (start: string, end: string): React.CSSProperties => {
    const offset = daysBetween(rangeStart, start) * DAY_WIDTH;
    const days = daysBetween(start, end) + 1;
    const width = Math.max(days * DAY_WIDTH, 8);
    return { insetInlineStart: offset, width };
  };

  const commitDrag = useCallback(
    async (state: DragState, dayDelta: number) => {
      const task = filteredTasks.find((t) => t.id === state.taskId);
      if (!task || task.isSummary) return;

      if (state.mode === "move") {
        const newStart = addDays(state.origStart, dayDelta);
        await updateTask(state.taskId, {
          startDate: newStart,
          endDate: addDays(newStart, state.origDuration - 1),
          manuallyScheduled: true,
        });
      } else {
        const newDuration = Math.max(1, state.origDuration + dayDelta);
        await updateTask(state.taskId, {
          durationDays: newDuration,
          endDate: addDays(state.origStart, newDuration - 1),
          manuallyScheduled: true,
        });
      }
    },
    [filteredTasks, updateTask],
  );

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const deltaPx = e.clientX - drag.startX;
      const dayDelta = isRtl ? -Math.round(deltaPx / DAY_WIDTH) : Math.round(deltaPx / DAY_WIDTH);
      if (drag.mode === "move") {
        setPreview({
          taskId: drag.taskId,
          start: addDays(drag.origStart, dayDelta),
          duration: drag.origDuration,
        });
      } else {
        setPreview({
          taskId: drag.taskId,
          start: drag.origStart,
          duration: Math.max(1, drag.origDuration + dayDelta),
        });
      }
    };
    const onUp = (e: MouseEvent) => {
      const deltaPx = e.clientX - drag.startX;
      const dayDelta = isRtl ? -Math.round(deltaPx / DAY_WIDTH) : Math.round(deltaPx / DAY_WIDTH);
      void commitDrag(drag, dayDelta);
      setDrag(null);
      setPreview(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [drag, isRtl, commitDrag]);

  const dayToX = useCallback(
    (day: number) => toX(day, isRtl, timelineWidth),
    [isRtl, timelineWidth],
  );

  const taskName = useCallback(
    (id: string) => filteredTasks.find((t) => t.id === id)?.name ?? id.slice(0, 8),
    [filteredTasks],
  );

  const dependencyPaths = useMemo(
    () =>
      computeGanttLinkPaths({
        dependencies: filteredDependencies,
        tasks: filteredTasks,
        taskIndex,
        rangeStart,
        toX: dayToX,
        displayTask,
        taskName,
        yOffset: TIMELINE_HEADER_HEIGHT,
      }),
    [
      filteredDependencies,
      filteredTasks,
      taskIndex,
      rangeStart,
      dayToX,
      displayTask,
      taskName,
    ],
  );

  const deleteLink = useCallback(
    async (depId: string, label: string) => {
      const ok = await confirmAction({
        title: t("confirm.deleteLinkTitle"),
        message: t("confirm.deleteLinkMessage", { label }),
        confirmLabel: t("confirm.confirmDelete"),
        destructive: true,
      });
      if (!ok) return;
      await removeDependency(depId);
      setHoveredLinkId(null);
      await recalculate();
    },
    [t, removeDependency, recalculate],
  );

  const onTaskRowClick = (taskId: string, isSummary: boolean) => {
    if (linkMode) {
      void handleLinkClick(taskId);
      return;
    }
    if (!isSummary) setSelectedTaskId(taskId);
  };

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50"
    >
      <GanttToolbar
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        linkCount={filteredDependencies.length}
        showBaseline={showBaseline}
        onShowBaselineChange={setShowBaseline}
      />
      <div
        ref={scrollRef}
        dir={isRtl ? "rtl" : "ltr"}
        className="min-h-0 flex-1 overflow-auto"
      >
        <div
          className="relative"
          style={{ minWidth: gridWidth + timelineWidth, minHeight: totalHeight }}
        >
          <div className="sticky top-0 z-20 flex border-b border-slate-200/80 dark:border-slate-700/70">
            <GanttGridHeader height={TIMELINE_HEADER_HEIGHT} isRtl={isRtl} compact={gridCompact} />
            <div
              dir={isRtl ? "rtl" : "ltr"}
              className="flex shrink-0 flex-col bg-gradient-to-b from-slate-800 to-slate-900 text-white shadow-sm"
              style={{ width: timelineWidth }}
            >
              <div
                className="flex flex-row border-b border-white/10"
                style={{ height: MONTH_ROW_HEIGHT }}
              >
                {monthColumns.map((col) => (
                  <div
                    key={col.key}
                    dir={isRtl ? "rtl" : "ltr"}
                    className={cn(
                      "flex shrink-0 items-center border-white/10 px-1 text-[10px] font-medium tracking-wide text-white/90",
                      isRtl ? "justify-center text-center" : "justify-center text-center",
                    )}
                    style={{ width: col.dayCount * DAY_WIDTH, borderInlineEndWidth: 1 }}
                  >
                    {col.label}
                  </div>
                ))}
              </div>
              <div className="flex flex-row" style={{ height: DAY_ROW_HEIGHT }}>
                {dayColumns.map((col) => (
                  <div
                    key={col.key}
                    dir={isRtl ? "rtl" : "ltr"}
                    className={cn(
                      "flex shrink-0 items-center justify-center border-white/10 text-[10px] text-white/75",
                      showTodayColumn && col.key === todayIso && "bg-emerald-500/90 font-bold text-white",
                    )}
                    style={{ width: DAY_WIDTH, borderInlineEndWidth: 1 }}
                    title={col.key}
                  >
                    {col.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <svg
            className="absolute z-10 overflow-visible"
            style={{
              top: TIMELINE_HEADER_HEIGHT,
              insetInlineStart: gridWidth,
              width: timelineWidth,
              height: totalHeight,
              pointerEvents: linkMode ? "none" : "auto",
            }}
            width={timelineWidth}
            height={totalHeight}
          >
            <defs>
              <filter id="gantt-link-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {LINK_TYPES.map((type) => {
                const s = LINK_STYLE[type];
                return (
                  <linearGradient
                    key={type}
                    id={`gantt-grad-${type}`}
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor={s.gradient[0]} />
                    <stop offset="100%" stopColor={s.gradient[1]} />
                  </linearGradient>
                );
              })}
              {LINK_TYPES.map((type) => (
                <marker
                  key={type}
                  id={`gantt-arrow-${type}`}
                  viewBox="0 0 10 10"
                  markerWidth="7"
                  markerHeight="7"
                  refX="9"
                  refY="5"
                  orient="auto"
                >
                  <path
                    d="M 0 1 L 9 5 L 0 9 Z"
                    fill={LINK_STYLE[type].gradient[1]}
                    stroke="none"
                  />
                </marker>
              ))}
            </defs>
            {dependencyPaths.map((p) => {
              const active = hoveredLinkId === p.depId;
              const style = LINK_STYLE[p.type];
              return (
                <g
                  key={p.depId}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredLinkId(p.depId)}
                  onMouseLeave={() => setHoveredLinkId((id) => (id === p.depId ? null : id))}
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteLink(p.depId, p.label);
                  }}
                >
                  <title>{p.label}{"\n"}{t("gantt.clickToDelete")}</title>
                  <path
                    d={p.hitD}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={14}
                    strokeLinecap="round"
                  />
                  <path
                    d={p.d}
                    fill="none"
                    stroke={`url(#gantt-grad-${p.type})`}
                    strokeWidth={active ? 3 : 2}
                    strokeLinecap="round"
                    strokeDasharray={p.type === "FS" ? undefined : "7 5"}
                    markerEnd={`url(#gantt-arrow-${p.type})`}
                    filter={active ? "url(#gantt-link-glow)" : undefined}
                    opacity={active ? 1 : 0.88}
                    style={{ transition: "stroke-width 0.15s ease" }}
                  />
                  <circle
                    cx={p.x1}
                    cy={p.y1}
                    r={active ? 5 : 4}
                    fill={style.gradient[0]}
                    stroke="white"
                    strokeWidth={1.5}
                    opacity={0.95}
                  />
                  {active && (
                    <g transform={`translate(${(p.x1 + p.x2) / 2 - 18}, ${(p.y1 + p.y2) / 2 - 10})`}>
                      <rect
                        x={0}
                        y={0}
                        width={36}
                        height={18}
                        rx={6}
                        fill="rgba(15,23,42,0.92)"
                      />
                      <text
                        x={18}
                        y={12}
                        textAnchor="middle"
                        fill="white"
                        fontSize={9}
                        fontWeight={600}
                      >
                        {p.type}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          <div
            style={{
              position: "relative",
              top: offsetY,
            }}
          >
            {visibleTasks.map((rawTask, visIdx) => {
              const task = displayTask(rawTask);
              const isLinkSource = linkSourceId === task.id;
              const isSelected = selectedTaskId === task.id;
              const rowNum = start + visIdx + 1;
              const roleCode = resolveTaskRole(task, assignments, resourceRole);
              const memberName = resolveTaskMember(task, assignments, resourceNames);
              const barSegments = pauseBarSegments(task);
              const milestoneX = daysBetween(rangeStart, task.startDate) * DAY_WIDTH + DAY_WIDTH / 2;

              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex border-b border-slate-200/50 dark:border-slate-800/60",
                    (task.isSummary || parentTaskIds.has(task.id)) &&
                      "bg-slate-50/80 dark:bg-slate-800/30",
                  )}
                  style={{ height: ROW_HEIGHT }}
                >
                  <GanttGridRow
                    task={task}
                    rowNum={rowNum}
                    roleCode={roleCode}
                    memberName={memberName}
                    isLinkSource={isLinkSource}
                    isSelected={isSelected}
                    linkMode={linkMode}
                    locale={locale}
                    isRtl={isRtl}
                    parentTaskIds={parentTaskIds}
                    onRowClick={() => onTaskRowClick(task.id, task.isSummary)}
                    onPriorityChange={(checked) =>
                      void updateTask(rawTask.id, { isPriority: checked })
                    }
                    showPriorityCheckbox={!task.isSummary}
                    isPriority={rawTask.isPriority ?? false}
                    compact={gridCompact}
                  />
                  <div
                    dir={isRtl ? "rtl" : "ltr"}
                    className="relative shrink-0 bg-white/50 dark:bg-slate-900/20"
                    style={{ width: timelineWidth }}
                  >
                    <div className="pointer-events-none absolute inset-0 flex flex-row">
                      {dayColumns.map((col) => (
                        <div
                          key={col.key}
                          className="shrink-0 border-e border-slate-200/40 dark:border-slate-700/40"
                          style={{ width: DAY_WIDTH }}
                        />
                      ))}
                    </div>
                    {showTodayColumn && (
                      <div
                        className="pointer-events-none absolute top-0 bottom-0 z-[5] bg-emerald-400/25 ring-1 ring-inset ring-emerald-500/30"
                        style={{
                          width: DAY_WIDTH,
                          insetInlineStart: todayDayIndex * DAY_WIDTH,
                        }}
                      />
                    )}
                    {task.isMilestone ? (
                      <div
                        className="absolute top-1/2 z-[15] -translate-y-1/2 -translate-x-1/2"
                        style={{ insetInlineStart: milestoneX - DAY_WIDTH / 2 }}
                      >
                        <span
                          className={cn(
                            "block h-3.5 w-3.5 rotate-45 rounded-[1px] border border-slate-600 bg-slate-500 shadow-md",
                            linkMode && !task.isSummary && "cursor-pointer",
                          )}
                          onClick={(e) => {
                            if (!linkMode) return;
                            e.stopPropagation();
                            void handleLinkClick(task.id);
                          }}
                        />
                      </div>
                    ) : (
                      <>
                        {showBaseline &&
                          rawTask.baselineStart &&
                          rawTask.baselineFinish && (
                            <div
                              className="absolute top-1/2 z-[10] h-2 -translate-y-1/2 rounded-full bg-slate-400/50 dark:bg-slate-500/40"
                              style={barStyleForRange(
                                rawTask.baselineStart,
                                rawTask.baselineFinish,
                              )}
                            />
                          )}
                        {barSegments.map((seg, segIdx) => (
                          <div
                            key={`${task.id}-${segIdx}`}
                            className={cn(
                              "absolute top-1/2 z-[15] -translate-y-1/2 rounded-full shadow-sm",
                              task.isSummary
                                ? "h-2.5 bg-slate-500/90"
                                : seg.kind === "planned"
                                  ? "h-2 border border-dashed border-amber-600/70 bg-amber-400/75 dark:bg-amber-500/60"
                                  : "h-2 bg-indigo-400/85 dark:bg-indigo-500/80",
                              !task.isSummary &&
                                !linkMode &&
                                seg.kind === "worked" &&
                                "cursor-grab active:cursor-grabbing",
                              linkMode &&
                                !task.isSummary &&
                                "cursor-pointer ring-1 ring-white/40",
                              drag?.taskId === task.id &&
                                seg.kind === "worked" &&
                                "ring-2 ring-indigo-300/80",
                              task.isCritical && seg.kind === "worked" && "ring-2 ring-red-400/70",
                            )}
                            style={barStyleForRange(seg.start, seg.end)}
                            onMouseDown={(e) => {
                              if (task.isSummary || linkMode || seg.kind !== "worked") return;
                              e.preventDefault();
                              setDrag({
                                taskId: task.id,
                                mode: "move",
                                startX: e.clientX,
                                origStart: rawTask.startDate,
                                origDuration: rawTask.durationDays,
                              });
                            }}
                            onClick={(e) => {
                              if (!linkMode) return;
                              e.stopPropagation();
                              void handleLinkClick(task.id);
                            }}
                          >
                            {!task.isSummary && !linkMode && seg.kind === "worked" && (
                              <span
                                className="absolute top-0 bottom-0 end-0 w-1.5 cursor-ew-resize"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setDrag({
                                    taskId: task.id,
                                    mode: "resize",
                                    startX: e.clientX,
                                    origStart: rawTask.startDate,
                                    origDuration: rawTask.durationDays,
                                  });
                                }}
                              />
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <TaskDetailDrawer
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />
    </div>
  );
}
