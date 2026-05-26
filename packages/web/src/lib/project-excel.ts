import * as XLSX from "xlsx";
import type {
  BudgetLineItem,
  DependencyType,
  Project,
  ScheduleConstraint,
  Task,
  TaskDependency,
  TaskStatus,
} from "@nexus/shared";
export interface ProjectExportPayload {
  project: Project;
  tasks: Task[];
  dependencies: TaskDependency[];
  exportedAt?: string;
}

const SHEET_TASKS = "Tasks";
const SHEET_DEPS = "Dependencies";
const SHEET_BUDGET = "BudgetLines";

const BUDGET_HEADERS = [
  "Name",
  "Category",
  "Cash Month",
  "Planned",
  "Actual",
  "Description",
] as const;

const TASK_HEADERS = [
  "WBS",
  "Parent WBS",
  "Name",
  "Status",
  "Start Date",
  "End Date",
  "Duration (days)",
  "% Complete",
  "Milestone",
  "Summary",
  "Priority",
  "Planned Cost",
  "Labor Planned",
  "Material Planned",
  "Other Planned",
  "Constraint",
  "Paused At",
  "Resume Date",
  "Remaining Work Days",
  "Sort Order",
] as const;

const DEP_HEADERS = ["Predecessor WBS", "Successor WBS", "Type", "Lag (days)"] as const;

function parentWbs(tasks: Task[], task: Task): string {
  if (!task.parentId) return "";
  return tasks.find((p) => p.id === task.parentId)?.wbs ?? "";
}

function boolCell(v: boolean): string {
  return v ? "Y" : "N";
}

function parseBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  return s === "y" || s === "yes" || s === "true" || s === "1" || s === "כן";
}

function parseNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseDateCell(v: unknown): string {
  if (v == null || v === "") return new Date().toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) {
      const dt = new Date(Date.UTC(d.y, d.m - 1, d.d));
      return dt.toISOString().slice(0, 10);
    }
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function parseStatus(v: unknown): TaskStatus {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "in_progress" || s === "בביצוע") return "in_progress";
  if (s === "completed" || s === "הושלם") return "completed";
  if (s === "on_hold" || s === "מושהה") return "on_hold";
  return "not_started";
}

function parseConstraint(v: unknown): ScheduleConstraint {
  const s = String(v ?? "ASAP").trim().toUpperCase();
  const allowed: ScheduleConstraint[] = [
    "ASAP",
    "ALAP",
    "MFO",
    "MSO",
    "SNET",
    "SNLT",
    "FNET",
    "FNLT",
  ];
  return allowed.includes(s as ScheduleConstraint) ? (s as ScheduleConstraint) : "ASAP";
}

function parseLinkType(v: unknown): DependencyType {
  const s = String(v ?? "FS").trim().toUpperCase();
  if (s === "SS" || s === "FF" || s === "SF") return s;
  return "FS";
}

function cell(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== "") return row[k];
  }
  const lower = Object.fromEntries(
    Object.entries(row).map(([key, val]) => [key.trim().toLowerCase(), val]),
  );
  for (const k of keys) {
    const v = lower[k.toLowerCase()];
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
}

