import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ResourcesService } from "./resources.service";

@Controller("projects/:projectId/resources")
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Get()
  list(@Param("projectId") projectId: string) {
    return this.resources.listByProject(projectId);
  }

  @Get("leveling")
  leveling(
    @Param("projectId") projectId: string,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.resources.getLevelingSuggestions(
      projectId,
      from ?? "2026-05-01",
      to ?? "2026-06-30",
    );
  }

  @Post("auto-level")
  autoLevel(
    @Param("projectId") projectId: string,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.resources.autoLevel(
      projectId,
      from ?? "2026-05-01",
      to ?? "2026-06-30",
    );
  }

  @Get("capacity")
  capacity(
    @Param("projectId") projectId: string,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    const start = from ?? new Date().toISOString().slice(0, 10);
    const end = new Date();
    end.setDate(end.getDate() + 28);
    return this.resources.getCapacity(
      projectId,
      start,
      to ?? end.toISOString().slice(0, 10),
    );
  }

  @Get("histogram")
  histogram(
    @Param("projectId") projectId: string,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.resources.getHistogram(
      projectId,
      from ?? "2026-05-01",
      to ?? "2026-06-30",
    );
  }
}
