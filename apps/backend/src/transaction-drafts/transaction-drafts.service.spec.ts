import { BadRequestException } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { KnexService } from '../database/knex.service';
import {
  parseIndonesianAmount,
  TransactionDraftsService,
} from './transaction-drafts.service';

describe('TransactionDraftsService', () => {
  const accounts = [
    { id: 1, account_name: 'BCA' },
    { id: 2, account_name: 'Cash' },
  ];

  function createService(
    aiDraft: Record<string, unknown>,
    activeAccounts = accounts,
  ) {
    const orderBy = jest.fn().mockResolvedValue(activeAccounts);
    const select = jest.fn().mockReturnValue({ orderBy });
    const where = jest.fn().mockReturnValue({ select });
    const connection = jest.fn().mockReturnValue({ where });
    const knexService = { connection } as unknown as KnexService;
    const generateJson = jest.fn().mockResolvedValue(aiDraft);
    const aiService = {
      generateJson,
    } as unknown as AiService;

    return {
      service: new TransactionDraftsService(knexService, aiService),
      generateJson,
      connection,
    };
  }

  const request = {
    text: 'hari ini makan 50 ribu pakai BCA',
    localDate: '2026-08-12',
    timeZone: 'Asia/Jakarta',
  };

  it('returns a complete expense draft with an owned active account ID', async () => {
    const { service, generateJson, connection } = createService({
      transactionType: 'EXPENSE',
      amount: 50000,
      transactionDate: '2026-08-12',
      accountName: 'BCA',
      destinationAccountName: null,
      category: 'Food',
      note: null,
    });

    await expect(service.create(request, 'user-1')).resolves.toEqual({
      data: {
        draft: {
          transactionType: 'EXPENSE',
          amount: 50000,
          transactionDate: '2026-08-12',
          accountId: 1,
          category: 'Food',
          note: null,
        },
        missingFields: [],
        warnings: [],
        accountResolution: 'exact',
        requestedAccountName: 'BCA',
        accountCandidates: [{ id: 1, accountName: 'BCA' }],
      },
    });

    expect(connection).toHaveBeenCalledWith('accounts');
    expect(generateJson).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['35k', 35000],
    ['35 rb', 35000],
    ['35rb', 35000],
    ['35 ribu', 35000],
    ['50ribu', 50000],
    ['1jt', 1000000],
    ['1 jt', 1000000],
    ['1 juta', 1000000],
    ['1.5jt', 1500000],
    ['1,5jt', 1500000],
    ['1.5 juta', 1500000],
    ['1,5 juta', 1500000],
    ['250k', 250000],
    ['250 ribu', 250000],
  ])('parses Indonesian amount format %s', (text, expected) => {
    expect(parseIndonesianAmount(text)).toBe(expected);
  });

  it('uses the deterministic Indonesian amount over an incorrect AI amount', async () => {
    const { service } = createService({
      transactionType: 'EXPENSE',
      amount: 50,
      transactionDate: '2026-08-12',
      accountName: 'BCA',
      destinationAccountName: null,
      category: 'Food & Drink',
      note: 'Makan',
    });

    const result = await service.create(
      { ...request, text: 'aku beli makan 50 rb pakai bca' },
      'user-1',
    );

    expect(result.data.draft.amount).toBe(50000);
  });

  it('returns account candidates when a name is ambiguous', async () => {
    const { service } = createService(
      {
        transactionType: 'EXPENSE',
        amount: 35000,
        transactionDate: '2026-08-12',
        accountName: 'BCA',
        destinationAccountName: null,
        category: 'Food & Drink',
        note: 'Coffee',
      },
      [
        { id: 1, account_name: 'BCA' },
        { id: 3, account_name: 'BCA' },
      ],
    );

    const result = await service.create(request, 'user-1');

    expect(result.data.accountResolution).toBe('ambiguous');
    expect(result.data.draft.accountId).toBeNull();
    expect(result.data.accountCandidates).toHaveLength(2);
  });

  it('returns unmatched account information without inventing an ID', async () => {
    const { service } = createService({
      transactionType: 'EXPENSE',
      amount: 50000,
      transactionDate: '2026-08-12',
      accountName: 'Mandiri',
      destinationAccountName: null,
      category: 'Food',
      note: null,
    });

    const result = await service.create(request, 'user-1');

    expect(result.data.draft.accountId).toBeNull();
    expect(result.data.missingFields).toContain('accountId');
    expect(result.data.accountResolution).toBe('unmatched');
  });

  it('does not call the AI provider when the user has no active accounts', async () => {
    const { service, generateJson } = createService({}, []);

    await expect(service.create(request, 'user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(generateJson).not.toHaveBeenCalled();
  });

  it('rejects an invalid IANA time zone before querying accounts', async () => {
    const { service, connection } = createService({});

    await expect(
      service.create({ ...request, timeZone: 'Not/AZone' }, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(connection).not.toHaveBeenCalled();
  });
});
