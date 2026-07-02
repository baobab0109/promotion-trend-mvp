import { describe, expect, it } from 'vitest';
import {
  addBacklogItem,
  addQueueItem,
  buildMeetingPackMarkdown,
  exportBacklogJson,
  exportQueueJson,
  filterEvidenceRows,
  getCompetitorEvidenceRows,
  getEvidenceRows
} from '../src/domain/evidenceWorkspace';
import type { EvidenceItem, TrendDataset, TrendTopic } from '../src/domain/types';

const idea = {
  title: 'CRM 리마인드 쿠폰',
  concept: '근거 기반 재방문 쿠폰',
  target: '휴면 고객',
  category: 'CRM',
  benefit: '10% 쿠폰',
  message: '놓친 혜택을 다시 확인하세요',
  channels: ['앱푸시'],
  expectedEffect: '재방문 상승',
  risk: '피로도',
  buzz: '중간',
  difficulty: '낮음',
  copy: { banner: '오늘만 쿠폰', push: '혜택이 곧 종료돼요', live: '라이브 특가' },
  checklist: ['세그먼트 확인'],
  teams: ['CRM']
};

function evidence(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    type: '기사',
    title: '멤버십 혜택 기사',
    source: '뉴스',
    date: '2026-06-25',
    url: 'https://example.com/news',
    summary: '멤버십 혜택이 확대되고 있다.',
    ...overrides
  };
}

function trend(overrides: Partial<TrendTopic> = {}): TrendTopic {
  return {
    id: 'trend-crm',
    name: 'CRM 쿠폰 개인화',
    summary: '멤버십과 쿠폰을 개인화한다.',
    keywords: ['CRM', '쿠폰'],
    channels: ['앱'],
    categories: ['멤버십/CRM'],
    promotionTypes: ['쿠폰'],
    modeBias: 'stable',
    scores: { momentum: 88, onstyleFit: 92, risk: 24 },
    evidence: [evidence()],
    aiInterpretation: { consumerInsight: '고객은 명확한 혜택을 원한다.', opportunity: '재방문 캠페인', caution: '푸시 과다 주의' },
    ideas: { stable: idea, aggressive: { ...idea, title: '경쟁 대응 타임딜' } },
    ...overrides
  };
}

function dataset(overrides: Partial<TrendDataset> = {}): TrendDataset {
  return {
    weekId: '2026-W27',
    label: '2026.07.01 - 2026.07.07',
    status: 'Published',
    generatedAt: '2026-07-02T00:00:00.000Z',
    source: 'notion',
    sourceSummary: [],
    trends: [trend()],
    ...overrides
  };
}

