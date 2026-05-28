import { Module } from "@nestjs/common";
import { BudgetModule } from "../budget/budget.module";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import {
  AttachmentsDownloadController,
  TaskCollaborationController,
} from "./task-collaboration.controller";

@Module({
  imports: [BudgetModule],
  controllers: [TasksController, TaskCollaborationController, AttachmentsDownloadController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
