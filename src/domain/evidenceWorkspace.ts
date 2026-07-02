import type { EvidenceItem, IdeaMode, SourceType, TrendDataset, TrendTopic } from './types';

export type EvidenceFilterType = SourceType | '전체';
export type QueueIntent = 'publish' | 'archive' | 'linkTrend' | 'requestReview';
export type BacklogStatus = 'New' | 'Ready' | 'In Review' | 'Done' | 'Archived';
export type BacklogPriority = 'High' | 'Medium' | 'Low';

export const CRM_TAGS = ['CRM', 'Growth', 'Retention', 'Acquisition', 'VIP', 'Live', 'Mobile'] as const;

export interface EvidenceRow extends EvidenceItem {
  id: string;
  linkedTrendIds: string[];
  linkedTrendNames: string[];
  crmTags: string[];
}

export interface EvidenceFilters {
  query: string;
  type: EvidenceFilterType;
  trendId: string;
}

export interface CurationQueueItem {
  id: string;
  evidenceId: string;
  evidenceTitle: string;
  evidenceType: SourceType;
  evidenceUrl: string;
  trendId?: string;
  trendName?: string;
  intent: QueueIntent;
  crmTags: string[];
  note: string;
  createdAt: string;
  applyMode: 'manual';
}

export interface BacklogItem {
  id: string;
  title: string;
  source: 'manual' | 'bookmark' | 'trend' | 'evidence';
  linkedTrendId?: string;
  linkedTrendName?: string;
  linkedEvidenceId?: string;
  status: BacklogStatus;
  priority: BacklogPriority;
  crmTags: string[];
  memo: string;
  createdAt: string;
}

interface QueueOptions {
  trendId?: string;
  trendName?: string;
  crmTags?: string[];
  note?: string;
  now?: string;
}

interface BacklogInput {
  title: string;
  source?: BacklogItem['source'];
  linkedTrendId?: string;
  linkedTrendName?: string;
  linkedEvidenceId?: string;
  status?: BacklogStatus;
  priority?: BacklogPriority;
  crmTags?: string[];
  memo?: string;
  now?: string;
}

interface MeetingPackInput {
  dataset: TrendDataset;
  evidenceRows: EvidenceRow[];
  queueItems?: CurationQueueItem[];
  backlogItems?: BacklogItem[];
  selectedEvidenceIds?: string[];
  crmTags?: string[];
}

