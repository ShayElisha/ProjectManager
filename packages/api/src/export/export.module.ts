import { Module } from "@nestjs/common";
import { ReportsModule } from "../reports/reports.module";
import { ExportController } from "./export.controller";
import { ExportService } from "./export.service";

@Module({
  imports: [ReportsModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
