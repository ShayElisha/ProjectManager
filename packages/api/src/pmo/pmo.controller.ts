import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { PmoService } from "./pmo.service";

@Controller("projects/:projectId/pmo")
export class PmoController {
  constructor(private readonly pmo: PmoService) {}

  @Get("baseline-variance")
  baselineVariance(
    @Param("projectId") projectId: string,
    @Query("baselineId") baselineId: string,
  ) {
    return this.pmo.baselineVariance(projectId, baselineId);
  }

  @Post("what-if")
  whatIf(
    @Param("projectId") projectId: string,
    @Body() body: { taskId: string; delayDays: number },
  ) {
    return this.pmo.whatIf(projectId, body.taskId, body.delayDays);
  }

  @Get("schedule-curve")
  scheduleCurve(@Param("projectId") projectId: string, @Query("asOf") asOf?: string) {
    return this.pmo.scheduleCurve(projectId, asOf);
  }

  @Get("forecast")
  forecast(@Param("projectId") projectId: string) {
    return this.pmo.forecast(projectId);
  }
}
