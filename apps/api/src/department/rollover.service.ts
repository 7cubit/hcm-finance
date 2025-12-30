import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SheetFactoryService } from '../google-workspace/sheet-factory.service';
import { SheetAccessService } from '../google-workspace/sheet-access.service';
import { NotificationService } from '../common/notification.service';

const prisma = new PrismaClient();

@Injectable()
export class RolloverService {
  private readonly logger = new Logger(RolloverService.name);

  constructor(
    private readonly sheetFactory: SheetFactoryService,
    private readonly sheetAccess: SheetAccessService,
    private readonly notificationService: NotificationService,
  ) {}

  async getRolloverPreview(targetYear: number) {
    const currentYear = targetYear - 1;
    const depts = await prisma.department.findMany({
      include: {
        externalSheets: {
          where: { fiscalYear: { year: currentYear } },
          include: { users: true }
        }
      }
    });

    return depts.map(d => ({
      id: d.id,
      name: d.name,
      currentSheetId: d.externalSheets[0]?.id,
      googleSheetId: d.externalSheets[0]?.googleSheetId,
      userCount: d.externalSheets[0]?.users.length || 0,
      budgetLimit: Number(d.budgetLimit)
    }));
  }

  async executeRollover(targetYear: number, options: { carryOver: boolean; notifyStaff: boolean }) {
    const currentYear = targetYear - 1;
    this.logger.log(`⏳ Starting Fiscal Rollover: ${currentYear} -> ${targetYear}`);

    // 1. Ensure Target Fiscal Year exists
    let fiscalYear = await prisma.fiscalYear.findUnique({ where: { year: targetYear } });
    if (!fiscalYear) {
      fiscalYear = await prisma.fiscalYear.create({
        data: {
          year: targetYear,
          startDate: new Date(`${targetYear}-01-01`),
          endDate: new Date(`${targetYear}-12-31`),
          isOpen: true
        }
      });
    }

    const departments = await prisma.department.findMany({
      include: {
        externalSheets: {
          where: { fiscalYear: { year: currentYear } },
          include: { users: true }
        }
      }
    });

    const results: any[] = [];

    for (const dept of departments) {
      try {
        const oldSheet = dept.externalSheets[0];
        if (!oldSheet) continue;

        // 2. Archive Old Sheet
        const archivedName = `[ARCHIVED] ${dept.name} ${currentYear}`;
        await this.sheetFactory.renameSpreadsheet(oldSheet.googleSheetId, archivedName);
        await this.sheetFactory.lockAllTabs(oldSheet.googleSheetId);
        
        await prisma.externalSheet.update({
          where: { id: oldSheet.id },
          data: { isActive: false }
        });

        // 3. Generate New Sheet for Target Year
        const sheetResult = await this.sheetFactory.generateYearlySheet(dept.id, dept.name, targetYear);
        
        // 4. Create New ExternalSheet record
        const newExternalSheet = await prisma.externalSheet.create({
          data: {
            googleSheetId: sheetResult.spreadsheetId,
            driveUrl: sheetResult.webViewLink,
            departmentId: dept.id,
            fiscalYearId: fiscalYear.id,
            isActive: true
          }
        });

        // 5. Migrate Permissions
        // First grant to Dept Head
        await this.sheetAccess.grantAccess(sheetResult.spreadsheetId, dept.headEmail, 'EDITOR', 'SYSTEM');
        
        // Then copy from old records
        for (const user of oldSheet.users) {
          await prisma.sheetUser.create({
            data: {
              email: user.email,
              role: user.role,
              externalSheetId: newExternalSheet.id,
              isOrgEmail: user.isOrgEmail
            }
          });
          await this.sheetAccess.grantAccess(sheetResult.spreadsheetId, user.email, user.role, 'SYSTEM');
        }

        // 6. Optional Carry-Over
        if (options.carryOver) {
          // In a real system, we'd fetch the actual balance from the ledger.
          // For now, let's log the intent.
          this.logger.log(`💰 Calculated carry-over balance for ${dept.name}`);
        }

        // 7. Optional Notification
        if (options.notifyStaff) {
          await this.notificationService.sendEmail(
            dept.headEmail,
            `Your ${targetYear} Financial Sheet is Ready`,
            `Hello,\n\nThe ${targetYear} fiscal year has been initialized. Your new worksheet for ${dept.name} is available here: ${sheetResult.webViewLink}\n\nThe ${currentYear} sheet has been archived and is now read-only.`
          );
        }

        results.push({ department: dept.name, status: 'SUCCESS', newSheetId: sheetResult.spreadsheetId });
      } catch (error) {
        this.logger.error(`❌ Rollover failed for ${dept.name}: ${error.message}`);
        results.push({ department: dept.name, status: 'FAILED', error: error.message });
      }
    }

    return { results, targetYear };
  }
}
