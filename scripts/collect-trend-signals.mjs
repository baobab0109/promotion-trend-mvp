import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  buildUpsertPlan,
  canonicalizeUrl,
  compactSummary,
  dedupeSignals,
  interleaveSignals,
  matchTrendCandidate,
  parseRssItems,
  stripHtml
} from './lib/trend-signal-utils.mjs';

const ROOT = process.cwd();
const NOTION_VERSION = '2022-06-28';
const DEFAULT_STATUS = 'Draft';
const STATUS_PUBLISHED = 'Published';
const SOURCE_CONFIG_PATH = path.join(ROOT, 'config', 'trend-signal-sources.json');
const NOTION_CONFIG_PATH = path.join(ROOT, 'config', 'notion-data-sources.json');
const STATIC_LATEST_PATH = path.join(ROOT, 'public', 'data', 'trends', 'latest.json');

function parseArgs(argv) {
  const options = { dryRun: false, limit: 20, status: DEFAULT_STATUS, json: false };
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--json') options.json = true;
    else if (arg.startsWith('--limit=')) options.limit = Math.max(1, Number.parseInt(arg.split('=')[1], 10) || options.limit);
    else if (arg.startsWith('--status=')) options.status = arg.split('=')[1] || DEFAULT_STATUS;
  }
  return options;
}

