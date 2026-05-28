import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { SearchModule } from "./search/search.module";
import { ProjectFeaturesModule } from "./project-features/project-features.module";
import { ProjectsModule } from "./projects/projects.module";
import { TasksModule } from "./tasks/tasks.module";
import { ResourcesModule } from "./resources/resources.module";
import { CollaborationModule } from "./collaboration/collaboration.module";
import { PortfolioModule } from "./portfolio/portfolio.module";
import { AiModule } from "./ai/ai.module";
import { ReportsModule } from "./reports/reports.module";
import { TeamModule } from "./team/team.module";
import { BudgetModule } from "./budget/budget.module";
import { PmoModule } from "./pmo/pmo.module";
import { RisksModule } from "./risks/risks.module";
import { ChangesModule } from "./changes/changes.module";
import { RejectionsModule } from "./rejections/rejections.module";
import { DatabaseModule } from "./database/database.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { IntegrationsModule } from "./integrations/integrations.module";

const realtimeModules = process.env.VERCEL ? [] : [RealtimeModule];

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    OrganizationsModule,
    SearchModule,
    ProjectFeaturesModule,
    IntegrationsModule,
    ...realtimeModules,
    ProjectsModule,
    TasksModule,
    ResourcesModule,
    CollaborationModule,
    PortfolioModule,
    AiModule,
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
