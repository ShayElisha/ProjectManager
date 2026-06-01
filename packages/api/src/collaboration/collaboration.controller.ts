import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Req } from "@nestjs/common";
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
}
