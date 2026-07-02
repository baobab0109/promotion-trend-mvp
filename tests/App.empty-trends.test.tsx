import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import type { TrendDataset, WeekManifestItem } from '../src/domain/types';

const emptyDataset: TrendDataset = {
  weekId: '2026-W25',
  label: '2026.06.17 - 2026.06.23',
  status: 'Published',
  generatedAt: '2026-06-26T00:00:00.000Z',
  source: 'notion',
  sourceSummary: [
    { name: '뉴스/기사', count: 0, note: '커머스·유통·브랜드 기사' },
    { name: 'SNS 공개 신호', count: 0, note: '해시태그/UGC 공개 신호' },
    { name: '커머스 혜택 검색', count: 0, note: '쿠폰·혜택·특가·프로모션 공개 근거' },
    { name: '경쟁사 프로모션', count: 0, note: '이벤트/기획전 페이지' }
  ],
  trends: []
};

const weeks: WeekManifestItem[] = [
  {
    weekId: '2026-W25',
    label: '2026.06.17 - 2026.06.23',
    status: 'Published',
    startDate: '2026-06-17',
    endDate: '2026-06-23',
    file: './data/trends/2026-W25.json',
    isLatest: true
  }
];

describe('App empty evidence-backed trends state', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('renders a zero-trend Notion week without crashing or opening a detail stack', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const path = String(url);
      if (path.endsWith('/weeks.json') || path === './data/weeks.json') {
        return { ok: true, json: async () => weeks } as Response;
      }
      return { ok: true, json: async () => emptyDataset } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await waitFor(() => expect(screen.getByText('0개 트렌드')).toBeInTheDocument());
    expect(screen.getAllByText(/해당 기간에 근거가 충분한 트렌드가 없습니다/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Trend Detail')).not.toBeInTheDocument();
  });
});
