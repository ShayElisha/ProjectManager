import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { UserAccount } from "@nexus/shared";
import { resolveOrgFilter } from "../common/org-access";
import { AiService, type GeneratedPlan } from "./ai.service";

@Controller("ai")
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get("projects/:projectId/analyze")
  analyze(@Param("projectId") projectId: string) {
    return this.ai.analyzeProject(projectId);
  }

  @Get("executive-summary")
  executiveSummary(@Req() req: { user: UserAccount }) {
    return this.ai.executiveSummary(resolveOrgFilter(req.user));
  }

  @Post("generate-plan")
  generatePlan(@Body() body: { prompt: string }) {
    return this.ai.generatePlan(body.prompt ?? "");
  }

  @Get("llm-status")
  llmStatus() {
    return { enabled: Boolean(process.env.OPENAI_API_KEY) };
  }

  @Post("projects/:projectId/apply-plan")
  applyPlan(@Param("projectId") projectId: string, @Body() plan: GeneratedPlan) {
    return this.ai.applyPlan(projectId, plan);
  }
}
