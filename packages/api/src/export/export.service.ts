import { Injectable, NotFoundException } from "@nestjs/common";
import { DataStoreService } from "../database/data-store.service";
import { ReportsService } from "../reports/reports.service";

@Injectable()
export class ExportService {
  constructor(
    private readonly db: DataStoreService,
    private readonly reports: ReportsService,
  ) {}

  tasksCsv(projectId: string): string {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException("Project not found");
    const tasks = this.db.getTasks(projectId);
    const header = "id,wbs,name,status,startDate,endDate,durationDays,percentComplete,isCritical";
    const rows = tasks.map(
      (t) =>
        `${t.id},${t.wbs},"${t.name.replace(/"/g, '""')}",${t.status},${t.startDate},${t.endDate},${t.durationDays},${t.percentComplete},${t.isCritical ?? false}`,
    );
    return [header, ...rows].join("\n");
  }

  biSnapshot(projectId: string) {
    const project = this.db.getProject(projectId);
    if (!project) throw new NotFoundException("Project not found");
    const tasks = this.db.getTasks(projectId);
    const status = this.reports.projectStatus(projectId);
    const resources = this.reports.resourceLoad(projectId);
    return {
      exportedAt: new Date().toISOString(),
      project: { id: project.id, name: project.name, currency: project.currency },
      summary: status,
      resources: resources.resources,
      tasks: tasks.map((t) => ({
        id: t.id,
        wbs: t.wbs,
        name: t.name,
        status: t.status,
        startDate: t.startDate,
        endDate: t.endDate,
        percentComplete: t.percentComplete,
        plannedCost: t.plannedCost,
        actualCost: t.actualCost,
      })),
    };
  }

  biCsv(data: ReturnType<ExportService["biSnapshot"]>): string {
    const header = "wbs,name,status,startDate,endDate,percentComplete,plannedCost,actualCost";
    const rows = data.tasks.map(
      (t) =>
        `${t.wbs},"${t.name.replace(/"/g, '""')}",${t.status},${t.startDate},${t.endDate},${t.percentComplete},${t.plannedCost ?? 0},${t.actualCost ?? 0}`,
    );
    return [header, ...rows].join("\n");
  }
}
