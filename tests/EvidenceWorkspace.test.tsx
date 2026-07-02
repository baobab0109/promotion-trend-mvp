import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EvidenceWorkspace from '../src/components/EvidenceWorkspace';
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
    evidence: [evidence(), evidence({ type: '검색', title: '쿠폰 검색량 증가', source: 'Google', url: 'https://example.com/search' })],
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
    trends: [trend(), trend({ id: 'trend-competitor', name: '경쟁 타임딜', evidence: [evidence({ type: '경쟁사', title: '쿠팡 타임딜 강화', source: '쿠팡', url: 'https://example.com/coupang' })] })],
    ...overrides
  };
}

describe('EvidenceWorkspace UI', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    window.localStorage.clear();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: { writeText }
    });
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  it('renders Evidence Board with filters, original links, and linked trend navigation', async () => {
    const user = userEvent.setup();
    const onSelectTrend = vi.fn();
    render(<EvidenceWorkspace dataset={dataset()} selectedTrendId="trend-crm" onSelectTrend={onSelectTrend} />);

    expect(screen.getByRole('heading', { name: /Evidence Workspace/i })).toBeInTheDocument();
    expect(screen.getByText('근거와 AI 해석을 분리해 운영하는 정적 Pages 워크스페이스')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Evidence Board' })).toBeInTheDocument();
    expect(screen.getByText('멤버십 혜택 기사')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /원문 링크/ })[0]).toHaveAttribute('href', 'https://example.com/news');

    await user.type(screen.getByLabelText('Evidence 검색'), '검색량');
    expect(screen.queryByText('멤버십 혜택 기사')).not.toBeInTheDocument();
    expect(screen.getByText('쿠폰 검색량 증가')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Evidence 검색'));
    await user.selectOptions(screen.getByLabelText('Source type 필터'), '경쟁사');
    expect(screen.getByText('쿠팡 타임딜 강화')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '연결 트렌드 보기: 경쟁 타임딜' }));
    expect(onSelectTrend).toHaveBeenCalledWith('trend-competitor', true);
  });

  it('adds manual curation actions to Action Queue and exposes copy/export affordances', async () => {
    const user = userEvent.setup();
    render(<EvidenceWorkspace dataset={dataset()} selectedTrendId="trend-crm" onSelectTrend={vi.fn()} />);

    await user.click(within(screen.getByTestId('evidence-row-trend-crm::0')).getByRole('button', { name: '발행 큐 추가' }));
    await user.click(screen.getByRole('tab', { name: /Action Queue/ }));

    expect(screen.getByText('수동 적용용 JSON')).toBeInTheDocument();
    expect(screen.getByText('Notion API 자동 쓰기 없음')).toBeInTheDocument();
    expect(screen.getByText('publish')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Queue JSON 복사' }));
    expect(await screen.findByText('Queue JSON을 복사했습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Queue JSON 다운로드' })).toBeInTheDocument();
  });

  it('renders empty state for zero evidence weeks without crashing', () => {
    render(<EvidenceWorkspace dataset={dataset({ trends: [] })} selectedTrendId="" onSelectTrend={vi.fn()} />);

    expect(screen.getByText('연결된 근거가 없습니다')).toBeInTheDocument();
    expect(screen.getByText('이 주차에는 Evidence Board에 표시할 Published 근거가 없습니다.')).toBeInTheDocument();
  });

  it('shows Meeting Pack, Idea Backlog, and Competitor Archive sections with manual/static guidance', async () => {
    const user = userEvent.setup();
    render(<EvidenceWorkspace dataset={dataset()} selectedTrendId="trend-crm" onSelectTrend={vi.fn()} />);

    await user.click(screen.getByRole('tab', { name: /Meeting Pack/ }));
    expect(screen.getByText('회의용 Markdown')).toBeInTheDocument();
    expect(screen.getByText(/기간·근거 요약·Top Trends·Ideas·Next Actions/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Meeting Pack 복사' }));
    expect(await screen.findByText('Meeting Pack Markdown을 복사했습니다.')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Idea Backlog/ }));
    expect(screen.getByText('업무형 Idea Backlog')).toBeInTheDocument();
    expect(screen.getByText(/기존 찜한 기획안과 별도 저장/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '선택 트렌드 아이디어를 Backlog에 추가' }));
    expect(screen.getByText('CRM 리마인드 쿠폰')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Competitor Archive/ }));
    expect(screen.getByRole('heading', { name: 'Competitor Archive' })).toBeInTheDocument();
    expect(screen.getByText('쿠팡 타임딜 강화')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '경쟁사 근거를 Meeting Pack에 반영' })).toBeInTheDocument();
  });
});
