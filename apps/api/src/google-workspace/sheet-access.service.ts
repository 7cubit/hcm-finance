import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaClient, UserRole, SheetRole } from '@prisma/client';
import { GoogleWorkspaceService } from './google-workspace.service';
import { AuditLogService } from '../common/audit-log.service';

const prisma = new PrismaClient();

@Injectable()
export class SheetAccessService {
  private readonly logger = new Logger(SheetAccessService.name);

  constructor(
    private readonly googleService: GoogleWorkspaceService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Phase 17: Verify user has access to a specific department's sheets
   * Prevents Media user from accessing Choir sheets
   */
  async verifyDepartmentAccess(
    userId: string,
    userEmail: string,
    departmentId: string,
    ipAddress?: string,
  ): Promise<boolean> {
    // Get user with their role
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      await this.auditLog.logFailedAccess(
        'Department',
        departmentId,
        userId,
        userEmail,
        ipAddress || 'unknown',
        'User not found'
      );
      return false;
    }

    // Super Admin and Treasurer have access to all departments
    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.TREASURER) {
      return true;
    }

    // Check if user is assigned to this department's sheets
    const assignedSheets = await prisma.sheetUser.findMany({
      where: {
        email: userEmail.toLowerCase(),
        externalSheet: {
          departmentId: departmentId,
        },
      },
    });

    if (assignedSheets.length === 0) {
      await this.auditLog.logFailedAccess(
        'Department',
        departmentId,
        userId,
        userEmail,
        ipAddress || 'unknown',
        'User not assigned to this department'
      );
      this.logger.warn(`🚫 Access denied: ${userEmail} tried to access department ${departmentId}`);
      return false;
    }

