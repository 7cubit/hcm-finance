import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Version,
} from '@nestjs/common';
import { IncomeService } from './income.service';
import { CreateIncomeDto, IncomeFilterDto } from './dto/income.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('income')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  /**
   * Create new income transaction with splits
   * POST /api/v1/income
   */
  @Post()
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER', 'STAFF')
  async createIncome(
    @Body() dto: CreateIncomeDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.incomeService.createIncome(dto, userId);
  }

  /**
   * Get all income transactions with filters
   * GET /api/v1/income
   */
  @Get()
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER', 'AUDITOR', 'STAFF', 'VIEWER')
  async getIncome(@Query() filters: IncomeFilterDto) {
    return this.incomeService.getIncome(filters);
  }

  /**
   * Get income summary by fund
   * GET /api/v1/income/summary
   */
  @Get('summary')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER', 'AUDITOR', 'VIEWER')
  async getIncomeSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.incomeService.getIncomeSummary(startDate, endDate);
  }

  /**
   * Get single income transaction by ID
   * GET /api/v1/income/:id
   */
  @Get(':id')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER', 'AUDITOR', 'STAFF', 'VIEWER')
  async getIncomeById(@Param('id') id: string) {
    return this.incomeService.getIncomeById(id);
  }
}
