import { Controller, Post, Body, Headers, Logger, HttpCode } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Webhook handler for inbound emails from emailit
 * Configure webhook URL in emailit dashboard: https://your-api.com/api/v1/webhooks/email/inbound
 */
@Controller('webhooks/email')
export class EmailWebhookController {
  private readonly logger = new Logger(EmailWebhookController.name);

  /**
   * Handle inbound email (e.g., replies to notifications)
   * emailit sends email data to this endpoint
   */
  @Post('inbound')
  @HttpCode(200)
  async handleInbound(
    @Body() body: {
      from: string;
      to: string;
      subject: string;
      text?: string;
      html?: string;
      headers?: Record<string, string>;
      attachments?: Array<{ filename: string; content: string; contentType: string }>;
      messageId?: string;
    },
    @Headers('x-emailit-signature') signature?: string,
  ) {
    this.logger.log(`📨 Inbound email from ${body.from} to ${body.to}`);

    // Log inbound email
    await prisma.notificationLog.create({
      data: {
        type: 'INBOUND_EMAIL',
        eventType: 'INBOUND',
        recipient: body.to,
        subject: body.subject,
        content: body.text || body.html,
        status: 'RECEIVED',
        messageId: body.messageId,
        sentAt: new Date(),
      },
    });

    // Parse the email for specific actions
    const textContent = (body.text || '').toLowerCase().trim();

    // Handle unlock request approval via email reply
    if (body.subject.includes('Unlock Request') && textContent.includes('yes')) {
      this.logger.log(`✅ Unlock approved via email reply from ${body.from}`);
      // TODO: Trigger unlock action
    }

    // Handle rejection via email reply
    if (textContent.startsWith('reject:')) {
      const reason = textContent.replace('reject:', '').trim();
      this.logger.log(`❌ Rejection via email from ${body.from}: ${reason}`);
      // TODO: Trigger rejection action
    }

    return { success: true, message: 'Inbound email processed' };
  }

  /**
   * Handle email delivery status webhooks (bounces, opens, clicks)
   * emailit sends delivery events to this endpoint
   */
  @Post('status')
  @HttpCode(200)
  async handleStatus(
    @Body() body: {
      event: 'delivered' | 'bounced' | 'opened' | 'clicked' | 'complained' | 'unsubscribed';
      messageId: string;
      recipient: string;
      timestamp: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    this.logger.log(`📊 Email ${body.event}: ${body.recipient} (${body.messageId})`);

    // Update notification log based on event
    const statusMap: Record<string, string> = {
      delivered: 'DELIVERED',
      bounced: 'BOUNCED',
      opened: 'OPENED',
      clicked: 'CLICKED',
      complained: 'COMPLAINED',
      unsubscribed: 'UNSUBSCRIBED',
    };

    await prisma.notificationLog.updateMany({
      where: { messageId: body.messageId },
      data: {
        status: statusMap[body.event] || body.event.toUpperCase(),
        deliveredAt: body.event === 'delivered' ? new Date(body.timestamp) : undefined,
      },
    });

    return { success: true };
  }

  /**
   * Handle unsubscribe requests
   */
  @Post('unsubscribe')
  @HttpCode(200)
  async handleUnsubscribe(
    @Body() body: { email: string; userId?: string; token?: string },
  ) {
    this.logger.log(`🔕 Unsubscribe request from ${body.email}`);

    // Find user by email and disable notifications
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    
    if (user) {
      await prisma.notificationPreference.upsert({
        where: { userId: user.id },
        create: { userId: user.id, emailEnabled: false },
        update: { emailEnabled: false },
      });
    }

    return { success: true, message: 'Unsubscribed successfully' };
  }
}
