import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  AutomationRule,
  CustomColumn,
  Cycle,
  ProjectForm,
  ProjectFormField,
  ProjectGuest,
  ProjectMessage,
  ProjectWikiPage,
  SavedView,
  Sprint,
  Task,
  RecurrenceRule,
} from "@nexus/shared";
import { v4 as uuid } from "uuid";
import { DataStoreService } from "../database/data-store.service";
import { TasksService } from "../tasks/tasks.service";
import { EmailService } from "../email/email.service";

@Injectable()
export class ProjectFeaturesService {
  constructor(
    private readonly db: DataStoreService,
    private readonly tasks: TasksService,
    private readonly email: EmailService,
  ) {}

  moveTask(sourceProjectId: string, taskId: string, targetProjectId: string) {
    return this.tasks.moveTask(sourceProjectId, taskId, targetProjectId);
  }

  listCustomColumns(projectId: string) {
    return this.db.getCustomColumns(projectId);
  }

  createCustomColumn(projectId: string, body: Omit<CustomColumn, "id" | "projectId">) {
    return this.db.createCustomColumn({ ...body, projectId });
  }

  listSprints(projectId: string) {
    return this.db.getSprints(projectId);
  }

  createSprint(projectId: string, body: Omit<Sprint, "id" | "projectId" | "status"> & { status?: Sprint["status"] }) {
    return this.db.createSprint({
      ...body,
      projectId,
      status: body.status ?? "planned",
    });
  }

  updateSprint(projectId: string, sprintId: string, patch: Partial<Sprint>) {
    const updated = this.db.updateSprint(projectId, sprintId, patch);
    if (!updated) throw new NotFoundException("Sprint not found");
    return updated;
  }

  sprintVelocity(projectId: string, sprintId: string) {
    const v = this.db.getSprintVelocity(projectId, sprintId);
    if (!v) throw new NotFoundException("Sprint not found");
    return v;
  }

  listCycles(projectId: string) {
    return this.db.getCycles(projectId);
  }

  createCycle(projectId: string, body: Omit<Cycle, "id" | "projectId">) {
    return this.db.createCycle({ ...body, projectId });
  }

  listForms(projectId: string) {
    return this.db.getProjectForms(projectId);
  }

  createForm(
    projectId: string,
    body: { title: string; slug?: string; fields: ProjectFormField[] },
  ) {
    const slug =
      body.slug ||
      body.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) ||
      uuid().slice(0, 8);
    return this.db.createProjectForm({
      projectId,
      slug,
      title: body.title,
      enabled: true,
      fields: body.fields,
    });
  }

  getPublicForm(slug: string) {
    const form = this.db.getFormBySlug(slug);
    if (!form) throw new NotFoundException("Form not found");
    return form;
  }

  async submitPublicForm(slug: string, values: Record<string, string>) {
    const form = this.db.getFormBySlug(slug);
    if (!form) throw new NotFoundException("Form not found");
    const name = values.name ?? values.title ?? `Request ${new Date().toISOString().slice(0, 10)}`;
    const result = await this.tasks.createTask(form.projectId, {
      name: String(name),
      startDate: values.startDate ?? new Date().toISOString().slice(0, 10),
      endDate: values.endDate ?? new Date().toISOString().slice(0, 10),
      durationDays: Number(values.durationDays) || 1,
      status: "not_started",
      description: Object.entries(values)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n"),
    });
    const taskId = "id" in result ? result.id : result.parent.id;
    return { ok: true, taskId };
  }

  listSavedViews(projectId: string, userId?: string) {
    return this.db.getSavedViews(projectId, userId);
  }

  createSavedView(projectId: string, body: Omit<SavedView, "id" | "projectId">) {
    return this.db.createSavedView({ ...body, projectId });
  }

  async createRecurringTasks(projectId: string, body: Partial<Task> & { recurrenceRule: RecurrenceRule }) {
    const { recurrenceRule, ...rest } = body;
    const base = this.tasks.buildTaskBase(projectId, rest);
    return this.db.generateRecurringTasks(projectId, base, recurrenceRule);
  }

  listAutomationRules(projectId: string) {
    return this.db.getAutomationRules(projectId);
  }

  createAutomationRule(projectId: string, body: Omit<AutomationRule, "id" | "projectId">) {
    return this.db.createAutomationRule({ ...body, id: uuid(), projectId });
  }

  getActivity(projectId: string) {
    return this.db.getActivityLogs(projectId);
  }

  listMessages(projectId: string) {
    return this.db.getProjectMessages(projectId);
  }

  postMessage(projectId: string, body: { userId: string; userName: string; text: string }) {
    return this.db.addProjectMessage({
      projectId,
      userId: body.userId,
      userName: body.userName,
      body: body.text,
    });
  }

  listWiki(projectId: string) {
    return this.db.getWikiPages(projectId);
  }

  saveWiki(projectId: string, body: { id?: string; title: string; content: string }) {
    return this.db.upsertWikiPage(projectId, body);
  }

  listGuests(projectId: string) {
    return this.db.getProjectGuests(projectId);
  }

  inviteGuest(projectId: string, body: { email: string; name?: string }) {
    return this.db.createProjectGuest({
      projectId,
      email: body.email,
      name: body.name,
      role: "viewer",
    });
  }

  getGuestProject(token: string) {
    const guest = this.db.getGuestByToken(token);
    if (!guest) throw new NotFoundException("Invalid guest link");
    const project = this.db.getProject(guest.projectId);
    if (!project) throw new NotFoundException("Project not found");
    const tasks = this.db.getTasks(guest.projectId).map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      startDate: t.startDate,
      endDate: t.endDate,
      percentComplete: t.percentComplete,
      wbs: t.wbs,
    }));
    return {
      guest: { id: guest.id, email: guest.email, name: guest.name, role: guest.role },
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        startDate: project.startDate,
        endDate: project.endDate,
      },
      tasks,
    };
  }

  async notifyEmail(to: string, subject: string, body: string) {
    const sent = await this.email.send(to, subject, body);
    return { sent };
  }
}
