import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { RedisService } from '../config/redis.service';
import { RateLimiterService } from './rate-limiter.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { SyncCacheService } from './sync-cache.service';

export interface SyncJobData {
  sheetId: string;
  spreadsheetId: string;
  departmentName: string;
  priority: 'manual' | 'cron';
  triggeredBy?: string;
}

export interface SyncJobResult {
  success: boolean;
  sheetId: string;
  newRows: number;
  updatedRows: number;
  skipped: boolean;
  error?: string;
}

/**
 * Sync Queue Service
 * Uses BullMQ to process sync jobs one by one
 * Manual syncs get priority over cron syncs
 */
@Injectable()
export class SyncQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncQueueService.name);
  private queue: Queue<SyncJobData, SyncJobResult> | null = null;
  private worker: Worker<SyncJobData, SyncJobResult> | null = null;
  private processor: ((job: Job<SyncJobData>) => Promise<SyncJobResult>) | null = null;
  private redisAvailable = false;

  constructor(
    private readonly redis: RedisService,
    private readonly rateLimiter: RateLimiterService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly syncCache: SyncCacheService,
  ) {}

  async onModuleInit() {
    try {
      const connection = this.redis.getClient();
      if (!connection) {
        this.logger.warn('⚠️ Redis not available, sync queue disabled (using direct sync)');
        return;
      }

      // Create queue
      this.queue = new Queue<SyncJobData, SyncJobResult>('sheet-sync', {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      });

      this.redisAvailable = true;
      this.logger.log('✅ Sync queue initialized');
    } catch (error: any) {
      this.logger.warn(`⚠️ Redis connection failed: ${error.message}. Using direct sync.`);
    }
  }

  /**
   * Set the processor function (called from SheetIngestionService)
   */
  setProcessor(processor: (job: Job<SyncJobData>) => Promise<SyncJobResult>) {
    this.processor = processor;
    
    if (!this.redisAvailable || !this.queue) {
      this.logger.warn('⚠️ Sync worker not started (Redis unavailable)');
      return;
    }

    try {
      // Create worker with concurrency of 1 (process jobs sequentially)
      this.worker = new Worker<SyncJobData, SyncJobResult>(
        'sheet-sync',
        async (job) => {
          // Check circuit breaker before processing
          const isOpen = await this.circuitBreaker.isCircuitOpen(job.data.sheetId);
          if (isOpen) {
            this.logger.warn(`🔴 Circuit open for ${job.data.sheetId}, skipping`);
            return {
              success: false,
              sheetId: job.data.sheetId,
              newRows: 0,
              updatedRows: 0,
              skipped: true,
              error: 'Circuit breaker open',
            };
          }

          try {
            // Execute with rate limiting
            const result = await this.rateLimiter.executeWithBackoff(
              () => processor(job),
            );

            // Record success
            await this.circuitBreaker.recordSuccess(job.data.sheetId);
            return result;
          } catch (error: any) {
            // Record failure
            await this.circuitBreaker.recordFailure(job.data.sheetId, error.message);
            throw error;
          }
        },
        {
          connection: this.redis.getClient()!,
          concurrency: 1, // Process one job at a time
        },
      );

      this.worker.on('completed', (job, result) => {
        this.logger.log(`✅ Job ${job.id} completed: ${result.newRows} new, ${result.updatedRows} updated`);
      });

      this.worker.on('failed', (job, error) => {
        this.logger.error(`❌ Job ${job?.id} failed: ${error.message}`);
      });

      this.logger.log('✅ Sync worker started');
    } catch (error: any) {
      this.logger.warn(`⚠️ Failed to start sync worker: ${error.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
  }

  /**
   * Add a manual sync job (high priority)
   */
  async addManualSync(data: Omit<SyncJobData, 'priority'>, triggeredBy?: string): Promise<string> {
    // Invalidate cache to force re-sync
    await this.syncCache.invalidate(data.sheetId);

    if (!this.queue) {
      this.logger.warn('⚠️ Queue not available, skipping manual sync job');
      return 'no-queue';
    }

    const job = await this.queue.add('sync', {
      ...data,
      priority: 'manual',
      triggeredBy,
    }, {
      priority: 1, // Higher priority (lower number = higher priority)
    });

    this.logger.log(`📤 Manual sync job added for ${data.departmentName}: ${job.id}`);
    return job.id!;
  }

  /**
   * Add a cron sync job (low priority)
   */
  async addCronSync(data: Omit<SyncJobData, 'priority'>): Promise<string> {
    if (!this.queue) {
      return 'no-queue';
    }

    const job = await this.queue.add('sync', {
      ...data,
      priority: 'cron',
    }, {
      priority: 10, // Lower priority
    });

    return job.id!;
  }

  /**
   * Get queue stats (for dashboard)
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    if (!this.queue) {
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Pause/Resume queue (for maintenance)
   */
  async pause(): Promise<void> {
    if (!this.queue) return;
    await this.queue.pause();
    this.logger.warn('⏸️ Sync queue paused');
  }

  async resume(): Promise<void> {
    if (!this.queue) return;
    await this.queue.resume();
    this.logger.log('▶️ Sync queue resumed');
  }
}
