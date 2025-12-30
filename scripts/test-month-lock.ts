import { NestFactory } from '@nestjs/core';
import { AppModule } from '../apps/api/src/app.module';
import { MonthLockService } from '../apps/api/src/google-workspace/month-lock.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const lockService = app.get(MonthLockService);

  const testSheetId = process.env.TEST_SHEET_ID; // Use an existing externalSheet ID
  const testMonth = 'January';

  if (!testSheetId) {
    console.error('❌ Please provide TEST_SHEET_ID (ExternalSheet ID) in env');
    process.exit(1);
  }

  console.log(`🔒 Testing Manual Lock for ${testMonth}...`);
  try {
    await lockService.lockMonth(testSheetId, testMonth);
    console.log('✅ Lock successfully applied.');

    // Wait a bit
    await new Promise(r => setTimeout(r, 5000));

    console.log(`🔓 Testing Manual Unlock for ${testMonth}...`);
    await lockService.unlockMonth(testSheetId, testMonth);
    console.log('✅ Unlock successfully applied.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

bootstrap();
