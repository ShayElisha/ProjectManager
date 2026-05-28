import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import type { UserAccount } from "@nexus/shared";
import { resolveOrgFilter } from "../common/org-access";
import { PortfolioService } from "./portfolio.service";

@Controller("portfolio")
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  overview(@Req() req: { user: UserAccount }) {
    const orgId = resolveOrgFilter(req.user);
    return this.portfolio.getOverview(orgId);
  }

  @Get("executive")
  executive(@Req() req: { user: UserAccount }) {
    const orgId = resolveOrgFilter(req.user);
    return this.portfolio.getExecutive(orgId);
  }

  @Post("simulate-load")
  simulateLoad(
    @Req() req: { user: UserAccount },
    @Body() body: { extraHoursPerWeek?: number; resourceId?: string },
  ) {
    const orgId = resolveOrgFilter(req.user);
    return this.portfolio.simulateLoad(orgId, body);
  }
}
