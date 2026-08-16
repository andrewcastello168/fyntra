import { BadRequestException, NotFoundException } from '@nestjs/common';
import { KnexService } from '../database/knex.service';
import { TransactionType } from '../transactions/enums/transaction-type.enum';
import {
  BudgetPeriodsService,
  validateCycleCandidate,
} from './budget-periods.service';

describe('validateCycleCandidate', () => {
  const activePeriod = {
    id: 10,
    start_date: '2026-08-26',
    end_date: '2026-09-25',
    status: 'ACTIVE',
  };

  it('allows a later income date to start the next cycle', () => {
    expect(
      validateCycleCandidate({
        candidateDate: '2026-09-26',
        endDate: '2026-10-25',
        today: '2026-10-03',
        periods: [activePeriod],
        assignedPeriodId: activePeriod.id,
      }),
    ).toBeNull();
  });

  it('rejects an income assigned to closed history', () => {
    expect(
      validateCycleCandidate({
        candidateDate: '2026-08-20',
        endDate: '2026-09-19',
        today: '2026-10-03',
        periods: [
          {
            ...activePeriod,
            start_date: '2026-08-01',
            status: 'CLOSED',
          },
        ],
        assignedPeriodId: activePeriod.id,
      }),
    ).toContain('closed cycle');
  });

  it('rejects a candidate on or before the active cycle start', () => {
    expect(
      validateCycleCandidate({
        candidateDate: '2026-08-26',
        endDate: '2026-09-25',
        today: '2026-10-03',
        periods: [activePeriod],
        assignedPeriodId: activePeriod.id,
      }),
    ).toContain('after the current cycle start date');
  });

  it('rejects overlap with another non-active cycle', () => {
    expect(
      validateCycleCandidate({
        candidateDate: '2026-09-26',
        endDate: '2026-10-25',
        today: '2026-10-03',
        periods: [
          activePeriod,
          {
            id: 11,
            start_date: '2026-09-20',
            end_date: '2026-10-19',
            status: 'PLANNED',
          },
        ],
        assignedPeriodId: activePeriod.id,
      }),
    ).toContain('overlap');
  });

  it('uses start_date to reject a successor even when its date range does not overlap', () => {
    expect(
      validateCycleCandidate({
        candidateDate: '2026-09-26',
        endDate: '2026-10-25',
        today: '2026-12-03',
        periods: [
          activePeriod,
          {
            id: 11,
            start_date: '2026-11-20',
            end_date: '2026-12-19',
            status: 'CLOSED',
          },
        ],
        assignedPeriodId: activePeriod.id,
      }),
    ).toContain('newer financial cycle');
  });
});

type Row = Record<string, unknown>;

class FakeQuery implements PromiseLike<Row[]> {
  private predicates: Array<(row: Row) => boolean> = [];
  private insertValue: Row | null = null;
  private orderColumn: string | null = null;

  constructor(
    private readonly table: string,
    private readonly tables: Record<string, Row[]>,
  ) {}

  where(criteria: Row): this;
  where(column: string, operator: string, value: unknown): this;
  where(criteriaOrColumn: Row | string, operator?: string, value?: unknown) {
    if (typeof criteriaOrColumn === 'object') {
      this.predicates.push((row) =>
        Object.entries(criteriaOrColumn).every(
          ([key, expected]) => row[key] === expected,
        ),
      );
      return this;
    }

    this.predicates.push((row) => {
      const actual = String(row[criteriaOrColumn]);
      const expected = String(value);
      if (operator === '>=') return actual >= expected;
      if (operator === '>') return actual > expected;
      return actual === expected;
    });
    return this;
  }

  forUpdate() {
    return this;
  }

  orderBy(column: string) {
    this.orderColumn = column;
    return this;
  }

  async first() {
    return this.rows()[0];
  }

  insert(value: Row) {
    this.insertValue = value;
    return this;
  }

  async returning() {
    const rows = this.tables[this.table];
    const nextId = Math.max(0, ...rows.map((row) => Number(row.id))) + 1;
    const inserted = { id: nextId, ...this.insertValue };
    rows.push(inserted);
    return [inserted];
  }

  async update(value: Row) {
    const rows = this.rows();
    rows.forEach((row) => Object.assign(row, value));
    return rows.length;
  }

