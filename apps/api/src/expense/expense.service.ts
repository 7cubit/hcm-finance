import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaClient, Prisma, TransactionType } from '@prisma/client';
import {
  CreateExpenseDto,
  UpdateExpenseStatusDto,
  VoidExpenseDto,
  ExpenseFilterDto,
  ExpenseStatus,
  RecurrenceType,
} from './dto/expense.dto';

const prisma = new PrismaClient();

interface BudgetWarning {
  fundId: string;
  fundName: string;
  budgetAmount: number;
  spent: number;
  remaining: number;
  isOverBudget: boolean;
}

@Injectable()
export class ExpenseService {
  /**
   * Generate unique expense reference
   */
  private async generateExpenseRef(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `HCM-EXP-${year}-`;

    const lastTransaction = await prisma.transaction.findFirst({
      where: {
        referenceNo: { startsWith: prefix },
        type: TransactionType.EXPENSE,
      },
      orderBy: { referenceNo: 'desc' },
    });

    let nextNumber = 1;
    if (lastTransaction?.referenceNo) {
      const lastNumber = parseInt(lastTransaction.referenceNo.split('-').pop() || '0', 10);
      nextNumber = lastNumber + 1;
    }

    return `${prefix}${String(nextNumber).padStart(4, '0')}`;
  }

