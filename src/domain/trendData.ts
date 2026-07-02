import { sampleTrends, sourceSummary as sampleSourceSummary } from '../data/sampleTrends';
import type { EvidenceItem, FilterOptions, SourceSummary, TrendDataset, TrendTopic } from './types';

const SOURCE_SUMMARY_META: Record<EvidenceItem['type'], { name: string; note: string }> = {
  기사: { name: '뉴스/기사', note: '커머스·유통·브랜드 기사' },
  SNS: { name: 'SNS 공개 신호', note: '해시태그/UGC 공개 신호' },
  검색: { name: '커머스 혜택 검색', note: '쿠폰·혜택·특가·프로모션 공개 근거' },
  경쟁사: { name: '경쟁사 프로모션', note: '이벤트/기획전 페이지' }
};

const SOURCE_ORDER: EvidenceItem['type'][] = ['기사', 'SNS', '검색', '경쟁사'];

function uniqueInOrder(values: string[]): string[] {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

export function buildFilterOptions(trends: TrendTopic[]): FilterOptions {
  if (trends.length === 0) {
    return {
      channels: ['전체'],
      categories: ['전체'],
      types: ['전체'],
      modes: ['전체']
    };
  }

  return {
    channels: ['전체', ...uniqueInOrder(trends.flatMap((trend) => trend.channels))],
    categories: ['전체', ...uniqueInOrder(trends.flatMap((trend) => trend.categories))],
    types: ['전체', ...uniqueInOrder(trends.flatMap((trend) => trend.promotionTypes))],
    modes: ['전체', '안정형 추천 강함', '공격형 추천 강함']
  };
}

export function buildSourceSummaryFromEvidence(trends: TrendTopic[], evidenceItems?: EvidenceItem[]): SourceSummary[] {
  const evidenceSource = Array.isArray(evidenceItems) && evidenceItems.length > 0
    ? evidenceItems
    : trends.flatMap((trend) => trend.evidence);
  const counts = evidenceSource
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

const VALID_EVIDENCE_TYPES = new Set<EvidenceItem['type']>(['기사', 'SNS', '검색', '경쟁사']);

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function sourceSummaryNameForType(type: EvidenceItem['type']): string {
  return SOURCE_SUMMARY_META[type].name;
}

function validateEvidenceItem(evidence: EvidenceItem, evidenceLabel: string, errors: string[], evidenceCounts: Record<EvidenceItem['type'], number>) {
  if (!VALID_EVIDENCE_TYPES.has(evidence.type)) {
    errors.push(`${evidenceLabel}.type must be one of 기사, SNS, 검색, 경쟁사`);
  } else {
    evidenceCounts[evidence.type] = (evidenceCounts[evidence.type] ?? 0) + 1;
  }
  if (!hasText(evidence.title)) errors.push(`${evidenceLabel}.title is required`);
  if (!hasText(evidence.source)) errors.push(`${evidenceLabel}.source is required`);
  if (!hasText(evidence.date)) errors.push(`${evidenceLabel}.date is required`);
  if (!hasText(evidence.summary)) errors.push(`${evidenceLabel}.summary is required`);
  if (!hasText(evidence.url)) errors.push(`${evidenceLabel}.url is required`);
  else if (!isHttpUrl(evidence.url)) errors.push(`${evidenceLabel}.url must be http(s)`);
}

export function validateTrendDataset(dataset: TrendDataset): string[] {
  const errors: string[] = [];

  if (!hasText(dataset.weekId)) errors.push('weekId is required');
  if (!hasText(dataset.label)) errors.push('label is required');
  if (!Array.isArray(dataset.sourceSummary) || dataset.sourceSummary.length === 0) errors.push('sourceSummary is required');
  if (Array.isArray(dataset.sourceSummary)) {
    const expectedSourceNames = SOURCE_ORDER.map(sourceSummaryNameForType);
    const actualSourceNames = dataset.sourceSummary.map((item) => item.name);
    for (const name of actualSourceNames) {
      if (!expectedSourceNames.includes(name)) errors.push(`sourceSummary.${name} is not recognized`);
    }
    if (actualSourceNames.slice(0, expectedSourceNames.length).join('|') !== expectedSourceNames.join('|')) {
      errors.push(`sourceSummary order must be ${expectedSourceNames.join(', ')}`);
    }
  }
  if (!Array.isArray(dataset.trends)) {
    errors.push('trends must be an array');
    return errors;
  }

  const ids = new Set<string>();
  const evidenceCounts: Record<EvidenceItem['type'], number> = { 기사: 0, SNS: 0, 검색: 0, 경쟁사: 0 };
  const hasTopLevelEvidence = Array.isArray(dataset.evidenceItems) && dataset.evidenceItems.length > 0;
  const topLevelEvidenceIds = new Set<string>();

  if (hasTopLevelEvidence) {
    dataset.evidenceItems?.forEach((evidence, index) => {
      const evidenceLabel = `evidenceItems[${index}]`;
      if (hasText(evidence.id)) topLevelEvidenceIds.add(evidence.id);
      validateEvidenceItem(evidence, evidenceLabel, errors, evidenceCounts);
    });
  }

  dataset.trends.forEach((trend) => {
    const label = trend.id || '(missing trend id)';
    if (!hasText(trend.id)) errors.push('trend.id is required');
    if (ids.has(trend.id)) errors.push(`${trend.id} is duplicated`);
    ids.add(trend.id);
    if (!hasText(trend.name)) errors.push(`${label}.name is required`);
    if (!hasText(trend.summary)) errors.push(`${label}.summary is required`);
    if (!Array.isArray(trend.keywords) || trend.keywords.length === 0) errors.push(`${label}.keywords must include at least one item`);
    if (!Array.isArray(trend.evidence)) {
      errors.push(`${label}.evidence must be an array`);
    } else if (!hasTopLevelEvidence && trend.evidence.length === 0) {
      errors.push(`${label}.evidence must include at least one item`);
    } else if (hasTopLevelEvidence && trend.evidence.length === 0 && (!Array.isArray(trend.evidenceIds) || trend.evidenceIds.length === 0)) {
      errors.push(`${label}.evidenceIds must include at least one item when evidenceItems is used`);
    } else {
      if (!hasTopLevelEvidence) trend.evidence.forEach((evidence, index) => {
        const evidenceLabel = `${label}.evidence[${index}]`;
        validateEvidenceItem(evidence, evidenceLabel, errors, evidenceCounts);
      });
      if (hasTopLevelEvidence && Array.isArray(trend.evidenceIds)) {
        trend.evidenceIds.forEach((evidenceId) => {
          if (!topLevelEvidenceIds.has(evidenceId)) errors.push(`${label}.evidenceIds.${evidenceId} is missing from evidenceItems`);
        });
      }
    }
    if (!trend.ideas?.stable) errors.push(`${label}.ideas.stable is required`);
    if (!trend.ideas?.aggressive) errors.push(`${label}.ideas.aggressive is required`);

    (['momentum', 'onstyleFit', 'risk'] as const).forEach((scoreKey) => {
      if (!isScore(trend.scores?.[scoreKey])) {
        errors.push(`${label}.scores.${scoreKey} must be between 0 and 100`);
      }
    });
  });

  for (const type of SOURCE_ORDER) {
    const sourceName = sourceSummaryNameForType(type);
    const summary = dataset.sourceSummary.find((item) => item.name === sourceName);
    const expectedCount = evidenceCounts[type] ?? 0;
    if (!summary) errors.push(`sourceSummary.${sourceName} is required`);
    else if (summary.count !== expectedCount) errors.push(`sourceSummary.${sourceName} count must equal evidence count ${expectedCount}`);
  }

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
