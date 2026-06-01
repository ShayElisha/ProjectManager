import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module";
import { ProjectsModule } from "./projects/projects.module";
import { TasksModule } from "./tasks/tasks.module";
import { ResourcesModule } from "./resources/resources.module";
import { CollaborationModule } from "./collaboration/collaboration.module";
import { PortfolioModule } from "./portfolio/portfolio.module";
import { ReportsModule } from "./reports/reports.module";
import { TeamModule } from "./team/team.module";
import { BudgetModule } from "./budget/budget.module";
import { PmoModule } from "./pmo/pmo.module";
import { RisksModule } from "./risks/risks.module";
import { ChangesModule } from "./changes/changes.module";
import { RejectionsModule } from "./rejections/rejections.module";
import { DatabaseModule } from "./database/database.module";
import { ProjectAccessInterceptor } from "./common/project-access.interceptor";

@Module({
  providers: [{ provide: APP_INTERCEPTOR, useClass: ProjectAccessInterceptor }],
  imports: [
    DatabaseModule,
    AuthModule,
    ProjectsModule,
    TasksModule,
    ResourcesModule,
    CollaborationModule,
    PortfolioModule,
    ReportsModule,
    TeamModule,
    BudgetModule,
    PmoModule,
    RisksModule,
    ChangesModule,
    RejectionsModule,
  ],
})
export class AppModule {}
