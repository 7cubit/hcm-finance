import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsDateString,
  Min,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SplitDto {
  @IsString()
  fundId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export enum ContributionType {
  LOCAL = 'LOCAL',
  FOREIGN = 'FOREIGN', // FCRA regulated
}

export class CreateIncomeDto {
  @IsNumber()
  @Min(0.01)
  totalAmount: number;

  @IsOptional()
  @IsString()
  currency?: string; // Default: JPY

  @IsString()
  accountId: string; // Bank account receiving the deposit

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitDto)
  splits: SplitDto[];

  @IsOptional()
  @IsString()
  donorId?: string; // null = Anonymous

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsOptional()
  @IsBoolean()
  isSundayCollection?: boolean; // Bulk anonymous gifts

  @IsOptional()
  @IsEnum(ContributionType)
  contributionType?: ContributionType; // LOCAL or FOREIGN (FCRA)

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  proofOfDepositUrl?: string; // Bank slip image URL

  @IsOptional()
  @IsDateString()
  date?: string; // Default: now
}

export class IncomeFilterDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  fundId?: string;

  @IsOptional()
  @IsString()
  donorId?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsEnum(ContributionType)
  contributionType?: ContributionType;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;
}
