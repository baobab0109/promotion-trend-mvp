import { describe, expect, it } from 'vitest';
import {
  buildUpsertPlan,
  canonicalizeUrl,
  interleaveSignals,
  matchTrendCandidate,
  parseRssItems
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
});
