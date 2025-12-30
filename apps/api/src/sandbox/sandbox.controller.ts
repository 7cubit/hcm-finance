import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Version } from '@nestjs/common';
import { SandboxService } from './sandbox.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('sandbox')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SandboxController {
  constructor(private readonly sandboxService: SandboxService) {}

  /**
   * Get sandbox status
   */
  @Get('status')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER', 'AUDITOR')
  async getStatus() {
    return this.sandboxService.getSandboxStatus();
  }

  /**
   * Enable sandbox mode for a department
   */
  @Post('enable/:departmentId')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async enable(
    @Param('departmentId') departmentId: string,
    @CurrentUser() user: any,
  ) {
    return this.sandboxService.enableSandboxMode(departmentId, user.id);
  }

  /**
   * Disable sandbox mode for a department
   */
  @Post('disable/:departmentId')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async disable(@Param('departmentId') departmentId: string) {
    return this.sandboxService.disableSandboxMode(departmentId);
  }

  /**
   * Reset all sandbox data
   */
  @Delete('reset')
  @Version('1')
  @Roles('SUPER_ADMIN')
  async reset() {
    return this.sandboxService.resetSandboxData();
  }

  /**
   * Graduate a user (mark as trained)
   */
  @Post('graduate/:userId')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async graduate(
    @Param('userId') userId: string,
    @CurrentUser() admin: any,
  ) {
    return this.sandboxService.graduateUser(userId, admin.id);
  }

  /**
   * Get training progress for all users
   */
  @Get('progress')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async getProgress() {
    return this.sandboxService.getTrainingProgress();
  }

  /**
   * Submit feedback/bug report
   */
  @Post('feedback')
  @Version('1')
  async submitFeedback(
    @Body('type') feedbackType: 'BUG' | 'SUGGESTION' | 'QUESTION',
    @Body('message') message: string,
    @Body('screenshot') screenshot: string,
    @CurrentUser() user: any,
  ) {
    return this.sandboxService.submitFeedback(
      user.email,
      feedbackType,
      message,
      screenshot,
    );
  }

  /**
   * Get all feedback reports
   */
  @Get('feedback')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async getFeedback(@Query('status') status?: string) {
    return this.sandboxService.getFeedback(status);
  }

  /**
   * Resolve feedback
   */
  @Post('feedback/:id/resolve')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async resolveFeedback(@Param('id') id: string) {
    return this.sandboxService.resolveFeedback(id);
  }
}
