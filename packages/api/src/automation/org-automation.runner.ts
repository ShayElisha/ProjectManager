import { v4 as uuid } from "uuid";
import type { Task } from "@nexus/shared";
import type { DataStoreService } from "../database/data-store.service";

export function runOrgAutomationRules(
  db: DataStoreService,
  organizationId: string,
  event: string,
  context: { projectId: string; task?: Task },
): void {
  const rules = db.getOrgAutomationRules(organizationId).filter((r) => r.enabled && r.event === event);
  for (const rule of rules) {
    if (rule.actionType === "notify") {
      const managers = db.getUsersByOrganization(organizationId).filter((u) =>
        ["admin", "pmo", "project_manager"].includes(u.role),
      );
      const targets = managers.length > 0 ? managers : db.getUsersByOrganization(organizationId).slice(0, 3);
      for (const user of targets) {
        void db.addNotification({
          id: uuid(),
          userId: user.id,
          type: "automation",
          title: rule.name,
          body: context.task
            ? `Org rule on «${context.task.name}»`
            : `Org rule fired for ${event}`,
          read: false,
          createdAt: new Date().toISOString(),
          metadata: { projectId: context.projectId, ruleId: rule.id, event },
        });
      }
    }
    if (rule.actionType === "webhook" && rule.actionPayload?.url) {
      const url = String(rule.actionPayload.url);
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, organizationId, ...context }),
      }).catch(() => undefined);
    }
  }
}
