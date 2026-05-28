import { Injectable, Logger } from "@nestjs/common";
import type { WebhookEvent } from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";

@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);

  constructor(private readonly db: DataStoreService) {}

  async dispatch(
    projectId: string,
    event: WebhookEvent,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const hooks = this.db.getWebhooks(projectId).filter((h) => h.enabled && h.events.includes(event));
    const body = JSON.stringify({ event, projectId, payload, timestamp: new Date().toISOString() });

    for (const hook of hooks) {
      try {
        await fetch(hook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(hook.secret ? { "X-Webhook-Secret": hook.secret } : {}),
          },
          body,
        });
      } catch (err) {
        this.logger.warn(`Webhook ${hook.id} failed: ${err}`);
      }
    }

    const integrations = this.db.getProjectIntegrations(projectId);
    if (integrations.slackWebhookUrl) {
      const text = this.slackMessage(event, payload);
      try {
        await fetch(integrations.slackWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
      } catch (err) {
        this.logger.warn(`Slack webhook failed: ${err}`);
      }
    }
  }

  private slackMessage(event: WebhookEvent, payload: Record<string, unknown>): string {
    const name = payload.name ?? payload.taskName ?? "—";
    switch (event) {
      case "task.created":
        return `✅ New task: ${name}`;
      case "task.updated":
        return `📝 Task updated: ${name}`;
      case "task.deleted":
        return `🗑️ Task deleted: ${name}`;
      default:
        return `📌 ${event}: ${name}`;
    }
  }
}
