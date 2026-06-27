const TRACKING_QUERY_PREFIXES = ['utm_'];
const TRACKING_QUERY_KEYS = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'gbraid',
  'wbraid',
  'mc_cid',
  'mc_eid',
  'igshid',
  'spm',
  'mkt_tok',
  'yclid'
]);
const XML_ENTITY_MAP = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' '
};
const KOREAN_PARTICLE_SUFFIX = /(?:으로|로|에서|에게|부터|까지|보다|처럼|만큼|은|는|이|가|을|를|의|에|와|과|도|만)$/u;

export function stripHtml(value = '') {
  return decodeXml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function decodeXml(value = '') {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, key) => XML_ENTITY_MAP[key.toLowerCase()] ?? match);
}

function firstTag(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match ? decodeXml(match[1]).trim() : '';
}

function firstTagAttribute(block, tagName, attributeName) {
  const match = block.match(new RegExp(`<${tagName}\\s+[^>]*${attributeName}=["']([^"']+)["'][^>]*>`, 'i'));
  return match ? decodeXml(match[1]).trim() : '';
}

export function canonicalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const url = new URL(decodeXml(rawUrl.trim()));
    if (!url.protocol.startsWith('http')) return '';

    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    url.hash = '';

    for (const key of Array.from(url.searchParams.keys())) {
      const lower = key.toLowerCase();
      if (TRACKING_QUERY_KEYS.has(lower) || TRACKING_QUERY_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
        url.searchParams.delete(key);
      }
    }

    const sorted = Array.from(url.searchParams.entries()).sort(([aKey, aValue], [bKey, bValue]) => {
      const keyCompare = aKey.localeCompare(bKey);
      return keyCompare || aValue.localeCompare(bValue);
    });
    url.search = '';
    for (const [key, value] of sorted) url.searchParams.append(key, value);

    return url.toString();
  } catch {
    return '';
  }
}

export function parseRssItems(xml, { fallbackSource = 'RSS', sourceHint = '', type = '기사' } = {}) {
  if (!xml || typeof xml !== 'string') return [];
  const blocks = Array.from(xml.matchAll(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi)).map((match) => match[0]);

  return blocks
    .map((block) => {
      const rawLink = firstTag(block, 'link') || firstTag(block, 'guid');
      const published = firstTag(block, 'pubDate') || firstTag(block, 'published') || firstTag(block, 'updated');
      const parsedDate = published ? new Date(published) : undefined;
      const source = firstTag(block, 'source') || firstTag(block, 'dc:creator') || firstTag(block, 'author') || fallbackSource;
      const description = stripHtml(firstTag(block, 'description') || firstTag(block, 'content:encoded'));
      const link = canonicalizeUrl(rawLink);

      return {
        title: stripHtml(firstTag(block, 'title')),
        link,
        canonicalUrl: link,
        publishedAt: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : '',
        source: stripHtml(source) || fallbackSource,
        sourceUrl: firstTagAttribute(block, 'source', 'url'),
        sourceHint,
        description,
        type
      };
    })
    .filter((item) => item.title && item.link);
}

export function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^0-9a-z가-힣]+/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function termVariants(term) {
  const normalized = normalizeText(term);
  if (!normalized) return [];
  const terms = new Set([normalized]);
  for (const part of normalized.split(' ')) {
    if (part.length >= 2) terms.add(part.replace(KOREAN_PARTICLE_SUFFIX, ''));
  }
  return Array.from(terms).filter((value) => value.length >= 2);
}

function trendTerms(trend) {
  return [
    trend.name,
    trend.summary,
    ...(trend.keywords || []),
    ...(trend.hints || []),
    ...(trend.categories || []),
    ...(trend.promotionTypes || [])
  ].filter(Boolean);
}

export function matchTrendCandidate(item, trends = []) {
  if (!trends.length) return null;
  const haystack = normalizeText([
    item.title,
    item.description,
    item.source
  ].filter(Boolean).join(' '));

  let best = null;
  for (const trend of trends) {
    const matchedTerms = [];
    let score = 0;
    for (const rawTerm of trendTerms(trend)) {
      for (const term of termVariants(rawTerm)) {
        if (!term || matchedTerms.includes(term)) continue;
        if (haystack.includes(term)) {
          matchedTerms.push(term);
          score += (trend.keywords || []).some((keyword) => termVariants(keyword).includes(term)) ? 5 : 2;
        }
      }
    }
    if (trend.name && haystack.includes(normalizeText(trend.name))) score += 4;
    const candidate = { trend, score, matchedTerms };
    if (!best || candidate.score > best.score) best = candidate;
  }

  if (best && best.score > 0) return best;
  return { trend: trends[0], score: 0, matchedTerms: [], fallback: true };
}

function stripPublisherSuffix(title = '', source = '') {
  const cleanTitle = String(title || '').trim();
  const cleanSource = String(source || '').trim();
  if (!cleanTitle || !cleanSource) return cleanTitle;
  const suffixes = [` - ${cleanSource}`, ` | ${cleanSource}`, ` :: ${cleanSource}`];
  return suffixes.reduce((value, suffix) => value.endsWith(suffix) ? value.slice(0, -suffix.length).trim() : value, cleanTitle);
}