  /**
   * Check account solvency
   */
  private async checkSolvency(accountId: string, amount: number): Promise<void> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const balance = parseFloat(account.balance.toString());
    if (balance < amount) {
      throw new BadRequestException(
        `Insufficient funds. Account balance: ¥${balance.toLocaleString()}, Required: ¥${amount.toLocaleString()}`,
      );
    }
  }

  /**
   * Check budget status and return warning if over budget
   */
  private async checkBudget(fundId: string, amount: number): Promise<BudgetWarning | null> {
    const fund = await prisma.fund.findUnique({
      where: { id: fundId },
    });

    if (!fund) {
      throw new NotFoundException(`Fund ${fundId} not found`);
    }

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const budget = await prisma.budget.findUnique({
      where: {
        fundId_month_year: {
          fundId,
          month: currentMonth,
          year: currentYear,
        },
      },
    });

    if (!budget) {
      return null; // No budget set
    }

    const budgetAmount = parseFloat(budget.amount.toString());
    const currentSpent = parseFloat(budget.spent.toString());
    const remaining = budgetAmount - currentSpent;
    const newTotal = currentSpent + amount;

    if (newTotal > budgetAmount) {
      return {
        fundId,
        fundName: fund.name,
        budgetAmount,
        spent: currentSpent,
        remaining,
        isOverBudget: true,
      };
    }

    return null;
  }

  /**
   * Create expense request
   */
  async createExpense(dto: CreateExpenseDto, userId: string) {
    // Validate fund exists
    const fund = await prisma.fund.findUnique({
      where: { id: dto.fundId },
    });

    if (!fund) {
      throw new NotFoundException(`Fund ${dto.fundId} not found`);
    }

    // Validate account exists
    const account = await prisma.account.findUnique({
      where: { id: dto.accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account ${dto.accountId} not found`);
    }

    // Solvency check (only for non-draft status)
    if (dto.status !== ExpenseStatus.DRAFT) {
      await this.checkSolvency(dto.accountId, dto.amount);
    }

    // Budget check
    const budgetWarning = await this.checkBudget(dto.fundId, dto.amount);

    // Generate reference
    const referenceNo = await this.generateExpenseRef();

    // Build description with privacy handling
    let description = dto.description;
    if (dto.isBenevolence && dto.hideIdentityInReports) {
      description = `[CONFIDENTIAL] ${description}`;
    }

    // Create expense transaction
    const transaction = await prisma.transaction.create({
      data: {
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency || 'JPY',
        payee: dto.hideIdentityInReports ? 'Confidential' : dto.payee,
        description,
        referenceNo,
        receiptUrl: dto.attachmentUrl,
        date: dto.date ? new Date(dto.date) : new Date(),
        accountId: dto.accountId,
        beneficiaryId: dto.beneficiaryId,
        recordedById: userId,
        isReconciled: false,
      },
    });

    // Create split for the fund
    await prisma.transactionSplit.create({
      data: {
        transactionId: transaction.id,
        fundId: dto.fundId,
        amount: new Prisma.Decimal(dto.amount),
        note: dto.isBenevolence ? 'Benevolence payment' : undefined,
      },
    });

    return {
      id: transaction.id,
      referenceNo,
      amount: dto.amount,
      currency: dto.currency || 'JPY',
      payee: dto.hideIdentityInReports ? 'Confidential' : dto.payee,
      description,
      fundId: dto.fundId,
      fundName: fund.name,
      accountId: dto.accountId,
      accountName: account.name,
      status: dto.status || ExpenseStatus.DRAFT,
      isBenevolence: dto.isBenevolence || false,
      isPrivate: dto.hideIdentityInReports || false,
      attachmentUrl: dto.attachmentUrl,
      date: transaction.date,
      budgetWarning: budgetWarning
        ? {
            message: `Warning: This expense will exceed the ${fund.name} budget`,
            ...budgetWarning,
          }
        : null,
    };
  }

  /**
   * Update expense status (approval workflow)
   */
  async updateExpenseStatus(id: string, dto: UpdateExpenseStatusDto, userId: string, userRole: string) {
    const transaction = await prisma.transaction.findFirst({
      where: { id, type: TransactionType.EXPENSE },
      include: { splits: { include: { fund: true } } },
    });

    if (!transaction) {
      throw new NotFoundException(`Expense ${id} not found`);
    }

    // Status transition validation
    const validTransitions: Record<string, string[]> = {
      DRAFT: ['PENDING', 'VOIDED'],
      PENDING: ['APPROVED', 'REJECTED'],
      APPROVED: ['PAID', 'VOIDED'],
      REJECTED: ['DRAFT'],
      PAID: ['VOIDED'],
      VOIDED: [],
    };

    // Get current status from description (simplified - in production, use separate status field)
    const currentStatus = this.extractStatus(transaction.description);
    const allowedNextStatuses = validTransitions[currentStatus] || [];

    if (!allowedNextStatuses.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${dto.status}`,
      );
    }

    // Role-based approval validation
    if (dto.status === ExpenseStatus.APPROVED) {
      if (!['SUPER_ADMIN', 'TREASURER'].includes(userRole)) {
        throw new ForbiddenException('Only Treasurer or Admin can approve expenses');
      }
    }

    // If marking as PAID, process the payment
    if (dto.status === ExpenseStatus.PAID) {
      await this.processPayment(transaction);
    }

    // Update with new status in description
    const updatedDescription = this.updateStatusInDescription(
      transaction.description,
      dto.status,
    );

    await prisma.transaction.update({
      where: { id },
      data: {
        description: updatedDescription,
      },
    });

    // Log to audit
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entityType: 'Transaction',
        entityId: id,
        beforeState: JSON.stringify({ status: currentStatus }),
        afterState: JSON.stringify({ status: dto.status, comment: dto.comment }),
        userId,
      },
    });

    return {
      id,
      previousStatus: currentStatus,
      newStatus: dto.status,
      comment: dto.comment,
      updatedAt: new Date(),
    };
  }

  /**
   * Process payment - deduct from account and update budget
   */
  private async processPayment(transaction: any) {
    const amount = parseFloat(transaction.amount.toString());

    // Solvency check before payment
    await this.checkSolvency(transaction.accountId, amount);

    await prisma.$transaction(async (tx) => {
      // Deduct from account
      await tx.account.update({
        where: { id: transaction.accountId },
        data: {
          balance: { decrement: amount },
        },
      });

      // Update budget spent
      const split = transaction.splits[0];
      if (split) {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        await tx.budget.updateMany({
          where: {
            fundId: split.fundId,
            month: currentMonth,
            year: currentYear,
          },
          data: {
            spent: { increment: amount },
          },
        });
      }

      // Mark as reconciled
      await tx.transaction.update({
        where: { id: transaction.id },
        data: { isReconciled: true },
      });
    });
  }

  /**
   * Void an expense (reverse without deleting)
   */
  async voidExpense(id: string, dto: VoidExpenseDto, userId: string) {
    const transaction = await prisma.transaction.findFirst({
      where: { id, type: TransactionType.EXPENSE },
      include: { splits: true },
    });

    if (!transaction) {
      throw new NotFoundException(`Expense ${id} not found`);
    }

    const currentStatus = this.extractStatus(transaction.description);
    if (currentStatus === 'VOIDED') {
      throw new BadRequestException('Expense is already voided');
    }

    const amount = parseFloat(transaction.amount.toString());

    await prisma.$transaction(async (tx) => {
      // If was paid, reverse the financial impact
      if (currentStatus === 'PAID' && transaction.isReconciled) {
        // Credit back to account
        await tx.account.update({
          where: { id: transaction.accountId },
          data: {
            balance: { increment: amount },
          },
        });

        // Reverse budget spent
        const split = transaction.splits[0];
        if (split) {
          const currentMonth = new Date().getMonth() + 1;
          const currentYear = new Date().getFullYear();

          await tx.budget.updateMany({
            where: {
              fundId: split.fundId,
              month: currentMonth,
              year: currentYear,
            },
            data: {
              spent: { decrement: amount },
            },
          });
        }
      }

      // Update status to VOIDED
      const voidedDescription = `[VOIDED: ${dto.reason}] ${transaction.description}`;
      await tx.transaction.update({
        where: { id },
        data: {
          description: voidedDescription,
          isReconciled: false,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          action: 'VOID',
          entityType: 'Transaction',
          entityId: id,
          beforeState: JSON.stringify({ status: currentStatus }),
          afterState: JSON.stringify({ status: 'VOIDED', reason: dto.reason }),
          userId,
        },
      });
    });

    return {
      id,
      status: 'VOIDED',
      reason: dto.reason,
      reversedAmount: currentStatus === 'PAID' ? amount : 0,
      voidedAt: new Date(),
    };
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals() {
    const transactions = await prisma.transaction.findMany({
      where: {
        type: TransactionType.EXPENSE,
        description: { contains: '[PENDING]' },
      },
      include: {
        account: true,
        splits: { include: { fund: true } },
        recordedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      count: transactions.length,
      items: transactions.map((t) => ({
        id: t.id,
        referenceNo: t.referenceNo,
        amount: parseFloat(t.amount.toString()),
        currency: t.currency,
        payee: t.payee,
        description: t.description.replace(/\[(PENDING|DRAFT)\]\s*/g, ''),
        fund: t.splits[0]?.fund
          ? { id: t.splits[0].fund.id, name: t.splits[0].fund.name }
          : null,
        account: { id: t.account.id, name: t.account.name },
        requestedBy: t.recordedBy,
        requestedAt: t.createdAt,
        hasReceipt: !!t.receiptUrl,
      })),
    };
  }

  /**
   * Get expenses with filters
   */
  async getExpenses(filters: ExpenseFilterDto) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {
      type: TransactionType.EXPENSE,
    };

    if (filters.status) {
      where.description = { contains: `[${filters.status}]` };
    }

    if (filters.fundId) {
      where.splits = { some: { fundId: filters.fundId } };
    }

    if (filters.accountId) {
      where.accountId = filters.accountId;
    }

    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          account: true,
          beneficiary: true,
          splits: { include: { fund: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions.map((t) => ({
        id: t.id,
        referenceNo: t.referenceNo,
        amount: parseFloat(t.amount.toString()),
        currency: t.currency,
        payee: t.payee,
        description: t.description,
        status: this.extractStatus(t.description),
        isPrivate: t.description.includes('[CONFIDENTIAL]'),
        fund: t.splits[0]?.fund
          ? { id: t.splits[0].fund.id, name: t.splits[0].fund.name }
          : null,
        account: { id: t.account.id, name: t.account.name },
        beneficiary: t.beneficiary
          ? {
              id: t.beneficiary.id,
              name: t.beneficiary.privateIdentity
                ? 'Private'
                : `${t.beneficiary.firstName} ${t.beneficiary.lastName}`,
            }
          : null,
        hasReceipt: !!t.receiptUrl,
        date: t.date,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // Helper to extract status from description
  private extractStatus(description: string): string {
    const match = description.match(/\[(DRAFT|PENDING|APPROVED|REJECTED|PAID|VOIDED)\]/);
    return match ? match[1] : 'DRAFT';
  }

  // Helper to update status in description
  private updateStatusInDescription(description: string, newStatus: string): string {
    const cleaned = description.replace(/\[(DRAFT|PENDING|APPROVED|REJECTED|PAID|VOIDED)\]\s*/g, '');
    return `[${newStatus}] ${cleaned}`;
  }
}
