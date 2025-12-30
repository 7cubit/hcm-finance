import { Module, Global } from '@nestjs/common';
import { GoogleWorkspaceService } from './google-workspace.service';
import { GoogleWorkspaceController } from './google-workspace.controller';
import { SheetFactoryService } from './sheet-factory.service';
import { SheetAccessService } from './sheet-access.service';
import { SheetIngestionService } from './sheet-ingestion.service';
import { SheetFeedbackService } from './sheet-feedback.service';
import { ReceiptPreservationService } from './receipt-preservation.service';
import { StagingApprovalService } from './staging-approval.service';
import { StagingApprovalController } from './staging-approval.controller';
import { MonthLockService } from './month-lock.service';
import { MonthLockController } from './month-lock.controller';
import { NotificationService } from '../common/notification.service';
import { AnomalyEngineService } from './anomaly-engine.service';
import { PushNotificationService } from '../common/push-notification.service';
// Phase 16: Quota Management
import { RedisService } from '../config/redis.service';
import { RateLimiterService } from './rate-limiter.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { SyncCacheService } from './sync-cache.service';
import { SyncQueueService } from './sync-queue.service';
// Phase 17: Security Hardening
import { SanitizerService } from '../common/sanitizer.service';
import { AuditLogService } from '../common/audit-log.service';
import { PrivacyService } from '../common/privacy.service';
import { BackupService } from './backup.service';

@Global()
@Module({
  providers: [
    // Core services
    GoogleWorkspaceService,
    SheetFactoryService,
    SheetAccessService,
    SheetIngestionService,
    SheetFeedbackService,
    ReceiptPreservationService,
    StagingApprovalService,
    MonthLockService,
    NotificationService,
    AnomalyEngineService,
    PushNotificationService,
    // Phase 16: Quota Management
    RedisService,
    RateLimiterService,
    CircuitBreakerService,
    SyncCacheService,
    SyncQueueService,
    // Phase 17: Security
    SanitizerService,
    AuditLogService,
    PrivacyService,
    BackupService,
  ],
  controllers: [GoogleWorkspaceController, StagingApprovalController, MonthLockController],
  exports: [
    GoogleWorkspaceService,
    SheetFactoryService,
    SheetAccessService,
    SheetIngestionService,
    SheetFeedbackService,
    ReceiptPreservationService,
    MonthLockService,
    NotificationService,
    AnomalyEngineService,
    PushNotificationService,
    // Phase 16 exports
    RedisService,
    RateLimiterService,
    CircuitBreakerService,
    SyncCacheService,
    SyncQueueService,
    // Phase 17 exports
    SanitizerService,
    AuditLogService,
    PrivacyService,
    BackupService,
  ],
})
export class GoogleWorkspaceModule {}