function unique(values: string[]): string[] {
  return values.map((value) => value?.trim()).filter(Boolean).filter((value, index, array) => array.indexOf(value) === index);
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function safeIso(now?: string): string {
  return now || new Date().toISOString();
}

function evidenceIdFromFallback(trendId: string, index: number): string {
  return `${trendId}::${index}`;
}

function evidenceItemId(item: EvidenceItem, index: number): string {
  return normalizeText(item.id) || `evidence::${index}`;
}

function trendNameMap(trends: TrendTopic[]): Map<string, string> {
  return new Map(trends.map((trend) => [trend.id, trend.name]));
}

function trendEvidenceIdMap(trends: TrendTopic[]): Map<string, string[]> {
  const byEvidenceId = new Map<string, string[]>();
  for (const trend of trends) {
    for (const evidenceId of trend.evidenceIds || []) {
      if (!byEvidenceId.has(evidenceId)) byEvidenceId.set(evidenceId, []);
      byEvidenceId.get(evidenceId)?.push(trend.id);
    }
  }
  return byEvidenceId;
}

function linkedTrendIdsForEvidence(item: EvidenceItem, itemId: string, trends: TrendTopic[]): string[] {
  const explicit = item.trendIds || [];
  const fromTrendEvidenceIds = trendEvidenceIdMap(trends).get(itemId) || [];
  return unique([...explicit, ...fromTrendEvidenceIds]);
}

function rowFromEvidence(item: EvidenceItem, id: string, linkedTrendIds: string[], trends: TrendTopic[]): EvidenceRow {
  const names = trendNameMap(trends);
  return {
    ...item,
    id,
    linkedTrendIds,
    linkedTrendNames: linkedTrendIds.map((trendId) => names.get(trendId) || trendId),
    crmTags: unique(item.crmTags || item.tags || [])
  };
}

export function getEvidenceRows(dataset: TrendDataset): EvidenceRow[] {
  const trends = dataset.trends || [];
  if (Array.isArray(dataset.evidenceItems) && dataset.evidenceItems.length > 0) {
    return dataset.evidenceItems.map((item, index) => {
      const id = evidenceItemId(item, index);
      return rowFromEvidence(item, id, linkedTrendIdsForEvidence(item, id, trends), trends);
    });
  }

  return trends.flatMap((trend) => (trend.evidence || []).map((item, index) => rowFromEvidence(
    item,
    normalizeText(item.id) || evidenceIdFromFallback(trend.id, index),
    [trend.id],
    trends
  )));
}

export function getEvidenceTypeOptions(rows: EvidenceRow[]): EvidenceFilterType[] {
  return ['전체', ...unique(rows.map((row) => row.type)) as SourceType[]];
}

export function filterEvidenceRows(rows: EvidenceRow[], filters: EvidenceFilters): EvidenceRow[] {
  const query = normalizeText(filters.query).toLowerCase();
  return rows.filter((row) => {
    const queryTarget = [row.title, row.source, row.summary, row.type, ...row.linkedTrendNames, ...row.crmTags].join(' ').toLowerCase();
    const matchesQuery = !query || queryTarget.includes(query);
    const matchesType = filters.type === '전체' || row.type === filters.type;
    const matchesTrend = filters.trendId === '전체' || row.linkedTrendIds.includes(filters.trendId);
    return matchesQuery && matchesType && matchesTrend;
  });
}

export function getEvidenceStats(rows: EvidenceRow[]): Record<SourceType, number> {
  return rows.reduce<Record<SourceType, number>>((acc, row) => {
    acc[row.type] = (acc[row.type] || 0) + 1;
    return acc;
  }, { 기사: 0, 검색: 0, SNS: 0, 경쟁사: 0 });
}

export function queueItemKey(evidenceId: string, intent: QueueIntent, trendId = ''): string {
  return `${evidenceId}::${intent}::${trendId}`;
}

export function addQueueItem(items: CurationQueueItem[], row: EvidenceRow, intent: QueueIntent, options: QueueOptions = {}): CurationQueueItem[] {
  const trendId = options.trendId || row.linkedTrendIds[0] || '';
  const trendName = options.trendName || row.linkedTrendNames[0] || '';
  const id = queueItemKey(row.id, intent, trendId);
  if (items.some((item) => item.id === id)) return items;
  return [
    ...items,
    {
      id,
      evidenceId: row.id,
      evidenceTitle: row.title,
      evidenceType: row.type,
      evidenceUrl: row.url,
      trendId,
      trendName,
      intent,
      crmTags: unique(options.crmTags || row.crmTags),
      note: options.note || '',
      createdAt: safeIso(options.now),
      applyMode: 'manual'
    }
  ];
}

export function removeQueueItem(items: CurationQueueItem[], id: string): CurationQueueItem[] {
  return items.filter((item) => item.id !== id);
}

export function exportQueueJson(items: CurationQueueItem[]): string {
  return JSON.stringify({
    applyMode: 'manual',
    security: 'static-pages-no-notion-write',
    generatedAt: safeIso(),
    guidance: '정적 GitHub Pages에서는 Notion API/secret을 브라우저에 두지 않습니다. 이 JSON을 복사해 Notion에 수동 적용하세요.',
    items
  }, null, 2);
}

export function addBacklogItem(items: BacklogItem[], input: BacklogInput): BacklogItem[] {
  const title = normalizeText(input.title);
  if (!title) return items;
  const linkedTrendId = normalizeText(input.linkedTrendId);
  const id = normalizeText((input as Partial<BacklogItem>).id) || `backlog::${title.toLowerCase()}::${linkedTrendId}`;
  if (items.some((item) => item.id === id || (item.title === title && (item.linkedTrendId || '') === linkedTrendId))) return items;
  return [
    ...items,
    {
      id,
      title,
      source: input.source || 'manual',
      linkedTrendId: linkedTrendId || undefined,
      linkedTrendName: normalizeText(input.linkedTrendName) || undefined,
      linkedEvidenceId: normalizeText(input.linkedEvidenceId) || undefined,
      status: input.status || 'New',
      priority: input.priority || 'Medium',
      crmTags: unique(input.crmTags || []),
      memo: input.memo || '',
      createdAt: safeIso(input.now)
    }
  ];
}

export function removeBacklogItem(items: BacklogItem[], id: string): BacklogItem[] {
  return items.filter((item) => item.id !== id);
}

export function exportBacklogJson(items: BacklogItem[]): string {
  return JSON.stringify({
    applyMode: 'manual',
    security: 'static-pages-no-notion-write',
    generatedAt: safeIso(),
    guidance: 'Idea Backlog는 localStorage에만 저장되며 기존 찜한 기획안과 별도입니다. JSON을 다운로드/복사해 업무 도구에 수동 반영하세요.',
    items
  }, null, 2);
}

const COMPETITOR_HINTS = ['경쟁사', '쿠팡', '컬리', '마켓컬리', '무신사', '올리브영', '11번가', '네이버', 'g마켓', 'gmarket', 'ssg', '롯데온', '오늘의집', '이마트'];

export function getCompetitorEvidenceRows(rows: EvidenceRow[]): EvidenceRow[] {
  return rows.filter((row) => {
    if (row.type === '경쟁사') return true;
    const haystack = `${row.title} ${row.source} ${row.summary}`.toLowerCase();
    return COMPETITOR_HINTS.some((hint) => haystack.includes(hint.toLowerCase()));
  });
}

function markdownList(values: string[]): string {
  return values.length > 0 ? values.map((value) => `- ${value}`).join('\n') : '- 없음';
}

function ideaLines(trends: TrendTopic[]): string[] {
  return trends.flatMap((trend) => (['stable', 'aggressive'] as IdeaMode[]).map((mode) => {
    const idea = trend.ideas?.[mode as 'stable' | 'aggressive'];
    return idea ? `- ${trend.name} / ${mode}: ${idea.title} — ${idea.concept}` : '';
  }).filter(Boolean));
}

export function buildMeetingPackMarkdown({ dataset, evidenceRows, queueItems = [], backlogItems = [], selectedEvidenceIds = [], crmTags = [] }: MeetingPackInput): string {
  const selectedRows = selectedEvidenceIds.length > 0
    ? evidenceRows.filter((row) => selectedEvidenceIds.includes(row.id))
    : evidenceRows.slice(0, 8);
  const stats = getEvidenceStats(evidenceRows);
  const topTrends = [...(dataset.trends || [])]
    .sort((a, b) => (b.scores?.momentum || 0) - (a.scores?.momentum || 0))
    .slice(0, 5);
  const tags = unique([...crmTags, ...queueItems.flatMap((item) => item.crmTags), ...backlogItems.flatMap((item) => item.crmTags)]);

  return [
    `# Evidence Meeting Pack — ${dataset.label}`,
    '',
    `- Week: ${dataset.weekId}`,
    `- Generated: ${safeIso()}`,
    `- CRM/Growth tags: ${tags.length ? tags.join(', ') : '미지정'}`,
    '- Security: Notion 자동 쓰기 없이, 정적 Pages에서 복사/다운로드 후 수동 적용',
    '',
    '## Evidence Summary',
    `- 총 근거: ${evidenceRows.length}건`,
    `- 기사 ${stats.기사} · 검색 ${stats.검색} · SNS ${stats.SNS} · 경쟁사 ${stats.경쟁사}`,
    markdownList(selectedRows.map((row) => `${row.title} (${row.type}/${row.source}) — ${row.summary} ${row.url}`)),
    '',
    '## Top Trends',
    markdownList(topTrends.map((trend) => `${trend.name}: ${trend.summary} (Momentum ${trend.scores?.momentum ?? 0}, Risk ${trend.scores?.risk ?? 0})`)),
    '',
    '## Ideas',
    markdownList(ideaLines(topTrends)),
    '',
    '## Next Actions',
    markdownList(queueItems.map((item) => `${item.intent}: ${item.evidenceTitle}${item.trendName ? ` → ${item.trendName}` : ''}${item.note ? ` / ${item.note}` : ''}`)),
    '',
    '## Backlog',
    markdownList(backlogItems.map((item) => `${item.priority}/${item.status}: ${item.title}${item.memo ? ` — ${item.memo}` : ''}`))
  ].join('\n');
}

export function readLocalJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocalJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}
