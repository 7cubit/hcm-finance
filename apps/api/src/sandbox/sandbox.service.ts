import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient, StagingStatus } from '@prisma/client';
import { GoogleWorkspaceService } from '../google-workspace/google-workspace.service';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export interface SandboxStatus {
  isEnabled: boolean;
  sandboxSheets: Array<{ id: string; name: string; departmentName: string }>;
  transactionCount: number;
  trainedUsers: number;
  pendingGraduations: number;
}

export interface TrainingProgress {
  userId: string;
  email: string;
  name: string;
  transactionsProcessed: number;
  approvalsCompleted: number;
  isTrainedUser: boolean;
  readyForGraduation: boolean;
}

@Injectable()
export class SandboxService {
  private readonly logger = new Logger(SandboxService.name);

  constructor(private readonly googleService: GoogleWorkspaceService) {}

  /**
   * Enable sandbox mode for a department
   * Creates a [TEST] prefixed sheet for training
   */
  async enableSandboxMode(departmentId: string, adminUserId: string): Promise<any> {
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: { externalSheets: true },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    // Check if sandbox already exists
    const existingSandbox = department.externalSheets.find(s => s.isSandbox);
    if (existingSandbox) {
      return { message: 'Sandbox already enabled', sheet: existingSandbox };
    }

    // Create a sandbox sheet
    const sandboxName = `[TEST] ${department.name} Training`;
    const { spreadsheetId, spreadsheetUrl } = await this.googleService.createSpreadsheet(
      sandboxName,
      department.headEmail
    );

    // Get or create fiscal year
    const currentYear = new Date().getFullYear();
    let fiscalYear = await prisma.fiscalYear.findUnique({ where: { year: currentYear } });
    if (!fiscalYear) {
      fiscalYear = await prisma.fiscalYear.create({
        data: {
          year: currentYear,
          startDate: new Date(currentYear, 0, 1),
          endDate: new Date(currentYear, 11, 31),
          isOpen: true,
        },
      });
    }

    // Register in database
    const sandboxSheet = await prisma.externalSheet.create({
      data: {
        googleSheetId: spreadsheetId,
        driveUrl: spreadsheetUrl,
        isSandbox: true,
        isActive: true,
        departmentId: departmentId,
        fiscalYearId: fiscalYear.id,
      },
    });

    this.logger.log(`🎓 Sandbox enabled for ${department.name}: ${spreadsheetUrl}`);

    return {
      message: 'Sandbox mode enabled',
      sheet: sandboxSheet,
      url: spreadsheetUrl,
    };
  }

  /**
   * Disable sandbox mode for a department
   */
  async disableSandboxMode(departmentId: string): Promise<any> {
    const sandboxSheets = await prisma.externalSheet.findMany({
      where: { departmentId, isSandbox: true },
    });

    if (sandboxSheets.length === 0) {
      return { message: 'No sandbox to disable' };
    }

    // Soft-disable (don't delete data)
    await prisma.externalSheet.updateMany({
      where: { departmentId, isSandbox: true },
      data: { isActive: false },
    });

    this.logger.log(`🎓 Sandbox disabled for department ${departmentId}`);
    return { message: 'Sandbox mode disabled', sheetsDisabled: sandboxSheets.length };
  }

  /**
   * Get sandbox status
   */
  async getSandboxStatus(): Promise<SandboxStatus> {
    const sandboxSheets = await prisma.externalSheet.findMany({
      where: { isSandbox: true, isActive: true },
      include: { department: true },
    });

    const transactionCount = await prisma.sandboxTransaction.count();
    const trainedUsers = await prisma.user.count({ where: { isTrainedUser: true } });
    const pendingGraduations = await prisma.user.count({ 
      where: { isTrainedUser: false, isActive: true } 
    });

    return {
      isEnabled: sandboxSheets.length > 0,
      sandboxSheets: sandboxSheets.map(s => ({
        id: s.id,
        name: s.googleSheetId,
        departmentName: s.department?.name || 'Unknown',
      })),
      transactionCount,
      trainedUsers,
      pendingGraduations,
    };
  }

  /**
   * Reset all sandbox data
   */
  async resetSandboxData(): Promise<{ deleted: number }> {
    const result = await prisma.sandboxTransaction.deleteMany({});
    this.logger.log(`🗑️ Reset sandbox: ${result.count} transactions deleted`);
    return { deleted: result.count };
  }

  /**
   * Graduate a user (mark as trained)
   */
  async graduateUser(userId: string, adminUserId: string): Promise<any> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isTrainedUser) {
      return { message: 'User is already trained', user };
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isTrainedUser: true },
    });

    this.logger.log(`🎓 User ${user.email} graduated by ${adminUserId}`);

    return {
      message: 'User graduated successfully',
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        isTrainedUser: updated.isTrainedUser,
      },
    };
  }

  /**
   * Get training progress for all users
   */
  async getTrainingProgress(): Promise<TrainingProgress[]> {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, email: true, name: true, isTrainedUser: true },
    });

    const progress: TrainingProgress[] = [];

    for (const user of users) {
      // Count sandbox transactions attributed to this user
      // (simplified - in production, track by user)
      const transactionsProcessed = 0; // Placeholder
      const approvalsCompleted = 0; // Placeholder

      progress.push({
        userId: user.id,
        email: user.email,
        name: user.name,
        transactionsProcessed,
        approvalsCompleted,
        isTrainedUser: user.isTrainedUser,
        readyForGraduation: transactionsProcessed >= 10 && approvalsCompleted >= 5,
      });
    }

    return progress;
  }

  /**
   * Submit training feedback/bug report
   */
  async submitFeedback(
    userEmail: string,
    feedbackType: 'BUG' | 'SUGGESTION' | 'QUESTION',
    message: string,
    screenshot?: string,
  ): Promise<any> {
    const feedback = await prisma.trainingFeedback.create({
      data: {
        userEmail,
        feedbackType,
        message,
        screenshot,
        status: 'OPEN',
      },
    });

    this.logger.log(`📝 Feedback received from ${userEmail}: ${feedbackType}`);
    return feedback;
  }

  /**
   * Get all feedback reports
   */
  async getFeedback(status?: string): Promise<any[]> {
    return prisma.trainingFeedback.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Resolve feedback
   */
  async resolveFeedback(feedbackId: string): Promise<any> {
    return prisma.trainingFeedback.update({
      where: { id: feedbackId },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
  }
}
