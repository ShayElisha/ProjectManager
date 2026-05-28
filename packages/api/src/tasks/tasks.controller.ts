import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { TasksService } from "./tasks.service";
import type { Task, TaskDependency, UserAccount } from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";
import { assertProjectAccess } from "../common/org-access";
import { AuditService } from "../audit/audit.service";

@Controller("projects/:projectId/tasks")
export class TasksController {
  constructor(
    private readonly tasks: TasksService,
    private readonly db: DataStoreService,
    private readonly audit: AuditService,
  ) {}

  private guardTask(user: UserAccount, projectId: string, taskId: string, level: "read" | "write") {
    assertProjectAccess(this.db, user, projectId);
    if (!this.db.canAccessTask(user.id, projectId, taskId, level)) {
      throw new ForbiddenException("TASK_ACCESS_DENIED");
    }
  }

  @Get()
  list(@Req() req: { user: UserAccount }, @Param("projectId") projectId: string) {
    assertProjectAccess(this.db, req.user, projectId);
    return this.tasks.findByProject(projectId);
  }

  @Post()
  create(
    @Req() req: { user: UserAccount },
    @Param("projectId") projectId: string,
    @Body() body: Partial<Task>,
  ) {
    assertProjectAccess(this.db, req.user, projectId);
    return this.tasks.createTask(projectId, body);
  }

  @Get("baselines")
  baselines(@Param("projectId") projectId: string) {
    return this.tasks.listBaselines(projectId);
  }

  @Post("recalculate")
  recalculate(@Param("projectId") projectId: string) {
    return this.tasks.recalculate(projectId);
  }

  @Post("pause")
  pause(
    @Param("projectId") projectId: string,
    @Body()
    body: {
      taskId: string;
      resumeDate: string;
      remainingWorkDays?: number;
      transferToTaskId?: string;
    },
  ) {
    return this.tasks.pauseTask(projectId, body.taskId, body);
  }

  @Post("resume")
  resume(
    @Param("projectId") projectId: string,
    @Body() body: { taskId: string },
  ) {
    return this.tasks.resumeTask(projectId, body.taskId);
  }

  @Post("dependencies")
  addDependency(
    @Param("projectId") projectId: string,
    @Body() body: Omit<TaskDependency, "id" | "projectId">,
  ) {
    return this.tasks.addDependency(projectId, body);
  }

  @Delete("dependencies/:depId")
  removeDependency(
    @Param("projectId") projectId: string,
    @Param("depId") depId: string,
  ) {
    return this.tasks.removeDependency(projectId, depId);
  }

  @Post("baselines")
  saveBaseline(@Param("projectId") projectId: string, @Body() body: { name: string }) {
    return this.tasks.saveBaseline(projectId, body.name);
  }

  @Post("generate-demo")
  generateDemo(
    @Param("projectId") projectId: string,
    @Body() body: { count?: number },
  ) {
    return this.tasks.generateDemoTasks(projectId, Math.min(body.count ?? 500, 5000));
  }

  @Patch(":taskId")
  async update(
    @Req() req: { user: UserAccount },
    @Param("projectId") projectId: string,
    @Param("taskId") taskId: string,
    @Body() body: Partial<Task>,
  ) {
    this.guardTask(req.user, projectId, taskId, "write");
    const project = this.db.getProject(projectId)!;
    const task = await this.tasks.updateTask(projectId, taskId, body);
    if (task) {
      this.audit.log(
        req.user,
        project.organizationId,
        "update",
        "task",
        `Updated task «${task.name}»`,
        taskId,
      );
    }
    return task;
  }

  @Delete(":taskId")
  delete(
    @Req() req: { user: UserAccount },
    @Param("projectId") projectId: string,
    @Param("taskId") taskId: string,
  ) {
    this.guardTask(req.user, projectId, taskId, "write");
    return this.tasks.deleteTask(projectId, taskId);
  }
}
