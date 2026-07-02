import { useEffect, useMemo, useState } from 'react';
import {
  CRM_TAGS,
  addBacklogItem,
  addQueueItem,
  buildMeetingPackMarkdown,
  exportBacklogJson,
  exportQueueJson,
  filterEvidenceRows,
  getCompetitorEvidenceRows,
  getEvidenceRows,
  getEvidenceStats,
  getEvidenceTypeOptions,
  readLocalJson,
  removeBacklogItem,
  removeQueueItem,
  writeLocalJson
} from '../domain/evidenceWorkspace';
import type { BacklogItem, CurationQueueItem, EvidenceFilterType, EvidenceRow, QueueIntent } from '../domain/evidenceWorkspace';
import type { TrendDataset } from '../domain/types';

interface EvidenceWorkspaceProps {
  dataset: TrendDataset;
  selectedTrendId: string;
  onSelectTrend: (id: string, jump?: boolean) => void;
}

type WorkspaceTab = 'board' | 'queue' | 'meeting' | 'backlog' | 'competitor';

const QUEUE_STORAGE_KEY = 'promotion-trend:evidence-action-queue:v1';
const BACKLOG_STORAGE_KEY = 'promotion-trend:idea-backlog:v1';
const tabLabels: Record<WorkspaceTab, string> = {
  board: 'Evidence Board',
  queue: 'Action Queue',
  meeting: 'Meeting Pack',
  backlog: 'Idea Backlog',
  competitor: 'Competitor Archive'
};
const intentLabel: Record<QueueIntent, string> = {
  publish: '발행 큐 추가',
  archive: '아카이브 큐 추가',
  linkTrend: '트렌드 연결 요청',
  requestReview: '리뷰 요청'
};

function usePersistentState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readLocalJson(key, fallback));
  useEffect(() => writeLocalJson(key, value), [key, value]);
  return [value, setValue] as const;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function firstTrendName(row: EvidenceRow): string {
  return row.linkedTrendNames[0] || '미연결';
}

function EvidenceRowCard({ row, onSelectTrend, onQueue }: {
  row: EvidenceRow;
  onSelectTrend: (id: string, jump?: boolean) => void;
  onQueue: (row: EvidenceRow, intent: QueueIntent) => void;
}) {
  return (
    <article className="evidence-board-row" data-testid={`evidence-row-${row.id}`}>
      <div className="evidence-board-top">
        <div>
          <div className="label-row compact">
            <span className="badge blue">{row.type}</span>
            <span className="badge">{row.source}</span>
            <span className="badge green">{row.date}</span>
          </div>
          <h3>{row.title}</h3>
        </div>
        <a className="evidence-link" href={row.url} target="_blank" rel="noreferrer">원문 링크 ↗</a>
      </div>
      <p>{row.summary}</p>
      <div className="evidence-board-meta">
        {row.linkedTrendIds.length > 0 ? row.linkedTrendIds.map((trendId, index) => (
          <button key={trendId} className="chip small-chip" type="button" onClick={() => onSelectTrend(trendId, true)}>
            연결 트렌드 보기: {row.linkedTrendNames[index] || trendId}
          </button>
        )) : <span className="muted">연결 트렌드 없음</span>}
        {row.crmTags.map((tag) => <span key={tag} className="badge violet">{tag}</span>)}
      </div>
      <div className="evidence-actions">
        <button className="btn small blue" type="button" onClick={() => onQueue(row, 'publish')}>{intentLabel.publish}</button>
        <button className="btn small" type="button" onClick={() => onQueue(row, 'archive')}>{intentLabel.archive}</button>
        <button className="btn small" type="button" onClick={() => onQueue(row, 'linkTrend')}>{intentLabel.linkTrend}</button>
        <button className="btn small ghost" type="button" onClick={() => onQueue(row, 'requestReview')}>{intentLabel.requestReview}</button>
      </div>
    </article>
  );
}