export function signalFingerprint(item = {}) {
  const source = normalizeText(item.source || item.collectorSource || '');
  const title = normalizeText(stripPublisherSuffix(item.title || '', item.source || item.collectorSource || ''));
  if (!title) return '';
  return `${source || 'unknown'}::${title}`;
}

export function dedupeSignals(items = []) {
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    const canonicalUrl = item.canonicalUrl || canonicalizeUrl(item.link || item.url);
    const fingerprint = signalFingerprint(item);
    const keys = [canonicalUrl ? `url:${canonicalUrl}` : '', fingerprint ? `fingerprint:${fingerprint}` : ''].filter(Boolean);
    if (!keys.length || keys.some((key) => seen.has(key))) continue;
    for (const key of keys) seen.add(key);
    unique.push({ ...item, canonicalUrl, link: item.link || canonicalUrl, fingerprint });
  }
  return unique;
}

export function interleaveSignals(items = [], limit = 20) {
  const groups = new Map();
  for (const item of items) {
    const key = item.collectorSource || item.source || 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const orderedGroups = Array.from(groups.values());
  const output = [];
  let index = 0;
  while (output.length < limit && orderedGroups.some((group) => index < group.length)) {
    for (const group of orderedGroups) {
      if (output.length >= limit) break;
      if (group[index]) output.push(group[index]);
    }
    index += 1;
  }
  return output;
}

function existingWithinDedupeWindow(existing = {}, item = {}) {
  const windowDays = Number(item.dedupeWindowDays || 0);
  if (!windowDays || !existing.evidenceDate) return false;
  const existingTime = new Date(existing.evidenceDate).getTime();
  if (Number.isNaN(existingTime)) return false;
  const ageMs = Date.now() - existingTime;
  return ageMs >= 0 && ageMs <= windowDays * 24 * 60 * 60 * 1000;
}

function planForExisting(existing, item, canonicalUrl, status, reasonPrefix = '') {
  if (existing.status === 'Published' && status !== 'Published') {
    return {
      action: 'skip',
      reason: `${reasonPrefix}existing Evidence Item is Published; refusing to downgrade to Draft`,
      pageId: existing.pageId,
      existing,
      item: { ...item, canonicalUrl }
    };
  }

  if (existing.status === 'Archived') {
    return {
      action: 'skip',
      reason: `${reasonPrefix}existing Evidence Item is Archived`,
      pageId: existing.pageId,
      existing,
      item: { ...item, canonicalUrl }
    };
  }

  if (existingWithinDedupeWindow(existing, item)) {
    return {
      action: 'skip',
      reason: `${reasonPrefix}existing Evidence Item is within ${item.dedupeWindowDays}d dedupe window`,
      pageId: existing.pageId,
      existing,
      item: { ...item, canonicalUrl }
    };
  }

  return { action: 'update', pageId: existing.pageId, existing, item: { ...item, canonicalUrl }, status };
}

export function buildUpsertPlan(items = [], existingByCanonicalUrl = new Map(), { status = 'Draft', existingByFingerprint = new Map(), minMatchScore = 0 } = {}) {
  const seen = new Set();
  return items.map((item) => {
    const canonicalUrl = item.canonicalUrl || canonicalizeUrl(item.link || item.url);
    const fingerprint = item.fingerprint || signalFingerprint(item);
    const itemWithKeys = { ...item, canonicalUrl, fingerprint };
    if (!canonicalUrl) return { action: 'skip', reason: 'missing canonical URL', item };
    const collectionKeys = [canonicalUrl ? `url:${canonicalUrl}` : '', fingerprint ? `fingerprint:${fingerprint}` : ''].filter(Boolean);
    const duplicateKey = collectionKeys.find((key) => seen.has(key));
    if (duplicateKey) return { action: 'skip', reason: `duplicate signal in collection: ${duplicateKey}`, item: itemWithKeys };
    for (const key of collectionKeys) seen.add(key);

    if (!item.trendMatch?.trend?.pageId && !item.trend?.pageId) {
      return { action: 'skip', reason: 'missing trend match', item: itemWithKeys };
    }

    if (status === 'Published') {
      const match = item.trendMatch;
      if (match?.fallback) return { action: 'skip', reason: 'fallback trend match is not publishable', item: itemWithKeys };
      if (Number(match?.score || 0) < minMatchScore) {
        return { action: 'skip', reason: `match score ${Number(match?.score || 0)} is below publish threshold ${minMatchScore}`, item: itemWithKeys };
      }
    }

    const existing = existingByCanonicalUrl.get(canonicalUrl);
    if (existing) return planForExisting(existing, { ...item, fingerprint }, canonicalUrl, status);

    const existingBySameFingerprint = fingerprint ? existingByFingerprint.get(fingerprint) : undefined;
    if (existingBySameFingerprint) {
      return planForExisting(existingBySameFingerprint, { ...item, fingerprint }, canonicalUrl, status, 'same title/source fingerprint already exists; ');
    }

    return { action: 'create', item: itemWithKeys, status };
  });
}

export function compactSummary(value, maxLength = 240) {
  const clean = stripHtml(value || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}…`;
}
