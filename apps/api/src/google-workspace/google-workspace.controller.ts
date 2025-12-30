import { Controller, Get, Post, Body, UseGuards, Version, Param } from '@nestjs/common';
import { GoogleWorkspaceService } from './google-workspace.service';
import { SheetFactoryService } from './sheet-factory.service';
import { SheetAccessService } from './sheet-access.service';
import { SheetIngestionService } from './sheet-ingestion.service';
import { SheetFeedbackService } from './sheet-feedback.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
// Phase 16: Quota Management
import { RateLimiterService } from './rate-limiter.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { SyncCacheService } from './sync-cache.service';
import { SyncQueueService } from './sync-queue.service';

@Controller('google-workspace')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GoogleWorkspaceController {
  constructor(
    private readonly googleService: GoogleWorkspaceService,
    private readonly sheetFactory: SheetFactoryService,
    private readonly sheetAccess: SheetAccessService,
    private readonly ingestionService: SheetIngestionService,
    private readonly feedbackService: SheetFeedbackService,
    // Phase 16
    private readonly rateLimiter: RateLimiterService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly syncCache: SyncCacheService,
    private readonly syncQueue: SyncQueueService,
  ) {}

  // ============================================
  // Phase 16: API Health & Monitoring
  // ============================================

  /**
   * API Health Dashboard - Shows queue stats, rate limits, circuit states
   */
  @Get('api-health')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async getApiHealth() {
    const [queueStats, quotaUsage, circuitStates, cacheStats] = await Promise.all([
      this.syncQueue.getQueueStats(),
      this.rateLimiter.getQuotaUsage(),
      this.circuitBreaker.getAllCircuitStates(),
      this.syncCache.getCacheStats(),
    ]);

    const openCircuits = circuitStates.filter(c => c.state === 'OPEN');

    return {
      status: openCircuits.length === 0 && quotaUsage.percentage < 80 ? 'healthy' : 'degraded',
      queue: queueStats,
      rateLimit: quotaUsage,
      circuits: {
        total: circuitStates.length,
        open: openCircuits.length,
        openSheets: openCircuits.map(c => c.sheetId),
      },
      cache: cacheStats,
      alerts: [
        ...(quotaUsage.percentage > 80 ? [`Quota usage above 80%: ${quotaUsage.percentage}%`] : []),
        ...(openCircuits.length > 0 ? [`${openCircuits.length} circuit(s) open`] : []),
      ],
    };
  }

  /**
   * Manual sync with priority (replaces old /sync endpoint)
   */
  @Post('sync')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async triggerManualSync(@CurrentUser() user: any) {
    // Queue all active sheets for sync with high priority
    await this.ingestionService.queueAllActiveSheets(true, user?.email);
    return { 
      message: 'Sync jobs queued with priority',
      priority: 'manual',
    };
  }

  /**
   * Reset circuit breaker for a specific sheet
   */
  @Post('circuits/:sheetId/reset')
  @Version('1')
  @Roles('SUPER_ADMIN')
  async resetCircuit(@Param('sheetId') sheetId: string) {
    await this.circuitBreaker.resetCircuit(sheetId);
    return { message: `Circuit reset for sheet ${sheetId}` };
  }

  /**
   * Invalidate sync cache for a sheet (force re-sync)
   */
  @Post('cache/:sheetId/invalidate')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async invalidateCache(@Param('sheetId') sheetId: string) {
    await this.syncCache.invalidate(sheetId);
    return { message: `Cache invalidated for sheet ${sheetId}` };
  }

  /**
   * Pause/Resume queue
   */
  @Post('queue/pause')
  @Version('1')
  @Roles('SUPER_ADMIN')
  async pauseQueue() {
    await this.syncQueue.pause();
    return { message: 'Sync queue paused' };
  }

  @Post('queue/resume')
  @Version('1')
  @Roles('SUPER_ADMIN')
  async resumeQueue() {
    await this.syncQueue.resume();
    return { message: 'Sync queue resumed' };
  }

  // ============================================
  // Existing Endpoints (Unchanged)
  // ============================================

  /**
   * Phase 6: Test Feedback (Row highlighting & Status)
   */
  @Post('test-feedback')
  @Version('1')
  @Roles('SUPER_ADMIN')
  async testFeedback(
    @Body() dto: { sheetId: string; tabName: string; rowIndex: number; status: any; message?: string },
  ) {
    return this.feedbackService.updateRowStatus(
      dto.sheetId,
      dto.tabName,
      dto.rowIndex,
      dto.status,
      dto.message,
    );
  }

  /**
   * Phase 5: Trigger manual ingestion (legacy - redirects to queue)
   */
  @Post('ingest')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async triggerIngestion(@CurrentUser() user: any) {
    await this.ingestionService.queueAllActiveSheets(true, user?.email);
    return { message: 'Ingestion process queued' };
  }

  /**
   * Verify Drive access - list files in Master Folder
   */
  @Get('verify')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async verifyAccess() {
    return this.googleService.verifyDriveAccess();
  }

  /**
   * Create a new spreadsheet and share it (Legacy)
   */
  @Post('spreadsheet')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async createSpreadsheet(
    @Body() dto: { title: string; shareWithEmail?: string },
  ) {
    return this.googleService.createSpreadsheet(dto.title, dto.shareWithEmail);
  }

  /**
   * Phase 3: Programmatically generate the 12-month tab structure (Sheet Factory)
   */
  @Post('setup/yearly-sheet')
  @Version('1')
  @Roles('SUPER_ADMIN')
  async generateYearlySheet(
    @Body() dto: { departmentId: string; departmentName: string; year: number },
  ) {
    return this.sheetFactory.generateYearlySheet(
      dto.departmentId,
      dto.departmentName,
      dto.year,
    );
  }

  /**
   * Create Master Folder (one-time setup)
   */
  @Post('setup/master-folder')
  @Version('1')
  @Roles('SUPER_ADMIN')
  async createMasterFolder(@Body() dto: { name?: string }) {
    const folderId = await this.googleService.createMasterFolder(dto.name);
    return {
      message: 'Master folder created. Add this to your .env file:',
      envVariable: `GOOGLE_DRIVE_MASTER_FOLDER_ID=${folderId}`,
      folderId,
    };
  }
}
