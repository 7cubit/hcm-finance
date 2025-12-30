import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';
import { Job } from 'bullmq';
import { GoogleWorkspaceService } from './google-workspace.service';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { ReceiptPreservationService } from './receipt-preservation.service';
import { AnomalyEngineService } from './anomaly-engine.service';
import { PushNotificationService } from '../common/push-notification.service';
// Phase 16: Quota Management
import { SyncQueueService, SyncJobData, SyncJobResult } from './sync-queue.service';
import { SyncCacheService } from './sync-cache.service';
import { RateLimiterService } from './rate-limiter.service';
// Phase 17: Security
import { SanitizerService } from '../common/sanitizer.service';

const prisma = new PrismaClient();

@Injectable()
export class SheetIngestionService implements OnModuleInit {
  private readonly logger = new Logger(SheetIngestionService.name);
  private readonly MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  constructor(
    private readonly googleService: GoogleWorkspaceService,
    private readonly receiptService: ReceiptPreservationService,
    private readonly anomalyEngine: AnomalyEngineService,
    private readonly pushService: PushNotificationService,
    // Phase 16
    private readonly syncQueue: SyncQueueService,
    private readonly syncCache: SyncCacheService,
    private readonly rateLimiter: RateLimiterService,
    // Phase 17
    private readonly sanitizer: SanitizerService,
  ) {}

  /**
   * Register the processor with the queue on module init
   */
  async onModuleInit() {
    this.syncQueue.setProcessor(this.processJob.bind(this));
    this.logger.log('✅ Sheet ingestion processor registered');
  }

  /**
   * Automated polling every 10 minutes - now queues jobs instead of direct processing
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleCron() {
    this.logger.log('🔄 Cron: Queueing sheet sync jobs...');
    await this.queueAllActiveSheets(false);
  }

  /**
   * Queue all active sheets for sync
   * @param isManual - If true, uses high priority
   * @param triggeredBy - Email of user who triggered (for manual syncs)
   */
  async queueAllActiveSheets(isManual: boolean = false, triggeredBy?: string) {
    try {
      const activeSheets = await prisma.externalSheet.findMany({
        where: { isActive: true },
        include: { department: true }
      });

      for (const sheet of activeSheets) {
        const jobData = {
          sheetId: sheet.id,
          spreadsheetId: sheet.googleSheetId,
          departmentName: sheet.department?.name || 'Unknown',
        };

        if (isManual) {
          await this.syncQueue.addManualSync(jobData, triggeredBy);
        } else {
          await this.syncQueue.addCronSync(jobData);
        }
      }

      this.logger.log(`📤 Queued ${activeSheets.length} sheets (priority: ${isManual ? 'manual' : 'cron'})`);
    } catch (error: any) {
      this.logger.error(`❌ Failed to queue sheets: ${error.message}`);
    }
  }

  /**
   * Process a single sync job (called by BullMQ worker)
   */
  async processJob(job: Job<SyncJobData>): Promise<SyncJobResult> {
    const { sheetId, spreadsheetId, departmentName } = job.data;
    
    try {
      const externalSheet = await prisma.externalSheet.findUnique({
        where: { id: sheetId },
        include: { department: true }
      });

      if (!externalSheet) {
        return { success: false, sheetId, newRows: 0, updatedRows: 0, skipped: true, error: 'Sheet not found' };
      }

      const result = await this.processSheet(externalSheet);
      
      // Notify about pending items after processing
      const pendingCount = await prisma.stagingTransaction.count({
        where: { status: 'PENDING' }
      });
      if (pendingCount > 0) {
        await this.pushService.notifyPendingItems(pendingCount);
      }

      return {
        success: true,
        sheetId,
        newRows: result.newRows,
        updatedRows: result.updatedRows,
        skipped: false,
      };
    } catch (error: any) {
      this.logger.error(`❌ Job processing error for ${departmentName}: ${error.message}`);
      return {
        success: false,
        sheetId,
        newRows: 0,
        updatedRows: 0,
        skipped: false,
        error: error.message,
      };
    }
  }

  private getTabNames(): string[] {
    const now = new Date();
    const currentMonth = now.getMonth();
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    return [this.MONTHS[prevMonth], this.MONTHS[currentMonth]];
  }

