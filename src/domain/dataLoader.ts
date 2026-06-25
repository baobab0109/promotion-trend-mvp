import type { TrendDataset } from './types';
import { validateTrendDataset } from './trendData';

export async function loadTrendDataset(fetcher: typeof fetch = fetch): Promise<TrendDataset> {
  const response = await fetcher('./data/trends/latest.json', { cache: 'no-store' });

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
