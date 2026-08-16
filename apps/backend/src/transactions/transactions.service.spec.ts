import { Test, TestingModule } from '@nestjs/testing';
import {
  getBudgetPeriodIdForNewTransaction,
  TransactionsService,
} from './transactions.service';
import { KnexService } from '../database/knex.service';
import { TransactionType } from './enums/transaction-type.enum';

describe('TransactionsService', () => {
  let service: TransactionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: KnexService, useValue: { connection: jest.fn() } },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('keeps a normal income in the current cycle', () => {
    expect(getBudgetPeriodIdForNewTransaction({ id: 42 })).toBe(42);
  });

  it('normalizes a PostgreSQL Date value for transaction detail output', () => {
    const formatter = service as unknown as {
      formatDateOnly: (value: string | Date | null | undefined) => string;
    };

    expect(formatter.formatDateOnly(new Date(2026, 7, 16))).toBe('2026-08-16');
  });

  it('returns a date-only string when GET detail receives a Date from Knex', async () => {
    const transactionQuery = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({
        id: 7,
        accountId: 3,
        accountName: 'Cash',
        destinationAccountId: null,
        destinationAccountName: null,
        accountType: 'CASH',
        currentBalance: 500000,
        budgetPeriodId: 2,
        periodStartDate: new Date(2026, 7, 1),
        periodEndDate: new Date(2026, 7, 31),
        savingPercentage: 20,
        periodStatus: 'ACTIVE',
        cycleSourcePeriodId: null,
        transactionType: TransactionType.EXPENSE,
        amount: 150000,
        transactionDate: new Date(2026, 7, 16),
        category: 'Groceries',
        note: null,
        createdAt: new Date(),
        updatedAt: null,
      }),
    };
    const periodQuery = {
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(undefined),
    };
    const connection = jest
      .fn()
      .mockReturnValueOnce(transactionQuery)
      .mockReturnValueOnce(periodQuery)
      .mockReturnValueOnce(periodQuery);
    const detailService = new TransactionsService({
      connection,
    } as unknown as KnexService);

    const response = await detailService.findOne(7, 'user-1');

    expect(response.data.transactionDate).toBe('2026-08-16');
  });

  it('normalizes date-only and timestamp strings without timezone shifting', () => {
    const formatter = service as unknown as {
      formatDateOnly: (value: string | Date | null | undefined) => string;
    };

    expect(formatter.formatDateOnly('2026-08-16')).toBe('2026-08-16');
    expect(formatter.formatDateOnly('2026-08-16T00:00:00+07:00')).toBe(
      '2026-08-16',
    );
  });

  it.each([null, undefined, new Date(Number.NaN), 'not-a-date'])(
    'rejects an invalid transaction date instead of throwing a slice error',
    (value) => {
      const formatter = service as unknown as {
        formatDateOnly: (input: string | Date | null | undefined) => string;
      };

      expect(() => formatter.formatDateOnly(value)).toThrow(
        'Transaction date is invalid.',
      );
    },
  );
});
