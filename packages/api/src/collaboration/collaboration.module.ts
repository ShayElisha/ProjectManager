import { Module } from "@nestjs/common";
import { BudgetModule } from "../budget/budget.module";
import { CollaborationController } from "./collaboration.controller";

@Module({
  imports: [BudgetModule],
  controllers: [CollaborationController],
})
export class CollaborationModule {}
