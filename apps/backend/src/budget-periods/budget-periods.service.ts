import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KnexService } from '../database/knex.service';
import { TransactionType } from '../transactions/enums/transaction-type.enum';
import { StartCycleDto } from './dto/start-cycle.dto';

interface BudgetPeriodRow {
  id: number;
  user_id: string;
  start_date: string | Date;
  end_date: string | Date;
  saving_percentage: number | string;
  status: string;
  created_at: Date;
  updated_at: Date | null;
  source_transaction_id: number | null;
}

interface TransactionRow {
  id: number;
  user_id: string;
  budget_period_id: number | null;
  transaction_type: TransactionType;
  transaction_date: string | Date;
  updated_at: Date | null;
}

@Injectable()
export class BudgetPeriodsService {
  constructor(private readonly knexService: KnexService) {}

  // ============================================================
  // GET ACTIVE PERIOD
  // ============================================================

  async findActive(userId: string) {
    const period = await this.knexService
      .connection<BudgetPeriodRow>('budget_periods')
      .where({
        user_id: userId,
        status: 'ACTIVE',
      })
      .first();

    return {
      message: period
        ? 'Periode budgeting aktif berhasil diambil.'
        : 'Tidak ada periode budgeting aktif.',

      data: period
        ? {
            id: Number(period.id),
            startDate: this.dateOnly(period.start_date),
            endDate: this.dateOnly(period.end_date),
            savingPercentage: Number(period.saving_percentage),
            status: period.status,
            sourceTransactionId: period.source_transaction_id
              ? Number(period.source_transaction_id)
              : null,
          }
        : null,
    };
  }

  // ============================================================
  // START NEW CYCLE FROM INCOME
  // ============================================================

  async startFromIncome(
    transactionId: number,
    startCycleDto: StartCycleDto,
    userId: string,
  ) {
    return this.knexService.connection.transaction(async (trx) => {
      // ----------------------------------------------------------
      // Find income transaction
      // ----------------------------------------------------------

      const income = await trx<TransactionRow>('transactions')
        .where({
          id: transactionId,
          user_id: userId,
        })
        .forUpdate()
        .first();

      if (!income) {
        throw new NotFoundException(
          'Income transaction not found or does not belong to you.',
        );
      }

      // ----------------------------------------------------------
      // Must be INCOME
      // ----------------------------------------------------------

      if (income.transaction_type !== TransactionType.INCOME) {
        throw new BadRequestException(
          'Only an income transaction can start a financial cycle.',
        );
      }

      // ----------------------------------------------------------
      // Prevent same income from creating another cycle
      // ----------------------------------------------------------

      const existingSourceCycle = await trx<BudgetPeriodRow>('budget_periods')
        .where({
          user_id: userId,
          source_transaction_id: transactionId,
        })
        .first();

      if (existingSourceCycle) {
        return this.startCycleResponse(existingSourceCycle, true);
      }

      // ----------------------------------------------------------
      // Normalize dates
      // ----------------------------------------------------------

      const candidateDate = this.dateOnly(income.transaction_date);

      const today = this.todayDate();

      // ----------------------------------------------------------
      // Get all existing periods
      // ----------------------------------------------------------

      const periods = await trx<BudgetPeriodRow>('budget_periods')
        .where({
          user_id: userId,
        })
        .orderBy('start_date', 'asc')
        .forUpdate();

      const activePeriod = periods.find((period) => period.status === 'ACTIVE');

      const assignedPeriod = periods.find(
        (period) => Number(period.id) === Number(income.budget_period_id),
      );

      // ----------------------------------------------------------
      // DEBUG
      // ----------------------------------------------------------

      // console.log('[BUDGET] transaction_date:', income.transaction_date);
      // console.log('[BUDGET] candidateDate:', candidateDate);
      // console.log('[BUDGET] today:', today);
      // console.log('[BUDGET] isValidCandidate:', isValidDateOnly(candidateDate));

      // ----------------------------------------------------------
      // Validate candidate date
      // ----------------------------------------------------------

      if (!isValidDateOnly(candidateDate)) {
        throw new BadRequestException(
          'The income transaction date is not valid for a financial cycle.',
        );
      }

      // ----------------------------------------------------------
      // Calculate cycle end date
      // ----------------------------------------------------------

      const endDate = this.oneMonthEnd(candidateDate);

      // ----------------------------------------------------------
      // Validate cycle
      // ----------------------------------------------------------

      const cycleValidationError = validateCycleCandidate({
        candidateDate,
        endDate,
        today,
        periods,
        assignedPeriodId: assignedPeriod?.id ?? null,
      });

      if (cycleValidationError) {
        throw new BadRequestException(cycleValidationError);
      }

      // ----------------------------------------------------------
      // Saving percentage
      // ----------------------------------------------------------

      const savingPercentage = Number(
        startCycleDto.savingPercentage ?? activePeriod?.saving_percentage ?? 20,
      );

      if (
        !Number.isFinite(savingPercentage) ||
        savingPercentage < 0 ||
        savingPercentage > 100
      ) {
        throw new BadRequestException(
          'Savings percentage must be between 0 and 100.',
        );
      }

      // ----------------------------------------------------------
      // Close current active period
      // ----------------------------------------------------------

      if (activePeriod) {
        await trx<BudgetPeriodRow>('budget_periods')
          .where({
            id: activePeriod.id,
            user_id: userId,
          })
          .update({
            end_date: this.previousDate(candidateDate),
            status: 'CLOSED',
            updated_at: trx.fn.now(),
          });
      }

      // ----------------------------------------------------------
      // Create new period
      // ----------------------------------------------------------

      const [newCycle] = await trx<BudgetPeriodRow>('budget_periods')
        .insert({
          user_id: userId,
          start_date: candidateDate,
          end_date: endDate,
          saving_percentage: savingPercentage,
          status: 'ACTIVE',
          source_transaction_id: transactionId,
          created_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        })
        .returning('*');

      if (!newCycle) {
        throw new BadRequestException('Failed to create the financial cycle.');
      }

      // ----------------------------------------------------------
      // Move transactions from old period
      // ----------------------------------------------------------

      if (activePeriod) {
        await trx<TransactionRow>('transactions')
          .where({
            user_id: userId,
            budget_period_id: activePeriod.id,
          })
          .where('transaction_date', '>=', candidateDate)
          .update({
            budget_period_id: newCycle.id,
            updated_at: trx.fn.now(),
          });
      }

      // ----------------------------------------------------------
      // Assign income transaction to new cycle
      // ----------------------------------------------------------

      await trx<TransactionRow>('transactions')
        .where({
          id: transactionId,
          user_id: userId,
        })
        .update({
          budget_period_id: newCycle.id,
          updated_at: trx.fn.now(),
        });

      // ----------------------------------------------------------
      // Response
      // ----------------------------------------------------------

      return this.startCycleResponse(newCycle, false);
    });
  }

