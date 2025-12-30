import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { PublicModule } from './public/public.module';
import { IncomeModule } from './income/income.module';
import { ExpenseModule } from './expense/expense.module';
import { ScheduleModule } from '@nestjs/schedule';
import { GoogleWorkspaceModule } from './google-workspace/google-workspace.module';
import { DepartmentModule } from './department/department.module';
import { SearchModule } from './search/search.module';
import { SandboxModule } from './sandbox/sandbox.module';
import { NotificationModule } from './notifications/notification.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 10000, limit: 50 },
      { name: 'long', ttl: 60000, limit: 100 },
    ]),
    AuthModule,
    AdminModule,
    PublicModule,
    IncomeModule,
    ExpenseModule,
    GoogleWorkspaceModule,
    DepartmentModule,
    SearchModule,
    SandboxModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
