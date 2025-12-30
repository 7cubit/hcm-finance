import { Controller, Get, Post, Body, Param, Query, UseGuards, Version, Req } from '@nestjs/common';
import type { Request } from 'express';
import { StagingApprovalService } from './staging-approval.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AnomalyEngineService } from './anomaly-engine.service';

@Controller('google-workspace/approvals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StagingApprovalController {
  constructor(
    private readonly approvalService: StagingApprovalService,
    private readonly anomalyEngine: AnomalyEngineService,
  ) {}

  /**
   * Get client IP address from request
   */
  private getClientIp(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
      || req.socket.remoteAddress 
      || 'unknown';
  }

  @Get()
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER', 'AUDITOR')
  async getPending(@Query('departmentId') departmentId?: string) {
    return this.approvalService.getPendingApprovals(departmentId);
  }

  @Post(':id/approve')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async approve(
    @Param('id') id: string,
    @Body('category') category: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const ipAddress = this.getClientIp(req);
    return this.approvalService.approve(id, user.id, user.email, ipAddress, category);
  }

  @Post(':id/reject')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async reject(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const ipAddress = this.getClientIp(req);
    return this.approvalService.reject(id, user.id, user.email, ipAddress, reason);
  }

  @Post('bulk-approve')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async bulkApprove(
    @Body('ids') ids: string[],
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const ipAddress = this.getClientIp(req);
    return this.approvalService.bulkApprove(ids, user.id, user.email, ipAddress);
  }

  @Post('anomalies/:id/ignore')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async ignoreAnomaly(@Param('id') id: string, @CurrentUser() user: any) {
    return this.anomalyEngine.ignoreAnomaly(id, user.id);
  }
}
