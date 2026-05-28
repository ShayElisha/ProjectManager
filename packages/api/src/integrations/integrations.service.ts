import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import type {
  CustomReport,
  Goal,
  KeyResult,
  ProjectIntegrations,
  ReportWidgetType,
  WebhookEvent,
  WebhookSubscription,
  WhiteboardItem,
} from "@nexus/shared";
import { v4 as uuid } from "uuid";
import { DataStoreService } from "../database/data-store.service";
import { TasksService } from "../tasks/tasks.service";

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly db: DataStoreService,
    private readonly tasks: TasksService,
  ) {}

  listCustomReports(projectId: string) {
    return this.db.getCustomReports(projectId);
  }

  createCustomReport(projectId: string, body: { name: string; widgets: ReportWidgetType[] }) {
    return this.db.createCustomReport({ projectId, name: body.name, widgets: body.widgets });
  }

  listWebhooks(projectId: string) {
    return this.db.getWebhooks(projectId);
  }

  createWebhook(
    projectId: string,
    body: { url: string; events: WebhookEvent[]; secret?: string },
  ) {
    return this.db.createWebhook({
      projectId,
      url: body.url,
      events: body.events,
      secret: body.secret,
      enabled: true,
    });
  }

  getIntegrations(projectId: string) {
    const current = this.db.getProjectIntegrations(projectId);
    const next: ProjectIntegrations = {
      projectId,
      slackWebhookUrl: current.slackWebhookUrl,
      emailInboundSecret: current.emailInboundSecret ?? uuid().slice(0, 16),
      zapierHookToken: current.zapierHookToken ?? uuid().replace(/-/g, ""),
    };
    if (!current.emailInboundSecret || !current.zapierHookToken) {
      this.db.setProjectIntegrations(next);
    }
    return next;
  }

  updateIntegrations(projectId: string, patch: Partial<ProjectIntegrations>) {
    const current = this.getIntegrations(projectId);
    const next: ProjectIntegrations = {
      ...current,
      ...patch,
      projectId,
    };
    this.db.setProjectIntegrations(next);
    return next;
  }

  listGoals(projectId: string) {
    return this.db.getGoals(projectId);
  }

  createGoal(projectId: string, body: { title: string; period: string }) {
    return this.db.createGoal({ projectId, title: body.title, period: body.period });
  }

  listKeyResults(projectId: string, goalId?: string) {
    return this.db.getKeyResults(projectId, goalId);
  }

  createKeyResult(
    projectId: string,
    body: { goalId: string; title: string; targetValue: number; unit?: string },
  ) {
    return this.db.createKeyResult({ ...body, projectId });
  }

  updateKeyResult(projectId: string, krId: string, patch: Partial<KeyResult>) {
    const updated = this.db.updateKeyResult(projectId, krId, patch);
    if (!updated) throw new NotFoundException("Key result not found");
    return updated;
  }

  listWhiteboard(projectId: string) {
    return this.db.getWhiteboardItems(projectId);
  }

  saveWhiteboardItem(
    projectId: string,
    body: { id?: string; x: number; y: number; text: string; color?: string; width?: number; height?: number },
  ) {
    return this.db.upsertWhiteboardItem(projectId, body);
  }

  deleteWhiteboardItem(projectId: string, itemId: string) {
    const ok = this.db.deleteWhiteboardItem(projectId, itemId);
    if (!ok) throw new NotFoundException("Item not found");
    return { ok: true };
  }

  async zapierAction(
    token: string,
    body: { action?: string; name?: string; description?: string },
  ) {
    const projectId = this.db.findProjectByZapierToken(token);
    if (!projectId) throw new NotFoundException("Invalid Zapier token");
    if (body.action === "create_task" || body.name) {
      const result = await this.tasks.createTask(projectId, {
        name: body.name ?? "Zapier task",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        durationDays: 1,
        status: "not_started",
        description: body.description,
      });
      const task = "id" in result ? result : result.parent;
      return { ok: true, taskId: task.id };
    }
    return { ok: true, projectId };
  }

  async inboundEmail(
    projectId: string,
    secret: string,
    body: { subject?: string; body?: string; from?: string },
  ) {
    if (!this.db.findProjectByEmailSecret(projectId, secret)) {
      throw new UnauthorizedException("Invalid inbound secret");
    }
    const subject = body.subject?.trim() || "Email task";
    const result = await this.tasks.createTask(projectId, {
      name: subject.slice(0, 200),
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      durationDays: 1,
      status: "not_started",
      description: [body.from ? `From: ${body.from}` : "", body.body ?? ""].filter(Boolean).join("\n"),
    });
    const task = "id" in result ? result : result.parent;
    return { ok: true, taskId: task.id };
  }
}
