import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { planMissingCompletedWeeks } from './lib/weekly-rollover-utils.mjs';

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, 'config', 'notion-data-sources.json');
const NOTION_VERSION = '2022-06-28';
const STATUS_PUBLISHED = 'Published';
const MODE_ORDER = ['stable', 'aggressive'];

function parseArgs(argv = process.argv.slice(2)) {
  return {
    dryRun: argv.includes('--dry-run'),
    json: argv.includes('--json'),
    now: argv.find((arg) => arg.startsWith('--now='))?.split('=')[1]
  };
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

async function loadConfig() {
  const config = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf8'));
  return {
    weeks: process.env.NOTION_WEEKS_DATABASE_ID || config.databases.weeks,
    trends: process.env.NOTION_TRENDS_DATABASE_ID || config.databases.trends,
    evidence: process.env.NOTION_EVIDENCE_DATABASE_ID || config.databases.evidence,
    ideas: process.env.NOTION_IDEAS_DATABASE_ID || config.databases.ideas
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function notion(pathname, { method = 'GET', body, retries = 3 } = {}) {
  const key = process.env.NOTION_API_KEY;
  if (!key) throw new Error('NOTION_API_KEY is required');
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
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
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(800 * attempt);
    }
  }
  throw lastError;
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

function prop(page, name) { return page.properties?.[name]; }
function title(page, name = 'Name') { return prop(page, name)?.title?.map((item) => item.plain_text).join('')?.trim() || ''; }
function richText(page, name) { return prop(page, name)?.rich_text?.map((item) => item.plain_text).join('')?.trim() || ''; }
function select(page, name) { return prop(page, name)?.select?.name || ''; }
function multiSelect(page, name) { return prop(page, name)?.multi_select?.map((item) => item.name).filter(Boolean) || []; }
function number(page, name, fallback = 0) { const value = prop(page, name)?.number; return typeof value === 'number' ? value : fallback; }
function dateStart(page, name) { return prop(page, name)?.date?.start || ''; }
function relationIds(page, name) { return prop(page, name)?.relation?.map((item) => item.id) || []; }

function richTextProp(value) { return { rich_text: [{ text: { content: String(value || '').slice(0, 1900) } }] }; }
function titleProp(value) { return { title: [{ text: { content: String(value || '').slice(0, 1900) } }] }; }
function selectProp(value) { return { select: { name: value } }; }
function multiSelectProp(values = []) { return { multi_select: values.filter(Boolean).map((name) => ({ name })) }; }
function numberProp(value) { return { number: value }; }
function dateProp(value) { return { date: { start: value } }; }
function relationProp(id) { return { relation: id ? [{ id }] : [] }; }

function weekSummary(page) {
  return {
    pageId: page.id,
    weekId: richText(page, 'Week ID'),
    label: richText(page, 'Label'),
    status: select(page, 'Status'),
    startDate: dateStart(page, 'Start Date'),
    endDate: dateStart(page, 'End Date')
  };
}

function trendPropertiesFromPage(page, targetWeekPageId) {
  return {
    Name: titleProp(title(page)),
    Week: relationProp(targetWeekPageId),
    'Trend ID': richTextProp(richText(page, 'Trend ID')),
    Summary: richTextProp(richText(page, 'Summary')),
    Status: selectProp(STATUS_PUBLISHED),
    Keywords: multiSelectProp(multiSelect(page, 'Keywords')),
    Channels: multiSelectProp(multiSelect(page, 'Channels')),
    Categories: multiSelectProp(multiSelect(page, 'Categories')),
    'Promotion Types': multiSelectProp(multiSelect(page, 'Promotion Types')),
    'Mode Bias': selectProp(select(page, 'Mode Bias') || 'stable'),
    Momentum: numberProp(number(page, 'Momentum')),
    'OnStyle Fit': numberProp(number(page, 'OnStyle Fit')),
    Risk: numberProp(number(page, 'Risk')),
    'Sort Order': numberProp(number(page, 'Sort Order')),
    'AI Consumer Insight': richTextProp(richText(page, 'AI Consumer Insight')),
    'AI Opportunity': richTextProp(richText(page, 'AI Opportunity')),
    'AI Caution': richTextProp(richText(page, 'AI Caution'))
  };
}

function ideaPropertiesFromPage(page, targetTrendPageId) {
  return {
    Name: titleProp(title(page)),
    Trend: relationProp(targetTrendPageId),
    Mode: selectProp(select(page, 'Mode')),
    Status: selectProp(STATUS_PUBLISHED),
    Concept: richTextProp(richText(page, 'Concept')),
    Target: richTextProp(richText(page, 'Target')),
    Category: richTextProp(richText(page, 'Category')),
    Benefit: richTextProp(richText(page, 'Benefit')),
    Message: richTextProp(richText(page, 'Message')),
    Channels: multiSelectProp(multiSelect(page, 'Channels')),
    'Expected Effect': richTextProp(richText(page, 'Expected Effect')),
    Risk: richTextProp(richText(page, 'Risk')),
    Buzz: selectProp(select(page, 'Buzz') || '중간'),
    Difficulty: selectProp(select(page, 'Difficulty') || '중간'),
    'Banner Copy': richTextProp(richText(page, 'Banner Copy')),
    'Push Copy': richTextProp(richText(page, 'Push Copy')),
    'Live Copy': richTextProp(richText(page, 'Live Copy')),
    Checklist: richTextProp(richText(page, 'Checklist')),
    Teams: multiSelectProp(multiSelect(page, 'Teams'))
  };
}

async function createPage(databaseId, properties, dryRun) {
  if (dryRun) return { id: `dry-run-${Math.random().toString(36).slice(2)}` };
  const page = await notion('/pages', { method: 'POST', body: { parent: { database_id: databaseId }, properties } });
  await sleep(350);
  return page;
}

async function patchPage(pageId, properties, dryRun) {
  if (dryRun) return;
  await notion(`/pages/${pageId}`, { method: 'PATCH', body: { properties } });
  await sleep(350);
}

async function loadTrendPages(db, weekPageId, { publishedOnly = true } = {}) {
  return (await queryDatabase(db.trends, {
    sorts: [{ property: 'Sort Order', direction: 'ascending' }]
  })).filter((page) => relationIds(page, 'Week').includes(weekPageId)
    && (!publishedOnly || select(page, 'Status') === STATUS_PUBLISHED));
}

async function loadIdeaPages(db, trendPageIds, { publishedOnly = true } = {}) {
  const trendSet = new Set(trendPageIds);
  return (await queryDatabase(db.ideas, {})).filter((page) => relationIds(page, 'Trend').some((id) => trendSet.has(id))
    && (!publishedOnly || select(page, 'Status') === STATUS_PUBLISHED));
}

function weekProperties(targetWeek, status) {
  return {
    Name: titleProp(targetWeek.weekId),
    'Week ID': richTextProp(targetWeek.weekId),
    Label: richTextProp(targetWeek.label),
    Status: selectProp(status),
    'Start Date': dateProp(targetWeek.startDate),
    'End Date': dateProp(targetWeek.endDate)
  };
}

async function ensureWeekPage(db, targetWeek, existingByWeekId, dryRun) {
  const existing = existingByWeekId.get(targetWeek.weekId);

  if (existing) {
    await patchPage(existing.id, weekProperties(targetWeek, 'Draft'), dryRun);
    return { page: existing, action: 'existing' };
  }

  const page = await createPage(db.weeks, weekProperties(targetWeek, 'Draft'), dryRun);
  return { page, action: 'created' };
}

async function loadSourceTemplate(db, sourceWeekPage) {
  const sourceTrends = await loadTrendPages(db, sourceWeekPage.id, { publishedOnly: true });
  const sourceTrendIds = sourceTrends.map((page) => page.id);
  const sourceIdeas = await loadIdeaPages(db, sourceTrendIds, { publishedOnly: true });
  const sourceIdeasByTrendMode = new Map();
  for (const page of sourceIdeas) {
    const trendId = relationIds(page, 'Trend').find((id) => sourceTrendIds.includes(id));
    const mode = select(page, 'Mode');
    if (trendId && MODE_ORDER.includes(mode)) sourceIdeasByTrendMode.set(`${trendId}:${mode}`, page);
  }

  const missingSourceIdeas = [];
  for (const sourceTrend of sourceTrends) {
    const trendId = richText(sourceTrend, 'Trend ID');
    for (const mode of MODE_ORDER) {
      if (!sourceIdeasByTrendMode.has(`${sourceTrend.id}:${mode}`)) missingSourceIdeas.push({ trendId, mode });
    }
  }

  return { sourceTrends, sourceIdeasByTrendMode, missingSourceIdeas };
}

async function cloneWeeklyTemplate(db, sourceTemplate, targetWeekPage, dryRun) {
  const { sourceTrends, sourceIdeasByTrendMode } = sourceTemplate;
  const targetTrends = await loadTrendPages(db, targetWeekPage.id, { publishedOnly: false });
  const targetTrendByTrendId = new Map(targetTrends.map((page) => [richText(page, 'Trend ID'), page]));

  const result = {
    sourceTrendCount: sourceTrends.length,
    createdTrends: 0,
    reusedTrends: 0,
    createdIdeas: 0,
    reusedIdeas: 0,
    missingSourceIdeas: []
  };

  for (const sourceTrend of sourceTrends) {
    const trendId = richText(sourceTrend, 'Trend ID');
    let targetTrend = targetTrendByTrendId.get(trendId);
    if (!targetTrend) {
      targetTrend = await createPage(db.trends, trendPropertiesFromPage(sourceTrend, targetWeekPage.id), dryRun);
      result.createdTrends += 1;
    } else {
      await patchPage(targetTrend.id, trendPropertiesFromPage(sourceTrend, targetWeekPage.id), dryRun);
      result.reusedTrends += 1;
    }

    const currentTargetIdeas = await loadIdeaPages(db, [targetTrend.id], { publishedOnly: false });
    const targetIdeaByMode = new Map(currentTargetIdeas.map((page) => [select(page, 'Mode'), page]).filter(([mode]) => mode));
    for (const mode of MODE_ORDER) {
      const sourceIdea = sourceIdeasByTrendMode.get(`${sourceTrend.id}:${mode}`);
      if (!sourceIdea) {
        result.missingSourceIdeas.push({ trendId, mode });
        continue;
      }
      const targetIdea = targetIdeaByMode.get(mode);
      if (targetIdea) {
        await patchPage(targetIdea.id, ideaPropertiesFromPage(sourceIdea, targetTrend.id), dryRun);
        result.reusedIdeas += 1;
        continue;
      }
      await createPage(db.ideas, ideaPropertiesFromPage(sourceIdea, targetTrend.id), dryRun);
      result.createdIdeas += 1;
    }
  }

  return result;
}

async function main() {
  const args = parseArgs();
  await loadDotEnv();
  const db = await loadConfig();
  const now = args.now ? new Date(args.now) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`Invalid --now value: ${args.now}`);

  const allWeekPages = await queryDatabase(db.weeks, {
    sorts: [{ property: 'Start Date', direction: 'ascending' }]
  });
  const weekSummaries = allWeekPages.map(weekSummary).filter((week) => week.weekId && week.startDate && week.endDate);
  const publishedWeekSummaries = weekSummaries.filter((week) => week.status === STATUS_PUBLISHED);
  if (!publishedWeekSummaries.length) throw new Error('No Published weeks found in Notion');

  const existingByWeekId = new Map(allWeekPages.map((page) => [richText(page, 'Week ID'), page]).filter(([weekId]) => weekId));
  const pageByWeekId = new Map(allWeekPages.map((page) => [richText(page, 'Week ID'), page]).filter(([weekId]) => weekId));
  const plannedWeeks = planMissingCompletedWeeks(publishedWeekSummaries, now);
  let sourceWeekSummary = publishedWeekSummaries.sort((a, b) => a.endDate.localeCompare(b.endDate)).at(-1);
  const results = [];

  for (const targetWeek of plannedWeeks) {
    const sourceWeekPage = pageByWeekId.get(sourceWeekSummary.weekId);
    if (!sourceWeekPage) throw new Error(`Source week page not found: ${sourceWeekSummary.weekId}`);

    const sourceTemplate = await loadSourceTemplate(db, sourceWeekPage);
    if (sourceTemplate.missingSourceIdeas.length) {
      throw new Error(`Source week ${sourceWeekSummary.weekId} is not clone-ready: ${JSON.stringify(sourceTemplate.missingSourceIdeas)}`);
    }

    const { page: targetWeekPage, action: weekAction } = await ensureWeekPage(db, targetWeek, existingByWeekId, args.dryRun);
    const cloneResult = await cloneWeeklyTemplate(db, sourceTemplate, targetWeekPage, args.dryRun);
    if (cloneResult.missingSourceIdeas.length) {
      throw new Error(`Weekly rollover for ${targetWeek.weekId} missed source ideas: ${JSON.stringify(cloneResult.missingSourceIdeas)}`);
    }
    await patchPage(targetWeekPage.id, weekProperties(targetWeek, STATUS_PUBLISHED), args.dryRun);
    results.push({ week: targetWeek, weekAction, ...cloneResult });

    pageByWeekId.set(targetWeek.weekId, targetWeekPage);
    existingByWeekId.set(targetWeek.weekId, targetWeekPage);
    sourceWeekSummary = targetWeek;
  }

  const summary = {
    dryRun: args.dryRun,
    now: now.toISOString(),
    plannedWeeks: plannedWeeks.map((week) => week.weekId),
    results
  };

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else if (plannedWeeks.length) {
    for (const result of results) {
      console.log(`Ensured ${result.week.weekId}: week=${result.weekAction}, trends created/reused=${result.createdTrends}/${result.reusedTrends}, ideas created/reused=${result.createdIdeas}/${result.reusedIdeas}`);
    }
  } else {
    console.log('No weekly rollover needed.');
  }

  const missingIdeas = results.flatMap((result) => result.missingSourceIdeas);
  if (missingIdeas.length) {
    console.error(`Missing source ideas for weekly rollover: ${JSON.stringify(missingIdeas)}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
