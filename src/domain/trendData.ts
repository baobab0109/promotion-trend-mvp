import { filterOptions as sampleFilterOptions, sampleTrends, sourceSummary as sampleSourceSummary } from '../data/sampleTrends';
import type { EvidenceItem, FilterOptions, SourceSummary, TrendDataset, TrendTopic } from './types';

const SOURCE_SUMMARY_META: Record<EvidenceItem['type'], { name: string; note: string }> = {
  기사: { name: '뉴스/기사', note: '커머스·유통·브랜드 기사' },
  SNS: { name: 'SNS 공개 신호', note: '해시태그/UGC 샘플' },
  검색: { name: '검색 키워드', note: '상승 검색어 샘플' },
  경쟁사: { name: '경쟁사 프로모션', note: '이벤트/기획전 페이지' }
};

const SOURCE_ORDER: EvidenceItem['type'][] = ['기사', 'SNS', '검색', '경쟁사'];

function uniqueInOrder(values: string[]): string[] {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

export function buildFilterOptions(trends: TrendTopic[]): FilterOptions {
  if (trends.length === 0) return sampleFilterOptions;

  return {
    channels: ['전체', ...uniqueInOrder(trends.flatMap((trend) => trend.channels))],
    categories: ['전체', ...uniqueInOrder(trends.flatMap((trend) => trend.categories))],
    types: ['전체', ...uniqueInOrder(trends.flatMap((trend) => trend.promotionTypes))],
    modes: ['전체', '안정형 추천 강함', '공격형 추천 강함']
  };
}

export function buildSourceSummaryFromEvidence(trends: TrendTopic[]): SourceSummary[] {
  const counts = trends
    .flatMap((trend) => trend.evidence)
    .reduce<Record<EvidenceItem['type'], number>>((acc, evidence) => {
      acc[evidence.type] = (acc[evidence.type] ?? 0) + 1;
      return acc;
    }, { 기사: 0, SNS: 0, 검색: 0, 경쟁사: 0 });

  return SOURCE_ORDER.map((type) => ({
    name: SOURCE_SUMMARY_META[type].name,
    count: counts[type] ?? 0,
    note: SOURCE_SUMMARY_META[type].note
  }));
}

function isScore(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateTrendDataset(dataset: TrendDataset): string[] {
  const errors: string[] = [];

  if (!hasText(dataset.weekId)) errors.push('weekId is required');
  if (!hasText(dataset.label)) errors.push('label is required');
  if (!Array.isArray(dataset.sourceSummary) || dataset.sourceSummary.length === 0) errors.push('sourceSummary is required');
  if (!Array.isArray(dataset.trends) || dataset.trends.length === 0) {
    errors.push('trends must include at least one item');
    return errors;
  }

  const ids = new Set<string>();
  dataset.trends.forEach((trend) => {
    const label = trend.id || '(missing trend id)';
    if (!hasText(trend.id)) errors.push('trend.id is required');
    if (ids.has(trend.id)) errors.push(`${trend.id} is duplicated`);
    ids.add(trend.id);
    if (!hasText(trend.name)) errors.push(`${label}.name is required`);
    if (!hasText(trend.summary)) errors.push(`${label}.summary is required`);
    if (!Array.isArray(trend.keywords) || trend.keywords.length === 0) errors.push(`${label}.keywords must include at least one item`);
    if (!Array.isArray(trend.evidence)) errors.push(`${label}.evidence must be an array`);
    if (!trend.ideas?.stable) errors.push(`${label}.ideas.stable is required`);
    if (!trend.ideas?.aggressive) errors.push(`${label}.ideas.aggressive is required`);

    (['momentum', 'onstyleFit', 'risk'] as const).forEach((scoreKey) => {
      if (!isScore(trend.scores?.[scoreKey])) {
        errors.push(`${label}.scores.${scoreKey} must be between 0 and 100`);
      }
    });
  });

  return errors;
}

export function createSampleTrendDataset(): TrendDataset {
  return {
    weekId: '2026-W25',
    label: '2026.06.17 - 2026.06.23',
    status: 'Published',
    generatedAt: new Date(0).toISOString(),
    source: 'sample',
    sourceSummary: sampleSourceSummary,
    trends: sampleTrends
  };
}
