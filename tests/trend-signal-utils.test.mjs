import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  buildUpsertPlan,
  canonicalizeUrl,
  dedupeSignals,
  interleaveSignals,
  matchTrendCandidate,
  parseRssItems,
  signalFingerprint
} from '../scripts/lib/trend-signal-utils.mjs';

const rssSample = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Google News</title>
    <item>
      <title><![CDATA[CJ온스타일, 멤버십 고객 대상 뷰티 기획전 강화]]></title>
      <link>https://example.com/news/article?utm_source=google&amp;utm_campaign=rss&amp;id=123</link>
      <pubDate>Thu, 25 Jun 2026 01:23:45 GMT</pubDate>
      <source url="https://news.example.com">Example News</source>
      <description><![CDATA[프리미엄 멤버십과 뷰티 큐레이션을 결합한 프로모션 소식]]></description>
    </item>
  </channel>
</rss>`;

describe('trend signal crawler utilities', () => {
  it('RSS XML에서 item title/link/pubDate/source/description을 파싱한다', () => {
    const items = parseRssItems(rssSample, { fallbackSource: 'Google News RSS' });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: 'CJ온스타일, 멤버십 고객 대상 뷰티 기획전 강화',
      link: 'https://example.com/news/article?id=123',
      source: 'Example News',
      publishedAt: '2026-06-25T01:23:45.000Z',
      description: '프리미엄 멤버십과 뷰티 큐레이션을 결합한 프로모션 소식'
    });
  });

  it('URL canonicalization에서 utm 등 tracking query를 제거한다', () => {
    const result = canonicalizeUrl('https://Example.com/path/?utm_source=newsletter&id=42&fbclid=abc&utm_medium=email#section');

    expect(result).toBe('https://example.com/path/?id=42');
  });

  it('trend keyword/hints 기반으로 가장 적절한 Notion Trend 후보를 매칭한다', () => {
    const trends = [
      { pageId: 'trend-1', name: '멤버십 프리뷰 강화', keywords: ['멤버십', '프리뷰'], summary: 'VIP 선공개 혜택' },
      { pageId: 'trend-2', name: '숏폼 라이브 커머스', keywords: ['숏폼', '라이브'], summary: '콘텐츠형 판매' }
    ];
    const item = {
      title: 'VIP 멤버십 고객 대상 프리뷰 기획전 오픈',
      description: '멤버십 선공개와 쿠폰 혜택이 핵심인 프로모션',
      sourceHint: 'membership preview'
    };

    const match = matchTrendCandidate(item, trends);

    expect(match?.trend.pageId).toBe('trend-1');
    expect(match?.score).toBeGreaterThan(0);
    expect(match?.matchedTerms).toEqual(expect.arrayContaining(['멤버십', '프리뷰']));
  });

  it('수집 source별 signal을 round-robin으로 섞어 limit 초반이 한 source에 쏠리지 않게 한다', () => {
    const items = [
      { title: 'A1', collectorSource: 'A' },
      { title: 'A2', collectorSource: 'A' },
      { title: 'A3', collectorSource: 'A' },
      { title: 'B1', collectorSource: 'B' },
      { title: 'B2', collectorSource: 'B' },
      { title: 'C1', collectorSource: 'C' }
    ];

    expect(interleaveSignals(items, 5).map((item) => item.title)).toEqual(['A1', 'B1', 'C1', 'A2', 'B2']);
  });

  it('duplicate URL 기준 upsert plan이 create/update/skip을 구분한다', () => {
    const items = [
      { title: '신규 기사', canonicalUrl: 'https://example.com/new', trendMatch: { trend: { pageId: 'trend-1' } } },
      { title: '기존 Draft 기사', canonicalUrl: 'https://example.com/draft', trendMatch: { trend: { pageId: 'trend-1' } } },
      { title: '기존 Published 기사', canonicalUrl: 'https://example.com/published', trendMatch: { trend: { pageId: 'trend-1' } } },
      { title: '중복 신규 기사', canonicalUrl: 'https://example.com/new', trendMatch: { trend: { pageId: 'trend-1' } } }
    ];
    const existing = new Map([
      ['https://example.com/draft', { pageId: 'page-draft', status: 'Draft' }],
      ['https://example.com/published', { pageId: 'page-published', status: 'Published' }]
    ]);

    const plan = buildUpsertPlan(items, existing, { status: 'Draft' });

    expect(plan.map((entry) => entry.action)).toEqual(['create', 'update', 'skip', 'skip']);
    expect(plan[1].pageId).toBe('page-draft');
    expect(plan[2].reason).toContain('Published');
    expect(plan[3].reason).toContain('duplicate');
  });

  it('same-run duplicate guard가 URL과 제목/source fingerprint 중복을 제거한다', () => {
    const items = [
      { title: '브랜드몰 여름 기획전 - Example News', source: 'Example News', link: 'https://example.com/a?utm_source=rss' },
      { title: '브랜드몰 여름 기획전', source: 'Example News', link: 'https://news.google.com/rss/articles/duplicate' },
      { title: '다른 쇼핑 혜택', source: 'Other News', link: 'https://example.com/b' }
    ];

    expect(signalFingerprint(items[0])).toBe(signalFingerprint(items[1]));
    expect(dedupeSignals(items).map((item) => item.title)).toEqual([
      '브랜드몰 여름 기획전 - Example News',
      '다른 쇼핑 혜택'
    ]);
  });

  it('same article fingerprint가 기존 Evidence에 있으면 새 URL이어도 create 대신 update한다', () => {
    const items = [
      { title: '브랜드몰 여름 기획전', source: 'Example News', canonicalUrl: 'https://news.google.com/rss/articles/new-url', trendMatch: { trend: { pageId: 'trend-1' } } }
    ];
    const existingByFingerprint = new Map([
      [signalFingerprint({ title: '브랜드몰 여름 기획전 - Example News', source: 'Example News' }), { pageId: 'existing-page', status: 'Draft' }]
    ]);

    const plan = buildUpsertPlan(items, new Map(), { status: 'Draft', existingByFingerprint });

    expect(plan[0].action).toBe('update');
    expect(plan[0].pageId).toBe('existing-page');
  });

  it('page-snapshot dedupe window 안의 기존 Draft는 update하지 않고 skip한다', () => {
    const today = new Date().toISOString().slice(0, 10);
    const items = [
      { title: '카카오쇼핑 톡딜', source: '카카오쇼핑 톡딜', canonicalUrl: 'https://store.kakao.com/home/hotdeal', dedupeWindowDays: 7, trendMatch: { trend: { pageId: 'trend-1' } } }
    ];
    const existing = new Map([
      ['https://store.kakao.com/home/hotdeal', { pageId: 'existing-page', status: 'Draft', evidenceDate: today }]
    ]);

    const plan = buildUpsertPlan(items, existing, { status: 'Draft' });

    expect(plan[0].action).toBe('skip');
    expect(plan[0].reason).toContain('dedupe window');
  });

  it('direct Published 모드에서 검색/SNS 타입을 보존하고 충분한 매칭 점수만 create한다', () => {
    const items = [
      { title: 'CJ온스타일 라이브 전용 쿠폰 혜택 기획전', type: '검색', source: 'Google News · 커머스사 혜택/쿠폰 실행 신호', canonicalUrl: 'https://example.com/commerce-benefit', trendMatch: { trend: { pageId: 'trend-1' }, score: 8 } },
      { title: '쇼핑라이브 리뷰 영상 확산', type: 'SNS', source: 'YouTube 공개 신호', canonicalUrl: 'https://www.youtube.com/watch?v=abc123', trendMatch: { trend: { pageId: 'trend-2' }, score: 7 } }
    ];

    const plan = buildUpsertPlan(items, new Map(), { status: 'Published', minMatchScore: 5 });

    expect(plan.map((entry) => entry.action)).toEqual(['create', 'create']);
    expect(plan.every((entry) => entry.status === 'Published')).toBe(true);
    expect(plan.map((entry) => entry.item.type)).toEqual(['검색', 'SNS']);
    expect(plan.every((entry) => entry.item.canonicalUrl.startsWith('https://'))).toBe(true);
  });

  it('direct Published 모드에서는 fallback 또는 낮은 match score 근거를 publish하지 않는다', () => {
    const items = [
      { title: '무관한 검색 신호', type: '검색', source: 'Google News · 커머스사 혜택/쿠폰 실행 신호', canonicalUrl: 'https://example.com/unrelated-search', trendMatch: { trend: { pageId: 'trend-1' }, score: 0, fallback: true } },
      { title: '약한 SNS 언급', type: 'SNS', source: 'YouTube 공개 신호', canonicalUrl: 'https://www.youtube.com/watch?v=weak', trendMatch: { trend: { pageId: 'trend-2' }, score: 2 } }
    ];

    const plan = buildUpsertPlan(items, new Map(), { status: 'Published', minMatchScore: 5 });

    expect(plan.map((entry) => entry.action)).toEqual(['skip', 'skip']);
    expect(plan[0].reason).toContain('fallback');
    expect(plan[1].reason).toContain('match score');
  });

  it('커머스 혜택 검색 source는 플랫폼+혜택+실행 문맥을 요구한다', async () => {
    const config = JSON.parse(await fs.readFile('config/trend-signal-sources.json', 'utf8'));
    const searchSources = config.rssFeeds.filter((source) => source.type === '검색');

    expect(searchSources.map((source) => source.name)).toEqual([
      'Google News · 커머스사 혜택/쿠폰 실행 신호',
      'Google News · 멤버십/회원전용 혜택 신호',
      'Google News · 라이브커머스 전용 혜택 신호',
      'Google News · 버티컬 기획전/브랜드위크 혜택 신호',
      'Google News · CRM 루틴/참여형 혜택 신호',
      'Google News · 개인화/추천딜 혜택 신호'
    ]);

    for (const source of searchSources) {
      expect(source.publishGrade).toBe(true);
      expect(source.strictKeywordFilter).toBe(true);
      expect(source.requiredKeywordGroups).toHaveLength(3);
      expect(source.validationNotes).toMatch(/혜택|쿠폰|프로모션|커머스사/);
      expect(source.name).not.toContain('급상승 검색어');
      expect(source.name).not.toContain('검색 관심/키워드');
    }
  });
});
