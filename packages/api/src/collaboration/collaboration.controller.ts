import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import { v4 as uuid } from "uuid";
import type { TimesheetEntry, UserAccount } from "@nexus/shared";
import { BudgetService } from "../budget/budget.service";
import { DataStoreService } from "../database/data-store.service";

class SubmitTimesheetDto {
  @IsString()
  userId!: string;

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
    @Param("projectId") projectId: string,
    @Body() body: SubmitTimesheetDto,
  ) {
    const entry: TimesheetEntry = {
      id: uuid(),
      projectId,
      ...body,
      status: "submitted",
    };
    await this.db.addTimesheet(entry);
    const overview = await this.budget.recalculate(projectId, false);
    await this.db.addNotification({
      id: uuid(),
      userId: "pm-1",
      type: "approval",
      title: "Timesheet pending approval",
      body: `${body.hours}h on ${body.date}`,
      read: false,
      createdAt: new Date().toISOString(),
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
  notifications(@Query("userId") userId?: string, @Req() req?: { user?: UserAccount }) {
    const uid = userId ?? req?.user?.id;
    return this.db.getNotifications(uid);
  }

  @Patch("notifications/:id/read")
  markNotificationRead(@Param("id") id: string) {
    return this.db.markNotificationRead(id);
  }

  @Post("notifications/read-all")
  markAllNotificationsRead(
    @Body() body: { userId?: string },
    @Req() req: { user?: UserAccount },
  ) {
    const uid = body.userId ?? req.user?.id;
    return this.db.markAllNotificationsRead(uid);
  }

  @Get("timer")
  activeTimer(
    @Param("projectId") projectId: string,
    @Req() req: { user?: UserAccount },
    @Query("userId") userId?: string,
  ) {
    const uid = userId ?? req.user?.id ?? "anonymous";
    return this.db.getActiveTimer(uid, projectId);
  }

  @Post("timer/start")
  startTimer(
    @Param("projectId") projectId: string,
    @Body() body: { taskId?: string; userId?: string },
    @Req() req: { user?: UserAccount },
  ) {
    const uid = body.userId ?? req.user?.id ?? "anonymous";
    return this.db.startTimer(uid, projectId, body.taskId);
  }

  @Post("timer/stop")
  async stopTimer(
    @Param("projectId") projectId: string,
    @Body() body: { userId?: string; notes?: string },
    @Req() req: { user?: UserAccount },
  ) {
    const uid = body.userId ?? req.user?.id ?? "anonymous";
    const result = await this.db.stopTimer(uid, projectId, body.notes);
    if (result?.entry) {
      const overview = await this.budget.recalculate(projectId, false);
      return { ...result, budget: overview };
    }
    return result;
  }
}
