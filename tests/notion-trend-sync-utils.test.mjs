import { describe, expect, it } from 'vitest';
import { filterTrendPagesWithEvidence, partitionEvidenceBySelectedWeekTrend } from '../scripts/lib/notion-trend-sync-utils.mjs';

function richText(value) {
  return { rich_text: [{ plain_text: value }] };
}

function title(value) {
  return { title: [{ plain_text: value }] };
}

function select(value) {
  return { select: { name: value } };
}

function date(value) {
  return { date: { start: value } };
}

function relation(ids) {
  return { relation: ids.map((id) => ({ id })) };
}

function trendPage(id, trendId, weekPageId) {
  return {
    id,
    properties: {
      Name: title(trendId),
      Status: select('Published'),
      'Trend ID': richText(trendId),
      Week: relation([weekPageId])
    }
  };
}

function evidencePage(id, evidenceDate, trendIds, evidenceTitle = id) {
  return {
    id,
    properties: {
      Name: title(evidenceTitle),
      Status: select('Published'),
      Trend: relation(trendIds),
      Type: select('기사'),
      Source: richText('뉴스'),
      'Evidence Date': date(evidenceDate),
      URL: { url: `https://example.com/${id}` },
      Summary: richText('요약')
    }
  };
}

describe('Notion trend sync evidence partitioning', () => {
  it('keeps only selected-week evidence and remaps old-week relations by canonical Trend ID', () => {
    const selectedWeek = { id: 'week-26', startDate: '2026-06-24', endDate: '2026-06-30' };
    const selectedTrendPages = [trendPage('trend-w26-routine', 'routine-benefit', 'week-26')];
    const allTrendPages = [
      ...selectedTrendPages,
      trendPage('trend-w25-routine', 'routine-benefit', 'week-25'),
      trendPage('trend-w25-other', 'other-trend', 'week-25')
    ];
    const evidencePages = [
      evidencePage('ev-w26-linked-to-w25', '2026-06-26', ['trend-w25-routine'], 'W26 evidence linked to W25 trend'),
      evidencePage('ev-outside-w26', '2026-07-01', ['trend-w25-routine'], 'outside W26'),
      evidencePage('ev-unknown-selected-trend', '2026-06-26', ['trend-w25-other'], 'other trend')
    ];

    const { evidenceByTrend, attachedEvidencePages } = partitionEvidenceBySelectedWeekTrend({
      evidencePages,
      allTrendPages,
      selectedTrendPages,
      selectedWeek
    });

    expect(evidenceByTrend.get('trend-w26-routine')?.map((evidence) => evidence.title)).toEqual(['W26 evidence linked to W25 trend']);
    expect(attachedEvidencePages.map((page) => page.id)).toEqual(['ev-w26-linked-to-w25']);
    expect(evidenceByTrend.has('trend-w25-routine')).toBe(false);
  });

  it('excludes selected-week trend pages that have no in-range evidence', () => {
    const selectedTrendPages = [
      trendPage('trend-w27-with-evidence', 'coupon-evidence-backed', 'week-27'),
      trendPage('trend-w27-template-only', 'membership-preview', 'week-27')
    ];
    const evidenceByTrend = new Map([
      ['trend-w27-with-evidence', [{ title: '근거 있음' }]]
    ]);

    expect(filterTrendPagesWithEvidence(selectedTrendPages, evidenceByTrend).map((page) => page.id)).toEqual([
      'trend-w27-with-evidence'
    ]);
  });
});