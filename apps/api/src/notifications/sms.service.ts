import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly accountSid = process.env.TWILIO_ACCOUNT_SID;
  private readonly authToken = process.env.TWILIO_AUTH_TOKEN;
  private readonly fromNumber = process.env.TWILIO_PHONE_NUMBER;

  /**
   * Send SMS via Twilio
   */
  async send(to: string, message: string, eventType: string, userId?: string): Promise<string | null> {
    // Log notification attempt
    const log = await prisma.notificationLog.create({
      data: {
        type: 'SMS',
        eventType,
        recipient: to,
        content: message,
        status: 'PENDING',
        userId,
      },
    });

    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      this.logger.warn('Twilio credentials not set, skipping SMS');
      await this.updateLogStatus(log.id, 'FAILED', 'Twilio credentials not configured');
      return null;
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: to,
          From: this.fromNumber,
          Body: message,
        }).toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Twilio API error: ${error}`);
      }

      const result = await response.json();
      const messageId = result.sid;

      await this.updateLogStatus(log.id, 'SENT', undefined, messageId);
      this.logger.log(`📱 SMS sent to ${to}`);

      return messageId;
    } catch (error: any) {
      this.logger.error(`Failed to send SMS: ${error.message}`);
      await this.updateLogStatus(log.id, 'FAILED', error.message);
      return null;
    }
  }

  private async updateLogStatus(logId: string, status: string, errorMessage?: string, messageId?: string) {
    await prisma.notificationLog.update({
      where: { id: logId },
      data: {
        status,
        errorMessage,
        messageId,
        sentAt: status === 'SENT' ? new Date() : undefined,
      },
    });
  }

  /**
   * Send urgent unlock request notification
   */
  async sendUnlockRequest(phone: string, details: {
    requestedBy: string;
    month: string;
    year: number;
    reason: string;
  }) {
    const message = `🔓 HCMJ Unlock Request\n${details.requestedBy} requested to unlock ${details.month} ${details.year}.\nReason: ${details.reason}\nReply YES to approve.`;
    return this.send(phone, message, 'UNLOCK_REQUEST');
  }

  /**
   * Send budget exceeded alert (urgent)
   */
  async sendBudgetAlert(phone: string, details: {
    fundName: string;
    exceededBy: number;
  }) {
    const message = `⚠️ HCMJ Budget Alert!\n${details.fundName} exceeded by ¥${details.exceededBy.toLocaleString()}. Immediate attention required.`;
    return this.send(phone, message, 'BUDGET_EXCEEDED');
  }
}
