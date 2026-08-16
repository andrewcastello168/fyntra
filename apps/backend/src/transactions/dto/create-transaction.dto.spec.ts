import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTransactionDto } from './create-transaction.dto';
import { TransactionType } from '../enums/transaction-type.enum';

function transactionWithDate(transactionDate: unknown) {
  return plainToInstance(CreateTransactionDto, {
    accountId: 1,
    transactionType: TransactionType.EXPENSE,
    amount: 150000,
    transactionDate,
  });
}

describe('CreateTransactionDto transactionDate', () => {
  it('accepts the canonical YYYY-MM-DD date-only format', async () => {
    await expect(validate(transactionWithDate('2026-08-16'))).resolves.toEqual(
      [],
    );
  });

  it.each([
    '2026-08-16T00:00:00.000Z',
    '16/08/2026',
    new Date(2026, 7, 16),
    '2026-02-30',
  ])('rejects non-canonical or invalid dates', async (transactionDate) => {
    const errors = await validate(transactionWithDate(transactionDate));
    expect(errors.some((error) => error.property === 'transactionDate')).toBe(
      true,
    );
  });
});
