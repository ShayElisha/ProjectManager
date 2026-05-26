import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import type { ManualRejectionCategory } from "@nexus/shared";
import { RejectionsService } from "./rejections.service";

@Controller("rejections")
export class RejectionsController {
  constructor(private readonly rejections: RejectionsService) {}

  @Get("suggestions")
  suggestions(@Query("projectId") projectId: string) {
    return this.rejections.suggest(projectId);
  }

  @Get()
  list(@Query("projectId") projectId?: string) {
    return this.rejections.list(projectId || undefined);
  }

  @Post()
  create(
    @Body()
    body: {
      projectId: string;
      title: string;
      description?: string;
      category: ManualRejectionCategory;
      rejectedAt: string;
      decisionNote?: string;
      impactScheduleDays?: number;
      impactCost?: number;
      taskId?: string;
    },
  ) {
    return this.rejections.createManual(body);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.rejections.deleteManual(id);
    return { ok: true };
  }
}
