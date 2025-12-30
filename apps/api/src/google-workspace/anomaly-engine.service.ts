import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient, AnomalySeverity } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationService } from '../common/notification.service';

const prisma = new PrismaClient();

@Injectable()
export class AnomalyEngineService {
  private readonly logger = new Logger(AnomalyEngineService.name);
  private readonly SUSPICIOUS_KEYWORDS = ['gift', 'personal', 'loan'];
  private readonly FORBIDDEN_CURRENCY_SYMBOLS = ['$', '€', '£', 'btc', 'eth'];

  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Scan a staging transaction for potential risks
   */
  async scanTransaction(txId: string, rawAmountStr?: string) {
    const tx = await prisma.stagingTransaction.findUnique({
      where: { id: txId },
      include: { 
        externalSheet: { include: { department: true } },
        anomalies: true 
      }
    });

    if (!tx) return;

    await this.checkDuplicates(tx);
    await this.checkSpikes(tx);
    await this.checkKeywords(tx);
    await this.checkCurrency(tx, rawAmountStr);
    await this.checkDateValidity(tx);
  }

  private async checkDuplicates(tx: any) {
    if (!tx.description) return;

    const duplicates = await prisma.stagingTransaction.findMany({
      where: {
        amount: tx.amount,
        description: { equals: tx.description, mode: 'insensitive' },
        id: { not: tx.id },
        externalSheetId: { not: tx.externalSheetId },
        status: { in: ['PENDING', 'APPROVED'] }
      },
      include: { externalSheet: { include: { department: true } } }
    });

    if (duplicates.length > 0) {
      await this.createAnomaly(tx.id, 'DUPLICATE', AnomalySeverity.MEDIUM, 
        `Duplicate amount/desc found in ${duplicates[0].externalSheet.department.name}`);
    }
  }

  private async checkSpikes(tx: any) {
    const budgetLimit = Number(tx.externalSheet.department.budgetLimit);
    const amount = Number(tx.amount);

    if (amount > budgetLimit * 0.5) {
      await this.createAnomaly(tx.id, 'SPIKE', AnomalySeverity.HIGH, 
        `Large spending: ¥${amount.toLocaleString()} is > 50% of monthly department limit.`);
    }
  }

  private async checkKeywords(tx: any) {
    if (!tx.description) return;
    const desc = tx.description.toLowerCase();
    const found = this.SUSPICIOUS_KEYWORDS.filter(k => desc.includes(k));

    if (found.length > 0) {
      await this.createAnomaly(tx.id, 'KEYWORD', AnomalySeverity.MEDIUM, 
        `Suspicious keywords: ${found.join(', ')}`);
    }
  }

  private async checkCurrency(tx: any, rawAmount?: string) {
    const textToSearch = `${tx.description || ''} ${rawAmount || ''}`.toLowerCase();
    const found = this.FORBIDDEN_CURRENCY_SYMBOLS.filter(s => textToSearch.includes(s));

    if (found.length > 0) {
      await this.createAnomaly(tx.id, 'CURRENCY', AnomalySeverity.LOW, 
        `Detected possible foreign currency symbol: ${found.join(' ')}`);
    }
  }

  private async checkDateValidity(tx: any) {
    if (!tx.date) return;
    const date = new Date(tx.date);
    const day = date.getDay(); // 0: Sun, 6: Sat

    if (day === 0 || day === 6) {
      await this.createAnomaly(tx.id, 'DATE', AnomalySeverity.LOW, 
        `Dated on a weekend (${date.toLocaleDateString('en-US', { weekday: 'long' })}).`);
    }
  }

  async checkVelocity(externalSheetId: string, count: number) {
    if (count > 50) {
      // Find the last N transactions from this sheet
      const txs = await prisma.stagingTransaction.findMany({
        where: { externalSheetId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: count
      });

      for (const tx of txs) {
        await this.createAnomaly(tx.id, 'VELOCITY', AnomalySeverity.MEDIUM, 
          `Batch velocity alert: ${count} rows updated in one sync (Possible copy-paste error).`);
      }
    }
  }

  /**
   * Train vendor whitelist from approved data
   */
  async learnVendor(description: string, category: string) {
    const vendorName = (description || '').split(' ')[0].trim();
    if (vendorName.length > 2) {
      await prisma.vendorWhitelist.upsert({
        where: { name: vendorName },
        update: { category },
        create: { name: vendorName, category }
      });
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_9PM)
  async sendSuspiciousDigest() {
    const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const anomalies = await prisma.anomaly.findMany({
      where: { 
        isIgnored: false,
        severity: { in: ['MEDIUM', 'HIGH'] },
        createdAt: { gte: threshold }
      },
      include: {
        stagingTransaction: {
          include: { externalSheet: { include: { department: true } } }
        }
      }
    });

    if (anomalies.length > 0) {
      const summary = anomalies.map(a => 
        `- [${a.type}] Dept: ${a.stagingTransaction.externalSheet.department.name}, Amt: ¥${Number(a.stagingTransaction.amount).toLocaleString()}, Issue: ${a.description}`
      ).join('\n');

      await this.notificationService.sendEmail(
        'admin@hcmj.org',
        'Suspicious Activity Digest',
        `The Anomaly Engine has flagged the following pending transactions:\n\n${summary}\n\nPlease review them in the Staging Dashboard.`
      );
    }
  }

  private async createAnomaly(txId: string, type: string, severity: AnomalySeverity, description: string) {
    const existing = await prisma.anomaly.findFirst({
      where: { stagingTransactionId: txId, type }
    });

    if (!existing) {
      await prisma.anomaly.create({
        data: { stagingTransactionId: txId, type, severity, description }
      });
      this.logger.warn(`🚩 [${type}] Anomaly for STX ${txId}: ${description}`);
    }
  }

  async ignoreAnomaly(id: string, email: string) {
    return prisma.anomaly.update({
      where: { id },
      data: { isIgnored: true, ignoredByEmail: email }
    });
  }
}
