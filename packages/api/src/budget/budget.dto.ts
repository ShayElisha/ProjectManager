import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import type { BudgetCategory } from "@nexus/shared";

const CATEGORIES: BudgetCategory[] = [
  "labor",
  "material",
  "equipment",
  "subcontractor",
  "other",
];

const MATERIAL_CATEGORIES: BudgetCategory[] = ["material", "equipment", "subcontractor"];

export class CreateBudgetLineDto {
  @IsIn(CATEGORIES)
  category!: BudgetCategory;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsNumber()
  @Min(0)
  plannedAmount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  committedAmount?: number;

  @IsNumber()
  @Min(0)
  actualAmount!: number;

  @Matches(/^\d{4}-\d{2}$/, { message: "cashMonth must be YYYY-MM" })
  cashMonth!: string;

  @IsOptional()
  @IsString()
  taskId?: string;

  @IsOptional()
  @IsIn(["manual", "rfq", "import"])
  source?: "manual" | "rfq" | "import";

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceRef?: string;
}

export class UpdateBudgetLineDto {
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: BudgetCategory;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  plannedAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  committedAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  actualAmount?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: "cashMonth must be YYYY-MM" })
  cashMonth?: string;

  @IsOptional()
  @IsString()
  taskId?: string | null;

  @IsOptional()
  @IsIn(["manual", "rfq", "import"])
  source?: "manual" | "rfq" | "import";

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceRef?: string;
}

export class RecalculateBudgetDto {
  @IsOptional()
  overwriteManual?: boolean;
}

export class BudgetReceiptDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  cashMonth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsBoolean()
  replace?: boolean;
}

export class SyncBudgetFromRfqDto {
  @IsString()
  comparisonId!: string;

  @IsString()
  vendorId!: string;

  @IsString()
  @MinLength(1)
  vendorName!: string;

  @IsString()
  @MinLength(1)
  rfqTitle!: string;

  @IsNumber()
  @Min(0)
  quotedPrice!: number;

  @IsOptional()
  @IsIn(MATERIAL_CATEGORIES)
  category?: BudgetCategory;

  @IsOptional()
  @IsString()
  taskId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  cashMonth?: string;
}
