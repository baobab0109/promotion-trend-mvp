import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, 'config', 'notion-data-sources.json');
const NOTION_VERSION = '2022-06-28';
const STATUS_PUBLISHED = 'Published';
const SOURCE_META = {
  기사: { name: '뉴스/기사', note: '커머스·유통·브랜드 기사' },
  SNS: { name: 'SNS 공개 신호', note: '해시태그/UGC 샘플' },
  검색: { name: '검색 키워드', note: '상승 검색어 샘플' },
  경쟁사: { name: '경쟁사 프로모션', note: '이벤트/기획전 페이지' }
};
const SOURCE_ORDER = ['기사', 'SNS', '검색', '경쟁사'];

async function loadDotEnv() {
  const candidates = [
    path.join(process.env.HOME || '', '.hermes', '.env'),
    path.join(process.env.LOCALAPPDATA || '', 'hermes', '.env')
  ];
  for (const file of candidates) {
    try {
      const text = await fs.readFile(file, 'utf8');
      for (const line of text.split(/\r?\n/)) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
        }
      }
    } catch {
      // local convenience only
    }
  }
}

async function loadConfig() {
  const config = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf8'));
  return {
    weeks: process.env.NOTION_WEEKS_DATABASE_ID || config.databases.weeks,
    trends: process.env.NOTION_TRENDS_DATABASE_ID || config.databases.trends,
    evidence: process.env.NOTION_EVIDENCE_DATABASE_ID || config.databases.evidence,
    ideas: process.env.NOTION_IDEAS_DATABASE_ID || config.databases.ideas
  };
}

