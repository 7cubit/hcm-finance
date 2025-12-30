import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsEnum,
  Min,
  ValidateIf,
} from 'class-validator';

export enum ExpenseStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
  VOIDED = 'VOIDED',
}

export enum RecurrenceType {
  NONE = 'NONE',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

export class CreateExpenseDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string; // Default: JPY

  @IsString()
  payee: string;

  @IsString()
  description: string;

  @IsString()
  fundId: string;

  @IsString()
  accountId: string;

  @IsOptional()
  @IsString()
  beneficiaryId?: string; // For benevolence payments

  @IsOptional()
  @IsBoolean()
  isBenevolence?: boolean;

  @IsOptional()
  @IsBoolean()
  hideIdentityInReports?: boolean; // Privacy flag

  @IsOptional()
  @IsEnum(RecurrenceType)
  recurrenceType?: RecurrenceType;

  @IsOptional()
  @IsDateString()
  recurrenceEndDate?: string;

  // Receipt required for expenses > 1000 JPY
  @ValidateIf((o) => o.amount > 1000)
  @IsString({ message: 'Receipt URL is required for expenses over ¥1,000' })
  attachmentUrl?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(ExpenseStatus)
  status?: ExpenseStatus; // Default: DRAFT
}

export class UpdateExpenseStatusDto {
  @IsEnum(ExpenseStatus)
  status: ExpenseStatus;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class VoidExpenseDto {
  @IsString()
  reason: string;
}

export class ExpenseFilterDto {
  @IsOptional()
  @IsEnum(ExpenseStatus)
  status?: ExpenseStatus;

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
  accountId?: string;

  @IsOptional()
  @IsBoolean()
  pendingApproval?: boolean;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}
