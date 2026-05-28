import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { IsIn, IsOptional, IsString } from "class-validator";
import { OrganizationsService } from "./organizations.service";

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
  list() {
    return this.orgs.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.orgs.get(id);
  }

  @Post()
  create(@Body() body: CreateOrgDto) {
    return this.orgs.create(body);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: CreateOrgDto) {
    return this.orgs.update(id, body);
  }
}
