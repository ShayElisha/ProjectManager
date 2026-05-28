import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { ProjectsService } from "./projects.service";
import type { Project } from "@nexus/shared";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(
    @Query("organizationId") organizationId?: string,
    @Query("parentId") parentId?: string,
    @Query("isTemplate") isTemplate?: string,
  ) {
    return this.projects.findAll({
      organizationId,
      parentId: parentId === undefined ? undefined : parentId === "null" ? null : parentId,
      isTemplate: isTemplate === undefined ? undefined : isTemplate === "true",
    });
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.projects.findOne(id);
  }

  @Post()
  create(@Body() body: Partial<Project>) {
    return this.projects.create(body);
  }

  @Post(":id/duplicate")
  duplicate(@Param("id") id: string, @Body() body: { name: string; organizationId?: string; parentId?: string | null }) {
    return this.projects.duplicate(id, body);
  }

  @Post("from-template/:templateId")
  createFromTemplate(
    @Param("templateId") templateId: string,
    @Body() body: { name: string; organizationId?: string; parentId?: string | null },
  ) {
    return this.projects.createFromTemplate(templateId, body);
  }

  @Post(":id/save-as-template")
  saveAsTemplate(@Param("id") id: string, @Body() body: { name?: string }) {
    return this.projects.saveAsTemplate(id, body.name);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: Partial<Project>) {
    return this.projects.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.projects.remove(id);
  }

  @Get(":id/evm")
  evm(@Param("id") id: string) {
    return this.projects.getEVM(id);
  }

  @Post(":id/import")
  import(
    @Param("id") id: string,
    @Body() body: { tasks?: unknown[]; dependencies?: unknown[] },
  ) {
    return this.projects.importProject(id, body as { tasks?: import("@nexus/shared").Task[]; dependencies?: import("@nexus/shared").TaskDependency[] });
  }

  @Get(":id/export")
  export(@Param("id") id: string, @Res() res: Response) {
    const data = this.projects.exportProject(id);
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="nexus-${id.slice(0, 8)}.json"`,
    );
    res.send(JSON.stringify(data, null, 2));
  }
}
