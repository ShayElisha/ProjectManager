import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import type { ReportWidgetType, WebhookEvent } from "@nexus/shared";
import { IntegrationsService } from "./integrations.service";

@Controller("projects/:projectId")
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get("custom-reports")
  customReports(@Param("projectId") projectId: string) {
    return this.integrations.listCustomReports(projectId);
  }

  @Post("custom-reports")
  createCustomReport(
    @Param("projectId") projectId: string,
    @Body() body: { name: string; widgets: ReportWidgetType[] },
  ) {
    return this.integrations.createCustomReport(projectId, body);
  }

  @Get("webhooks")
  webhooks(@Param("projectId") projectId: string) {
    return this.integrations.listWebhooks(projectId);
  }

  @Post("webhooks")
  createWebhook(
    @Param("projectId") projectId: string,
    @Body() body: { url: string; events: WebhookEvent[]; secret?: string },
  ) {
    return this.integrations.createWebhook(projectId, body);
  }

  @Get("integrations")
  getIntegrations(@Param("projectId") projectId: string) {
    return this.integrations.getIntegrations(projectId);
  }

  @Patch("integrations")
  updateIntegrations(
    @Param("projectId") projectId: string,
    @Body() body: { slackWebhookUrl?: string; emailInboundSecret?: string; zapierHookToken?: string },
  ) {
    return this.integrations.updateIntegrations(projectId, body);
  }

  @Get("goals")
  goals(@Param("projectId") projectId: string) {
    return this.integrations.listGoals(projectId);
  }

  @Post("goals")
  createGoal(
    @Param("projectId") projectId: string,
    @Body() body: { title: string; period: string },
  ) {
    return this.integrations.createGoal(projectId, body);
  }

  @Get("key-results")
  keyResults(@Param("projectId") projectId: string, @Query("goalId") goalId?: string) {
    return this.integrations.listKeyResults(projectId, goalId);
  }

  @Post("key-results")
  createKeyResult(
    @Param("projectId") projectId: string,
    @Body() body: { goalId: string; title: string; targetValue: number; unit?: string },
  ) {
    return this.integrations.createKeyResult(projectId, body);
  }

  @Patch("key-results/:krId")
  updateKeyResult(
    @Param("projectId") projectId: string,
    @Param("krId") krId: string,
    @Body() body: { currentValue?: number; title?: string; targetValue?: number },
  ) {
    return this.integrations.updateKeyResult(projectId, krId, body);
  }

  @Get("whiteboard")
  whiteboard(@Param("projectId") projectId: string) {
    return this.integrations.listWhiteboard(projectId);
  }

  @Post("whiteboard")
  saveWhiteboard(
    @Param("projectId") projectId: string,
    @Body() body: { id?: string; x: number; y: number; text: string; color?: string },
  ) {
    return this.integrations.saveWhiteboardItem(projectId, body);
  }

  @Delete("whiteboard/:itemId")
  deleteWhiteboard(@Param("projectId") projectId: string, @Param("itemId") itemId: string) {
    return this.integrations.deleteWhiteboardItem(projectId, itemId);
  }
}
