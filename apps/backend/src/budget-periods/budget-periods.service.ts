import { Injectable } from '@nestjs/common';
import { KnexService } from '../database/knex.service';

interface BudgetPeriodRow {
  id: number;
  user_id: string;
  start_date: string;
  end_date: string;
  saving_percentage: number | string;
  status: string;
  created_at: Date;
  updated_at: Date | null;
}

@Injectable()
export class BudgetPeriodsService {
  constructor(private readonly knexService: KnexService) {}

  async findActive(userId: string) {
    const period = await this.knexService
      .connection<BudgetPeriodRow>('budget_periods')
      .where({ user_id: userId, status: 'ACTIVE' })
      .first();

    return {
      message: period
        ? 'Periode budgeting aktif berhasil diambil.'
        : 'Tidak ada periode budgeting aktif.',
      data: period
        ? {
            id: Number(period.id),
            startDate: period.start_date,
            endDate: period.end_date,
            savingPercentage: Number(period.saving_percentage),
            status: period.status,
          }
        : null,
    };
  }
}
