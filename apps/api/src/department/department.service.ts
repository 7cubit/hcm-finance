import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SheetFactoryService } from '../google-workspace/sheet-factory.service';
import { SheetAccessService } from '../google-workspace/sheet-access.service';

const prisma = new PrismaClient();

@Injectable()
export class DepartmentService {
  private readonly logger = new Logger(DepartmentService.name);

  constructor(
    private readonly sheetFactory: SheetFactoryService,
    private readonly sheetAccess: SheetAccessService,
  ) { }

  async findAll() {
    const departments = await prisma.department.findMany({
      include: {
        externalSheets: {
          where: { isActive: true },
          include: {
            users: true,
            syncLogs: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            stagingTransactions: {
              where: { status: { not: 'REJECTED' } },
              select: { amount: true }
            }
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return departments.map(dept => {
      const activeSheet = dept.externalSheets[0];
      const spent = activeSheet?.stagingTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;
      return {
        ...dept,
        spent,
      };
    });
  }

  async findOne(id: string) {
    const dept = await prisma.department.findUnique({
      where: { id },
      include: {
        externalSheets: {
          include: {
            users: true,
            syncLogs: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        },
      },
    });

    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async create(data: { name: string; budgetLimit: number; headEmail: string }) {
    // 1. Create Department in DB
    const department = await prisma.department.create({
      data: {
        name: data.name,
        budgetLimit: data.budgetLimit,
        headEmail: data.headEmail,
      },
    });

    // 2. Generate Google Sheet for the current year
    const year = new Date().getFullYear();
    const sheetResult = await this.sheetFactory.generateYearlySheet(
      department.id,
      department.name,
      year
    );

    // 3. Register ExternalSheet in DB
    // Note: SheetFactory already handles some DB linking if implemented, but let's be explicit
    // Actually, SheetFactory should probably return the sheetId
    const fiscalYear = await prisma.fiscalYear.findFirst({
      where: { year, isOpen: true }
    });

    if (!fiscalYear) {
      // Create one if missing for dev
      await prisma.fiscalYear.create({
        data: {
          year,
          startDate: new Date(`${year}-01-01`),
          endDate: new Date(`${year}-12-31`),
          isOpen: true
        }
      });
    }

    const externalSheet = await prisma.externalSheet.create({
      data: {
        googleSheetId: sheetResult.spreadsheetId,
        driveUrl: sheetResult.webViewLink,
        departmentId: department.id,
        fiscalYearId: (await prisma.fiscalYear.findFirst({ where: { year } }))?.id!,
      }
    });

    // 4. Grant access to Department Head
    await this.sheetAccess.grantAccess(
      sheetResult.spreadsheetId,
      data.headEmail,
      'EDITOR',
      'SYSTEM'
    );

    return { department, externalSheet };
  }

  async updateBudget(id: string, budgetLimit: number) {
    return prisma.department.update({
      where: { id },
      data: { budgetLimit },
    });
  }

  async addSheetUser(sheetId: string, email: string, role: 'EDITOR' | 'VIEWER') {
    const sheet = await prisma.externalSheet.findUnique({ where: { id: sheetId } });
    if (!sheet) throw new NotFoundException('Sheet not found');

    // Grant in Google
    await this.sheetAccess.grantAccess(sheet.googleSheetId, email, role, 'ADMIN');

    // Register in DB
    return prisma.sheetUser.create({
      data: {
        email,
        role,
        externalSheetId: sheetId,
        isOrgEmail: email.endsWith('@hcmj.org'),
      }
    });
  }

  async removeSheetUser(sheetId: string, userId: string) {
    const user = await prisma.sheetUser.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const sheet = await prisma.externalSheet.findUnique({ where: { id: sheetId } });
    if (!sheet) throw new NotFoundException('Sheet not found');

    // Revoke in Google
    await this.sheetAccess.revokeAccess(sheet.googleSheetId, user.email, 'ADMIN');

    // Delete in DB
    return prisma.sheetUser.delete({ where: { id: userId } });
  }

  async regenerateSheet(id: string) {
    const department = await this.findOne(id);
    const year = new Date().getFullYear();

    // Generate new sheet
    const sheetResult = await this.sheetFactory.generateYearlySheet(
      department.id,
      department.name,
      year
    );

    // Update or Create ExternalSheet
    return prisma.externalSheet.updateMany({
      where: { departmentId: id, fiscalYear: { year } },
      data: {
        googleSheetId: sheetResult.spreadsheetId,
        driveUrl: sheetResult.webViewLink,
        isActive: true,
      }
    });
  }
}
