import type { PeriodControlModel, PeriodPreset, PeriodSelection, PeriodWeeklyOption, WeekManifestItem } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_PERIOD_SELECTION: PeriodSelection = {
  preset: 'weekly',
  weeklyValue: 'latest'
};

const QUICK_OPTIONS: PeriodControlModel['quickOptions'] = [
  { value: 'recent-7', label: '최근 7일', description: '가장 최근 7일과 겹치는 주차 데이터' },
  { value: 'recent-14', label: '최근 14일', description: '전주 대비 흐름까지 보는 2주 창' },
  { value: 'recent-30', label: '최근 30일', description: '기본 모니터링용 30일 창' },
  { value: 'weekly', label: '주간', description: '완료 주차와 최근 N주 합산 선택' }
];

function dateOnly(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sortWeeks(weeks: WeekManifestItem[]): WeekManifestItem[] {
  return [...weeks]
    .filter((week) => week.weekId && week.file)
    .sort((a, b) => dateOnly(b.startDate || b.endDate).getTime() - dateOnly(a.startDate || a.endDate).getTime());
}

function labelForWeek(index: number, week: WeekManifestItem): string {
  if (index === 0) return `최신 완료주 · ${week.label}`;
  if (index === 1) return `직전 주 · ${week.label}`;
  return `${index}주 전 · ${week.label}`;
}

function aggregateLabel(count: number, selected: WeekManifestItem[]): string {
  if (selected.length === 0) return `최근 ${count}주 합산`;
  const newest = selected[0];
  const oldest = selected[selected.length - 1];
  const range = oldest.startDate && newest.endDate ? `${oldest.startDate}~${newest.endDate}` : `${selected.length}주 데이터`;
  return `최근 ${count}주 합산 · ${range}`;
}

export function buildPeriodControlModel(weeks: WeekManifestItem[], today: Date = new Date()): PeriodControlModel {
  const sorted = sortWeeks(weeks)
    .filter((week) => week.status === 'Published' || dateOnly(week.startDate || week.endDate) <= dateOnly(today));

  const weekOptions: PeriodWeeklyOption[] = sorted.map((week, index) => ({
    value: index === 0 ? 'latest' : `week:${week.weekId}`,
    label: labelForWeek(index, week),
    description: `${week.startDate}~${week.endDate}`,
    files: [week.file]
  }));

  [4, 8].forEach((count) => {
    const selected = sorted.slice(0, count);
    if (selected.length > 0) {
      weekOptions.push({
        value: `recent-${count}w`,
        label: aggregateLabel(count, selected),
        description: `${selected.length}개 완료 주차를 합산`,
        files: selected.map((week) => week.file)
      });
    }
  });

  return {
    quickOptions: QUICK_OPTIONS,
    weeklyOptions: weekOptions,
    defaultWeeklyValue: weekOptions[0]?.value ?? 'latest'
  };
}

function daysForPreset(preset: PeriodPreset): number | null {
  if (preset === 'recent-7') return 7;
  if (preset === 'recent-14') return 14;
  if (preset === 'recent-30') return 30;
  return null;
}

export function resolvePeriodDataFiles(selection: PeriodSelection, weeks: WeekManifestItem[], today: Date = new Date()): string[] {
  const sorted = sortWeeks(weeks);
  if (sorted.length === 0) return ['./data/trends/latest.json'];

  const days = daysForPreset(selection.preset);
  if (days !== null) {
    const todayDate = dateOnly(today);
    const cutoff = new Date(todayDate.getTime() - (days - 1) * DAY_MS);
    const files = sorted
      .filter((week) => {
        const start = dateOnly(week.startDate || week.endDate);
        const end = dateOnly(week.endDate || week.startDate);
        return end >= cutoff && start <= todayDate;
      })
      .map((week) => week.file);
    return files.length > 0 ? files : [sorted[0].file];
  }

  const model = buildPeriodControlModel(sorted, today);
  const weeklyOption = model.weeklyOptions.find((option) => option.value === selection.weeklyValue) ?? model.weeklyOptions[0];
  return weeklyOption?.files.length ? weeklyOption.files : [sorted[0].file];
}

export function getPeriodLabel(selection: PeriodSelection, weeks: WeekManifestItem[], today: Date = new Date()): string {
  const model = buildPeriodControlModel(weeks, today);
  if (selection.preset === 'weekly') {
    return model.weeklyOptions.find((option) => option.value === selection.weeklyValue)?.label ?? '주간';
  }
  return model.quickOptions.find((option) => option.value === selection.preset)?.label ?? '기간';
}
