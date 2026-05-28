import { Controller, Get, Query, Req } from "@nestjs/common";
import type { UserAccount } from "@nexus/shared";
import { resolveOrgFilter } from "../common/org-access";
import { SearchService } from "./search.service";

@Controller("search")
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  query(
    @Req() req: { user: UserAccount },
    @Query("q") q = "",
    @Query("organizationId") organizationId?: string,
  ) {
    const orgId = resolveOrgFilter(req.user, organizationId);
    return this.search.search(q, orgId);
  }
}