async function notion(pathname, { method = 'GET', body } = {}) {
  const key = process.env.NOTION_API_KEY;
  if (!key) throw new Error('NOTION_API_KEY is required');

  const response = await fetch(`https://api.notion.com/v1${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${method} ${pathname} failed: ${response.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function queryDatabase(databaseId, body = {}) {
  const results = [];
  let startCursor;
  do {
    const data = await notion(`/databases/${databaseId}/query`, {
      method: 'POST',
      body: { page_size: 100, ...body, ...(startCursor ? { start_cursor: startCursor } : {}) }
    });
    results.push(...data.results);
    startCursor = data.has_more ? data.next_cursor : undefined;
  } while (startCursor);
  return results;
}

function prop(page, name) {
  return page.properties?.[name];
}

function title(page, name = 'Name') {
  return prop(page, name)?.title?.map((item) => item.plain_text).join('')?.trim() || '';
}

function richText(page, name) {
  return prop(page, name)?.rich_text?.map((item) => item.plain_text).join('')?.trim() || '';
}

function select(page, name) {
  return prop(page, name)?.select?.name || '';
}

function multiSelect(page, name) {
  return prop(page, name)?.multi_select?.map((item) => item.name).filter(Boolean) || [];
}

function number(page, name, fallback = 0) {
  const value = prop(page, name)?.number;
  return typeof value === 'number' ? value : fallback;
}

function dateStart(page, name) {
  return prop(page, name)?.date?.start || '';
}

function url(page, name) {
  return prop(page, name)?.url || '';
}

function relationIds(page, name) {
  return prop(page, name)?.relation?.map((item) => item.id) || [];
}

function isPublished(page) {
  return select(page, 'Status') === STATUS_PUBLISHED;
}

function clampScore(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function checklist(value) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function ideaFromPage(page) {
  return {
    title: title(page),
    concept: richText(page, 'Concept'),
    target: richText(page, 'Target'),
    category: richText(page, 'Category'),
    benefit: richText(page, 'Benefit'),
    message: richText(page, 'Message'),
    channels: multiSelect(page, 'Channels'),
    expectedEffect: richText(page, 'Expected Effect'),
    risk: richText(page, 'Risk'),
    buzz: select(page, 'Buzz'),
    difficulty: select(page, 'Difficulty'),
    copy: {
      banner: richText(page, 'Banner Copy'),
      push: richText(page, 'Push Copy'),
      live: richText(page, 'Live Copy')
    },
    checklist: checklist(richText(page, 'Checklist')),
    teams: multiSelect(page, 'Teams')
  };
}

function evidenceFromPage(page) {
  return {
    type: select(page, 'Type'),
    title: title(page),
    source: richText(page, 'Source'),
    date: dateStart(page, 'Evidence Date'),
    url: url(page, 'URL'),
    summary: richText(page, 'Summary')
  };
}

function buildSourceSummary(trends) {
  const counts = Object.fromEntries(SOURCE_ORDER.map((type) => [type, 0]));
  for (const trend of trends) {
    for (const evidence of trend.evidence) {
      if (evidence.type in counts) counts[evidence.type] += 1;
    }
  }
  return SOURCE_ORDER.map((type) => ({
    name: SOURCE_META[type].name,
    count: counts[type] || 0,
    note: SOURCE_META[type].note
  }));
}

function validateDataset(dataset) {
  const errors = [];
  if (!dataset.weekId) errors.push('weekId is required');
  if (!dataset.label) errors.push('label is required');
  if (!dataset.trends.length) errors.push('at least one Published trend is required');
  const ids = new Set();
  for (const trend of dataset.trends) {
    if (!trend.id) errors.push('trend.id is required');
    if (ids.has(trend.id)) errors.push(`${trend.id} is duplicated`);
    ids.add(trend.id);
    for (const key of ['stable', 'aggressive']) {
      if (!trend.ideas[key]?.title) errors.push(`${trend.id}.ideas.${key} is required`);
    }
  }
  return errors;
}

async function main() {
  await loadDotEnv();
  const db = await loadConfig();
  const requestedWeekId = process.argv.find((arg) => arg.startsWith('--week='))?.split('=')[1];

  const publishedWeeks = (await queryDatabase(db.weeks, {
    filter: { property: 'Status', select: { equals: STATUS_PUBLISHED } },
    sorts: [{ property: 'Start Date', direction: 'descending' }]
  })).filter(isPublished);

  if (publishedWeeks.length === 0) throw new Error('No Published weeks found in Notion');

  const selectedWeek = requestedWeekId
    ? publishedWeeks.find((week) => richText(week, 'Week ID') === requestedWeekId)
    : publishedWeeks[0];
  if (!selectedWeek) throw new Error(`Published week not found: ${requestedWeekId}`);

  const allTrendPages = (await queryDatabase(db.trends, {
    filter: { property: 'Status', select: { equals: STATUS_PUBLISHED } },
    sorts: [{ property: 'Sort Order', direction: 'ascending' }]
  })).filter((page) => isPublished(page) && relationIds(page, 'Week').includes(selectedWeek.id));

  const trendIds = new Set(allTrendPages.map((page) => page.id));
  const evidencePages = (await queryDatabase(db.evidence, {
    filter: { property: 'Status', select: { equals: STATUS_PUBLISHED } }
  })).filter((page) => isPublished(page) && relationIds(page, 'Trend').some((id) => trendIds.has(id)));
  const ideaPages = (await queryDatabase(db.ideas, {
    filter: { property: 'Status', select: { equals: STATUS_PUBLISHED } }
  })).filter((page) => isPublished(page) && relationIds(page, 'Trend').some((id) => trendIds.has(id)));

  const evidenceByTrend = new Map();
  for (const page of evidencePages) {
    for (const trendId of relationIds(page, 'Trend')) {
      if (!evidenceByTrend.has(trendId)) evidenceByTrend.set(trendId, []);
      evidenceByTrend.get(trendId).push(evidenceFromPage(page));
    }
  }

  const ideasByTrend = new Map();
  for (const page of ideaPages) {
    const mode = select(page, 'Mode');
    if (mode !== 'stable' && mode !== 'aggressive') continue;
    for (const trendId of relationIds(page, 'Trend')) {
      if (!ideasByTrend.has(trendId)) ideasByTrend.set(trendId, {});
      ideasByTrend.get(trendId)[mode] = ideaFromPage(page);
    }
  }

  const trends = allTrendPages.map((page) => ({
    id: richText(page, 'Trend ID'),
    name: title(page),
    summary: richText(page, 'Summary'),
    keywords: multiSelect(page, 'Keywords'),
    channels: multiSelect(page, 'Channels'),
    categories: multiSelect(page, 'Categories'),
    promotionTypes: multiSelect(page, 'Promotion Types'),
    modeBias: select(page, 'Mode Bias') === 'aggressive' ? 'aggressive' : 'stable',
    scores: {
      momentum: clampScore(number(page, 'Momentum')),
      onstyleFit: clampScore(number(page, 'OnStyle Fit')),
      risk: clampScore(number(page, 'Risk'))
    },
    evidence: evidenceByTrend.get(page.id) || [],
    aiInterpretation: {
      consumerInsight: richText(page, 'AI Consumer Insight') || 'Notion DB에 고객 인사이트를 입력하면 웹에 표시됩니다.',
      opportunity: richText(page, 'AI Opportunity') || 'Notion DB에 적용 기회를 입력하면 웹에 표시됩니다.',
      caution: richText(page, 'AI Caution') || 'Notion DB에 주의사항을 입력하면 웹에 표시됩니다.'
    },
    ideas: ideasByTrend.get(page.id) || {}
  }));

  const weekId = richText(selectedWeek, 'Week ID');
  const dataset = {
    weekId,
    label: richText(selectedWeek, 'Label'),
    status: select(selectedWeek, 'Status'),
    generatedAt: new Date().toISOString(),
    source: 'notion',
    sourceSummary: buildSourceSummary(trends),
    trends
  };

  const errors = validateDataset(dataset);
  if (errors.length > 0) throw new Error(`Generated dataset is invalid: ${errors.join(', ')}`);

  const publicDataDir = path.join(ROOT, 'public', 'data');
  const trendsDir = path.join(publicDataDir, 'trends');
  await fs.mkdir(trendsDir, { recursive: true });

  const weeksManifest = publishedWeeks.map((week) => ({
    weekId: richText(week, 'Week ID'),
    label: richText(week, 'Label'),
    status: select(week, 'Status'),
    startDate: dateStart(week, 'Start Date'),
    endDate: dateStart(week, 'End Date'),
    file: `./data/trends/${richText(week, 'Week ID')}.json`,
    isLatest: week.id === selectedWeek.id
  }));

  await fs.writeFile(path.join(publicDataDir, 'weeks.json'), JSON.stringify(weeksManifest, null, 2) + '\n', 'utf8');
  await fs.writeFile(path.join(trendsDir, `${weekId}.json`), JSON.stringify(dataset, null, 2) + '\n', 'utf8');
  await fs.writeFile(path.join(trendsDir, 'latest.json'), JSON.stringify(dataset, null, 2) + '\n', 'utf8');

  console.log(`Synced ${trends.length} trends, ${evidencePages.length} evidence items, ${ideaPages.length} ideas from Notion week ${weekId}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
