import type { TrendDataset, WeekManifestItem } from './types';
import { buildSourceSummaryFromEvidence, validateTrendDataset } from './trendData';

function isFetcher(value: unknown): value is typeof fetch {
  return typeof value === 'function';
}

function makeAggregateWeekId(label: string): string {
  const recentDays = label.match(/최근\s*(\d+)일/);
  if (recentDays) return `aggregate:recent-${recentDays[1]}`;
  const recentWeeks = label.match(/최근\s*(\d+)주/);
  if (recentWeeks) return `aggregate:recent-${recentWeeks[1]}w`;
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gi, '-')
    .replace(/^-|-$/g, '');
  return `aggregate:${normalized || 'period'}`;
}

export async function loadTrendDataset(fetcher?: typeof fetch): Promise<TrendDataset>;
export async function loadTrendDataset(dataPath: string, fetcher?: typeof fetch): Promise<TrendDataset>;
export async function loadTrendDataset(dataPathOrFetcher: string | typeof fetch = './data/trends/latest.json', maybeFetcher: typeof fetch = fetch): Promise<TrendDataset> {
  const dataPath = isFetcher(dataPathOrFetcher) ? './data/trends/latest.json' : dataPathOrFetcher;
  const fetcher = isFetcher(dataPathOrFetcher) ? dataPathOrFetcher : maybeFetcher;
  const response = await fetcher(dataPath, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`트렌드 데이터를 불러오지 못했습니다. (${response.status})`);
  }

  const dataset = await response.json() as TrendDataset;
  const validationErrors = validateTrendDataset(dataset);
  if (validationErrors.length > 0) {
    throw new Error(`트렌드 데이터 검증 실패: ${validationErrors.join(', ')}`);
  }

  return dataset;
}

export async function loadWeeksManifest(fetcher: typeof fetch = fetch): Promise<WeekManifestItem[]> {
  const response = await fetcher('./data/weeks.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`주차 목록을 불러오지 못했습니다. (${response.status})`);
  }
  const weeks = await response.json() as WeekManifestItem[];
  if (!Array.isArray(weeks)) {
    throw new Error('주차 목록 형식이 올바르지 않습니다.');
  }
  return weeks.filter((week) => week.weekId && week.file);
}

export async function loadTrendDatasets(dataPaths: string[], label: string, fetcher: typeof fetch = fetch): Promise<TrendDataset> {
  const uniquePaths = dataPaths.filter((path, index) => path && dataPaths.indexOf(path) === index);
  if (uniquePaths.length === 0) {
    return loadTrendDataset(fetcher);
  }
  if (uniquePaths.length === 1) {
    const dataset = await loadTrendDataset(uniquePaths[0], fetcher);
    return { ...dataset, label };
  }

  const datasets = await Promise.all(uniquePaths.map((path) => loadTrendDataset(path, fetcher)));
  const trends = datasets.flatMap((dataset) => dataset.trends.map((trend) => {
    const prefixedTrendId = `${dataset.weekId}__${trend.id}`;
    const nestedEvidence = (trend.evidence || []).map((evidence) => ({
      ...evidence,
      id: evidence.id ? `${dataset.weekId}__${evidence.id}` : evidence.id,
      trendIds: [prefixedTrendId]
    }));
    const evidenceIds = Array.isArray(trend.evidenceIds) && trend.evidenceIds.length > 0
      ? trend.evidenceIds.map((evidenceId) => `${dataset.weekId}__${evidenceId}`)
      : nestedEvidence.map((evidence, index) => evidence.id || `${prefixedTrendId}::${index}`);
    return {
      ...trend,
      id: prefixedTrendId,
      evidence: nestedEvidence,
      evidenceIds
    };
  }));
  const evidenceItems = datasets.flatMap((dataset) => {
    if (Array.isArray(dataset.evidenceItems) && dataset.evidenceItems.length > 0) {
      return dataset.evidenceItems.map((evidence, index) => ({
        ...evidence,
        id: `${dataset.weekId}__${evidence.id || `evidence::${index}`}`,
        trendIds: (evidence.trendIds || []).map((trendId) => `${dataset.weekId}__${trendId}`)
      }));
    }
    return dataset.trends.flatMap((trend) => (trend.evidence || []).map((evidence, index) => ({
      ...evidence,
      id: evidence.id ? `${dataset.weekId}__${evidence.id}` : `${dataset.weekId}__${trend.id}::${index}`,
      trendIds: [`${dataset.weekId}__${trend.id}`]
    })));
  });
  const generatedAt = datasets
    .map((dataset) => dataset.generatedAt)
    .filter(Boolean)
    .sort()
    .at(-1) ?? new Date(0).toISOString();

  return {
    weekId: makeAggregateWeekId(label),
    label,
    status: 'Published',
    generatedAt,
    source: datasets.some((dataset) => dataset.source === 'notion') ? 'notion' : 'sample',
    sourceSummary: buildSourceSummaryFromEvidence(trends, evidenceItems),
    trends,
    evidenceItems
  };
}
