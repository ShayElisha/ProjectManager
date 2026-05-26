import { Injectable, NotFoundException } from "@nestjs/common";
import { v4 as uuid } from "uuid";
import {
  getProjectFinancials,
  isMaterialBudgetCategory,
  recalculateProjectCosts,
  syncTaskCostTotals,
} from "@nexus/shared";
import type { BudgetCategory, BudgetLineItem, BudgetOverviewReport } from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";

@Injectable()
export class BudgetService {
  constructor(private readonly db: DataStoreService) {}

  overview(projectId: string): BudgetOverviewReport {
    return getProjectFinancials(this.financialsInput(projectId));
  }

  private financialsInput(projectId: string) {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    return {
      projectId,
      currency: project.currency,
      budgetCap: project.budgetCap,
      tasks: this.db.getTasks(projectId),
      lines: this.db.getBudgetLines(projectId),
      assignments: this.db.getAssignments(projectId),
      resources: this.db.getResources(project.organizationId),
      timesheets: this.db.getTimesheets(projectId),
      members: this.db.getProjectMembers(projectId),
      hoursPerDay: project.hoursPerDay ?? 8,
    };
  }

  listLines(projectId: string): BudgetLineItem[] {
    if (!this.db.getProject(projectId)) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    return this.db.getBudgetLines(projectId);
  }

  listMaterialLines(projectId: string): BudgetLineItem[] {
    return this.listLines(projectId).filter((l) => isMaterialBudgetCategory(l.category));
  }

  async createLine(
    projectId: string,
    dto: Omit<BudgetLineItem, "id" | "projectId">,
  ): Promise<BudgetLineItem> {
    if (!this.db.getProject(projectId)) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    const line: BudgetLineItem = {
      id: uuid(),
      projectId,
      category: dto.category,
      name: dto.name,
      description: dto.description,
      plannedAmount: dto.plannedAmount ?? 0,
      committedAmount: dto.committedAmount,
      actualAmount: dto.actualAmount ?? 0,
      cashMonth: dto.cashMonth,
      taskId: dto.taskId,
      source: dto.source ?? "manual",
      sourceRef: dto.sourceRef,
    };
    return this.db.addBudgetLine(line);
  }

  async updateLine(
    projectId: string,
    lineId: string,
    patch: Partial<BudgetLineItem>,
  ): Promise<BudgetLineItem> {
    const updated = await this.db.updateBudgetLine(projectId, lineId, patch);
    if (!updated) throw new NotFoundException(`Budget line ${lineId} not found`);
    return updated;
  }

  async deleteLine(projectId: string, lineId: string): Promise<void> {
    const ok = await this.db.deleteBudgetLine(projectId, lineId);
    if (!ok) throw new NotFoundException(`Budget line ${lineId} not found`);
  }

  async recalculate(projectId: string, overwriteManual = false): Promise<BudgetOverviewReport> {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const tasks = this.db.getTasks(projectId);
    const lines = this.db.getBudgetLines(projectId);
    const assignments = this.db.getAssignments(projectId);
    const resources = this.db.getResources(project.organizationId);
    const timesheets = this.db.getTimesheets(projectId);
    const members = this.db.getProjectMembers(projectId);
    const hoursPerDay = project.hoursPerDay ?? 8;

    const rolled = recalculateProjectCosts(
      tasks,
      lines,
      assignments,
      resources,
      timesheets,
      overwriteManual,
      members,
      hoursPerDay,
    );
    await this.db.setTasks(projectId, rolled);
    return this.overview(projectId);
  }

  async recordReceipt(
    projectId: string,
    lineId: string,
    body: { amount: number; cashMonth?: string; note?: string; replace?: boolean },
  ): Promise<{ line: BudgetLineItem; overview: BudgetOverviewReport }> {
    const line = this.db.getBudgetLine(projectId, lineId);
    if (!line) throw new NotFoundException(`Budget line ${lineId} not found`);

    const newActual = body.replace
      ? body.amount
      : line.actualAmount + body.amount;

    const updated = await this.updateLine(projectId, lineId, {
      actualAmount: newActual,
      cashMonth: body.cashMonth ?? line.cashMonth,
      description: body.note
        ? [line.description, body.note].filter(Boolean).join(" · ")
        : line.description,
    });

    const overview = await this.recalculate(projectId, false);
    return { line: updated, overview };
  }

  async syncFromRfq(
    projectId: string,
    body: {
      comparisonId: string;
      vendorId: string;
      vendorName: string;
      rfqTitle: string;
      quotedPrice: number;
      category?: BudgetCategory;
      taskId?: string;
      cashMonth?: string;
    },
  ): Promise<{ line: BudgetLineItem; overview: BudgetOverviewReport }> {
    if (!this.db.getProject(projectId)) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const category =
      body.category && isMaterialBudgetCategory(body.category) ? body.category : "material";
    const sourceRef = `rfq:${body.comparisonId}:${body.vendorId}`;
    const cashMonth = body.cashMonth ?? new Date().toISOString().slice(0, 7);
    const existing = this.db.findBudgetLineBySourceRef(projectId, sourceRef);

    let line: BudgetLineItem;
    if (existing) {
      line = (await this.updateLine(projectId, existing.id, {
        name: body.vendorName,
        description: body.rfqTitle,
        committedAmount: body.quotedPrice,
        plannedAmount: Math.max(existing.plannedAmount, body.quotedPrice),
        category,
        taskId: body.taskId ?? existing.taskId,
        cashMonth,
        source: "rfq",
        sourceRef,
      }))!;
    } else {
      line = await this.createLine(projectId, {
        category,
        name: body.vendorName,
        description: body.rfqTitle,
        plannedAmount: body.quotedPrice,
        committedAmount: body.quotedPrice,
        actualAmount: 0,
        cashMonth,
        taskId: body.taskId,
        source: "rfq",
        sourceRef,
      });
    }

    const overview = await this.recalculate(projectId, false);
    return { line, overview };
  }

  applyCostPatch(patch: Partial<import("@nexus/shared").Task>): Partial<import("@nexus/shared").Task> {
    const hasCost =
      patch.plannedLaborCost !== undefined ||
      patch.plannedMaterialCost !== undefined ||
      patch.plannedOtherCost !== undefined ||
      patch.actualLaborCost !== undefined ||
      patch.actualMaterialCost !== undefined ||
      patch.actualOtherCost !== undefined;
    if (!hasCost) return patch;
    const merged = { ...patch } as import("@nexus/shared").Task;
    return syncTaskCostTotals(merged as import("@nexus/shared").Task);
  }
}
