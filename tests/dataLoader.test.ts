import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadTrendDataset, loadTrendDatasets, loadWeeksManifest } from '../src/domain/dataLoader';
import type { TrendDataset, WeekManifestItem } from '../src/domain/types';

const validDataset: TrendDataset = {
  weekId: '2026-W26',
  label: '2026.06.24 - 2026.06.30',
  status: 'Published',
  generatedAt: '2026-06-26T00:00:00.000Z',
  source: 'notion',
  sourceSummary: [
    { name: '뉴스/기사', count: 1, note: '커머스·유통·브랜드 기사' },
    { name: 'SNS 공개 신호', count: 0, note: '해시태그/UGC 공개 신호' },
    { name: '커머스 혜택 검색', count: 0, note: '쿠폰·혜택·특가·프로모션 공개 근거' },
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
      evidence: [{ type: '기사', title: '근거', source: '뉴스', date: '2026-06-26', url: 'https://example.com/news', summary: '요약' }],
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

  it('loads a requested weekly dataset path for the week selector', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => validDataset });

    await loadTrendDataset('./data/trends/2026-W26.json', fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledWith('./data/trends/2026-W26.json', { cache: 'no-store' });
  });

  it('loads the weeks manifest used by the period selector', async () => {
    const manifest: WeekManifestItem[] = [
      { weekId: '2026-W26', label: '2026.06.24 - 2026.06.30', status: 'Published', startDate: '2026-06-24', endDate: '2026-06-30', file: './data/trends/2026-W26.json', isLatest: true }
    ];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => manifest });

    const weeks = await loadWeeksManifest(fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledWith('./data/weeks.json', { cache: 'no-store' });
    expect(weeks).toEqual(manifest);
  });

  it('combines multiple weekly datasets for recent N-day or recent N-week aggregate views', async () => {
    const week25 = { ...validDataset, weekId: '2026-W25', label: '2026.06.17 - 2026.06.23' };
    const week24 = {
      ...validDataset,
      weekId: '2026-W24',
      label: '2026.06.10 - 2026.06.16',
      sourceSummary: [
        { name: '뉴스/기사', count: 0, note: '커머스·유통·브랜드 기사' },
        { name: 'SNS 공개 신호', count: 1, note: '해시태그/UGC 공개 신호' },
        { name: '커머스 혜택 검색', count: 0, note: '쿠폰·혜택·특가·프로모션 공개 근거' },
        { name: '경쟁사 프로모션', count: 0, note: '이벤트/기획전 페이지' }
      ],
      trends: [{ ...validDataset.trends[0], id: 'trend-b', evidence: [{ type: 'SNS' as const, title: 'SNS 근거', source: 'SNS', date: '2026-06-12', url: 'https://www.youtube.com/watch?v=abc123', summary: '요약' }] }]
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => week25 })
      .mockResolvedValueOnce({ ok: true, json: async () => week24 });

    const dataset = await loadTrendDatasets(['./data/trends/2026-W25.json', './data/trends/2026-W24.json'], '최근 14일', fetchMock as unknown as typeof fetch);

    expect(dataset.weekId).toBe('aggregate:recent-14');
    expect(dataset.label).toBe('최근 14일');
    expect(dataset.trends.map((trend) => trend.id)).toEqual(['2026-W25__trend-a', '2026-W24__trend-b']);
    expect(dataset.sourceSummary.find((source) => source.name === '뉴스/기사')?.count).toBe(1);
    expect(dataset.sourceSummary.find((source) => source.name === 'SNS 공개 신호')?.count).toBe(1);
  });

  it('throws a readable error when the generated dataset is invalid', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...validDataset, trends: [] }) });

    await expect(loadTrendDataset(fetchMock as unknown as typeof fetch)).rejects.toThrow('트렌드 데이터 검증 실패');
  });
});
