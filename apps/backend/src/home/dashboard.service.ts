import { Injectable } from '@nestjs/common';
import { KnexService } from 'src/database/knex.service';

interface DetailTopResult {
  total_balance: string | number | null;
}

interface DetailMidResult {
  total_income: string | number;
  total_expense: string | number;
  spending_budget: string | number;
  remaining_budget: string | number;
  remaining_days: number;
  available_per_day: string | number;
}

interface RawQueryResult<T> {
  rows: T[];
}

@Injectable()
export class DashboardService {
  constructor(private readonly knexService: KnexService) {}

  async getSummary(userId: string) {
    const detailTop = await this.knexService
      .connection('accounts')
      .where({
        user_id: userId,
        is_active: true,
      })
      .sum<DetailTopResult>('current_balance as total_balance')
      .first();

    const detailMidQuery = await this.knexService.connection.raw<
      RawQueryResult<DetailMidResult>
    >(
      `
        WITH budget_summary AS (
          SELECT
            bp.user_id,
            bp.start_date,
            bp.end_date,
            bp.saving_percentage,

            COALESCE(
              SUM(
                CASE
                  WHEN tr.transaction_type = 'INCOME'
                  THEN tr.amount
                  ELSE 0
                END
              ),
              0
            ) AS total_income,

            COALESCE(
              SUM(
                CASE
                  WHEN tr.transaction_type = 'EXPENSE'
                  THEN tr.amount
                  ELSE 0
                END
              ),
              0
            ) AS total_expense

          FROM budget_periods bp

          LEFT JOIN transactions tr
            ON tr.user_id = bp.user_id
            AND tr.transaction_date BETWEEN bp.start_date AND bp.end_date
            AND tr.transaction_type IN ('INCOME', 'EXPENSE')

          WHERE bp.user_id = ?
            AND bp.status = 'ACTIVE'

          GROUP BY
            bp.user_id,
            bp.start_date,
            bp.end_date,
            bp.saving_percentage
        )

        SELECT
          total_income,
          total_expense,

          total_income * (1 - saving_percentage / 100.0)
            AS spending_budget,

          total_income * (1 - saving_percentage / 100.0)
            - total_expense
            AS remaining_budget,

          GREATEST(end_date - CURRENT_DATE + 1, 0)
            AS remaining_days,

          CASE
            WHEN end_date >= CURRENT_DATE THEN
              GREATEST(
                total_income * (1 - saving_percentage / 100.0)
                  - total_expense,
                0
              )
              / NULLIF(end_date - CURRENT_DATE + 1, 0)
            ELSE 0
          END AS available_per_day

        FROM budget_summary
        `,
      [userId],
    );

    const detailMid = detailMidQuery.rows[0];

    const detailBottom = await this.knexService
      .connection('transactions as tr')
      .join('accounts as ac', 'tr.account_id', 'ac.id')
      .where('tr.user_id', userId)
      .where('ac.is_active', true)
      .orderBy('tr.transaction_date', 'desc')
      .select(
        'tr.id',
        'tr.category',
        'tr.note',
        'tr.amount',
        'tr.transaction_type as transactionType',
        'tr.transaction_date as transactionDate',
        'ac.account_name as accountName',
        'tr.created_at as createdAt',
      )
      .limit(5);

    return {
      data: {
        top: {
          currentBalance: Number(detailTop?.total_balance ?? 0),
        },

        mid: {
          totalIncome: Number(detailMid?.total_income ?? 0),
          totalExpense: Number(detailMid?.total_expense ?? 0),
          spendingBudget: Number(detailMid?.spending_budget ?? 0),
          remainingBudget: Number(detailMid?.remaining_budget ?? 0),
          remainingDays: Number(detailMid?.remaining_days ?? 0),
          availablePerDay: Number(detailMid?.available_per_day ?? 0),
        },

        bottom: detailBottom,
      },
    };
  }
}
