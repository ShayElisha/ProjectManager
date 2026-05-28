import { Module } from "@nestjs/common";
import { TasksModule } from "../tasks/tasks.module";
import { ProjectFeaturesController, PublicFormsController } from "./project-features.controller";
import { ProjectFeaturesService } from "./project-features.service";

@Module({
  imports: [TasksModule],
  controllers: [ProjectFeaturesController, PublicFormsController],
  providers: [ProjectFeaturesService],
})
export class ProjectFeaturesModule {}
