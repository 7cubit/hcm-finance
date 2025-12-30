import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { sheets_v4 } from 'googleapis';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';
import { GoogleWorkspaceService } from './google-workspace.service';
import { NotificationService } from '../common/notification.service';

const prisma = new PrismaClient();

@Injectable()
export class MonthLockService {
  private readonly logger = new Logger(MonthLockService.name);

  constructor(
    private readonly googleService: GoogleWorkspaceService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Cron job: Runs at 00:01 on the 1st of every month.
   * Locks the previous month for all active sheets.
   */
  @Cron('1 0 1 * *')
  async handleMonthlyLocking() {
    this.logger.log('🕒 Starting automated monthly lock runner...');
    
    // Calculate previous month
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const targetMonth = monthNames[prevMonthDate.getMonth()];
    
    const activeSheets = await prisma.externalSheet.findMany({
      where: { isActive: true },
      include: { department: true }
    });

    for (const sheet of activeSheets) {
      try {
        await this.lockMonth(sheet.id, targetMonth);
        this.logger.log(`✅ Locked ${targetMonth} for ${sheet.department.name}`);
      } catch (error) {
        this.logger.error(`❌ Failed to lock ${targetMonth} for ${sheet.department.name}: ${error.message}`);
      }
    }
  }

  async lockMonth(externalSheetId: string, month: string) {
    const sheet = await prisma.externalSheet.findUnique({
      where: { id: externalSheetId },
      include: { department: true }
    });
    if (!sheet) throw new NotFoundException('Sheet not found');

    // 1. Get Spreadsheet metadata to find the Tab ID
    const spreadsheet = await this.googleService.sheetsClient.spreadsheets.get({
      spreadsheetId: sheet.googleSheetId
    });

    // --- SAFETY GUARD: Prevent locking current month ---
    const now = new Date();
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const currentMonth = monthNames[now.getMonth()];
    
    if (month === currentMonth) {
      throw new BadRequestException(`Safety Guard: Cannot lock the current month (${month}). Wait until the 1st of next month.`);
    }
    // --------------------------------------------------

    const tab = spreadsheet.data.sheets?.find(s => s.properties?.title === month);
    if (!tab) throw new BadRequestException(`Tab "${month}" not found in sheet`);

    const sheetId = tab.properties?.sheetId;

    // 2. Add Protected Range & Change Tab Color
    const requests: sheets_v4.Schema$Request[] = [
      {
        addProtectedRange: {
          protectedRange: {
            range: { sheetId },
            description: `Monthly Close: ${month}`,
            warningOnly: false,
            editors: {
              users: [this.googleService.config.serviceAccountEmail || ''],
              groups: [],
              domainUsersCanEdit: false
            }
          }
        }
      },
      {
        updateSheetProperties: {
          properties: {
            sheetId,
            tabColor: { red: 0.8, green: 0.8, blue: 0.8 } // Grey
          },
          fields: 'tabColor'
        }
      }
    ];

    await this.googleService.sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: sheet.googleSheetId,
      requestBody: { requests }
    });

    // 3. Update DB
    if (!sheet.lockedMonths.includes(month)) {
      await prisma.externalSheet.update({
        where: { id: externalSheetId },
        data: {
          lockedMonths: {
            push: month
          }
        }
      });
    }

    // 4. Notification
    if (sheet.department.headEmail) {
      await this.notificationService.notifyMonthLock(sheet.department.headEmail, month);
    }
  }

  async unlockMonth(externalSheetId: string, month: string) {
    const sheet = await prisma.externalSheet.findUnique({
      where: { id: externalSheetId }
    });
    if (!sheet) throw new NotFoundException('Sheet not found');

    // 1. Find the Protected Range ID
    const spreadsheet = await this.googleService.sheetsClient.spreadsheets.get({
      spreadsheetId: sheet.googleSheetId
    });

    const tab = spreadsheet.data.sheets?.find(s => s.properties?.title === month);
    if (!tab) throw new BadRequestException(`Tab "${month}" not found`);

    const protectedRange = tab.protectedRanges?.find(pr => pr.description === `Monthly Close: ${month}`);
    
    const requests: sheets_v4.Schema$Request[] = [];

    if (protectedRange?.protectedRangeId) {
      requests.push({
        deleteProtectedRange: {
          protectedRangeId: protectedRange.protectedRangeId
        }
      });
    }

    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId: tab.properties?.sheetId,
          tabColor: { red: 1, green: 1, blue: 1 } // Reset to White/Default
        },
        fields: 'tabColor'
      }
    });

    await this.googleService.sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: sheet.googleSheetId,
      requestBody: { requests }
    });

    // 2. Update DB
    await prisma.externalSheet.update({
      where: { id: externalSheetId },
      data: {
        lockedMonths: {
          set: sheet.lockedMonths.filter(m => m !== month)
        }
      }
    });
  }
}
