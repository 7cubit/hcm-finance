import { Controller, Get, UseGuards, Version } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  // Dashboard stats - requires at least VIEWER role
  @Get('dashboard')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER', 'AUDITOR', 'STAFF', 'VIEWER')
  getDashboard(@CurrentUser() user: any) {
    return {
      message: 'Admin Dashboard',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      stats: {
        totalFunds: 4,
        totalAccounts: 3,
        pendingTransactions: 0,
        monthlyIncome: 0,
        monthlyExpense: 0,
      },
    };
  }

  // Financial data - requires TREASURER or higher
  @Get('finances')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER', 'AUDITOR')
  getFinances() {
    return {
      message: 'Financial Overview',
      data: {
        funds: [],
        accounts: [],
        recentTransactions: [],
      },
    };
  }

  // Audit logs - requires AUDITOR or higher
  @Get('audit')
  @Version('1')
  @Roles('SUPER_ADMIN', 'AUDITOR')
  getAuditLogs() {
    return {
      message: 'Audit Logs',
      logs: [],
    };
  }

  // System settings - SUPER_ADMIN only
  @Get('settings')
  @Version('1')
  @Roles('SUPER_ADMIN')
  getSettings() {
    return {
      message: 'System Settings',
      settings: {
        currency: 'JPY',
        fiscalYearStart: 'April',
        timezone: 'Asia/Tokyo',
      },
    };
  }
}
