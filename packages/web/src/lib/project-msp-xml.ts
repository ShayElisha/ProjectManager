import type { Task, TaskDependency } from "@nexus/shared";

const newId = () => crypto.randomUUID();

/** Parses Microsoft Project XML (File → Save As → XML). */
export function parseMspXml(xml: string, projectId: string): {
  tasks: Task[];
  dependencies: TaskDependency[];
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Invalid XML");
  }

  const taskEls = Array.from(doc.querySelectorAll("Task")).filter((el) => {
    const uid = el.querySelector("UID")?.textContent;
    return uid && uid !== "0";
  });

  const uidToId = new Map<string, string>();
  const tasks: Task[] = [];
  let order = 0;

  for (const el of taskEls) {
    const uid = el.querySelector("UID")?.textContent ?? String(order);
    const id = newId();
    uidToId.set(uid, id);
    const name = el.querySelector("Name")?.textContent?.trim() || `Task ${order + 1}`;
    const start = (el.querySelector("Start")?.textContent ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10);
    const finish = (el.querySelector("Finish")?.textContent ?? "").slice(0, 10) || start;
    const durationRaw = el.querySelector("Duration")?.textContent ?? "";
    const daysMatch = durationRaw.match(/P(\d+)D/);
    const durationDays = daysMatch ? Math.max(1, Number(daysMatch[1])) : 1;

    tasks.push({
      id,
      projectId,
      parentId: null,
      wbs: String(order + 1),
      name,
      status: "not_started",
      startDate: start,
      endDate: finish >= start ? finish : start,
      durationDays,
      percentComplete: 0,
      isMilestone: durationDays <= 0,
      isSummary: false,
      manuallyScheduled: false,
      constraint: "ASAP",
      isCritical: false,
      assigneeIds: [],
      sortOrder: order++,
      isPriority: false,
      plannedCost: 0,
      actualCost: 0,
    });
  }

  const dependencies: TaskDependency[] = [];
  for (const el of taskEls) {
    const uid = el.querySelector("UID")?.textContent;
    const predUid = el.querySelector("PredecessorLink > PredecessorUID")?.textContent;
    if (!uid || !predUid) continue;
    const successorId = uidToId.get(uid);
    const predecessorId = uidToId.get(predUid);
    if (!successorId || !predecessorId) continue;
    dependencies.push({
      id: newId(),
      projectId,
      predecessorId,
      successorId,
      type: "FS",
      lagDays: 0,
    });
  }

  return { tasks, dependencies };
}