    return true;
  }

  /**
   * Phase 17: Verify sheet is not publicly accessible
   */
  async verifySheetNotPublic(sheetId: string): Promise<{ isPublic: boolean; warning?: string }> {
    const drive = this.googleService.driveClient;

    try {
      const permissions = await drive.permissions.list({
        fileId: sheetId,
        fields: 'permissions(id, type, role)',
      });

      const publicPermission = permissions.data.permissions?.find(
        (p) => p.type === 'anyone' || p.type === 'domain'
      );

      if (publicPermission) {
        this.logger.error(`🚨 SECURITY: Sheet ${sheetId} is publicly accessible!`);
        return { 
          isPublic: true, 
          warning: `Sheet has public/domain access. Remove permission ID: ${publicPermission.id}` 
        };
      }

      return { isPublic: false };
    } catch (error: any) {
      this.logger.error(`Failed to check sheet permissions: ${error.message}`);
      return { isPublic: false };
    }
  }

  /**
   * Phase 17: Remove public access from a sheet
   */
  async removePublicAccess(sheetId: string, recordedByUserId: string): Promise<{ removed: number }> {
    const drive = this.googleService.driveClient;
    let removedCount = 0;

    try {
      const permissions = await drive.permissions.list({
        fileId: sheetId,
        fields: 'permissions(id, type)',
      });

      for (const permission of permissions.data.permissions || []) {
        if (permission.type === 'anyone' || permission.type === 'domain') {
          await drive.permissions.delete({
            fileId: sheetId,
            permissionId: permission.id!,
          });
          removedCount++;
          this.logger.log(`🔒 Removed public permission ${permission.id} from sheet ${sheetId}`);
        }
      }

      if (removedCount > 0) {
        await this.auditLog.log({
          action: 'REMOVE_PUBLIC_ACCESS',
          entityType: 'ExternalSheet',
          entityId: sheetId,
          userId: recordedByUserId,
          metadata: { removedPermissions: removedCount },
        });
      }

      return { removed: removedCount };
    } catch (error: any) {
      this.logger.error(`Failed to remove public access: ${error.message}`);
      throw new BadRequestException(`Google API Error: ${error.message}`);
    }
  }

  /**
   * Grant access to a specific Google Sheet
   */
  async grantAccess(
    sheetId: string,
    email: string,
    role: SheetRole,
    recordedByUserId: string,
    suppressEmail: boolean = true,
  ) {
    const drive = this.googleService.driveClient;
    const isOrgEmail = email.endsWith('@hcmj.org');
    
    // Mapping internal SheetRole to Google Drive roles
    const driveRole = role === SheetRole.EDITOR ? 'writer' : 'reader';

    try {
      // 1. Google Drive API call
      const permission = await drive.permissions.create({
        fileId: sheetId,
        requestBody: {
          type: 'user',
          role: driveRole,
          emailAddress: email,
        },
        sendNotificationEmail: !suppressEmail,
      });

      if (!isOrgEmail && email.endsWith('@gmail.com')) {
        this.logger.warn(`⚠️ Personal email granted access: ${email} to sheet ${sheetId}`);
      }

      // 2. Audit Log
      await this.auditLog.log({
        action: 'GRANT_ACCESS',
        entityType: 'ExternalSheet',
        entityId: sheetId,
        userId: recordedByUserId,
        metadata: { email, role: driveRole, isOrgEmail },
      });

      this.logger.log(`✅ Granted ${driveRole} access to ${email} for sheet ${sheetId}`);
      return { permissionId: permission.data.id, email, role: driveRole };
    } catch (error: any) {
      this.logger.error(`❌ Failed to grant access: ${error.message}`);
      throw new BadRequestException(`Google API Error: ${error.message}`);
    }
  }

  /**
   * Revoke access from a specific Google Sheet
   */
  async revokeAccess(sheetId: string, email: string, recordedByUserId: string) {
    const drive = this.googleService.driveClient;

    try {
      // 1. Find the permission ID for this email
      const permissions = await drive.permissions.list({
        fileId: sheetId,
        fields: 'permissions(id, emailAddress)',
      });

      const permissionId = permissions.data.permissions?.find(
        (p) => p.emailAddress?.toLowerCase() === email.toLowerCase(),
      )?.id;

      if (!permissionId) {
        this.logger.warn(`No permission found for ${email} on sheet ${sheetId}`);
        return { success: false, message: 'Permission not found' };
      }

      // 2. Remove permission via Drive API
      await drive.permissions.delete({
        fileId: sheetId,
        permissionId: permissionId,
      });

      // 3. Audit Log
      await this.auditLog.log({
        action: 'REVOKE_ACCESS',
        entityType: 'ExternalSheet',
        entityId: sheetId,
        userId: recordedByUserId,
        metadata: { email },
      });

      this.logger.log(`🚫 Revoked access for ${email} from sheet ${sheetId}`);
      return { success: true };
    } catch (error: any) {
      this.logger.error(`❌ Failed to revoke access: ${error.message}`);
      throw new BadRequestException(`Google API Error: ${error.message}`);
    }
  }

  /**
   * Repair Permissions: Sync DB state with Google Drive state
   */
  async repairPermissions(externalSheetId: string, recordedByUserId: string) {
    const sheet = await prisma.externalSheet.findUnique({
      where: { id: externalSheetId },
      include: { users: true },
    });

    if (!sheet) throw new BadRequestException('External Sheet not found');

    const googleSheetId = sheet.googleSheetId;
    
    this.logger.log(`🔧 Repairing permissions for sheet ${googleSheetId}...`);

    for (const user of sheet.users) {
      await this.grantAccess(
        googleSheetId,
        user.email,
        user.role,
        recordedByUserId,
        true, // Always suppress on repair
      );
    }

    return { success: true, userCount: sheet.users.length };
  }

  /**
   * Sync Team Access: Ensure all members of a department have access to its sheet
   */
  async syncDepartmentTeamAccess(departmentId: string, recordedByUserId: string) {
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: { externalSheets: true },
    });

    if (!department) throw new BadRequestException('Department not found');

    for (const sheet of department.externalSheets) {
      // 1. Grant to Dept Head
      await this.grantAccess(
        sheet.googleSheetId,
        department.headEmail,
        SheetRole.EDITOR,
        recordedByUserId,
      );
      
      // 2. Repair other users linked to this sheet
      await this.repairPermissions(sheet.id, recordedByUserId);
    }
  }
}
