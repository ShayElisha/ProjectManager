import { Controller, Get, Query } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";
import { SearchService } from "./search.service";

@Controller("search")
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  query(@Query("q") q = "", @Query("organizationId") organizationId?: string) {
    return this.search.search(q, organizationId);
  }
}
