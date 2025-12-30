import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { EmailWebhookController } from './email-webhook.controller';
import { GoogleWorkspaceModule } from '../google-workspace/google-workspace.module';

@Module({
  imports: [GoogleWorkspaceModule],
  providers: [EmailService, SmsService, NotificationService],
  controllers: [NotificationController, EmailWebhookController],
  exports: [EmailService, SmsService, NotificationService],
})
export class NotificationModule {}
