import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuditLogEntry {
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Audit Log Service
 * Tracks all sensitive actions with full context
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  /**
   * Log an action
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          userId: entry.userId,
          userEmail: entry.userEmail,
          ipAddress: entry.ipAddress || 'unknown',
          userAgent: entry.userAgent,
          beforeState: entry.beforeState ? JSON.stringify(entry.beforeState) : null,
          afterState: entry.afterState ? JSON.stringify(entry.afterState) : null,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
          createdAt: new Date(),
        },
      });

      this.logger.log(`📝 Audit: ${entry.action} on ${entry.entityType}:${entry.entityId} by ${entry.userEmail || entry.userId}`);
    } catch (error: any) {
      // Don't let audit failures break the main flow
      this.logger.error(`Failed to write audit log: ${error.message}`);
    }
  }

  /**
   * Log approval action
   */
  async logApproval(
    transactionId: string,
    userId: string,
    userEmail: string,
    ipAddress: string,
    approved: boolean,
    reason?: string,
  ): Promise<void> {
    await this.log({
      action: approved ? 'APPROVE' : 'REJECT',
      entityType: 'StagingTransaction',
      entityId: transactionId,
      userId,
      userEmail,
      ipAddress,
      metadata: {
        reason,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log data modification
   */
  async logModification(
    entityType: string,
    entityId: string,
    userId: string,
    userEmail: string,
    ipAddress: string,
    beforeState: Record<string, any>,
    afterState: Record<string, any>,
  ): Promise<void> {
    await this.log({
      action: 'MODIFY',
      entityType,
      entityId,
      userId,
      userEmail,
      ipAddress,
      beforeState,
      afterState,
    });
  }

  /**
   * Log data access (for sensitive data)
   */
  async logAccess(
    entityType: string,
    entityId: string,
    userId: string,
    userEmail: string,
    ipAddress: string,
  ): Promise<void> {
    await this.log({
      action: 'ACCESS',
      entityType,
      entityId,
      userId,
      userEmail,
      ipAddress,
    });
  }

  /**
   * Log failed access attempt (security)
   */
  async logFailedAccess(
    entityType: string,
    entityId: string,
    userId: string,
    userEmail: string,
    ipAddress: string,
    reason: string,
  ): Promise<void> {
    await this.log({
      action: 'ACCESS_DENIED',
      entityType,
      entityId,
      userId,
      userEmail,
      ipAddress,
      metadata: { reason },
    });

    this.logger.warn(`🚨 Access denied: ${userEmail} tried to access ${entityType}:${entityId} - ${reason}`);
  }

  /**
   * Get audit logs for an entity
   */
  async getLogsForEntity(entityType: string, entityId: string, limit: number = 100): Promise<any[]> {
    return prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get all logs for a user
   */
  async getLogsForUser(userId: string, limit: number = 100): Promise<any[]> {
    return prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get security-relevant logs (access denied, etc.)
   */
  async getSecurityLogs(limit: number = 100): Promise<any[]> {
    return prisma.auditLog.findMany({
      where: {
        action: { in: ['ACCESS_DENIED', 'LOGIN_FAILED', 'SUSPICIOUS_ACTIVITY'] }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