  /**
   * Process a single spreadsheet: Current & Previous month tabs
   * Now includes cache checking and batch updates
   */
  async processSheet(externalSheet: any): Promise<{ newRows: number; updatedRows: number }> {
    const sheets = this.googleService.sheetsClient;
    const spreadsheetId = externalSheet.googleSheetId;
    const tabs = this.getTabNames();

    let totalNewRows = 0;
    let totalUpdatedRows = 0;

    for (const tab of tabs) {
      try {
        const range = `${tab}!A2:G`;
        
        // Rate-limited API call
        const response = await this.rateLimiter.executeWithBackoff(async () => {
          return sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
          });
        });

        const rows = response.data.values || [];

        // Phase 16: Check cache - skip if unchanged
        const hasChanged = await this.syncCache.hasChanged(externalSheet.id, tab, rows);
        if (!hasChanged) {
          this.logger.debug(`⏭️ Skipping ${externalSheet.department?.name}/${tab} - no changes`);
          continue;
        }

        const batchUpdates: any[] = [];
        let newRows = 0;
        let updatedRows = 0;

        for (let i = 0; i < rows.length; i++) {
          const rowIndex = i + 2;
          const [dateStr, description, category, amountStr, receiptUrl, status, uuid] = rows[i];

          if (!amountStr || amountStr.trim() === '') continue;

          const cleanAmount = parseFloat(amountStr.replace(/[$,¥]/g, '').trim());
          const rawDataStr = JSON.stringify(rows[i]);
          const rawDataHash = createHash('md5').update(rawDataStr).digest('hex');

          const date = new Date(dateStr);
          if (isNaN(date.getTime())) {
            batchUpdates.push({
              range: `${tab}!F${rowIndex}`,
              values: [['INVALID DATE']]
            });
            continue;
          }

          const { missing } = await this.receiptService.checkCompliance(cleanAmount, receiptUrl);
          let finalReceiptUrl = receiptUrl || '';
          let thumbnailUrl = '';

          if (receiptUrl && receiptUrl.includes('drive.google.com')) {
            try {
              const archived = await this.receiptService.archiveReceipt(
                receiptUrl,
                uuid || 'temp-' + uuidv4(),
                externalSheet.department?.name || 'Unknown',
                new Date().getFullYear()
              );
              finalReceiptUrl = archived.gcsUrl;
              thumbnailUrl = archived.thumbnailUrl || '';
            } catch (archiveError: any) {
              this.logger.error(`Failed to archive receipt at row ${rowIndex}: ${archiveError.message}`);
            }
          }

          if (!uuid || uuid.trim() === '') {
            const syncUuid = uuidv4();
            // Phase 17: Sanitize inputs to prevent CSV injection
            const sanitizedDescription = this.sanitizer.sanitizeString(description);
            const sanitizedCategory = this.sanitizer.sanitizeString(category);
            const newStx = await prisma.stagingTransaction.create({
              data: {
                externalSheetId: externalSheet.id,
                sheetRowIndex: rowIndex,
                sheetTabName: tab,
                amount: cleanAmount,
                description: sanitizedDescription || '',
                category: sanitizedCategory || '',
                date: date,
                receiptUrl: finalReceiptUrl,
                thumbnailUrl: thumbnailUrl,
                isMissingReceipt: missing,
                syncUuid,
                rawDataHash,
                status: 'PENDING'
              }
            });

            await this.anomalyEngine.scanTransaction(newStx.id, amountStr);

            batchUpdates.push({
              range: `${tab}!G${rowIndex}`,
              values: [[syncUuid]]
            });
            batchUpdates.push({
              range: `${tab}!F${rowIndex}`,
              values: [['STAGED']]
            });
            newRows++;
          } else {
            const existing = await prisma.stagingTransaction.findUnique({
              where: { syncUuid: uuid }
            });

            if (existing) {
              if (existing.status === 'APPROVED') {
                if (existing.rawDataHash !== rawDataHash) {
                  batchUpdates.push({
                    range: `${tab}!F${rowIndex}`,
                    values: [['CONFLICT']]
                  });
                  this.logger.warn(`⚠️ Conflict: Approved row modified. Sheet: ${spreadsheetId}, Row: ${rowIndex}`);
                }
              } else {
                await prisma.stagingTransaction.update({
                  where: { syncUuid: uuid },
                  data: {
                    amount: cleanAmount,
                    description: description || '',
                    category: category || '',
                    date: date,
                    receiptUrl: finalReceiptUrl,
                    thumbnailUrl: thumbnailUrl,
                    isMissingReceipt: missing,
                    rawDataHash,
                    sheetRowIndex: rowIndex
                  }
                });
                
                await this.anomalyEngine.scanTransaction(existing.id, amountStr);
                updatedRows++;
              }
            } else {
              this.logger.warn(`🔍 Orphan UUID ${uuid} found. Re-importing row ${rowIndex}.`);
              const orphanStx = await prisma.stagingTransaction.create({
                data: {
                  externalSheetId: externalSheet.id,
                  sheetRowIndex: rowIndex,
                  amount: cleanAmount,
                  description: description || '',
                  category: category || '',
                  date: date,
                  receiptUrl: finalReceiptUrl,
                  thumbnailUrl: thumbnailUrl,
                  isMissingReceipt: missing,
                  syncUuid: uuid,
                  rawDataHash,
                  status: 'PENDING'
                }
              });
              
              await this.anomalyEngine.scanTransaction(orphanStx.id, amountStr);
              newRows++;
            }
          }
        }
        
        await this.anomalyEngine.checkVelocity(externalSheet.id, newRows + updatedRows);

        // Batch update with rate limiting
        if (batchUpdates.length > 0) {
          await this.rateLimiter.executeWithBackoff(async () => {
            return sheets.spreadsheets.values.batchUpdate({
              spreadsheetId,
              requestBody: {
                data: batchUpdates,
                valueInputOption: 'USER_ENTERED'
              }
            });
          });
        }

        // Phase 16: Update cache after successful processing
        await this.syncCache.updateHash(externalSheet.id, tab, rows);

        totalNewRows += newRows;
        totalUpdatedRows += updatedRows;

      } catch (tabError: any) {
        this.logger.error(`❌ Error processing tab ${tab} for sheet ${spreadsheetId}: ${tabError.message}`);
        throw tabError; // Re-throw to trigger circuit breaker
      }
    }

    if (totalNewRows > 0 || totalUpdatedRows > 0) {
      this.logger.log(`📊 Ingestion Stats [${externalSheet.department?.name}]: ${totalNewRows} New, ${totalUpdatedRows} Updated`);
    }

    return { newRows: totalNewRows, updatedRows: totalUpdatedRows };
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use queueAllActiveSheets instead
   */
  async ingestAllActiveSheets() {
    await this.queueAllActiveSheets(true);
  }
}
