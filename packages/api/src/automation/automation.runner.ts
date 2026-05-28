import type { AutomationRule, Task } from "@nexus/shared";
import type { DataStoreService } from "../database/data-store.service";
import { v4 as uuid } from "uuid";

export function runAutomationRules(
  db: DataStoreService,
  projectId: string,
  task: Task,
  before: Task,
  patch: Partial<Task>,
): void {
  const rules = db.getAutomationRules(projectId).filter((r) => r.enabled);
  for (const rule of rules) {
    if (!fieldTriggered(rule, before, task, patch)) continue;
    applyAction(db, projectId, task, rule);
  }
}

function fieldTriggered(
  rule: AutomationRule,
  before: Task,
  after: Task,
  patch: Partial<Task>,
): boolean {
  const field = rule.triggerField as keyof Task;
  if (!(field in patch) && rule.triggerOp !== "changed") return false;
  const prev = before[field];
  const next = after[field];
  if (rule.triggerOp === "changed") return prev !== next;
  if (rule.triggerOp === "eq") return String(next) === String(rule.triggerValue ?? "");
  if (rule.triggerOp === "neq") return String(next) !== String(rule.triggerValue ?? "");
  return false;
}

function applyAction(
  db: DataStoreService,
  projectId: string,
  task: Task,
  rule: AutomationRule,
): void {
  if (rule.actionType === "set_status" && rule.actionPayload?.status) {
    void db.updateTask(projectId, task.id, {
      status: rule.actionPayload.status as Task["status"],
    });
  }
  if (rule.actionType === "set_field" && rule.actionPayload?.field) {
    const field = rule.actionPayload.field as keyof Task;
    const value = rule.actionPayload.value;
    void db.updateTask(projectId, task.id, { [field]: value } as Partial<Task>);
  }
  if (rule.actionType === "notify") {
    void db.addNotification({
      id: uuid(),
      userId: "pm-1",
      type: "automation",
      title: rule.name,
      body: `Task «${task.name}» matched rule`,
      read: false,
      createdAt: new Date().toISOString(),
      metadata: { taskId: task.id, ruleId: rule.id },
    });
  }
}