  // ============================================================
  // RESPONSE
  // ============================================================

  private startCycleResponse(period: BudgetPeriodRow, alreadyStarted: boolean) {
    return {
      message: alreadyStarted
        ? 'This income already starts a financial cycle.'
        : 'Financial cycle started.',

      data: {
        alreadyStarted,

        cycle: {
          id: Number(period.id),

          startDate: this.dateOnly(period.start_date),

          endDate: this.dateOnly(period.end_date),

          savingPercentage: Number(period.saving_percentage),

          status: period.status,

          sourceTransactionId: period.source_transaction_id
            ? Number(period.source_transaction_id)
            : null,
        },
      },
    };
  }

  // ============================================================
  // DATE HELPERS
  // ============================================================

  private dateOnly(value: string | Date): string {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    return String(value).slice(0, 10);
  }

  private todayDate(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
    }).format(new Date());
  }

  private previousDate(value: string): string {
    const date = new Date(`${value}T00:00:00.000Z`);

    date.setUTCDate(date.getUTCDate() - 1);

    return date.toISOString().slice(0, 10);
  }

  private oneMonthEnd(value: string): string {
    const date = new Date(`${value}T00:00:00.000Z`);

    date.setUTCMonth(date.getUTCMonth() + 1);

    date.setUTCDate(date.getUTCDate() - 1);

    return date.toISOString().slice(0, 10);
  }
}

// ============================================================
// VALIDATE CYCLE CANDIDATE
// ============================================================

export function validateCycleCandidate(input: {
  candidateDate: string;
  endDate: string;
  today: string;

  periods: Array<
    Pick<BudgetPeriodRow, 'id' | 'start_date' | 'end_date' | 'status'>
  >;

  assignedPeriodId: number | null;
}): string | null {
  const { candidateDate, endDate, today, periods, assignedPeriodId } = input;

  // ------------------------------------------------------------
  // Candidate date format
  // ------------------------------------------------------------

  if (!isValidDateOnly(candidateDate)) {
    return 'The income transaction date is not valid for a financial cycle.';
  }

  // ------------------------------------------------------------
  // Future date
  // ------------------------------------------------------------

  if (candidateDate > today) {
    return 'A financial cycle cannot start from a future income date.';
  }

  // ------------------------------------------------------------
  // Newer cycle already exists
  // ------------------------------------------------------------

  if (periods.some((period) => dateOnly(period.start_date) > candidateDate)) {
    return "A newer financial cycle already exists, so this income can't be used as a cycle start.";
  }

  // ------------------------------------------------------------
  // Active period
  // ------------------------------------------------------------

  const activePeriod = periods.find((period) => period.status === 'ACTIVE');

  // ------------------------------------------------------------
  // Assigned period
  // ------------------------------------------------------------

  const assignedPeriod = periods.find(
    (period) => Number(period.id) === Number(assignedPeriodId),
  );

  if (assignedPeriod?.status === 'CLOSED') {
    return "This income is part of a closed cycle and can't start a new cycle from here.";
  }

  // ------------------------------------------------------------
  // Candidate must be after active cycle start
  // ------------------------------------------------------------

  if (activePeriod && candidateDate <= dateOnly(activePeriod.start_date)) {
    return 'The income date must be after the current cycle start date.';
  }

  // ------------------------------------------------------------
  // Cannot use closed financial history
  // ------------------------------------------------------------

  if (
    periods.some(
      (period) =>
        period.status === 'CLOSED' &&
        dateOnly(period.end_date) >= candidateDate,
    )
  ) {
    return "This income is part of closed financial history and can't start a new cycle from here.";
  }

  // ------------------------------------------------------------
  // Prevent overlapping cycles
  // ------------------------------------------------------------

  if (
    periods.some(
      (period) =>
        period.id !== activePeriod?.id &&
        dateOnly(period.start_date) <= endDate &&
        dateOnly(period.end_date) >= candidateDate,
    )
  ) {
    return 'The new financial cycle would overlap an existing cycle.';
  }

  return null;
}

// ============================================================
// DATE HELPERS
// ============================================================

function dateOnly(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
