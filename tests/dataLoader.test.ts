import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadTrendDataset } from '../src/domain/dataLoader';
import type { TrendDataset } from '../src/domain/types';

const validDataset: TrendDataset = {
  weekId: '2026-W26',
  label: '2026.06.24 - 2026.06.30',
  status: 'Published',
  generatedAt: '2026-06-26T00:00:00.000Z',
  source: 'notion',
  sourceSummary: [
    { name: '뉴스/기사', count: 1, note: '커머스·유통·브랜드 기사' },
    { name: 'SNS 공개 신호', count: 0, note: '해시태그/UGC 샘플' },
    { name: '검색 키워드', count: 0, note: '상승 검색어 샘플' },
    { name: '경쟁사 프로모션', count: 0, note: '이벤트/기획전 페이지' }
  ],
  trends: [
    {
      id: 'trend-a',
      name: '테스트 트렌드',
      summary: '요약',
      keywords: ['키워드'],
      channels: ['기사'],
      categories: ['뷰티'],
      promotionTypes: ['멤버십'],
      modeBias: 'stable',
      scores: { momentum: 80, onstyleFit: 90, risk: 30 },
      evidence: [{ type: '기사', title: '근거', source: '뉴스', date: '2026-06-26', url: '', summary: '요약' }],
      aiInterpretation: { consumerInsight: '인사이트', opportunity: '기회', caution: '주의' },
      ideas: {
        stable: {
          title: '안정형', concept: '컨셉', target: '타깃', category: '뷰티', benefit: '혜택', message: '메시지',
          channels: ['앱'], expectedEffect: '효과', risk: '리스크', buzz: '중간', difficulty: '낮음',
          copy: { banner: '배너', push: '푸시', live: '라이브' }, checklist: ['체크'], teams: ['CRM']
        },
        aggressive: {
          title: '공격형', concept: '컨셉', target: '타깃', category: '뷰티', benefit: '혜택', message: '메시지',
          channels: ['앱'], expectedEffect: '효과', risk: '리스크', buzz: '높음', difficulty: '높음',
          copy: { banner: '배너', push: '푸시', live: '라이브' }, checklist: ['체크'], teams: ['CRM']
        }
      }
    }
  ]
};

describe('loadTrendDataset', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads and validates the static JSON dataset generated from Notion', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => validDataset });

    const dataset = await loadTrendDataset(fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledWith('./data/trends/latest.json', { cache: 'no-store' });
    expect(dataset.source).toBe('notion');
    expect(dataset.trends[0].id).toBe('trend-a');
  });

  it('throws a readable error when the generated dataset is invalid', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...validDataset, trends: [] }) });

    await expect(loadTrendDataset(fetchMock as unknown as typeof fetch)).rejects.toThrow('트렌드 데이터 검증 실패');
  });
});
