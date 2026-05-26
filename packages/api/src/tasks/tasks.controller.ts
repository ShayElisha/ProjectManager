import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { TasksService } from "./tasks.service";
import type { Task, TaskDependency } from "@nexus/shared";

@Controller("projects/:projectId/tasks")
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@Param("projectId") projectId: string) {
    return this.tasks.findByProject(projectId);
  }

  @Post()
  create(@Param("projectId") projectId: string, @Body() body: Partial<Task>) {
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
  update(
    @Param("projectId") projectId: string,
    @Param("taskId") taskId: string,
    @Body() body: Partial<Task>,
  ) {
    return this.tasks.updateTask(projectId, taskId, body);
  }

  @Delete(":taskId")
  delete(@Param("projectId") projectId: string, @Param("taskId") taskId: string) {
    return this.tasks.deleteTask(projectId, taskId);
  }
}
