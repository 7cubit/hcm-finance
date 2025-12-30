import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient, StagingStatus } from '@prisma/client';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { GoogleWorkspaceService } from '../google-workspace/google-workspace.service';

const prisma = new PrismaClient();

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly googleService: GoogleWorkspaceService,
  ) {}

  /**
   * Check user notification preferences
   */
  private async canNotify(userId: string, eventType: string, channel: 'email' | 'sms'): Promise<boolean> {
    const prefs = await prisma.notificationPreference.findUnique({ where: { userId } });
    
    if (!prefs) return true; // Default to enabled
    
    if (channel === 'email' && !prefs.emailEnabled) return false;
    if (channel === 'sms' && !prefs.smsEnabled) return false;

    switch (eventType) {
      case 'ROW_REJECTED': return prefs.rowRejected;
      case 'MONTH_LOCKED': return prefs.monthLocked;
      case 'BUDGET_EXCEEDED': return prefs.budgetExceeded;
      case 'UNLOCK_REQUEST': return prefs.unlockRequest;
      case 'WEEKLY_DIGEST': return prefs.digestEnabled;
      default: return true;
    }
  }

  /**
   * Notify on row rejection
   */
  async notifyRowRejected(stagingId: string, reason: string, rejectedBy: string) {
    const staging = await prisma.stagingTransaction.findUnique({
      where: { id: stagingId },
      include: { externalSheet: { include: { department: true, users: true } } },
    });

    if (!staging) return;

    // Notify all users on this sheet
    for (const user of staging.externalSheet.users) {
      await this.emailService.sendRowRejected(user.email, {
        description: staging.description || 'Unknown',
        reason,
        department: staging.externalSheet.department?.name || 'Unknown',
        rejectedBy,
      });

      // Add comment to Google Sheet
      await this.addSheetComment(
        staging.externalSheet.googleSheetId,
        staging.sheetRowIndex,
        `❌ REJECTED by ${rejectedBy}: ${reason}`,
        user.email
      );
    }
  }

  /**
   * Notify on month lock
   */
  async notifyMonthLocked(month: string, year: number, lockedBy: string) {
    const departments = await prisma.department.findMany();

    for (const dept of departments) {
      await this.emailService.sendMonthLocked(dept.headEmail, {
        month,
        year,
        lockedBy,
      });
    }
  }

  /**
   * Notify on budget exceeded
   */
  async notifyBudgetExceeded(fundId: string, budgetAmount: number, currentSpent: number) {
    const fund = await prisma.fund.findUnique({ where: { id: fundId } });
    if (!fund) return;

    const exceededBy = currentSpent - budgetAmount;

    // Get treasurer
    const treasurer = await prisma.user.findFirst({ where: { role: 'TREASURER' } });
    if (treasurer) {
      await this.emailService.sendBudgetExceeded(treasurer.email, {
        fundName: fund.name,
        budgetAmount,
        currentSpent,
        exceededBy,
      });

      // Also send SMS for urgent alert
      if (treasurer.phone) {
        await this.smsService.sendBudgetAlert(treasurer.phone, {
          fundName: fund.name,
          exceededBy,
        });
      }
    }
  }

  /**
   * Send weekly digest - runs every Monday at 9 AM
   */
  @Cron('0 9 * * MON')
  async sendWeeklyDigests() {
    this.logger.log('📊 Sending weekly digests...');

    const departments = await prisma.department.findMany({
      include: { externalSheets: true },
    });

    const weekEnd = new Date();
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    for (const dept of departments) {
      // Get transactions from this week
      const transactions = await prisma.stagingTransaction.findMany({
        where: {
          externalSheetId: { in: dept.externalSheets.map(s => s.id) },
          createdAt: { gte: weekStart, lte: weekEnd },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      const totalApproved = transactions.filter(t => t.status === StagingStatus.APPROVED).length;
      const totalPending = transactions.filter(t => t.status === StagingStatus.PENDING).length;
      const totalRejected = transactions.filter(t => t.status === StagingStatus.REJECTED).length;

      await this.emailService.sendWeeklyDigest(dept.headEmail, {
        departmentName: dept.name,
        weekStart: weekStart.toLocaleDateString(),
        weekEnd: weekEnd.toLocaleDateString(),
        items: transactions.map(t => ({
          description: t.description || 'Unknown',
          amount: Number(t.amount),
          status: t.status,
        })),
        totalApproved,
        totalPending,
        totalRejected,
      });
    }

    this.logger.log(`📊 Sent ${departments.length} weekly digests`);
  }

  /**
   * Add comment to Google Sheet tagging user
   */
  private async addSheetComment(sheetId: string, rowIndex: number, comment: string, tagEmail: string) {
    try {
      // Note: Google Sheets API doesn't have direct comment API access via service account
      // We'll add a note to a cell instead
      const sheets = this.googleService.sheetsClient;
      const range = `A${rowIndex}`;

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[`@${tagEmail} ${comment}`]],
        },
      });

      this.logger.log(`💬 Added sheet comment at row ${rowIndex}`);
    } catch (error: any) {
      this.logger.error(`Failed to add sheet comment: ${error.message}`);
    }
  }

  /**
   * Get notification logs
   */
  async getLogs(filters?: { status?: string; eventType?: string; limit?: number }) {
    return prisma.notificationLog.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.eventType && { eventType: filters.eventType }),
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
    });
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId: string, prefs: Partial<{
    emailEnabled: boolean;
    smsEnabled: boolean;
    digestEnabled: boolean;
    rowRejected: boolean;
    monthLocked: boolean;
    budgetExceeded: boolean;
    unlockRequest: boolean;
  }>) {
    return prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...prefs },
      update: prefs,
    });
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: string) {
    return prisma.notificationPreference.findUnique({ where: { userId } });
  }
}
