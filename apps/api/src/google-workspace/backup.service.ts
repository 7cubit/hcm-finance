import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';
import { Storage } from '@google-cloud/storage';
import { GoogleWorkspaceService } from './google-workspace.service';

const prisma = new PrismaClient();

/**
 * Backup Service
 * Nightly backup of all sheets to GCS
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private storage: Storage;
  private readonly BUCKET_NAME = process.env.GCS_BACKUP_BUCKET || 'hcmj-finance-backups';
  private readonly RETENTION_DAYS = 30;

  constructor(private readonly googleService: GoogleWorkspaceService) {
    this.storage = new Storage();
  }

  /**
   * Nightly backup at 2:00 AM
   */
  @Cron('0 2 * * *')
  async handleNightlyBackup() {
    this.logger.log('🌙 Starting nightly backup...');
    await this.backupAllSheets();
    await this.cleanupOldBackups();
  }

  /**
   * Backup all active sheets
   */
  async backupAllSheets(): Promise<{ success: number; failed: number }> {
    const sheets = await prisma.externalSheet.findMany({
      where: { isActive: true },
      include: { department: true }
    });

    let success = 0;
    let failed = 0;

    for (const sheet of sheets) {
      try {
        await this.backupSheet(sheet.googleSheetId, sheet.department?.name || 'Unknown');
        success++;
      } catch (error: any) {
        this.logger.error(`Failed to backup ${sheet.department?.name}: ${error.message}`);
        failed++;
      }
    }

    this.logger.log(`📦 Backup complete: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Backup a single sheet as Excel
   */
  async backupSheet(spreadsheetId: string, departmentName: string): Promise<string> {
    const drive = this.googleService.driveClient;
    const date = new Date().toISOString().split('T')[0];
    const fileName = `${departmentName}_${date}.xlsx`;

    // Export as Excel
    const response = await drive.files.export({
      fileId: spreadsheetId,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }, { responseType: 'arraybuffer' });

    // Upload to GCS
    const bucket = this.storage.bucket(this.BUCKET_NAME);
    const file = bucket.file(`backups/${date}/${fileName}`);

    await file.save(Buffer.from(response.data as ArrayBuffer), {
      metadata: {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        metadata: {
          spreadsheetId,
          departmentName,
          backupDate: date,
        }
      }
    });

    this.logger.log(`✅ Backed up: ${fileName}`);
    return `gs://${this.BUCKET_NAME}/backups/${date}/${fileName}`;
  }

  /**
   * Clean up backups older than retention period
   */
  async cleanupOldBackups(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);

    const bucket = this.storage.bucket(this.BUCKET_NAME);
    const [files] = await bucket.getFiles({ prefix: 'backups/' });

    let deletedCount = 0;

    for (const file of files) {
      const [metadata] = await file.getMetadata();
      const timeCreated = metadata?.timeCreated;
      if (!timeCreated) continue;
      const createdAt = new Date(timeCreated);

      if (createdAt < cutoffDate) {
        await file.delete();
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.logger.log(`🗑️ Cleaned up ${deletedCount} old backups`);
    }

    return deletedCount;
  }

  /**
   * List available backups
   */
  async listBackups(date?: string): Promise<Array<{ name: string; date: string; size: number }>> {
    const bucket = this.storage.bucket(this.BUCKET_NAME);
    const prefix = date ? `backups/${date}/` : 'backups/';
    const [files] = await bucket.getFiles({ prefix });

    return files.map(file => ({
      name: file.name,
      date: file.name.split('/')[1],
      size: parseInt(String(file.metadata.size || '0'), 10),
    }));
  }

  /**
   * Restore a backup (download URL)
   */
  async getBackupDownloadUrl(filePath: string): Promise<string> {
    const bucket = this.storage.bucket(this.BUCKET_NAME);
    const file = bucket.file(filePath);

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    return url;
  }
}
