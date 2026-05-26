import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import type { RiskSuggestion } from "@nexus/shared";
import { RisksService } from "./risks.service";
import { CreateRiskDto, UpdateRiskDto } from "./risks.dto";

@Controller("projects/:projectId/risks")
export class RisksController {
  constructor(private readonly risks: RisksService) {}

  @Get()
  list(@Param("projectId") projectId: string) {
    return this.risks.list(projectId);
  }

  @Get("suggestions")
  suggestions(@Param("projectId") projectId: string) {
    return this.risks.suggest(projectId);
  }

  @Post()
  create(@Param("projectId") projectId: string, @Body() body: CreateRiskDto) {
    return this.risks.create(projectId, body);
  }

  @Post("from-suggestion")
  fromSuggestion(
    @Param("projectId") projectId: string,
    @Body() body: RiskSuggestion,
  ) {
    return this.risks.createFromSuggestion(projectId, body);
  }

  @Patch(":riskId")
  update(
    @Param("projectId") projectId: string,
    @Param("riskId") riskId: string,
    @Body() body: UpdateRiskDto,
  ) {
    return this.risks.update(projectId, riskId, body);
  }

  @Delete(":riskId")
  remove(@Param("projectId") projectId: string, @Param("riskId") riskId: string) {
    return this.risks.remove(projectId, riskId);
  }
}
