import { Module, forwardRef } from "@nestjs/common";
import { TasksModule } from "../tasks/tasks.module";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationsPublicController } from "./integrations-public.controller";
import { IntegrationsService } from "./integrations.service";
import { WebhookDispatcherService } from "./webhook-dispatcher.service";

@Module({
  imports: [forwardRef(() => TasksModule)],
  controllers: [IntegrationsController, IntegrationsPublicController],
  providers: [IntegrationsService, WebhookDispatcherService],
  exports: [WebhookDispatcherService],
})
export class IntegrationsModule {}