async function loadDotEnv() {
  const candidates = [
    path.join(ROOT, '.env'),
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

async function loadNotionConfig() {
  const config = JSON.parse(await fs.readFile(NOTION_CONFIG_PATH, 'utf8'));
  return {
    weeks: process.env.NOTION_WEEKS_DATABASE_ID || config.databases.weeks,
    trends: process.env.NOTION_TRENDS_DATABASE_ID || config.databases.trends,
    evidence: process.env.NOTION_EVIDENCE_DATABASE_ID || config.databases.evidence
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
  if (!response.ok) throw new Error(`${method} ${pathname} failed: ${response.status} ${JSON.stringify(data)}`);
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

function dateStart(page, name) {
  return prop(page, name)?.date?.start || '';
}

function pageUrl(page, name) {
  return prop(page, name)?.url || '';
}

function relationIds(page, name) {
  return prop(page, name)?.relation?.map((item) => item.id) || [];
}

function isPublished(page) {
  return select(page, 'Status') === STATUS_PUBLISHED;
}

async function loadNotionContext() {
  const db = await loadNotionConfig();
  const publishedWeeks = (await queryDatabase(db.weeks, {
    filter: { property: 'Status', select: { equals: STATUS_PUBLISHED } },
    sorts: [{ property: 'Start Date', direction: 'descending' }]
  })).filter(isPublished);
  if (!publishedWeeks.length) throw new Error('No Published weeks found in Notion');

  const week = publishedWeeks[0];
  const trendPages = (await queryDatabase(db.trends, {
    filter: { property: 'Status', select: { equals: STATUS_PUBLISHED } },
    sorts: [{ property: 'Sort Order', direction: 'ascending' }]
  })).filter((page) => isPublished(page) && relationIds(page, 'Week').includes(week.id));

  if (!trendPages.length) throw new Error('No Published trend topics found for latest Published week');

  const trends = trendPages.map((page) => ({
    pageId: page.id,
    trendId: richText(page, 'Trend ID'),
    name: title(page),
    summary: richText(page, 'Summary'),
    keywords: multiSelect(page, 'Keywords'),
    categories: multiSelect(page, 'Categories'),
    promotionTypes: multiSelect(page, 'Promotion Types'),
    hints: [richText(page, 'AI Consumer Insight'), richText(page, 'AI Opportunity')].filter(Boolean)
  }));

  const evidencePages = await queryDatabase(db.evidence, {
    sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }]
  });
  const existingEvidence = new Map();
  for (const page of evidencePages) {
    const canonicalUrl = canonicalizeUrl(pageUrl(page, 'URL'));
    if (!canonicalUrl || existingEvidence.has(canonicalUrl)) continue;
    existingEvidence.set(canonicalUrl, {
      pageId: page.id,
      status: select(page, 'Status'),
      title: title(page),
      trendIds: relationIds(page, 'Trend')
    });
  }

  return {
    source: 'notion',
    db,
    week: {
      pageId: week.id,
      weekId: richText(week, 'Week ID'),
      label: richText(week, 'Label'),
      startDate: dateStart(week, 'Start Date')
    },
    trends,
    existingEvidence
  };
}

async function loadStaticContext() {
  const dataset = JSON.parse(await fs.readFile(STATIC_LATEST_PATH, 'utf8'));
  return {
    source: 'static-fallback',
    db: null,
    week: { weekId: dataset.weekId, label: dataset.label, pageId: dataset.weekId },
    trends: (dataset.trends || []).map((trend) => ({
      pageId: trend.id,
      trendId: trend.id,
      name: trend.name,
      summary: trend.summary,
      keywords: trend.keywords || [],
      categories: trend.categories || [],
      promotionTypes: trend.promotionTypes || [],
      hints: [trend.aiInterpretation?.consumerInsight, trend.aiInterpretation?.opportunity].filter(Boolean)
    })),
    existingEvidence: new Map()
  };
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'promotion-trend-mvp-signal-collector/1.0 (+public pages only)',
        Accept: 'text/html,application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8'
      }
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function googleNewsUrl(query) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
}

async function collectRssSource(source) {
  const url = source.url || googleNewsUrl(source.query);
  const xml = await fetchText(url);
  const lookbackDays = Number(source.lookbackDays || 0);
  const minTime = lookbackDays > 0 ? Date.now() - lookbackDays * 24 * 60 * 60 * 1000 : 0;
  const maxItems = Math.max(1, Number(source.maxItems || 3));
  const items = parseRssItems(xml, {
    fallbackSource: source.name,
    sourceHint: [source.query, ...(source.keywords || [])].filter(Boolean).join(' '),
    type: source.type || '기사'
  }).filter((item) => {
    if (!minTime || !item.publishedAt) return true;
    return new Date(item.publishedAt).getTime() >= minTime;
  }).sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
    .slice(0, maxItems);

  return items.map((item) => ({
    ...item,
    collectorSource: source.name,
    sourceHint: [item.sourceHint, source.name].filter(Boolean).join(' '),
    keywords: source.keywords || []
  }));
}

function htmlMatch(html, pattern) {
  const match = html.match(pattern);
  return match ? stripHtml(match[1]) : '';
}

function parseHtmlSignal(html, source) {
  const title = htmlMatch(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || htmlMatch(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["'][^>]*>/i)
    || htmlMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i)
    || source.name;
  const description = htmlMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || htmlMatch(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || source.description
    || `${source.name} 공개 프로모션 페이지`;

  const canonicalUrl = canonicalizeUrl(source.url);
  return {
    title,
    link: canonicalUrl,
    canonicalUrl,
    publishedAt: new Date().toISOString(),
    source: source.name,
    sourceHint: [source.name, source.description, ...(source.keywords || [])].filter(Boolean).join(' '),
    description,
    collectorSource: source.name,
    keywords: source.keywords || [],
    type: source.type || '경쟁사'
  };
}

async function collectCompetitorSource(source) {
  const html = await fetchText(source.url);
  return [parseHtmlSignal(html, source)];
}

async function collectSignals(sourceConfig) {
  const items = [];
  const sourceResults = [];
  const sources = [...(sourceConfig.rssFeeds || []), ...(sourceConfig.competitorPages || [])];

  for (const source of sources) {
    try {
      const collected = source.kind === 'competitor' || source.type === '경쟁사'
        ? await collectCompetitorSource(source)
        : await collectRssSource(source);
      items.push(...collected);
      sourceResults.push({ name: source.name, ok: true, count: collected.length });
    } catch (error) {
      sourceResults.push({ name: source.name, ok: false, count: 0, error: error.message });
    }
  }

  return { items, sourceResults };
}

function evidenceProperties(item, status) {
  const trend = item.trendMatch?.trend || item.trend;
  const evidenceDate = item.publishedAt && !Number.isNaN(new Date(item.publishedAt).getTime())
    ? new Date(item.publishedAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return {
    Name: { title: [{ text: { content: String(item.title || item.canonicalUrl).slice(0, 2000) } }] },
    Trend: { relation: [{ id: trend.pageId }] },
    Type: { select: { name: item.type || '기사' } },
    Source: { rich_text: [{ text: { content: String(item.source || item.collectorSource || '').slice(0, 2000) } }] },
    'Evidence Date': { date: { start: evidenceDate } },
    URL: { url: item.canonicalUrl },
    Summary: { rich_text: [{ text: { content: compactSummary(item.description || item.title || '', 500).slice(0, 2000) } }] },
    Status: { select: { name: status || DEFAULT_STATUS } }
  };
}

async function executePlan(plan, evidenceDatabaseId) {
  const results = [];
  for (const entry of plan) {
    if (entry.action === 'create') {
      const data = await notion('/pages', {
        method: 'POST',
        body: {
          parent: { database_id: evidenceDatabaseId },
          properties: evidenceProperties(entry.item, entry.status)
        }
      });
      results.push({ ...entry, pageId: data.id });
    } else if (entry.action === 'update') {
      const properties = evidenceProperties(entry.item, entry.status);
      await notion(`/pages/${entry.pageId}`, { method: 'PATCH', body: { properties } });
      results.push(entry);
    } else {
      results.push(entry);
    }
  }
  return results;
}

function summarizePlan(plan) {
  return plan.reduce((acc, entry) => {
    acc[entry.action] = (acc[entry.action] || 0) + 1;
    return acc;
  }, { create: 0, update: 0, skip: 0 });
}

function publicPlanEntry(entry) {
  return {
    action: entry.action,
    reason: entry.reason,
    pageId: entry.pageId,
    title: entry.item?.title,
    url: entry.item?.canonicalUrl,
    type: entry.item?.type,
    source: entry.item?.source,
    trend: entry.item?.trendMatch?.trend?.name,
    trendId: entry.item?.trendMatch?.trend?.trendId,
    matchScore: entry.item?.trendMatch?.score,
    matchedTerms: entry.item?.trendMatch?.matchedTerms
  };
}

function printHuman(result) {
  console.log(`Trend signal collection ${result.dryRun ? 'dry-run' : 'write'} complete.`);
  console.log(`Context: ${result.contextSource}, week=${result.week.weekId || result.week.label}, status=${result.status}`);
  console.log(`Sources: ${result.sourceResults.filter((item) => item.ok).length}/${result.sourceResults.length} ok, collected=${result.totals.collected}, limited=${result.totals.limited}`);
  console.log(`Plan: create=${result.totals.create}, update=${result.totals.update}, skip=${result.totals.skip}`);
  for (const source of result.sourceResults.filter((item) => !item.ok)) {
    console.log(`Source error: ${source.name} - ${source.error}`);
  }
  for (const entry of result.plan.slice(0, 10)) {
    console.log(`- [${entry.action}] ${entry.title} -> ${entry.trend || 'no trend'} (${entry.url})${entry.reason ? ` / ${entry.reason}` : ''}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await loadDotEnv();

  if (!['Draft', 'Published'].includes(options.status)) {
    throw new Error('--status must be Draft or Published');
  }

  const sourceConfig = JSON.parse(await fs.readFile(SOURCE_CONFIG_PATH, 'utf8'));
  let context;
  const warnings = [];
  if (process.env.NOTION_API_KEY) {
    try {
      context = await loadNotionContext();
    } catch (error) {
      if (!options.dryRun) throw error;
      context = await loadStaticContext();
      warnings.push(`Notion context query failed in dry-run; used public/data/trends/latest.json fallback and assumed no existing Evidence Items. Reason: ${error.message}`);
    }
  } else if (options.dryRun) {
    context = await loadStaticContext();
    warnings.push('NOTION_API_KEY not found; dry-run used public/data/trends/latest.json as a local fallback and assumed no existing Evidence Items.');
  } else {
    throw new Error('NOTION_API_KEY is required unless --dry-run is used');
  }

  const { items, sourceResults } = await collectSignals(sourceConfig);
  const matchedItems = interleaveSignals(dedupeSignals(items), options.limit).map((item) => ({
    ...item,
    trendMatch: matchTrendCandidate(item, context.trends)
  }));

  const plan = buildUpsertPlan(matchedItems, context.existingEvidence, { status: options.status });
  const executedPlan = options.dryRun ? plan : await executePlan(plan, context.db.evidence);
  const counts = summarizePlan(executedPlan);
  const publicPlan = executedPlan.map(publicPlanEntry);
  const result = {
    dryRun: options.dryRun,
    status: options.status,
    limit: options.limit,
    contextSource: context.source,
    week: context.week,
    warnings,
    sourceResults,
    totals: {
      sources: sourceResults.length,
      sourceErrors: sourceResults.filter((item) => !item.ok).length,
      collected: items.length,
      limited: matchedItems.length,
      ...counts
    },
    samples: publicPlan.slice(0, Math.min(5, publicPlan.length)),
    plan: publicPlan
  };

  if (options.json) console.log(JSON.stringify(result, null, 2));
  else printHuman(result);
}

main().catch((error) => {
  const wantsJson = process.argv.includes('--json');
  if (wantsJson) console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  else console.error(error.message);
  process.exit(1);
});
