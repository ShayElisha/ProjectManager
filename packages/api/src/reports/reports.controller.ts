import { Controller, Get, Param } from "@nestjs/common";
import { ReportsService } from "./reports.service";

@Controller("projects/:projectId/reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("status")
  status(@Param("projectId") projectId: string) {
    return this.reports.projectStatus(projectId);
  }

  @Get("resources")
  resources(@Param("projectId") projectId: string) {
    return this.reports.resourceLoad(projectId);
  }

  @Get("cashflow")
  cashflow(@Param("projectId") projectId: string) {
    return this.reports.cashFlow(projectId);
  }
}
