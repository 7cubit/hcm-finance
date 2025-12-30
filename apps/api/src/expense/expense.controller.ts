import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ExpenseService } from './expense.service';
import {
  CreateExpenseDto,
  UpdateExpenseStatusDto,
  VoidExpenseDto,
  ExpenseFilterDto,
} from './dto/expense.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('expense')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @Post()
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER', 'STAFF')
  async createExpense(
    @Body() dto: CreateExpenseDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.expenseService.createExpense(dto, userId);
  }

  @Get()
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER', 'AUDITOR', 'STAFF', 'VIEWER')
  async getExpenses(@Query() filters: ExpenseFilterDto) {
    return this.expenseService.getExpenses(filters);
  }

  @Get('approvals')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async getPendingApprovals() {
    return this.expenseService.getPendingApprovals();
  }

  @Patch(':id/status')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseStatusDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    return this.expenseService.updateExpenseStatus(id, dto, userId, userRole);
  }

  @Patch(':id/void')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async voidExpense(
    @Param('id') id: string,
    @Body() dto: VoidExpenseDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.expenseService.voidExpense(id, dto, userId);
  }
}
