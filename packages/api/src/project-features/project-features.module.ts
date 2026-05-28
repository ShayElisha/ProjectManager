import { Module } from "@nestjs/common";
import { TasksModule } from "../tasks/tasks.module";
import {
  GuestAccessController,
  ProjectFeaturesController,
  PublicFormsController,
} from "./project-features.controller";
import { ProjectFeaturesService } from "./project-features.service";
import { EmailService } from "../email/email.service";

@Module({
  imports: [TasksModule],
  controllers: [ProjectFeaturesController, PublicFormsController, GuestAccessController],
  providers: [ProjectFeaturesService, EmailService],
})
export class ProjectFeaturesModule {}
