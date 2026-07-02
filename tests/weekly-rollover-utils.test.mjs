import { describe, expect, it } from 'vitest';
import { buildNextWeek, planMissingWeeksThroughCurrent } from '../scripts/lib/weekly-rollover-utils.mjs';

const week25 = {
  weekId: '2026-W25',
  label: '2026.06.17 - 2026.06.23',
  status: 'Published',
  startDate: '2026-06-17',
  endDate: '2026-06-23'
};

describe('weekly rollover utilities', () => {
  it('builds the next weekly bucket from the previous Wednesday-Tuesday window', () => {
    expect(buildNextWeek(week25)).toEqual({
      weekId: '2026-W26',
      label: '2026.06.24 - 2026.06.30',
      status: 'Published',
      startDate: '2026-06-24',
      endDate: '2026-06-30'
    });
  });

  it('plans missing weeks through the current in-progress KST week', () => {
    expect(planMissingWeeksThroughCurrent([week25], new Date('2026-07-02T07:00:00+09:00'))).toEqual([
      {
        weekId: '2026-W26',
        label: '2026.06.24 - 2026.06.30',
        status: 'Published',
        startDate: '2026-06-24',
        endDate: '2026-06-30'
      },
      {
        weekId: '2026-W27',
        label: '2026.07.01 - 2026.07.07',
        status: 'Published',
        startDate: '2026-07-01',
        endDate: '2026-07-07'
      }
    ]);

    expect(planMissingWeeksThroughCurrent([week25], new Date('2026-07-07T07:00:00+09:00')).map((week) => week.weekId)).toEqual(['2026-W26', '2026-W27']);
    expect(planMissingWeeksThroughCurrent([week25], new Date('2026-07-08T07:00:00+09:00')).map((week) => week.weekId)).toEqual(['2026-W26', '2026-W27', '2026-W28']);
  });

  it('does not plan a Published week that already exists but still ensures the current window', () => {
    const week26 = buildNextWeek(week25);

    expect(planMissingWeeksThroughCurrent([week25, week26], new Date('2026-07-02T07:00:00+09:00')).map((week) => week.weekId)).toEqual(['2026-W27']);
  });

  it('still plans a completed week when only a non-Published page exists so the repair path can publish it', () => {
    const draftWeek26 = { ...buildNextWeek(week25), status: 'Draft' };

    expect(planMissingWeeksThroughCurrent([week25, draftWeek26], new Date('2026-07-02T07:00:00+09:00')).map((week) => week.weekId)).toEqual(['2026-W26', '2026-W27']);
  });
});
