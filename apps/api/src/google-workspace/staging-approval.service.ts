import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient, StagingStatus, TransactionType } from '@prisma/client';
import { SheetFeedbackService } from './sheet-feedback.service';
import { AnomalyEngineService } from './anomaly-engine.service';
import { AuditLogService } from '../common/audit-log.service';
import { SanitizerService } from '../common/sanitizer.service';
import { ReceiptPreservationService } from './receipt-preservation.service';

const prisma = new PrismaClient();

@Injectable()
export class StagingApprovalService {
  private readonly logger = new Logger(StagingApprovalService.name);

  constructor(
    private readonly feedbackService: SheetFeedbackService,
    private readonly anomalyEngine: AnomalyEngineService,
    private readonly auditLog: AuditLogService,
    private readonly sanitizer: SanitizerService,
    private readonly receiptService: ReceiptPreservationService,
  ) { }

  async getPendingApprovals(departmentId?: string) {
    const items = await prisma.stagingTransaction.findMany({
      where: {
        status: StagingStatus.PENDING,
        ...(departmentId ? { externalSheet: { departmentId } } : {}),
      },
      include: {
        externalSheet: {
          include: {
            department: true,
          },
        },
        anomalies: {
          where: { isIgnored: false }
        }
      },
      orderBy: { date: 'desc' },
    });

    // Resolve signed URLs for receipts
    return Promise.all(items.map(async (item) => ({
      ...item,
      receiptUrl: item.receiptUrl ? await this.receiptService.getSignedUrl(item.receiptUrl) : null,
    })));
  }

  async approve(
    id: string,
    adminUserId: string,
    adminUserEmail: string,
    ipAddress: string,
    correctedCategory?: string
  ) {
    const staging = await prisma.stagingTransaction.findUnique({
      where: { id },
      include: {
        externalSheet: {
          include: { department: true }
        }
      },
    });

    if (!staging) throw new NotFoundException('Staging transaction not found');
    if (staging.status !== StagingStatus.PENDING) {
      throw new BadRequestException(`Cannot approve transaction with status ${staging.status}`);
    }

    // Sanitize category input
    const sanitizedCategory = correctedCategory
      ? this.sanitizer.sanitizeString(correctedCategory)
      : staging.category;

    // 1. Move to Ledger (Transaction model)
    const account = await prisma.account.findFirst({ where: { type: 'BANK', isActive: true } });
    if (!account) throw new BadRequestException('No active bank account found for ledger entry');

    const transaction = await prisma.transaction.create({
      data: {
        type: TransactionType.EXPENSE,
        amount: staging.amount,
        description: this.sanitizer.sanitizeString(staging.description) || 'Sheet Import',
        date: staging.date || new Date(),
        receiptUrl: staging.receiptUrl,
        accountId: account.id,
        recordedById: adminUserId,
        splits: {
          create: {
            amount: staging.amount,
            fundId: (await prisma.fund.findFirst())?.id || '',
          }
        }
      }
    });

    // 2. Update Staging Status
    await prisma.stagingTransaction.update({
      where: { id },
      data: {
        status: StagingStatus.APPROVED,
        category: sanitizedCategory,
      },
    });

    // 3. Audit Log - Track approval with IP address
    await this.auditLog.logApproval(
      id,
      adminUserId,
      adminUserEmail,
      ipAddress,
      true, // approved
      `Approved. Amount: ${staging.amount}, Category: ${sanitizedCategory}`
    );

    // 4. Feedback Loop to Google Sheets
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const tabName = staging.date ? monthNames[staging.date.getMonth()] : monthNames[new Date().getMonth()];

    // 5. Train Anomaly Engine (Machine Learning from human approval)
    if (staging.description) {
      await this.anomalyEngine.learnVendor(staging.description, staging.category || 'Archived');
    }

    try {
      await this.feedbackService.updateRowStatus(
        staging.externalSheet.googleSheetId,
        tabName,
        staging.sheetRowIndex,
        'APPROVED',
        `Approved by ${adminUserEmail} on ${new Date().toLocaleDateString()}`
      );
    } catch (error: any) {
      this.logger.error(`Feedback failed for ${id}: ${error.message}`);
    }

    return transaction;
  }

  async reject(
    id: string,
    adminUserId: string,
    adminUserEmail: string,
    ipAddress: string,
    reason: string
  ) {
    const staging = await prisma.stagingTransaction.findUnique({
      where: { id },
      include: { externalSheet: true },
    });

    if (!staging) throw new NotFoundException('Staging transaction not found');

    // Sanitize reason input
    const sanitizedReason = this.sanitizer.sanitizeString(reason);

    // 1. Update Staging Status
    await prisma.stagingTransaction.update({
      where: { id },
      data: {
        status: StagingStatus.REJECTED,
        note: sanitizedReason,
      },
    });

    // 2. Audit Log - Track rejection with IP address
    await this.auditLog.logApproval(
      id,
      adminUserId,
      adminUserEmail,
      ipAddress,
      false, // rejected
      sanitizedReason
    );

    // 3. Feedback Loop to Google Sheets
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const tabName = staging.date ? monthNames[staging.date.getMonth()] : monthNames[new Date().getMonth()];

    try {
      await this.feedbackService.updateRowStatus(
        staging.externalSheet.googleSheetId,
        tabName,
        staging.sheetRowIndex,
        'REJECTED',
        sanitizedReason
      );
    } catch (error: any) {
      this.logger.error(`Feedback failed for ${id}: ${error.message}`);
    }

    return { message: 'Rejected' };
  }

  async bulkApprove(ids: string[], adminUserId: string, adminUserEmail: string, ipAddress: string) {
    const results: any[] = [];
    for (const id of ids) {
      try {
        const tx = await this.approve(id, adminUserId, adminUserEmail, ipAddress);
        results.push({ id, status: 'success', txId: tx.id });
      } catch (error: any) {
        results.push({ id, status: 'error', message: error.message });
      }
    }
    return results;
  }
}
