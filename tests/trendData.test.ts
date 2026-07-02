import { describe, expect, it } from 'vitest';
import {
  buildFilterOptions,
  buildSourceSummaryFromEvidence,
  createSampleTrendDataset,
  validateTrendDataset
} from '../src/domain/trendData';
import type { TrendDataset, TrendTopic } from '../src/domain/types';

const baseIdea = {
  title: '테스트 기획안',
  concept: '컨셉',
  target: '타깃',
  category: '뷰티',
  benefit: '혜택',
  message: '메시지',
  channels: ['앱'],
  expectedEffect: '효과',
  risk: '리스크',
  buzz: '중간',
  difficulty: '낮음',
  copy: { banner: '배너', push: '푸시', live: '라이브' },
  checklist: ['체크'],
  teams: ['CRM']
};

function trend(overrides: Partial<TrendTopic> = {}): TrendTopic {
  return {
    id: 'trend-a',
    name: '테스트 트렌드',
    summary: '요약',
    keywords: ['멤버십', 'AI추천'],
    channels: ['검색', '기사'],
    categories: ['뷰티', '멤버십/CRM'],
    promotionTypes: ['멤버십', '큐레이션'],
    modeBias: 'stable',
    scores: { momentum: 80, onstyleFit: 90, risk: 30 },
    evidence: [
      { type: '기사', title: '기사 근거', source: '뉴스', date: '2026-06-25', url: 'https://example.com/news', summary: '기사 요약' },
      { type: '검색', title: 'CJ온스타일 라이브 전용 쿠폰 혜택 기획전', source: 'Google News · 커머스사 혜택/쿠폰 실행 신호', date: '2026-06-25', url: 'https://example.com/commerce-benefit', summary: '커머스사명과 혜택 메커니즘이 확인된 검색 기반 근거' }
    ],
    aiInterpretation: { consumerInsight: '인사이트', opportunity: '기회', caution: '주의' },
    ideas: { stable: baseIdea, aggressive: { ...baseIdea, title: '공격형 기획안' } },
    ...overrides
  };
}

describe('trend data helpers', () => {
  it('derives filter options from published trend data without duplicates', () => {
    const options = buildFilterOptions([
      trend(),
      trend({ id: 'trend-b', channels: ['SNS', '검색'], categories: ['패션'], promotionTypes: ['한정판'], modeBias: 'aggressive' })
    ]);

    expect(options.channels).toEqual(['전체', '검색', '기사', 'SNS']);
    expect(options.categories).toEqual(['전체', '뷰티', '멤버십/CRM', '패션']);
    expect(options.types).toEqual(['전체', '멤버십', '큐레이션', '한정판']);
    expect(options.modes).toEqual(['전체', '안정형 추천 강함', '공격형 추천 강함']);
  });

  it('does not show sample-derived filter options for a zero-trend evidence-backed week', () => {
    expect(buildFilterOptions([])).toEqual({
      channels: ['전체'],
      categories: ['전체'],
      types: ['전체'],
      modes: ['전체']
    });
  });

  it('summarizes evidence counts into the source labels used by the dashboard', () => {
    const summary = buildSourceSummaryFromEvidence([trend()]);

    expect(summary).toEqual([
      { name: '뉴스/기사', count: 1, note: '커머스·유통·브랜드 기사' },
      { name: 'SNS 공개 신호', count: 0, note: '해시태그/UGC 공개 신호' },
      { name: '커머스 혜택 검색', count: 1, note: '쿠폰·혜택·특가·프로모션 공개 근거' },
      { name: '경쟁사 프로모션', count: 0, note: '이벤트/기획전 페이지' }
    ]);
  });

  it('validates required weekly dataset fields and trend score ranges', () => {
    const dataset: TrendDataset = {
      weekId: '2026-W26',
      label: '2026.06.24 - 2026.06.30',
      status: 'Published',
      generatedAt: '2026-06-26T00:00:00.000Z',
      source: 'notion',
      sourceSummary: buildSourceSummaryFromEvidence([trend()]),
      trends: [trend()]
    };

    expect(validateTrendDataset(dataset)).toEqual([]);
    expect(validateTrendDataset({ ...dataset, trends: [trend({ scores: { momentum: 101, onstyleFit: 90, risk: 30 } })] })).toContain(
      'trend-a.scores.momentum must be between 0 and 100'
    );
  });

  it('allows a published week with zero evidence-backed trends while keeping sourceSummary count validation', () => {
    const emptySummary = buildSourceSummaryFromEvidence([]);
    const dataset: TrendDataset = {
      weekId: '2026-W25',
      label: '2026.06.17 - 2026.06.23',
      status: 'Published',
      generatedAt: '2026-06-26T00:00:00.000Z',
      source: 'notion',
      sourceSummary: emptySummary,
      trends: []
    };

    expect(validateTrendDataset(dataset)).toEqual([]);
    expect(validateTrendDataset({
      ...dataset,
      sourceSummary: emptySummary.map((item) => item.name === '뉴스/기사' ? { ...item, count: 1 } : item)
    })).toContain('sourceSummary.뉴스/기사 count must equal evidence count 0');
  });

  it('requires publish-ready evidence type, fields, URL, and sourceSummary counts', () => {
    const dataset: TrendDataset = {
      weekId: '2026-W26',
      label: '2026.06.24 - 2026.06.30',
      status: 'Published',
      generatedAt: '2026-06-26T00:00:00.000Z',
      source: 'notion',
      sourceSummary: buildSourceSummaryFromEvidence([trend()]),
      trends: [trend()]
    };

    expect(validateTrendDataset(dataset)).toEqual([]);
    expect(validateTrendDataset({ ...dataset, trends: [trend({ evidence: [{ ...trend().evidence[0], type: 'Search' as never }] })] })).toContain(
      'trend-a.evidence[0].type must be one of 기사, SNS, 검색, 경쟁사'
    );
    expect(validateTrendDataset({ ...dataset, trends: [trend({ evidence: [{ ...trend().evidence[0], url: '' }] })] })).toContain(
      'trend-a.evidence[0].url is required'
    );
    expect(validateTrendDataset({ ...dataset, trends: [trend({ evidence: [{ ...trend().evidence[0], url: 'javascript:alert(1)' }] })] })).toContain(
      'trend-a.evidence[0].url must be http(s)'
    );
    expect(validateTrendDataset({ ...dataset, sourceSummary: dataset.sourceSummary.map((item) => item.name === '커머스 혜택 검색' ? { ...item, count: 0 } : item) })).toContain(
      'sourceSummary.커머스 혜택 검색 count must equal evidence count 1'
    );
    expect(validateTrendDataset({ ...dataset, sourceSummary: dataset.sourceSummary.map((item) => item.name === '커머스 혜택 검색' ? { ...item, name: '검색 키워드', note: '상승 검색어/키워드' } : item) })).toEqual(
      expect.arrayContaining([
        'sourceSummary.검색 키워드 is not recognized',
        'sourceSummary.커머스 혜택 검색 is required'
      ])
    );
  });

  it('wraps the existing sample data in a dataset object for fallback rendering', () => {
    const dataset = createSampleTrendDataset();

    expect(dataset.source).toBe('sample');
    expect(dataset.trends.length).toBeGreaterThan(0);
    expect(dataset.sourceSummary.length).toBe(4);
  });
});
