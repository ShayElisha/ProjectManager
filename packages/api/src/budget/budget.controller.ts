import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { BudgetService } from "./budget.service";
import { assertBudgetLineTaskLink } from "./budget-validation";
import {
  BudgetReceiptDto,
  CreateBudgetLineDto,
  RecalculateBudgetDto,
  SyncBudgetFromRfqDto,
  UpdateBudgetLineDto,
} from "./budget.dto";
import { DataStoreService } from "../database/data-store.service";

@Controller("projects/:projectId")
export class BudgetController {
  constructor(
    private readonly budget: BudgetService,
    private readonly db: DataStoreService,
  ) {}

  @Get("budget")
  overview(@Param("projectId") projectId: string) {
    return this.budget.overview(projectId);
  }

  @Get("budget-lines")
  listLines(@Param("projectId") projectId: string) {
    return this.budget.listLines(projectId);
  }

  @Get("budget/material-lines")
  listMaterialLines(@Param("projectId") projectId: string) {
    return this.budget.listMaterialLines(projectId);
  }

  @Post("budget-lines")
  createLine(@Param("projectId") projectId: string, @Body() body: CreateBudgetLineDto) {
    assertBudgetLineTaskLink(this.db, projectId, body.taskId);
    return this.budget.createLine(projectId, body);
  }

  @Patch("budget-lines/:lineId")
  updateLine(
    @Param("projectId") projectId: string,
    @Param("lineId") lineId: string,
    @Body() body: UpdateBudgetLineDto,
  ) {
    const taskId = body.taskId === null ? undefined : body.taskId;
    if (taskId) assertBudgetLineTaskLink(this.db, projectId, taskId);
    return this.budget.updateLine(projectId, lineId, { ...body, taskId });
  }

  @Delete("budget-lines/:lineId")
  async deleteLine(@Param("projectId") projectId: string, @Param("lineId") lineId: string) {
    await this.budget.deleteLine(projectId, lineId);
    return { ok: true };
  }

  @Post("budget/recalculate")
  recalculate(@Param("projectId") projectId: string, @Body() body: RecalculateBudgetDto) {
    return this.budget.recalculate(projectId, body?.overwriteManual ?? false);
  }

  @Post("budget-lines/:lineId/receipt")
  recordReceipt(
    @Param("projectId") projectId: string,
    @Param("lineId") lineId: string,
    @Body() body: BudgetReceiptDto,
  ) {
    return this.budget.recordReceipt(projectId, lineId, body);
  }

  @Post("budget/sync-from-rfq")
  syncFromRfq(@Param("projectId") projectId: string, @Body() body: SyncBudgetFromRfqDto) {
    if (body.taskId) assertBudgetLineTaskLink(this.db, projectId, body.taskId);
    return this.budget.syncFromRfq(projectId, body);
  }
}
