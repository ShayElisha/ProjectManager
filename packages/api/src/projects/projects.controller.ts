import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import type { UserAccount } from "@nexus/shared";
import { ProjectsService } from "./projects.service";
import type { Project } from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";
import { assertOrgAccess, assertProjectAccess, resolveOrgFilter } from "../common/org-access";

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
    return this.projects.findAll(
      {
        organizationId: orgId,
        parentId: parentId === undefined ? undefined : parentId === "null" ? null : parentId,
        isTemplate: isTemplate === undefined ? undefined : isTemplate === "true",
      },
      req.user,
    );
  }

  @Get(":id")
  get(@Req() req: { user: UserAccount }, @Param("id") id: string) {
    assertProjectAccess(this.db, req.user, id);
    return this.projects.findOne(id);
  }

  @Post()
  create(@Req() req: { user: UserAccount }, @Body() body: Partial<Project>) {
    const organizationId = body.organizationId ?? req.user.organizationId;
    if (!organizationId) throw new ForbiddenException("ORG_REQUIRED");
    assertOrgAccess(req.user, organizationId);
    return this.projects.create({ ...body, organizationId });
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
