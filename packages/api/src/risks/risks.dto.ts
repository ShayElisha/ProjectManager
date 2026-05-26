import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import type { RiskCategory, RiskLevel, RiskSource, RiskStatus } from "@nexus/shared";

const LEVELS: RiskLevel[] = ["low", "medium", "high"];
const CATEGORIES: RiskCategory[] = [
  "schedule",
  "budget",
  "resource",
  "technical",
  "scope",
  "external",
];
const SOURCES: RiskSource[] = [
  "manual",
  "template",
  "auto_schedule",
  "auto_evm",
  "auto_resource",
];
const STATUSES: RiskStatus[] = ["open", "mitigated", "closed"];

export class CreateRiskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsIn(CATEGORIES)
  category!: RiskCategory;

  @IsIn(LEVELS)
  probability!: RiskLevel;

  @IsIn(LEVELS)
  impact!: RiskLevel;

  @IsOptional()
  @IsIn(SOURCES)
  source?: RiskSource;

  @IsOptional()
  @IsString()
  ownerResourceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  responsePlan?: string;

  @IsOptional()
  @IsString()
  taskId?: string;
}

export class UpdateRiskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: RiskCategory;

  @IsOptional()
  @IsIn(LEVELS)
  probability?: RiskLevel;

  @IsOptional()
  @IsIn(LEVELS)
  impact?: RiskLevel;

  @IsOptional()
  @IsIn(STATUSES)
  status?: RiskStatus;

  @IsOptional()
  @IsString()
  ownerResourceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  responsePlan?: string;

  @IsOptional()
  @IsString()
  taskId?: string;
}
