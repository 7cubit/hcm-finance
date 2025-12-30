import { Injectable } from '@nestjs/common';
import { PrismaClient, StagingStatus } from '@prisma/client';

const prisma = new PrismaClient();

export interface SearchResults {
  staging: any[];
  production: any[];
  totalSum: number;
  count: number;
}

@Injectable()
export class SearchService {
  async globalSearch(query: string, filters: {
    status?: StagingStatus;
    departmentId?: string;
    includeDeleted?: boolean;
    minAmount?: number;
    maxAmount?: number;
  }): Promise<SearchResults> {
    const isAmountSearch = !isNaN(Number(query)) && query.length > 0;
    const amount = isAmountSearch ? Number(query) : null;

    // Search Staging Transactions
    const staging = await prisma.stagingTransaction.findMany({
      where: {
        AND: [
          filters.includeDeleted ? {} : { deletedAt: null },
          filters.status ? { status: filters.status } : {},
          filters.departmentId ? { externalSheet: { departmentId: filters.departmentId } } : {},
          {
            OR: [
              { description: { contains: query, mode: 'insensitive' } },
              { note: { contains: query, mode: 'insensitive' } },
              { category: { contains: query, mode: 'insensitive' } },
              amount ? { amount: amount } : {},
            ],
          },
        ],
      },
      include: {
        externalSheet: { include: { department: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Search Production Ledger
    const production = await prisma.transaction.findMany({
      where: {
        AND: [
          filters.includeDeleted ? {} : { deletedAt: null },
          {
            OR: [
              { description: { contains: query, mode: 'insensitive' } },
              { payee: { contains: query, mode: 'insensitive' } },
              amount ? { amount: amount } : {},
            ],
          },
        ],
      },
      include: {
        account: true,
      },
      orderBy: { date: 'desc' },
    });

    const allItems = [...staging, ...production];
    const totalSum = allItems.reduce((sum, item) => sum + Number(item.amount), 0);

    return {
      staging,
      production,
      totalSum,
      count: allItems.length,
    };
  }

  async exportToCsv(query: string, filters: any) {
    const data = await this.globalSearch(query, filters);
    const rows = [
      ['Source', 'Date', 'Description', 'Category/Account', 'Amount', 'Status'],
    ];

    data.staging.forEach((item) => {
      rows.push([
        'STAGING',
        item.date ? item.date.toISOString() : item.createdAt.toISOString(),
        item.description || '',
        item.category || '',
        item.amount.toString(),
        item.status,
      ]);
    });

    data.production.forEach((item) => {
      rows.push([
        'PRODUCTION',
        item.date.toISOString(),
        item.description,
        item.account.name,
        item.amount.toString(),
        'FINALIZED',
      ]);
    });

    return rows.map((r) => r.join(',')).join('\n');
  }
}
