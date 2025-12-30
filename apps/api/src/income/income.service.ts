import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient, Prisma, TransactionType } from '@prisma/client';
import { CreateIncomeDto, IncomeFilterDto, ContributionType } from './dto/income.dto';

const prisma = new PrismaClient();

@Injectable()
export class IncomeService {
  /**
   * Generate a unique Receipt ID
   * Format: HCM-INC-YYYY-NNN (e.g., HCM-INC-2025-001)
   */
  private async generateReceiptId(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `HCM-INC-${year}-`;

    // Get the last receipt number for this year
    const lastTransaction = await prisma.transaction.findFirst({
      where: {
        referenceNo: {
          startsWith: prefix,
        },
      },
      orderBy: {
        referenceNo: 'desc',
      },
    });

    let nextNumber = 1;
    if (lastTransaction?.referenceNo) {
      const lastNumber = parseInt(lastTransaction.referenceNo.split('-').pop() || '0', 10);
      nextNumber = lastNumber + 1;
    }

    return `${prefix}${String(nextNumber).padStart(4, '0')}`;
  }

  /**
   * Create income transaction with splits
   * ACID: Updates account balance + fund allocations atomically
   */
  async createIncome(dto: CreateIncomeDto, userId: string) {
    // Validation: Sum of splits must equal total amount
    const splitsSum = dto.splits.reduce((sum, split) => sum + split.amount, 0);
    
    if (Math.abs(splitsSum - dto.totalAmount) > 0.01) {
      throw new BadRequestException(
        `Split amounts (${splitsSum}) must equal total amount (${dto.totalAmount})`,
      );
    }

    // Verify account exists
    const account = await prisma.account.findUnique({
      where: { id: dto.accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account ${dto.accountId} not found`);
    }

    // Verify all funds exist
    const fundIds = dto.splits.map((s) => s.fundId);
    const funds = await prisma.fund.findMany({
      where: { id: { in: fundIds } },
    });

    if (funds.length !== fundIds.length) {
      throw new BadRequestException('One or more fund IDs are invalid');
    }

    // Generate receipt ID
    const receiptId = await this.generateReceiptId();

    // Build description
    let description = dto.description || 'Income';
    if (dto.isSundayCollection) {
      description = `Sunday Collection - ${description}`;
    }
    if (dto.contributionType === ContributionType.FOREIGN) {
      description = `[FCRA] ${description}`;
    }

    // ACID Transaction: Create transaction + splits + update balances
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the main transaction
      const transaction = await tx.transaction.create({
        data: {
          type: TransactionType.INCOME,
          amount: new Prisma.Decimal(dto.totalAmount),
          currency: dto.currency || 'JPY',
          description,
          referenceNo: receiptId,
          receiptUrl: dto.proofOfDepositUrl,
          date: dto.date ? new Date(dto.date) : new Date(),
          accountId: dto.accountId,
          donorId: dto.isAnonymous ? null : dto.donorId,
          recordedById: userId,
          isReconciled: false,
        },
      });

      // 2. Create transaction splits
      const splits = await Promise.all(
        dto.splits.map((split) =>
          tx.transactionSplit.create({
            data: {
              transactionId: transaction.id,
              fundId: split.fundId,
              amount: new Prisma.Decimal(split.amount),
              note: split.note,
            },
          }),
        ),
      );

      // 3. Update account balance (Asset increases)
      await tx.account.update({
        where: { id: dto.accountId },
        data: {
          balance: {
            increment: dto.totalAmount,
          },
        },
      });

      // 4. Update budget spent amounts (if applicable)
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      // Note: For income, we typically don't update "spent" on budgets
      // But we could track income vs budget targets if needed

      return {
        transaction,
        splits,
      };
    });

    // Return with fund names for response
    const splitsWithFunds = await prisma.transactionSplit.findMany({
      where: { transactionId: result.transaction.id },
      include: { fund: true },
    });

    return {
      id: result.transaction.id,
      receiptId,
      totalAmount: dto.totalAmount,
      currency: dto.currency || 'JPY',
      date: result.transaction.date,
      description: result.transaction.description,
      accountId: dto.accountId,
      donorId: dto.donorId,
      isAnonymous: dto.isAnonymous || !dto.donorId,
      isSundayCollection: dto.isSundayCollection || false,
      contributionType: dto.contributionType || ContributionType.LOCAL,
      proofOfDepositUrl: dto.proofOfDepositUrl,
      splits: splitsWithFunds.map((s) => ({
        fundId: s.fundId,
        fundName: s.fund.name,
        amount: parseFloat(s.amount.toString()),
        note: s.note,
      })),
    };
  }

  /**
   * Get income transactions with filters
   */
  async getIncome(filters: IncomeFilterDto) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {
      type: TransactionType.INCOME,
    };

    // Date range filter
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) {
        where.date.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.date.lte = new Date(filters.endDate);
      }
    }

    // Account filter
    if (filters.accountId) {
      where.accountId = filters.accountId;
    }

    // Donor filter
    if (filters.donorId) {
      where.donorId = filters.donorId;
    }

    // Fund filter (via splits)
    if (filters.fundId) {
      where.splits = {
        some: {
          fundId: filters.fundId,
        },
      };
    }

    // FCRA filter
    if (filters.contributionType) {
      if (filters.contributionType === ContributionType.FOREIGN) {
        where.description = { contains: '[FCRA]' };
      } else {
        where.description = { not: { contains: '[FCRA]' } };
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          account: true,
          donor: true,
          splits: {
            include: {
              fund: true,
            },
          },
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
        receiptId: t.referenceNo,
        amount: parseFloat(t.amount.toString()),
        currency: t.currency,
        date: t.date,
        description: t.description,
        account: {
          id: t.account.id,
          name: t.account.name,
        },
        donor: t.donor
          ? {
              id: t.donor.id,
              name: `${t.donor.firstName} ${t.donor.lastName}`,
            }
          : null,
        isAnonymous: !t.donorId,
        isFCRA: t.description.includes('[FCRA]'),
        proofOfDepositUrl: t.receiptUrl,
        splits: t.splits.map((s) => ({
          fundId: s.fundId,
          fundName: s.fund.name,
          amount: parseFloat(s.amount.toString()),
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get income by ID
   */
  async getIncomeById(id: string) {
    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        type: TransactionType.INCOME,
      },
      include: {
        account: true,
        donor: true,
        splits: {
          include: {
            fund: true,
          },
        },
        recordedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Income transaction ${id} not found`);
    }

    return {
      id: transaction.id,
      receiptId: transaction.referenceNo,
      amount: parseFloat(transaction.amount.toString()),
      currency: transaction.currency,
      date: transaction.date,
      description: transaction.description,
      account: {
        id: transaction.account.id,
        name: transaction.account.name,
        type: transaction.account.type,
      },
      donor: transaction.donor
        ? {
            id: transaction.donor.id,
            donorId: transaction.donor.donorId,
            name: `${transaction.donor.firstName} ${transaction.donor.lastName}`,
          }
        : null,
      isAnonymous: !transaction.donorId,
      isFCRA: transaction.description.includes('[FCRA]'),
      proofOfDepositUrl: transaction.receiptUrl,
      isReconciled: transaction.isReconciled,
      recordedBy: transaction.recordedBy,
      splits: transaction.splits.map((s) => ({
        id: s.id,
        fundId: s.fundId,
        fundName: s.fund.name,
        fundColor: s.fund.color,
        amount: parseFloat(s.amount.toString()),
        note: s.note,
      })),
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }

  /**
   * Get income summary by fund
   */
  async getIncomeSummary(startDate?: string, endDate?: string) {
    const where: Prisma.TransactionSplitWhereInput = {
      transaction: {
        type: TransactionType.INCOME,
      },
    };

    if (startDate || endDate) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (startDate) {
        dateFilter.gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.lte = new Date(endDate);
      }
      where.transaction = {
        type: TransactionType.INCOME,
        date: dateFilter,
      };
    }

    const splits = await prisma.transactionSplit.groupBy({
      by: ['fundId'],
      where,
      _sum: {
        amount: true,
      },
    });

    // Get fund names
    const fundIds = splits.map((s) => s.fundId);
    const funds = await prisma.fund.findMany({
      where: { id: { in: fundIds } },
    });

    const fundMap = new Map(funds.map((f) => [f.id, f]));

    return {
      byFund: splits.map((s) => ({
        fundId: s.fundId,
        fundName: fundMap.get(s.fundId)?.name || 'Unknown',
        fundColor: fundMap.get(s.fundId)?.color || '#888',
        total: parseFloat(s._sum.amount?.toString() || '0'),
      })),
      grandTotal: splits.reduce(
        (sum, s) => sum + parseFloat(s._sum.amount?.toString() || '0'),
        0,
      ),
    };
  }
}
