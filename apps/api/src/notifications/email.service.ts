import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type NotificationEventType = 
  | 'ROW_REJECTED'
  | 'MONTH_LOCKED'
  | 'BUDGET_EXCEEDED'
  | 'WEEKLY_DIGEST'
  | 'UNLOCK_REQUEST'
  | 'APPROVAL_COMPLETED';

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey = process.env.EMAILIT_API_KEY;
  private readonly fromEmail = process.env.EMAIL_FROM || 'noreply@finance.hcmj.org';
  private readonly fromName = 'HCMJ Finance';
  private readonly dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
  private readonly webhookUrl = process.env.API_URL || 'http://localhost:3001';

  /**
   * Send email via emailit API
   */
  async send(params: EmailParams, eventType: NotificationEventType, userId?: string): Promise<string | null> {
    // Log notification attempt
    const log = await prisma.notificationLog.create({
      data: {
        type: 'EMAIL',
        eventType,
        recipient: params.to,
        subject: params.subject,
        content: params.html,
        status: 'PENDING',
        userId,
      },
    });

    if (!this.apiKey) {
      this.logger.warn('EMAILIT_API_KEY not set, skipping email');
      await this.updateLogStatus(log.id, 'FAILED', 'API key not configured');
      return null;
    }

    try {
      const response = await fetch('https://api.emailit.com/v1/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: params.to,
          subject: params.subject,
          html: params.html,
          reply_to: params.replyTo,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`emailit API error: ${error}`);
      }

      const result = await response.json();
      const messageId = result.id || result.messageId;

      await this.updateLogStatus(log.id, 'SENT', undefined, messageId);
      this.logger.log(`📧 Email sent to ${params.to}: ${params.subject}`);

      return messageId;
    } catch (error: any) {
      this.logger.error(`Failed to send email: ${error.message}`);
      await this.updateLogStatus(log.id, 'FAILED', error.message);
      return null;
    }
  }

  /**
   * Update notification log status
   */
  private async updateLogStatus(
    logId: string, 
    status: string, 
    errorMessage?: string, 
    messageId?: string
  ) {
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
   * Generate HCMJ branded HTML email
   */
  generateTemplate(params: {
    title: string;
    body: string;
    ctaText?: string;
    ctaLink?: string;
    unsubscribeToken?: string;
  }): string {
    const { title, body, ctaText, ctaLink, unsubscribeToken } = params;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">
                🏛️ HCMJ Finance
              </h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 20px;">${title}</h2>
              <div style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${body}
              </div>
              
              ${ctaText && ctaLink ? `
              <div style="margin-top: 30px; text-align: center;">
                <a href="${ctaLink}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  ${ctaText}
                </a>
              </div>
              ` : ''}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
                Holy Cross Marthoma Japanese Church Finance System
                <br>
                ${unsubscribeToken ? `
                <a href="${this.dashboardUrl}/unsubscribe?token=${unsubscribeToken}" style="color: #6366f1;">Manage notification preferences</a>
                ` : ''}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Send Row Rejected notification
   */
  async sendRowRejected(email: string, details: {
    description: string;
    reason: string;
    department: string;
    rejectedBy: string;
  }) {
    const html = this.generateTemplate({
      title: '❌ Transaction Rejected',
      body: `
        <p>A transaction you submitted has been rejected:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Description</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${details.description}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Department</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${details.department}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Rejected By</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${details.rejectedBy}</td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #6b7280;">Reason</td>
            <td style="padding: 8px; color: #ef4444; font-weight: 500;">${details.reason}</td>
          </tr>
        </table>
        <p>Please correct the entry in your Google Sheet and resubmit.</p>
      `,
      ctaText: 'View in Dashboard',
      ctaLink: `${this.dashboardUrl}/admin/approvals`,
    });

    return this.send({ to: email, subject: '❌ Transaction Rejected - HCMJ Finance', html }, 'ROW_REJECTED');
  }

  /**
   * Send Month Locked notification
   */
  async sendMonthLocked(email: string, details: { month: string; year: number; lockedBy: string }) {
    const html = this.generateTemplate({
      title: '🔒 Month Locked',
      body: `
        <p>The month <strong>${details.month} ${details.year}</strong> has been locked by ${details.lockedBy}.</p>
        <p>No further edits can be made to transactions in this period.</p>
        <p>If you need to make changes, please submit an unlock request.</p>
      `,
      ctaText: 'Request Unlock',
      ctaLink: `${this.dashboardUrl}/admin/rollover`,
    });

    return this.send({ to: email, subject: `🔒 ${details.month} ${details.year} Locked - HCMJ Finance`, html }, 'MONTH_LOCKED');
  }

  /**
   * Send Budget Exceeded notification
   */
  async sendBudgetExceeded(email: string, details: {
    fundName: string;
    budgetAmount: number;
    currentSpent: number;
    exceededBy: number;
  }) {
    const html = this.generateTemplate({
      title: '⚠️ Budget Exceeded',
      body: `
        <p style="color: #ef4444; font-weight: 600;">The budget for ${details.fundName} has been exceeded!</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Budget</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">¥${details.budgetAmount.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Currently Spent</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #ef4444; font-weight: 500;">¥${details.currentSpent.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #6b7280;">Over Budget</td>
            <td style="padding: 8px; color: #ef4444; font-weight: 700;">¥${details.exceededBy.toLocaleString()}</td>
          </tr>
        </table>
        <p>Please review and adjust spending or request a budget increase.</p>
      `,
      ctaText: 'View Budget Report',
      ctaLink: `${this.dashboardUrl}/admin/dashboard`,
    });

    return this.send({ to: email, subject: `⚠️ Budget Exceeded: ${details.fundName} - HCMJ Finance`, html }, 'BUDGET_EXCEEDED');
  }

  /**
   * Send Weekly Digest
   */
  async sendWeeklyDigest(email: string, details: {
    departmentName: string;
    weekStart: string;
    weekEnd: string;
    items: Array<{ description: string; amount: number; status: string }>;
    totalApproved: number;
    totalPending: number;
    totalRejected: number;
  }) {
    const itemRows = details.items.slice(0, 10).map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">¥${item.amount.toLocaleString()}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
          <span style="padding: 2px 8px; border-radius: 4px; font-size: 12px; ${
            item.status === 'APPROVED' ? 'background: #d1fae5; color: #059669;' :
            item.status === 'REJECTED' ? 'background: #fee2e2; color: #dc2626;' :
            'background: #fef3c7; color: #d97706;'
          }">${item.status}</span>
        </td>
      </tr>
    `).join('');

    const html = this.generateTemplate({
      title: `📊 Weekly Digest: ${details.departmentName}`,
      body: `
        <p>Here's your weekly summary for <strong>${details.weekStart} - ${details.weekEnd}</strong>:</p>
        
        <div style="display: flex; gap: 16px; margin: 20px 0;">
          <div style="flex: 1; background: #d1fae5; padding: 16px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: #059669;">${details.totalApproved}</div>
            <div style="color: #047857; font-size: 12px;">Approved</div>
          </div>
          <div style="flex: 1; background: #fef3c7; padding: 16px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: #d97706;">${details.totalPending}</div>
            <div style="color: #b45309; font-size: 12px;">Pending</div>
          </div>
          <div style="flex: 1; background: #fee2e2; padding: 16px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: #dc2626;">${details.totalRejected}</div>
            <div style="color: #b91c1c; font-size: 12px;">Rejected</div>
          </div>
        </div>

        ${details.items.length > 0 ? `
        <h3 style="margin-top: 24px; color: #1f2937;">Recent Items</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Description</th>
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Amount</th>
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>
        ` : '<p style="color: #6b7280;">No transactions this week.</p>'}
      `,
      ctaText: 'View Full Report',
      ctaLink: `${this.dashboardUrl}/admin/dashboard`,
    });

    return this.send({ to: email, subject: `📊 Weekly Digest: ${details.departmentName} - HCMJ Finance`, html }, 'WEEKLY_DIGEST');
  }
}
