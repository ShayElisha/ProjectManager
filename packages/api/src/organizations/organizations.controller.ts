import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { IsIn, IsOptional, IsString } from "class-validator";
import type { UserAccount } from "@nexus/shared";
import { roleAtLeast } from "@nexus/shared";
import { OrganizationsService } from "./organizations.service";
import { assertOrgAccess } from "../common/org-access";
import { Roles } from "../auth/roles.decorator";

class CreateOrgDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsIn(["he", "en"])
  defaultLocale?: "he" | "en";

  @IsOptional()
  @IsIn(["ILS", "USD", "EUR"])
  defaultCurrency?: "ILS" | "USD" | "EUR";
}

@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Get()
  list(@Req() req: { user: UserAccount }) {
    const all = this.orgs.list();
    if (roleAtLeast(req.user.role, "admin") && !req.user.organizationId) return all;
    if (!req.user.organizationId) return all;
    return all.filter((o) => o.id === req.user.organizationId);
  }

  @Get(":id")
  get(@Req() req: { user: UserAccount }, @Param("id") id: string) {
    assertOrgAccess(req.user, id);
    return this.orgs.get(id);
  }

  @Post()
  @Roles("admin")
  create(@Body() body: CreateOrgDto) {
    return this.orgs.create(body);
  }

  @Patch(":id")
  update(@Req() req: { user: UserAccount }, @Param("id") id: string, @Body() body: CreateOrgDto) {
    assertOrgAccess(req.user, id);
    return this.orgs.update(id, body);
  }
}
