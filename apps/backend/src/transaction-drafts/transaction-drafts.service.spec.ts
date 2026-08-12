import { BadRequestException } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { KnexService } from '../database/knex.service';
import { TransactionDraftsService } from './transaction-drafts.service';

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
      },
    });

    expect(connection).toHaveBeenCalledWith('accounts');
    expect(generateJson).toHaveBeenCalledTimes(1);
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
