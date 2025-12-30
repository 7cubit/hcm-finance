import { Controller, Get, Post, Put, Body, Query, UseGuards, Version } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Get notification logs
   */
  @Get('logs')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async getLogs(
    @Query('status') status?: string,
    @Query('eventType') eventType?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationService.getLogs({
      status,
      eventType,
      limit: limit ? parseInt(limit) : 100,
    });
  }

  /**
   * Get user preferences
   */
  @Get('preferences')
  @Version('1')
  async getPreferences(@CurrentUser() user: any) {
    return this.notificationService.getPreferences(user.id);
  }

  /**
   * Update user preferences
   */
  @Put('preferences')
  @Version('1')
  async updatePreferences(
    @CurrentUser() user: any,
    @Body() body: {
      emailEnabled?: boolean;
      smsEnabled?: boolean;
      digestEnabled?: boolean;
      rowRejected?: boolean;
      monthLocked?: boolean;
      budgetExceeded?: boolean;
      unlockRequest?: boolean;
    },
  ) {
    return this.notificationService.updatePreferences(user.id, body);
  }

  /**
   * Send test email (admin only)
   */
  @Post('test')
  @Version('1')
  @Roles('SUPER_ADMIN')
  async sendTest(
    @Body('email') email: string,
    @Body('type') type: 'org' | 'personal',
  ) {
    const html = this.emailService.generateTemplate({
      title: '🧪 Test Email',
      body: `
        <p>This is a test email from HCMJ Finance.</p>
        <p>Email type: <strong>${type}</strong></p>
        <p>Recipient: <strong>${email}</strong></p>
        <p>If you received this, your notification system is working correctly!</p>
      `,
      ctaText: 'View Dashboard',
      ctaLink: process.env.DASHBOARD_URL || 'http://localhost:3000',
    });

    const result = await this.emailService.send(
      { to: email, subject: '🧪 Test Email - HCMJ Finance', html },
      'APPROVAL_COMPLETED'
    );

    return { success: !!result, messageId: result };
  }

  /**
   * Trigger weekly digest manually (admin only)
   */
  @Post('digest')
  @Version('1')
  @Roles('SUPER_ADMIN')
  async triggerDigest() {
    await this.notificationService.sendWeeklyDigests();
    return { success: true, message: 'Weekly digests sent' };
  }
}
