import { validateCycleCandidate } from './budget-periods.service';

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
        periods: [{ ...activePeriod, status: 'CLOSED' }],
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
            start_date: '2026-10-20',
            end_date: '2026-11-19',
            status: 'PLANNED',
          },
        ],
        assignedPeriodId: activePeriod.id,
      }),
    ).toContain('overlap');
  });
});
