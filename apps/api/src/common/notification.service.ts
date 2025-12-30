import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async sendEmail(to: string, subject: string, body: string) {
    // In a real production app, you'd use @nestjs-modules/mailer or direct SMTP/SES
    this.logger.log(`📧 Sending Email to: ${to}`);
    this.logger.log(`Subject: ${subject}`);
    this.logger.log(`Body: ${body}`);

    // Simulating success
    return true;
  }

  async notifyMonthLock(deptHeadEmail: string, month: string) {
    const subject = `${month} is now closed`;
    const body = `Hello Department Head,\n\nFinancial records for ${month} are now locked and closed for review. Please contact the Treasurer if corrections are needed.`;

    return this.sendEmail(deptHeadEmail, subject, body);
  }
}
