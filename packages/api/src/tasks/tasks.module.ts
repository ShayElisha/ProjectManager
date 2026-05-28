import { Module, forwardRef } from "@nestjs/common";
import { BudgetModule } from "../budget/budget.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import {
  AttachmentsDownloadController,
  TaskCollaborationController,
} from "./task-collaboration.controller";

@Module({
  imports: [BudgetModule, forwardRef(() => IntegrationsModule)],
  controllers: [TasksController, TaskCollaborationController, AttachmentsDownloadController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
