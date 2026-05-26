import { Body, Controller, Get, Post } from "@nestjs/common";
import { PortfolioService } from "./portfolio.service";

@Controller("portfolio")
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  overview() {
    return this.portfolio.getOverview();
  }

  @Get("executive")
  executive() {
    return this.portfolio.getExecutive();
  }

  @Post("simulate-load")
  simulateLoad(
    @Body() body: { extraHoursPerWeek?: number; resourceId?: string },
  ) {
    return this.portfolio.simulateLoad(body);
  }
}
