import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import type { UserAccount } from "@nexus/shared";
import { ProjectsService } from "./projects.service";
import type { Project } from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";
import { assertProjectAccess, resolveOrgFilter } from "../common/org-access";

@Controller("projects")
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly db: DataStoreService,
  ) {}

  @Get()
  list(
    @Req() req: { user: UserAccount },
    @Query("organizationId") organizationId?: string,
    @Query("parentId") parentId?: string,
    @Query("isTemplate") isTemplate?: string,
  ) {
    const orgId = resolveOrgFilter(req.user, organizationId);
    return this.projects.findAll({
      organizationId: orgId,
      parentId: parentId === undefined ? undefined : parentId === "null" ? null : parentId,
      isTemplate: isTemplate === undefined ? undefined : isTemplate === "true",
    });
  }

  @Get(":id")
  get(@Req() req: { user: UserAccount }, @Param("id") id: string) {
    assertProjectAccess(this.db, req.user, id);
    return this.projects.findOne(id);
  }

  @Post()
  create(@Req() req: { user: UserAccount }, @Body() body: Partial<Project>) {
    const organizationId = body.organizationId ?? req.user.organizationId;
    return this.projects.create({ ...body, organizationId });
  }

  @Post(":id/duplicate")
  duplicate(
    @Req() req: { user: UserAccount },
    @Param("id") id: string,
    @Body() body: { name: string; organizationId?: string; parentId?: string | null },
  ) {
    assertProjectAccess(this.db, req.user, id);
    return this.projects.duplicate(id, body);
  }

  @Post("from-template/:templateId")
  createFromTemplate(
    @Req() req: { user: UserAccount },
    @Param("templateId") templateId: string,
    @Body() body: { name: string; organizationId?: string; parentId?: string | null },
  ) {
    assertProjectAccess(this.db, req.user, templateId);
    return this.projects.createFromTemplate(templateId, body);
  }

  @Post(":id/save-as-template")
  saveAsTemplate(
    @Req() req: { user: UserAccount },
    @Param("id") id: string,
    @Body() body: { name?: string },
  ) {
    assertProjectAccess(this.db, req.user, id);
    return this.projects.saveAsTemplate(id, body.name);
  }

  @Patch(":id")
  update(
    @Req() req: { user: UserAccount },
    @Param("id") id: string,
    @Body() body: Partial<Project>,
  ) {
    assertProjectAccess(this.db, req.user, id);
    return this.projects.update(id, body);
  }

  @Delete(":id")
  remove(@Req() req: { user: UserAccount }, @Param("id") id: string) {
    assertProjectAccess(this.db, req.user, id);
    return this.projects.remove(id);
  }

  @Get(":id/evm")
  evm(@Req() req: { user: UserAccount }, @Param("id") id: string) {
    assertProjectAccess(this.db, req.user, id);
    return this.projects.getEVM(id);
  }

  @Post(":id/import")
  import(
    @Req() req: { user: UserAccount },
    @Param("id") id: string,
    @Body() body: { tasks?: unknown[]; dependencies?: unknown[] },
  ) {
    assertProjectAccess(this.db, req.user, id);
    return this.projects.importProject(id, body as { tasks?: import("@nexus/shared").Task[]; dependencies?: import("@nexus/shared").TaskDependency[] });
  }

  @Get(":id/export")
  export(@Req() req: { user: UserAccount }, @Param("id") id: string, @Res() res: Response) {
    assertProjectAccess(this.db, req.user, id);
    const data = this.projects.exportProject(id);
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="nexus-${id.slice(0, 8)}.json"`,
    );
    res.send(data);
  }
}