export default function EvidenceWorkspace({ dataset, selectedTrendId, onSelectTrend }: EvidenceWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('board');
  const [query, setQuery] = useState('');
  const [sourceType, setSourceType] = useState<EvidenceFilterType>('전체');
  const [linkedTrend, setLinkedTrend] = useState('전체');
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [queueItems, setQueueItems] = usePersistentState<CurationQueueItem[]>(QUEUE_STORAGE_KEY, []);
  const [backlogItems, setBacklogItems] = usePersistentState<BacklogItem[]>(BACKLOG_STORAGE_KEY, []);
  const [status, setStatus] = useState('');

  const evidenceRows = useMemo(() => getEvidenceRows(dataset), [dataset]);
  const filteredRows = useMemo(() => filterEvidenceRows(evidenceRows, { query, type: sourceType, trendId: linkedTrend }), [evidenceRows, linkedTrend, query, sourceType]);
  const sourceOptions = useMemo(() => getEvidenceTypeOptions(evidenceRows), [evidenceRows]);
  const competitorRows = useMemo(() => getCompetitorEvidenceRows(evidenceRows), [evidenceRows]);
  const stats = useMemo(() => getEvidenceStats(evidenceRows), [evidenceRows]);
  const selectedTrend = useMemo(() => dataset.trends.find((trend) => trend.id === selectedTrendId) || dataset.trends[0], [dataset.trends, selectedTrendId]);
  const meetingMarkdown = useMemo(() => buildMeetingPackMarkdown({
    dataset,
    evidenceRows,
    queueItems,
    backlogItems,
    selectedEvidenceIds,
    crmTags: [...CRM_TAGS].filter((tag) => queueItems.some((item) => item.crmTags.includes(tag)) || backlogItems.some((item) => item.crmTags.includes(tag)))
  }), [backlogItems, dataset, evidenceRows, queueItems, selectedEvidenceIds]);

  useEffect(() => {
    setSelectedEvidenceIds((current) => current.filter((id) => evidenceRows.some((row) => row.id === id)));
  }, [evidenceRows]);

  function notify(message: string) {
    setStatus(message);
    window.setTimeout(() => setStatus(''), 2400);
  }

  function handleQueue(row: EvidenceRow, intent: QueueIntent) {
    const before = queueItems.length;
    const next = addQueueItem(queueItems, row, intent, { trendId: row.linkedTrendIds[0], trendName: firstTrendName(row), crmTags: row.crmTags.length ? row.crmTags : ['Growth'] });
    setQueueItems(next);
    notify(next.length === before ? '이미 Action Queue에 있는 항목입니다.' : 'Action Queue에 추가했습니다. 수동 적용용 JSON으로만 저장됩니다.');
  }

  async function handleCopyQueue() {
    notify(await copyText(exportQueueJson(queueItems)) ? 'Queue JSON을 복사했습니다.' : '클립보드 권한이 없어 복사하지 못했습니다.');
  }

  async function handleCopyBacklog() {
    notify(await copyText(exportBacklogJson(backlogItems)) ? 'Backlog JSON을 복사했습니다.' : '클립보드 권한이 없어 복사하지 못했습니다.');
  }

  async function handleCopyMeeting() {
    notify(await copyText(meetingMarkdown) ? 'Meeting Pack Markdown을 복사했습니다.' : '클립보드 권한이 없어 복사하지 못했습니다.');
  }

  function addSelectedTrendIdeaToBacklog() {
    if (!selectedTrend?.ideas?.stable) {
      notify('Backlog에 추가할 선택 트렌드 아이디어가 없습니다.');
      return;
    }
    const next = addBacklogItem(backlogItems, {
      title: selectedTrend.ideas.stable.title,
      source: 'trend',
      linkedTrendId: selectedTrend.id,
      linkedTrendName: selectedTrend.name,
      priority: selectedTrend.scores.momentum >= 85 ? 'High' : 'Medium',
      status: 'New',
      crmTags: selectedTrend.categories.includes('멤버십/CRM') ? ['CRM', 'Retention'] : ['Growth'],
      memo: selectedTrend.ideas.stable.concept
    });
    setBacklogItems(next);
    notify(next.length === backlogItems.length ? '이미 Backlog에 있는 아이디어입니다.' : 'Idea Backlog에 추가했습니다.');
  }

  function addCompetitorsToMeeting() {
    setSelectedEvidenceIds((current) => [...new Set([...current, ...competitorRows.map((row) => row.id)])]);
    notify('경쟁사 근거를 Meeting Pack 선택 근거에 반영했습니다.');
  }

  return (
    <section className="evidence-workspace-panel" aria-labelledby="evidence-workspace-title">
      <div className="evidence-workspace-head">
        <div>
          <span className="eyebrow"><span className="dot" /> Evidence-first workspace</span>
          <h2 id="evidence-workspace-title">Evidence Workspace</h2>
          <p>근거와 AI 해석을 분리해 운영하는 정적 Pages 워크스페이스</p>
        </div>
        <div className="manual-security-note">
          <strong>정적 Pages 보안 원칙</strong>
          <span>브라우저 Notion API/secret 사용 없음 · localStorage + 복사/다운로드 + 수동 적용</span>
        </div>
      </div>

      <div className="workspace-stats" aria-label="Evidence statistics">
        <span>총 {evidenceRows.length}건</span>
        <span>기사 {stats.기사}</span>
        <span>검색 {stats.검색}</span>
        <span>SNS {stats.SNS}</span>
        <span>경쟁사 {stats.경쟁사}</span>
      </div>

      <div className="workspace-tabs" role="tablist" aria-label="Evidence Workspace tabs">
        {(Object.keys(tabLabels) as WorkspaceTab[]).map((tab) => (
          <button key={tab} className={`workspace-tab ${activeTab === tab ? 'active' : ''}`} role="tab" aria-selected={activeTab === tab} type="button" onClick={() => setActiveTab(tab)}>
            {tabLabels[tab]}{tab === 'queue' ? ` (${queueItems.length})` : tab === 'backlog' ? ` (${backlogItems.length})` : ''}
          </button>
        ))}
      </div>

      {activeTab === 'board' && (
        <div className="workspace-tab-panel" role="tabpanel">
          <div className="section-head inline-head">
            <div>
              <h2>Evidence Board</h2>
              <p>dataset.evidenceItems를 우선 사용하고, 없으면 trends[].evidence를 안전하게 펼쳐 원문 근거를 확인합니다.</p>
            </div>
          </div>
          <div className="evidence-filters">
            <label>
              <span>Evidence 검색</span>
              <input className="search" aria-label="Evidence 검색" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목·출처·요약·트렌드 검색" />
            </label>
            <label>
              <span>Source type 필터</span>
              <select aria-label="Source type 필터" value={sourceType} onChange={(event) => setSourceType(event.target.value as EvidenceFilterType)}>
                {sourceOptions.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label>
              <span>Linked trend 필터</span>
              <select aria-label="Linked trend 필터" value={linkedTrend} onChange={(event) => setLinkedTrend(event.target.value)}>
                <option value="전체">전체</option>
                {dataset.trends.map((trend) => <option key={trend.id} value={trend.id}>{trend.name}</option>)}
              </select>
            </label>
          </div>
          {evidenceRows.length === 0 ? (
            <div className="empty evidence-empty" role="status">
              <h3>연결된 근거가 없습니다</h3>
              <p>이 주차에는 Evidence Board에 표시할 Published 근거가 없습니다.</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="empty" role="status">필터 조건에 맞는 근거가 없습니다.</div>
          ) : (
            <div className="evidence-board-list">
              {filteredRows.map((row) => (
                <EvidenceRowCard key={row.id} row={row} onSelectTrend={onSelectTrend} onQueue={handleQueue} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'queue' && (
        <div className="workspace-tab-panel" role="tabpanel">
          <div className="manual-export-head">
            <div>
              <h2>Action Queue</h2>
              <p><strong>수동 적용용 JSON</strong> · <span>Notion API 자동 쓰기 없음</span></p>
            </div>
            <div className="hero-actions">
              <button className="btn small blue" type="button" onClick={handleCopyQueue}>Queue JSON 복사</button>
              <button className="btn small" type="button" onClick={() => downloadText(`action-queue-${dataset.weekId}.json`, exportQueueJson(queueItems))}>Queue JSON 다운로드</button>
              <button className="btn small ghost" type="button" onClick={() => setQueueItems([])}>Queue 비우기</button>
            </div>
          </div>
          {queueItems.length === 0 ? <div className="empty">Evidence Board에서 발행/아카이브/연결/리뷰 의도를 추가하세요.</div> : (
            <div className="queue-list">
              {queueItems.map((item) => (
                <article key={item.id} className="queue-item">
                  <span className="badge orange">{item.intent}</span>
                  <strong>{item.evidenceTitle}</strong>
                  <p>{item.trendName || '미연결'} · {item.crmTags.join(', ') || '태그 없음'}</p>
                  <button className="btn small ghost" type="button" onClick={() => setQueueItems(removeQueueItem(queueItems, item.id))}>제거</button>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'meeting' && (
        <div className="workspace-tab-panel" role="tabpanel">
          <div className="manual-export-head">
            <div>
              <h2>Meeting Pack</h2>
              <p><strong>회의용 Markdown</strong> · 기간·근거 요약·Top Trends·Ideas·Next Actions 포함</p>
            </div>
            <div className="hero-actions">
              <button className="btn small blue" type="button" onClick={handleCopyMeeting}>Meeting Pack 복사</button>
              <button className="btn small" type="button" onClick={() => downloadText(`meeting-pack-${dataset.weekId}.md`, meetingMarkdown)}>Meeting Pack 다운로드</button>
            </div>
          </div>
          <div className="meeting-grid">
            <div className="meeting-selector">
              <h3>포함할 Evidence</h3>
              {evidenceRows.slice(0, 12).map((row) => (
                <label key={row.id} className="check-row">
                  <input type="checkbox" checked={selectedEvidenceIds.includes(row.id)} onChange={(event) => {
                    setSelectedEvidenceIds((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id));
                  }} />
                  <span>{row.title}</span>
                </label>
              ))}
            </div>
            <pre className="markdown-preview">{meetingMarkdown}</pre>
          </div>
        </div>
      )}

      {activeTab === 'backlog' && (
        <div className="workspace-tab-panel" role="tabpanel">
          <div className="manual-export-head">
            <div>
              <h2>Idea Backlog</h2>
              <p><strong>업무형 Idea Backlog</strong> · 기존 찜한 기획안과 별도 저장 · 상태/우선순위/CRM tags/memo 관리</p>
            </div>
            <div className="hero-actions">
              <button className="btn small blue" type="button" onClick={addSelectedTrendIdeaToBacklog}>선택 트렌드 아이디어를 Backlog에 추가</button>
              <button className="btn small" type="button" onClick={handleCopyBacklog}>Backlog JSON 복사</button>
              <button className="btn small" type="button" onClick={() => downloadText(`idea-backlog-${dataset.weekId}.json`, exportBacklogJson(backlogItems))}>Backlog 다운로드</button>
            </div>
          </div>
          {backlogItems.length === 0 ? <div className="empty">선택 트렌드의 안정형 아이디어를 업무 Backlog로 전환해 보세요.</div> : (
            <div className="backlog-grid">
              {backlogItems.map((item) => (
                <article key={item.id} className="backlog-card">
                  <div className="label-row compact"><span className="badge red">{item.priority}</span><span className="badge green">{item.status}</span>{item.crmTags.map((tag) => <span className="badge violet" key={tag}>{tag}</span>)}</div>
                  <strong>{item.title}</strong>
                  <p>{item.memo || '메모 없음'}</p>
                  <small>{item.linkedTrendName || item.linkedTrendId || '미연결'} · {item.source}</small>
                  <button className="btn small ghost" type="button" onClick={() => setBacklogItems(removeBacklogItem(backlogItems, item.id))}>제거</button>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'competitor' && (
        <div className="workspace-tab-panel" role="tabpanel">
          <div className="manual-export-head">
            <div>
              <h2>Competitor Archive</h2>
              <p>type=경쟁사 또는 제목/출처에서 경쟁사 신호가 추정되는 근거를 별도 아카이브합니다.</p>
            </div>
            <button className="btn small blue" type="button" onClick={addCompetitorsToMeeting}>경쟁사 근거를 Meeting Pack에 반영</button>
          </div>
          {competitorRows.length === 0 ? <div className="empty">경쟁사로 분류되거나 추정되는 근거가 없습니다.</div> : (
            <div className="evidence-board-list compact-list">
              {competitorRows.map((row) => <EvidenceRowCard key={row.id} row={row} onSelectTrend={onSelectTrend} onQueue={handleQueue} />)}
            </div>
          )}
        </div>
      )}

      <div className={`inline-status ${status ? 'show' : ''}`} role="status" aria-live="polite">{status}</div>
    </section>
  );
}