describe('evidence workspace domain', () => {
  it('flattens trend evidence rows with linked trend context and deterministic ids', () => {
    const rows = getEvidenceRows(dataset({ trends: [trend(), trend({ id: 'trend-live', name: '라이브 혜택', evidence: [evidence({ type: 'SNS', title: 'SNS 반응', source: 'Instagram', url: 'https://example.com/sns' })] })] }));

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: 'trend-crm::0',
      type: '기사',
      title: '멤버십 혜택 기사',
      linkedTrendIds: ['trend-crm'],
      linkedTrendNames: ['CRM 쿠폰 개인화']
    });
    expect(rows[1].linkedTrendNames).toEqual(['라이브 혜택']);
  });

  it('prefers top-level evidenceItems and resolves trend.evidenceIds without duplicating fallback evidence', () => {
    const v2 = dataset({
      evidenceItems: [
        { ...evidence({ title: 'V2 경쟁사 아카이브', type: '경쟁사', source: '경쟁사몰' }), id: 'ev-1', trendIds: ['trend-crm'], crmTags: ['CRM', 'Growth'] },
        { ...evidence({ title: 'V2 검색 신호', type: '검색', source: 'Google' }), id: 'ev-2' }
      ],
      trends: [trend({ evidenceIds: ['ev-1', 'ev-2'], evidence: [evidence({ title: '구형 중첩 근거' })] })]
    });

    const rows = getEvidenceRows(v2);

    expect(rows.map((row) => row.id)).toEqual(['ev-1', 'ev-2']);
    expect(rows[0].linkedTrendNames).toEqual(['CRM 쿠폰 개인화']);
    expect(rows[0].crmTags).toEqual(['CRM', 'Growth']);
  });

  it('filters evidence rows by query, source type, and linked trend', () => {
    const rows = getEvidenceRows(dataset({ trends: [
      trend(),
      trend({ id: 'trend-search', name: '검색 혜택', evidence: [evidence({ type: '검색', title: '쿠폰 검색량 증가', source: 'Google', summary: '검색 신호' })] })
    ] }));

    expect(filterEvidenceRows(rows, { query: '쿠폰', type: '전체', trendId: '전체' })).toHaveLength(2);
    expect(filterEvidenceRows(rows, { query: '', type: '검색', trendId: '전체' })).toHaveLength(1);
    expect(filterEvidenceRows(rows, { query: '', type: '전체', trendId: 'trend-search' })).toHaveLength(1);
    expect(filterEvidenceRows(rows, { query: '없는단어', type: '전체', trendId: '전체' })).toEqual([]);
  });

  it('handles zero evidence datasets with an empty row set', () => {
    expect(getEvidenceRows(dataset({ trends: [] }))).toEqual([]);
  });

  it('deduplicates curation queue items and exports manual-apply JSON', () => {
    const row = getEvidenceRows(dataset())[0];
    const queue = addQueueItem([], row, 'publish', { trendId: 'trend-crm', crmTags: ['CRM'], note: '검토 후 반영' });
    const deduped = addQueueItem(queue, row, 'publish', { trendId: 'trend-crm' });
    const anotherIntent = addQueueItem(deduped, row, 'archive');

    expect(deduped).toHaveLength(1);
    expect(anotherIntent).toHaveLength(2);
    const exported = JSON.parse(exportQueueJson(anotherIntent));
    expect(exported).toMatchObject({ applyMode: 'manual', security: 'static-pages-no-notion-write' });
    expect(exported.items).toEqual(expect.arrayContaining([expect.objectContaining({ evidenceId: row.id, intent: 'publish', crmTags: ['CRM'] })]));
  });

  it('builds meeting markdown with period, evidence summary, top trends, ideas, and next actions', () => {
    const ds = dataset();
    const rows = getEvidenceRows(ds);
    const queue = addQueueItem([], rows[0], 'requestReview', { note: '회의에서 판단', crmTags: ['Growth'] });
    const markdown = buildMeetingPackMarkdown({ dataset: ds, evidenceRows: rows, queueItems: queue, crmTags: ['CRM', 'Growth'] });

    expect(markdown).toContain('# Evidence Meeting Pack — 2026.07.01 - 2026.07.07');
    expect(markdown).toContain('## Evidence Summary');
    expect(markdown).toContain('멤버십 혜택 기사');
    expect(markdown).toContain('## Top Trends');
    expect(markdown).toContain('CRM 쿠폰 개인화');
    expect(markdown).toContain('## Ideas');
    expect(markdown).toContain('CRM 리마인드 쿠폰');
    expect(markdown).toContain('## Next Actions');
    expect(markdown).toContain('Notion 자동 쓰기 없이');
  });

  it('detects competitor archive evidence by type or competitor-like source/title', () => {
    const rows = getEvidenceRows(dataset({ trends: [trend({ evidence: [
      evidence({ type: '기사', title: '쿠팡 타임딜 강화', source: '뉴스' }),
      evidence({ type: '경쟁사', title: '올리브영 기획전', source: '경쟁사몰' }),
      evidence({ type: 'SNS', title: '일반 반응', source: 'Instagram' })
    ] })] }));

    expect(getCompetitorEvidenceRows(rows).map((row) => row.title)).toEqual(['쿠팡 타임딜 강화', '올리브영 기획전']);
  });

  it('stores backlog items with status, priority, CRM tags and exports JSON separately from bookmarks', () => {
    const next = addBacklogItem([], {
      title: 'VIP 쿠폰 리마인드',
      source: 'manual',
      linkedTrendId: 'trend-crm',
      priority: 'High',
      status: 'Ready',
      crmTags: ['CRM', 'Retention'],
      memo: '찜 기능과 별도 운영'
    });
    const deduped = addBacklogItem(next, { ...next[0], title: 'VIP 쿠폰 리마인드' });

    expect(deduped).toHaveLength(1);
    expect(deduped[0]).toMatchObject({ status: 'Ready', priority: 'High', crmTags: ['CRM', 'Retention'] });
    expect(JSON.parse(exportBacklogJson(deduped))).toMatchObject({ applyMode: 'manual', items: [{ title: 'VIP 쿠폰 리마인드' }] });
  });
});
