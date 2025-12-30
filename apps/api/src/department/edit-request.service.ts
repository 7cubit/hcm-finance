import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient, RequestStatus } from '@prisma/client';
import { MonthLockService } from '../google-workspace/month-lock.service';
import { NotificationService } from '../common/notification.service';
import { SheetIngestionService } from '../google-workspace/sheet-ingestion.service';
import { Cron, CronExpression } from '@nestjs/schedule';

const prisma = new PrismaClient();

@Injectable()
export class EditRequestService {
  private readonly logger = new Logger(EditRequestService.name);

  constructor(
    private readonly lockService: MonthLockService,
    private readonly notificationService: NotificationService,
    private readonly ingestionService: SheetIngestionService,
  ) {}

  async submitRequest(data: { departmentId: string; month: string; year: number; reason: string; email: string }) {
    return prisma.editRequest.create({
      data: {
        departmentId: data.departmentId,
        month: data.month,
        year: data.year,
        reason: data.reason,
        requestedByEmail: data.email,
        status: 'PENDING',
      }
    });
  }

  async findAllPending() {
    return prisma.editRequest.findMany({
      where: { status: 'PENDING' },
      include: { department: true }
    });
  }

  async approveRequest(id: string, approvedByEmail: string) {
    const request = await prisma.editRequest.findUnique({
      where: { id },
      include: { department: { include: { externalSheets: true } } }
    });

    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== 'PENDING') throw new BadRequestException('Request is already processed');

    const sheetId = request.department.externalSheets?.[0]?.id;
    if (!sheetId) throw new BadRequestException('No active sheet found for department');

    // 1. Unlock the sheet tab
    await this.lockService.unlockMonth(sheetId, request.month);

    // 2. Set expiration (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // 3. Update Request status
    await prisma.editRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedByEmail,
        expiresAt,
      }
    });

    // 4. Notify User
    await this.notificationService.sendEmail(
      request.requestedByEmail,
      `Unlock Request Approved: ${request.month}`,
      `Your request to unlock ${request.month} for the ${request.department.name} department has been approved. 
      You have 24 hours (until ${expiresAt.toLocaleString()}) to make your changes before it is automatically re-locked.`
    );

    this.logger.log(`🔓 Approved unlock request for ${request.month} (${request.department.name})`);
    return { expiresAt };
  }

  /**
   * Background job to check for expired requests and re-lock them.
   * Runs every 30 minutes.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleExpiredRequests() {
    const expiredRequests = await prisma.editRequest.findMany({
      where: {
        status: 'APPROVED',
        expiresAt: { lte: new Date() },
      },
      include: { department: { include: { externalSheets: true } } }
    });

    for (const request of expiredRequests) {
      const sheetId = request.department.externalSheets?.[0]?.id;
      if (!sheetId) continue;

      try {
        this.logger.log(`🔒 Re-locking ${request.month} for ${request.department.name} (Window Expired)`);
        
        // 1. Re-lock the month
        await this.lockService.lockMonth(sheetId, request.month);

        // 2. Force a sync immediately after the window closes
        const externalSheet = request.department.externalSheets?.[0];
        if (externalSheet) {
          await this.ingestionService.processSheet({
            ...externalSheet,
            department: request.department
          });
        }

        // 2. Clear protection ID in DB logic happens in lockMonth
        
        // 3. Mark as REJECTED or a new status like 'CLOSED'? 
        // Original requirements say "Log who requested and who approved" 
        // Let's use REJECTED to mean "finished window" or maybe add a new enum? 
        // For now let's just mark it as processed if it was pending or approved.
        // Actually, let's just update the status to mark it as definitively done.
        // Prisma schema allows PENDING, APPROVED, REJECTED. 
        // Let's use REJECTED if we want to show it's "over". 
        // Better: the prompt says "Notify Admin when the re-lock is successful."
        
        await prisma.editRequest.update({
          where: { id: request.id },
          data: { status: 'REJECTED' } // REJECTED here means 'Window Closed'
        });

        // 4. Notify Admin
        await this.notificationService.sendEmail(
          'admin@hcmj.org',
          `Window Closed: ${request.month} for ${request.department.name}`,
          `The 24-hour edit window for ${request.requestedByEmail} has expired. The tab has been successully re-locked and a sync has been triggered.`
        );
        
      } catch (error) {
        this.logger.error(`❌ Failed to re-lock expired request ${request.id}: ${error.message}`);
      }
    }
  }
}
