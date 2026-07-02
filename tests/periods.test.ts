import { describe, expect, it } from 'vitest';
import { DEFAULT_PERIOD_SELECTION, buildPeriodControlModel, resolvePeriodDataFiles } from '../src/domain/periods';
import type { WeekManifestItem } from '../src/domain/types';

const weeks: WeekManifestItem[] = [
  {
    weekId: '2026-W25',
    label: '2026.06.17 - 2026.06.23',
    status: 'Published',
    startDate: '2026-06-17',
    endDate: '2026-06-23',
    file: './data/trends/2026-W25.json',
    isLatest: true
  },
  {
    weekId: '2026-W24',
    label: '2026.06.10 - 2026.06.16',
    status: 'Published',
    startDate: '2026-06-10',
    endDate: '2026-06-16',
    file: './data/trends/2026-W24.json',
    isLatest: false
  },
  {
    weekId: '2026-W23',
    label: '2026.06.03 - 2026.06.09',
    status: 'Published',
    startDate: '2026-06-03',
    endDate: '2026-06-09',
    file: './data/trends/2026-W23.json',
    isLatest: false
  }
];

describe('period controls', () => {
  it('uses weekly latest week as the default period selection', () => {
    expect(DEFAULT_PERIOD_SELECTION).toEqual({ preset: 'weekly', weeklyValue: 'latest' });
  });

  it('builds the recommended quick presets plus weekly choices with latest week first', () => {
    const model = buildPeriodControlModel(weeks, new Date('2026-06-27T00:00:00+09:00'));

    expect(model.quickOptions.map((option) => option.value)).toEqual(['recent-7', 'recent-14', 'recent-30', 'weekly']);
    expect(model.weeklyOptions[0]).toMatchObject({ value: 'latest', label: '최신 주차 · 2026.06.17 - 2026.06.23' });
    expect(model.weeklyOptions[1]).toMatchObject({ value: 'week:2026-W24', label: '직전 주 · 2026.06.10 - 2026.06.16' });
    expect(model.weeklyOptions.some((option) => option.value === 'recent-4w' && option.label.includes('최근 4주 합산'))).toBe(true);
    expect(model.defaultWeeklyValue).toBe('latest');
  });

  it('resolves recent 14 days to all weekly data files overlapping that calendar window', () => {
    const files = resolvePeriodDataFiles({ preset: 'recent-14', weeklyValue: 'latest' }, weeks, new Date('2026-06-27T00:00:00+09:00'));

    expect(files).toEqual(['./data/trends/2026-W25.json', './data/trends/2026-W24.json']);
  });

  it('resolves weekly aggregate options to the newest available week files', () => {
    const files = resolvePeriodDataFiles({ preset: 'weekly', weeklyValue: 'recent-4w' }, weeks, new Date('2026-06-27T00:00:00+09:00'));

    expect(files).toEqual(['./data/trends/2026-W25.json', './data/trends/2026-W24.json', './data/trends/2026-W23.json']);
  });
});
