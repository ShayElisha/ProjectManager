import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import { v4 as uuid } from "uuid";
import type { TimesheetEntry, UserAccount } from "@nexus/shared";
import { BudgetService } from "../budget/budget.service";
import { DataStoreService } from "../database/data-store.service";

class SubmitTimesheetDto {
  @IsString()
  taskId!: string;

  @IsString()
  date!: string;

  @IsNumber()
  @Min(0)
  @Max(24)
  hours!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

class UpdateTimesheetStatusDto {
  @IsIn(["draft", "submitted", "approved", "rejected"])
  status!: TimesheetEntry["status"];

  @IsOptional()
  @IsString()
  notes?: string;
}

@Controller("projects/:projectId")
export class CollaborationController {
  constructor(
    private readonly db: DataStoreService,
    private readonly budget: BudgetService,
  ) {}

  @Get("timesheets")
  timesheets(@Param("projectId") projectId: string) {
    return this.db.getTimesheets(projectId);
  }

  @Post("timesheets")
  async submitTimesheet(
    @Req() req: { user: UserAccount },
    @Param("projectId") projectId: string,
    @Body() body: SubmitTimesheetDto,
  ) {
    const entry: TimesheetEntry = {
      id: uuid(),
      projectId,
      userId: req.user.id,
      taskId: body.taskId,
      date: body.date,
      hours: body.hours,
      notes: body.notes,
      status: "submitted",
    };
    await this.db.addTimesheet(entry);
    const overview = await this.budget.recalculate(projectId, false);
    this.db.notifyProjectManagers(projectId, {
      type: "approval",
      title: "Timesheet pending approval",
      body: `${req.user.name}: ${body.hours}h on ${body.date}`,
      metadata: { entryId: entry.id, taskId: body.taskId },
    });
    return { entry, budget: overview };
  }

  @Patch("timesheets/:entryId")
  async updateTimesheetStatus(
    @Param("projectId") projectId: string,
    @Param("entryId") entryId: string,
    @Body() body: UpdateTimesheetStatusDto,
  ) {
    const updated = await this.db.updateTimesheet(projectId, entryId, {
      status: body.status,
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    });
    if (!updated) {
      return { ok: false };
    }
    const overview = await this.budget.recalculate(projectId, false);
    return { entry: updated, budget: overview };
  }

  @Get("notifications")
  notifications(@Req() req: { user: UserAccount }) {
    return this.db.getNotifications(req.user.id);
  }

  @Patch("notifications/:id/read")
  markNotificationRead(@Req() req: { user: UserAccount }, @Param("id") id: string) {
    const list = this.db.getNotifications(req.user.id);
    const n = list.find((x) => x.id === id);
    if (!n) throw new NotFoundException();
    if (n.userId !== req.user.id) throw new ForbiddenException();
    return this.db.markNotificationRead(id);
  }

  @Post("notifications/read-all")
  markAllNotificationsRead(@Req() req: { user: UserAccount }) {
    return this.db.markAllNotificationsRead(req.user.id);
  }

  @Get("timer")
  activeTimer(@Req() req: { user: UserAccount }, @Param("projectId") projectId: string) {
    return this.db.getActiveTimer(req.user.id, projectId);
  }

  @Post("timer/start")
  startTimer(
    @Req() req: { user: UserAccount },
    @Param("projectId") projectId: string,
    @Body() body: { taskId?: string },
  ) {
    return this.db.startTimer(req.user.id, projectId, body.taskId);
  }

  @Post("timer/stop")
  async stopTimer(
    @Req() req: { user: UserAccount },
    @Param("projectId") projectId: string,
    @Body() body: { notes?: string },
  ) {
    const result = await this.db.stopTimer(req.user.id, projectId, body.notes);
    if (result?.entry) {
      const overview = await this.budget.recalculate(projectId, false);
      return { ...result, budget: overview };
    }
    return result;
  }
}