  then<TResult1 = Row[], TResult2 = never>(
    onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.rows()).then(onfulfilled, onrejected);
  }

  private rows() {
    const rows = this.tables[this.table].filter((row) =>
      this.predicates.every((predicate) => predicate(row)),
    );
    return this.orderColumn
      ? rows.sort((left, right) =>
          String(left[this.orderColumn!]).localeCompare(
            String(right[this.orderColumn!]),
          ),
        )
      : rows;
  }
}

function createService(tables: Record<string, Row[]>) {
  const connection = ((table: string) =>
    new FakeQuery(table, tables)) as unknown as KnexService['connection'];
  connection.transaction = async <T>(
    callback: (trx: KnexService['connection']) => Promise<T>,
  ) => callback(connection);
  connection.fn = { now: () => new Date('2026-08-16T00:00:00.000Z') } as never;

  return new BudgetPeriodsService({ connection } as KnexService);
}

function cycleFixture(category = 'Salary') {
  return {
    tables: {
      budget_periods: [
        {
          id: 10,
          user_id: 'user-1',
          start_date: '2026-07-01',
          end_date: '2026-07-31',
          saving_percentage: 20,
          status: 'ACTIVE',
          source_transaction_id: null,
        },
      ],
      transactions: [
        {
          id: 100,
          user_id: 'user-1',
          budget_period_id: 10,
          transaction_type: TransactionType.INCOME,
          transaction_date: '2026-08-01',
          category,
        },
        {
          id: 101,
          user_id: 'user-1',
          budget_period_id: 10,
          transaction_type: TransactionType.EXPENSE,
          transaction_date: '2026-07-31',
        },
        {
          id: 102,
          user_id: 'user-1',
          budget_period_id: 10,
          transaction_type: TransactionType.EXPENSE,
          transaction_date: '2026-08-05',
        },
      ],
    } satisfies Record<string, Row[]>,
  };
}

describe('BudgetPeriodsService.startFromIncome', () => {
  it.each(['Salary', 'Freelance', 'Side income', 'Bonus', 'Other'])(
    'allows explicitly starting a cycle from %s income',
    async (category) => {
      const fixture = cycleFixture(category);
      const response = await createService(fixture.tables).startFromIncome(
        100,
        {},
        'user-1',
      );

      expect(response.data.alreadyStarted).toBe(false);
      expect(response.data.cycle.startDate).toBe('2026-08-01');
    },
  );

  it('repairs a missed cycle and reassigns transactions on or after the boundary', async () => {
    const fixture = cycleFixture();
    await createService(fixture.tables).startFromIncome(100, {}, 'user-1');

    const previous = fixture.tables.budget_periods.find((row) => row.id === 10);
    const created = fixture.tables.budget_periods.find((row) => row.id === 11);
    expect(previous).toMatchObject({
      end_date: '2026-07-31',
      status: 'CLOSED',
    });
    expect(created).toMatchObject({
      start_date: '2026-08-01',
      source_transaction_id: 100,
      status: 'ACTIVE',
    });
    expect(
      fixture.tables.transactions.find((row) => row.id === 101),
    ).toMatchObject({ budget_period_id: 10 });
    expect(
      fixture.tables.transactions.find((row) => row.id === 102),
    ).toMatchObject({ budget_period_id: 11 });
  });

  it('rejects cross-user modification', async () => {
    const fixture = cycleFixture();
    await expect(
      createService(fixture.tables).startFromIncome(100, {}, 'user-2'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(fixture.tables.budget_periods).toHaveLength(1);
  });

  it('rejects repair when a period has a later start_date', async () => {
    const fixture = cycleFixture();
    fixture.tables.budget_periods.push({
      id: 11,
      user_id: 'user-1',
      start_date: '2026-08-10',
      end_date: '2026-09-09',
      saving_percentage: 20,
      status: 'CLOSED',
      source_transaction_id: 999,
    });

    await expect(
      createService(fixture.tables).startFromIncome(100, {}, 'user-1'),
    ).rejects.toThrow(BadRequestException);
    expect(fixture.tables.budget_periods).toHaveLength(2);
    expect(
      fixture.tables.transactions.find((row) => row.id === 102),
    ).toMatchObject({ budget_period_id: 10 });
  });

  it('is idempotent for repeated cycle-start requests', async () => {
    const fixture = cycleFixture();
    const service = createService(fixture.tables);
    await service.startFromIncome(100, {}, 'user-1');
    const repeated = await service.startFromIncome(100, {}, 'user-1');

    expect(repeated.data.alreadyStarted).toBe(true);
    expect(fixture.tables.budget_periods).toHaveLength(2);
  });
});