export function exportProjectToExcel(
  payload: ProjectExportPayload,
  fileBaseName: string,
): void {
  const { tasks, dependencies } = payload;
  const taskRows = tasks.map((t) => ({
    [TASK_HEADERS[0]]: t.wbs,
    [TASK_HEADERS[1]]: parentWbs(tasks, t),
    [TASK_HEADERS[2]]: t.name,
    [TASK_HEADERS[3]]: t.status,
    [TASK_HEADERS[4]]: t.startDate,
    [TASK_HEADERS[5]]: t.endDate,
    [TASK_HEADERS[6]]: t.durationDays,
    [TASK_HEADERS[7]]: t.percentComplete,
    [TASK_HEADERS[8]]: boolCell(t.isMilestone),
    [TASK_HEADERS[9]]: boolCell(t.isSummary),
    [TASK_HEADERS[10]]: boolCell(t.isPriority),
    [TASK_HEADERS[11]]: t.plannedCost ?? "",
    [TASK_HEADERS[12]]: t.plannedLaborCost ?? "",
    [TASK_HEADERS[13]]: t.plannedMaterialCost ?? "",
    [TASK_HEADERS[14]]: t.plannedOtherCost ?? "",
    [TASK_HEADERS[15]]: t.constraint,
    [TASK_HEADERS[16]]: t.pausedAt ?? "",
    [TASK_HEADERS[17]]: t.resumeDate ?? "",
    [TASK_HEADERS[18]]: t.remainingWorkDays ?? "",
    [TASK_HEADERS[19]]: t.sortOrder,
  }));

  const depRows = dependencies.map((d) => {
    const pred = tasks.find((t) => t.id === d.predecessorId);
    const succ = tasks.find((t) => t.id === d.successorId);
    return {
      [DEP_HEADERS[0]]: pred?.wbs ?? d.predecessorId,
      [DEP_HEADERS[1]]: succ?.wbs ?? d.successorId,
      [DEP_HEADERS[2]]: d.type,
      [DEP_HEADERS[3]]: d.lagDays,
    };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(taskRows, { header: [...TASK_HEADERS] }), SHEET_TASKS);
  XLSX.utils.book_append_sheet(
    wb,
    depRows.length
      ? XLSX.utils.json_to_sheet(depRows, { header: [...DEP_HEADERS] })
      : XLSX.utils.aoa_to_sheet([Array.from(DEP_HEADERS)]),
    SHEET_DEPS,
  );

  const safeName = fileBaseName.replace(/[^\w\u0590-\u05FF.-]+/g, "_").slice(0, 80) || "project";
  XLSX.writeFile(wb, `${safeName}.xlsx`);
}

export function exportBudgetLinesToExcel(lines: BudgetLineItem[], fileBaseName: string): void {
  const rows = lines.map((l) => ({
    [BUDGET_HEADERS[0]]: l.name,
    [BUDGET_HEADERS[1]]: l.category,
    [BUDGET_HEADERS[2]]: l.cashMonth,
    [BUDGET_HEADERS[3]]: l.plannedAmount,
    [BUDGET_HEADERS[4]]: l.actualAmount,
    [BUDGET_HEADERS[5]]: l.description ?? "",
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    rows.length
      ? XLSX.utils.json_to_sheet(rows, { header: [...BUDGET_HEADERS] })
      : XLSX.utils.aoa_to_sheet([Array.from(BUDGET_HEADERS)]),
    SHEET_BUDGET,
  );
  const safeName = fileBaseName.replace(/[^\w\u0590-\u05FF.-]+/g, "_").slice(0, 80) || "budget";
  XLSX.writeFile(wb, `${safeName}-budget-lines.xlsx`);
}

export async function parseProjectExcel(
  file: File,
  projectId: string,
): Promise<{ tasks: Task[]; dependencies: TaskDependency[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });

  const tasksSheet =
    wb.Sheets[SHEET_TASKS] ??
    wb.Sheets[wb.SheetNames.find((n) => /task|משימ/i.test(n)) ?? ""] ??
    wb.Sheets[wb.SheetNames[0]];
  if (!tasksSheet) {
    throw new Error("EXCEL_NO_TASKS_SHEET");
  }

  const taskRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(tasksSheet, {
    defval: "",
  });
  if (taskRows.length === 0) {
    throw new Error("EXCEL_EMPTY_TASKS");
  }

  const wbsToId = new Map<string, string>();
  const tasks: Task[] = [];

  for (const row of taskRows) {
    const wbs = String(cell(row, "WBS", "wbs", "מספר") ?? "").trim();
    const name = String(cell(row, "Name", "name", "שם", "תיאור") ?? "").trim();
    if (!wbs && !name) continue;
    if (!wbs) throw new Error("EXCEL_MISSING_WBS");

    const id = crypto.randomUUID();
    wbsToId.set(wbs, id);

    const startDate = parseDateCell(cell(row, "Start Date", "startDate", "התחלה"));
    const durationDays = Math.max(1, parseNumber(cell(row, "Duration (days)", "durationDays", "ימים"), 1));
    const endRaw = cell(row, "End Date", "endDate", "סיום");
    const endDate = endRaw != null && endRaw !== "" ? parseDateCell(endRaw) : addDays(startDate, durationDays - 1);

    tasks.push({
      id,
      projectId,
      parentId: null,
      wbs,
      name: name || wbs,
      status: parseStatus(cell(row, "Status", "status", "סטטוס")),
      startDate,
      endDate,
      durationDays,
      percentComplete: Math.min(100, Math.max(0, parseNumber(cell(row, "% Complete", "percentComplete", "אחוז"), 0))),
      isMilestone: parseBool(cell(row, "Milestone", "isMilestone", "אבן דרך")),
      isSummary: parseBool(cell(row, "Summary", "isSummary", "סיכום")),
      manuallyScheduled: false,
      constraint: parseConstraint(cell(row, "Constraint", "constraint")),
      isCritical: false,
      assigneeIds: [],
      sortOrder: parseNumber(cell(row, "Sort Order", "sortOrder"), tasks.length),
      isPriority: parseBool(cell(row, "Priority", "isPriority", "עדיפות")),
      plannedCost: parseNumber(cell(row, "Planned Cost", "plannedCost"), 0) || undefined,
      plannedLaborCost:
        parseNumber(cell(row, "Labor Planned", "plannedLaborCost"), 0) || undefined,
      plannedMaterialCost:
        parseNumber(cell(row, "Material Planned", "plannedMaterialCost"), 0) || undefined,
      plannedOtherCost:
        parseNumber(cell(row, "Other Planned", "plannedOtherCost"), 0) || undefined,
      pausedAt: String(cell(row, "Paused At", "pausedAt") ?? "").trim() || undefined,
      resumeDate: String(cell(row, "Resume Date", "resumeDate") ?? "").trim() || undefined,
      remainingWorkDays: parseNumber(cell(row, "Remaining Work Days", "remainingWorkDays"), 0) || undefined,
    });
  }

  for (const row of taskRows) {
    const wbs = String(cell(row, "WBS", "wbs") ?? "").trim();
    const parent = String(cell(row, "Parent WBS", "parentWbs", "parentId", "הורה") ?? "").trim();
    if (!wbs || !parent) continue;
    const task = tasks.find((t) => t.wbs === wbs);
    const parentId = wbsToId.get(parent);
    if (task && parentId) task.parentId = parentId;
  }

  const depsSheet =
    wb.Sheets[SHEET_DEPS] ??
    wb.Sheets[wb.SheetNames.find((n) => /depend|קישור|link/i.test(n)) ?? ""];
  const dependencies: TaskDependency[] = [];

  if (depsSheet) {
    const depRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(depsSheet, { defval: "" });
    for (const row of depRows) {
      const predWbs = String(
        cell(row, "Predecessor WBS", "predecessorWbs", "predecessorId", "קודם") ?? "",
      ).trim();
      const succWbs = String(
        cell(row, "Successor WBS", "successorWbs", "successorId", "עוקב") ?? "",
      ).trim();
      if (!predWbs || !succWbs) continue;

      const predecessorId = wbsToId.get(predWbs);
      const successorId = wbsToId.get(succWbs);
      if (!predecessorId || !successorId) continue;

      dependencies.push({
        id: crypto.randomUUID(),
        projectId,
        predecessorId,
        successorId,
        type: parseLinkType(cell(row, "Type", "type", "סוג")),
        lagDays: parseNumber(cell(row, "Lag (days)", "lagDays", "השהייה"), 0),
      });
    }
  }

  return { tasks, dependencies };
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Legacy JSON export from older versions */
export function parseProjectJson(text: string): { tasks?: Task[]; dependencies?: TaskDependency[] } {
  return JSON.parse(text) as { tasks?: Task[]; dependencies?: TaskDependency[] };
}
