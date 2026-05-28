import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { IsObject } from "class-validator";
import { Public } from "../auth/public.decorator";
import { ProjectFeaturesService } from "./project-features.service";
import type { RecurrenceRule, Task } from "@nexus/shared";

@Controller("projects/:projectId")
export class ProjectFeaturesController {
  constructor(private readonly features: ProjectFeaturesService) {}

  @Post("tasks/:taskId/move")
  moveTask(
    @Param("projectId") projectId: string,
    @Param("taskId") taskId: string,
    @Body() body: { targetProjectId: string },
  ) {
    return this.features.moveTask(projectId, taskId, body.targetProjectId);
  }

  @Post("tasks/recurring")
  recurring(@Param("projectId") projectId: string, @Body() body: Partial<Task> & { recurrenceRule: RecurrenceRule }) {
    return this.features.createRecurringTasks(projectId, body);
  }

  @Get("custom-columns")
  customColumns(@Param("projectId") projectId: string) {
    return this.features.listCustomColumns(projectId);
  }

  @Post("custom-columns")
  createCustomColumn(
    @Param("projectId") projectId: string,
    @Body() body: { key: string; label: string; type: string; options?: string[] },
  ) {
    return this.features.createCustomColumn(projectId, body as Parameters<ProjectFeaturesService["createCustomColumn"]>[1]);
  }

  @Get("sprints")
  sprints(@Param("projectId") projectId: string) {
    return this.features.listSprints(projectId);
  }

  @Post("sprints")
  createSprint(
    @Param("projectId") projectId: string,
    @Body() body: { name: string; startDate: string; endDate: string; goal?: string; status?: string },
  ) {
    return this.features.createSprint(projectId, body as Parameters<ProjectFeaturesService["createSprint"]>[1]);
  }

  @Patch("sprints/:sprintId")
  updateSprint(
    @Param("projectId") projectId: string,
    @Param("sprintId") sprintId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.features.updateSprint(projectId, sprintId, body);
  }

  @Get("sprints/:sprintId/velocity")
  velocity(@Param("projectId") projectId: string, @Param("sprintId") sprintId: string) {
    return this.features.sprintVelocity(projectId, sprintId);
  }

  @Get("cycles")
  cycles(@Param("projectId") projectId: string) {
    return this.features.listCycles(projectId);
  }

  @Post("cycles")
  createCycle(
    @Param("projectId") projectId: string,
    @Body() body: { name: string; startDate: string; endDate: string },
  ) {
    return this.features.createCycle(projectId, body);
  }

  @Get("forms")
  forms(@Param("projectId") projectId: string) {
    return this.features.listForms(projectId);
  }

  @Post("forms")
  createForm(
    @Param("projectId") projectId: string,
    @Body() body: { title: string; slug?: string; fields: Array<{ key: string; label: string; type: string; required?: boolean }> },
  ) {
    return this.features.createForm(projectId, body as Parameters<ProjectFeaturesService["createForm"]>[1]);
  }

  @Get("saved-views")
  savedViews(@Param("projectId") projectId: string, @Query("userId") userId?: string) {
    return this.features.listSavedViews(projectId, userId);
  }

  @Post("saved-views")
  createSavedView(
    @Param("projectId") projectId: string,
    @Body() body: {
      name: string;
      viewMode: string;
      filters?: Record<string, unknown>;
      columns?: string[];
      userId?: string;
    },
  ) {
    return this.features.createSavedView(projectId, body as Parameters<ProjectFeaturesService["createSavedView"]>[1]);
  }

  @Get("automation-rules")
  automationRules(@Param("projectId") projectId: string) {
    return this.features.listAutomationRules(projectId);
  }

  @Post("automation-rules")
  createAutomationRule(
    @Param("projectId") projectId: string,
    @Body() body: Omit<import("@nexus/shared").AutomationRule, "id" | "projectId">,
  ) {
    return this.features.createAutomationRule(projectId, body);
  }

  @Get("activity")
  activity(@Param("projectId") projectId: string) {
    return this.features.getActivity(projectId);
  }

  @Get("messages")
  messages(@Param("projectId") projectId: string) {
    return this.features.listMessages(projectId);
  }

  @Post("messages")
  postMessage(
    @Param("projectId") projectId: string,
    @Body() body: { userId: string; userName: string; text: string },
  ) {
    return this.features.postMessage(projectId, body);
  }

  @Get("wiki")
  wiki(@Param("projectId") projectId: string) {
    return this.features.listWiki(projectId);
  }

  @Post("wiki")
  saveWiki(
    @Param("projectId") projectId: string,
    @Body() body: { id?: string; title: string; content: string },
  ) {
    return this.features.saveWiki(projectId, body);
  }

  @Get("guests")
  guests(@Param("projectId") projectId: string) {
    return this.features.listGuests(projectId);
  }

  @Post("guests")
  inviteGuest(
    @Param("projectId") projectId: string,
    @Body() body: { email: string; name?: string },
  ) {
    return this.features.inviteGuest(projectId, body);
  }

  @Post("notify-email")
  notifyEmail(@Body() body: { to: string; subject: string; body: string }) {
    return this.features.notifyEmail(body.to, body.subject, body.body);
  }
}

@Public()
@Controller("guest")
export class GuestAccessController {
  constructor(private readonly features: ProjectFeaturesService) {}

  @Get(":token")
  project(@Param("token") token: string) {
    return this.features.getGuestProject(token);
  }
}

class SubmitFormDto {
  @IsObject()
  values!: Record<string, string>;
}

@Public()
@Controller("public/forms")
export class PublicFormsController {
  constructor(private readonly features: ProjectFeaturesService) {}

  @Get(":slug")
  getForm(@Param("slug") slug: string) {
    return this.features.getPublicForm(slug);
  }

  @Post(":slug/submit")
  submit(@Param("slug") slug: string, @Body() body: SubmitFormDto) {
    return this.features.submitPublicForm(slug, body.values);
  }
}
