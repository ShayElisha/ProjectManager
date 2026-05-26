import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ChangesService } from "./changes.service";
import type { ChangeRequestStatus } from "@nexus/shared";

@Controller("projects/:projectId/changes")
export class ChangesController {
  constructor(private readonly changes: ChangesService) {}

  @Get()
  list(@Param("projectId") projectId: string) {
    return this.changes.list(projectId);
  }

  @Post()
  create(
    @Param("projectId") projectId: string,
    @Body()
    body: {
      title: string;
      description?: string;
      impactScheduleDays?: number;
      impactCost?: number;
      requestedBy?: string;
    },
  ) {
    return this.changes.create(projectId, body);
  }

  @Patch(":changeId")
  update(
    @Param("projectId") projectId: string,
    @Param("changeId") changeId: string,
    @Body() body: Partial<{ title: string; description: string; impactScheduleDays: number; impactCost: number }>,
  ) {
    return this.changes.update(projectId, changeId, body);
  }

  @Post(":changeId/submit")
  submit(@Param("projectId") projectId: string, @Param("changeId") changeId: string) {
    return this.changes.transition(projectId, changeId, "submitted");
  }

  @Post(":changeId/approve")
  approve(
    @Param("projectId") projectId: string,
    @Param("changeId") changeId: string,
    @Body() body: { decisionNote?: string },
  ) {
    return this.changes.transition(projectId, changeId, "approved", body.decisionNote);
  }

  @Post(":changeId/reject")
  reject(
    @Param("projectId") projectId: string,
    @Param("changeId") changeId: string,
    @Body() body: { decisionNote?: string },
  ) {
    return this.changes.transition(projectId, changeId, "rejected", body.decisionNote);
  }

  @Delete(":changeId")
  remove(@Param("projectId") projectId: string, @Param("changeId") changeId: string) {
    return this.changes.remove(projectId, changeId);
  }
}
