import { Controller, Get, Header, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { ExportService } from "./export.service";

@Controller("export")
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get("projects/:projectId/tasks")
  @Header("Content-Type", "text/csv; charset=utf-8")
  tasksCsv(@Param("projectId") projectId: string, @Res() res: Response) {
    const csv = this.exportService.tasksCsv(projectId);
    res.setHeader("Content-Disposition", `attachment; filename="tasks-${projectId}.csv"`);
    res.send(csv);
  }

  @Get("projects/:projectId/bi")
  biJson(@Param("projectId") projectId: string) {
    return this.exportService.biSnapshot(projectId);
  }

  @Get("projects/:projectId/bi.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  biCsv(@Param("projectId") projectId: string, @Res() res: Response) {
    const data = this.exportService.biSnapshot(projectId);
    res.setHeader("Content-Disposition", `attachment; filename="bi-${projectId}.csv"`);
    res.send(this.exportService.biCsv(data));
  }
}
