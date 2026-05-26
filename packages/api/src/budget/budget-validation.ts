import { BadRequestException } from "@nestjs/common";
import type { BudgetLineItem } from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";

export function assertBudgetLineTaskLink(
  db: DataStoreService,
  projectId: string,
  taskId: string | undefined | null,
): void {
  if (!taskId) return;
  const tasks = db.getTasks(projectId);
  if (!tasks.some((t) => t.id === taskId)) {
    throw new BadRequestException(`taskId ${taskId} not found in project`);
  }
}

export function mergeBudgetLinePatch(
  existing: BudgetLineItem,
  patch: Partial<BudgetLineItem>,
): Omit<BudgetLineItem, "id" | "projectId"> {
  return {
    category: patch.category ?? existing.category,
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    plannedAmount: patch.plannedAmount ?? existing.plannedAmount,
    committedAmount: patch.committedAmount ?? existing.committedAmount,
    actualAmount: patch.actualAmount ?? existing.actualAmount,
    cashMonth: patch.cashMonth ?? existing.cashMonth,
    taskId: patch.taskId !== undefined ? patch.taskId : existing.taskId,
    source: patch.source ?? existing.source,
    sourceRef: patch.sourceRef ?? existing.sourceRef,
  };
}
