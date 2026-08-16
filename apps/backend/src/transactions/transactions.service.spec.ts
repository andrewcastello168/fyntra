import { Test, TestingModule } from '@nestjs/testing';
import {
  getBudgetPeriodIdForNewTransaction,
  TransactionsService,
} from './transactions.service';
import { KnexService } from '../database/knex.service';
import { TransactionType } from './enums/transaction-type.enum';

type UpdateHarnessOptions = {
  transactionType?: TransactionType;
  oldAccountId?: string;
  updatedAccountId?: string;
  oldAmount?: number;
  updatedAmount?: number;
  accounts?: Array<{
    id: string;
    account_name: string;
    current_balance: string;
    is_active: boolean;
  }>;
  sourceCycle?: object;
  balanceUpdateCount?: number;
};

function firstQuery(value: unknown) {
  return {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    forUpdate: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(value),
  };
}

function lockedRowsQuery<T>(rows: T) {
  return {
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    forUpdate: jest.fn().mockResolvedValue(rows),
  };
}

function orderedRowsQuery<T>(rows: T) {
  return {
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockResolvedValue(rows),
  };
}

function createUpdateHarness(options: UpdateHarnessOptions = {}) {
  const transactionType = options.transactionType ?? TransactionType.EXPENSE;
  const oldAccountId = options.oldAccountId ?? '3';
  const updatedAccountId = options.updatedAccountId ?? oldAccountId;
  const oldAmount = options.oldAmount ?? 100;
  const updatedAmount = options.updatedAmount ?? oldAmount;
  const accounts = options.accounts ?? [
    {
      id: oldAccountId,
      account_name: 'Cash',
      current_balance: '1000',
      is_active: true,
    },
  ];
  const existingTransaction = {
    id: '7',
    user_id: 'user-1',
    account_id: oldAccountId,
    budget_period_id: '2',
    transaction_type: transactionType,
    destination_account_id: null,
    amount: oldAmount,
    transaction_date: '2026-08-16',
    category: 'General',
    note: null,
    created_at: new Date(),
    updated_at: null,
  };
  const updatedTransaction = {
    ...existingTransaction,
    account_id: updatedAccountId,
    amount: updatedAmount,
  };
  const targetPeriod = {
    id: '2',
    user_id: 'user-1',
    start_date: '2026-08-01',
    end_date: '2026-08-31',
    saving_percentage: 20,
    status: 'ACTIVE',
    created_at: new Date(),
    updated_at: null,
    source_transaction_id: '1',
  };

  const existingQuery = firstQuery(existingTransaction);
  const sourceCycleQuery = firstQuery(options.sourceCycle);
  const targetPeriodQuery = firstQuery(targetPeriod);
  const accountsQuery = lockedRowsQuery(accounts);
  const raw = jest.fn((sql: string, bindings: number[]) => ({ sql, bindings }));
  const accountUpdateQueries = Array.from(
    { length: options.balanceUpdateCount ?? 0 },
    () => ({
      where: jest.fn().mockReturnThis(),
      update: jest.fn().mockResolvedValue(1),
    }),
  );
  const transactionUpdateQuery = {
    where: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([updatedTransaction]),
  };
  const updatedAccountsQuery = orderedRowsQuery(accounts);
  const trx = jest
    .fn()
    .mockReturnValueOnce(existingQuery)
    .mockReturnValueOnce(sourceCycleQuery)
    .mockReturnValueOnce(targetPeriodQuery)
    .mockReturnValueOnce(accountsQuery);

  for (const query of accountUpdateQueries) trx.mockReturnValueOnce(query);
  trx
    .mockReturnValueOnce(transactionUpdateQuery)
    .mockReturnValueOnce(updatedAccountsQuery);

  Object.assign(trx, {
    fn: { now: jest.fn(() => new Date()) },
    raw,
  });

  const connection = Object.assign(jest.fn(), {
    transaction: jest.fn(
      (callback: (transaction: typeof trx) => Promise<unknown>) =>
        callback(trx),
    ),
  });

  return {
    service: new TransactionsService({
      connection,
    } as unknown as KnexService),
    accountsQuery,
    accountUpdateQueries,
    raw,
    trx,
  };
}

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
    expect(getBudgetPeriodIdForNewTransaction({ id: '42' })).toBe(42);
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

  it('updates without changing account when BIGINT IDs are strings', async () => {
    const harness = createUpdateHarness();

    const response = await harness.service.update(
      7,
      { note: 'Updated note' },
      'user-1',
    );

    expect(harness.accountsQuery.whereIn).toHaveBeenCalledWith('id', [3]);
    expect(harness.accountUpdateQueries).toHaveLength(0);
    expect(response.data.transaction.accountId).toBe(3);
  });

  it('updates an expense amount using a numeric balance-delta key', async () => {
    const harness = createUpdateHarness({
      updatedAmount: 150,
      balanceUpdateCount: 1,
    });

    await harness.service.update(7, { amount: 150 }, 'user-1');

    expect(harness.raw).toHaveBeenCalledWith('current_balance + ?', [-50]);
    expect(harness.accountUpdateQueries[0].where).toHaveBeenCalledWith({
      id: 3,
      user_id: 'user-1',
    });
  });

  it('moves an expense between string-ID accounts with numeric lookup keys', async () => {
    const harness = createUpdateHarness({
      updatedAccountId: '4',
      accounts: [
        {
          id: '3',
          account_name: 'Cash',
          current_balance: '1000',
          is_active: true,
        },
        {
          id: '4',
          account_name: 'Bank',
          current_balance: '1000',
          is_active: true,
        },
      ],
      balanceUpdateCount: 2,
    });

    await harness.service.update(7, { accountId: 4 }, 'user-1');

    expect(harness.accountsQuery.whereIn).toHaveBeenCalledWith('id', [3, 4]);
    expect(harness.accountUpdateQueries[0].where).toHaveBeenCalledWith({
      id: 3,
      user_id: 'user-1',
    });
    expect(harness.accountUpdateQueries[1].where).toHaveBeenCalledWith({
      id: 4,
      user_id: 'user-1',
    });
    expect(harness.raw.mock.calls).toEqual([
      ['current_balance + ?', [100]],
      ['current_balance + ?', [-100]],
    ]);
  });

  it('preserves income balance correction with string account IDs', async () => {
    const harness = createUpdateHarness({
      transactionType: TransactionType.INCOME,
      updatedAmount: 150,
      balanceUpdateCount: 1,
    });

    await harness.service.update(7, { amount: 150 }, 'user-1');

    expect(harness.raw).toHaveBeenCalledWith('current_balance + ?', [50]);
    expect(harness.accountUpdateQueries[0].where).toHaveBeenCalledWith({
      id: 3,
      user_id: 'user-1',
    });
  });

  it('keeps source-cycle date protection when cycle IDs are strings', async () => {
    const harness = createUpdateHarness({
      transactionType: TransactionType.INCOME,
      sourceCycle: { id: '2', source_transaction_id: '7' },
    });

    await expect(
      harness.service.update(7, { transactionDate: '2026-08-17' }, 'user-1'),
    ).rejects.toThrow(
      'The date or type of an income that starts a cycle cannot be changed.',
    );
  });
});
