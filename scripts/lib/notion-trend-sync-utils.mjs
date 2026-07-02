function prop(page, name) {
  return page.properties?.[name];
}

export function title(page, name = 'Name') {
  return prop(page, name)?.title?.map((item) => item.plain_text).join('')?.trim() || '';
}

export function richText(page, name) {
  return prop(page, name)?.rich_text?.map((item) => item.plain_text).join('')?.trim() || '';
}

export function dateStart(page, name) {
  return prop(page, name)?.date?.start || '';
}

export function relationIds(page, name) {
  return prop(page, name)?.relation?.map((item) => item.id) || [];
}

function selectedWeekDateRange(selectedWeek) {
  return {
    startDate: selectedWeek.startDate || dateStart(selectedWeek, 'Start Date'),
    endDate: selectedWeek.endDate || dateStart(selectedWeek, 'End Date')
  };
}

export function isDateWithinInclusiveRange(date, startDate, endDate) {
  if (!date || !startDate || !endDate) return false;
  return date >= startDate && date <= endDate;
}

function publicEvidenceId(page) {
  const seed = [
    prop(page, 'Type')?.select?.name || '',
    title(page),
    richText(page, 'Source'),
    dateStart(page, 'Evidence Date'),
    prop(page, 'URL')?.url || '',
    richText(page, 'Summary')
  ].join('|');
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `ev_${(hash >>> 0).toString(36)}`;
}

export function evidenceFromPage(page) {
  return {
    id: publicEvidenceId(page),
    type: prop(page, 'Type')?.select?.name || '',
    title: title(page),
    source: richText(page, 'Source'),
    date: dateStart(page, 'Evidence Date'),
    url: prop(page, 'URL')?.url || '',
    summary: richText(page, 'Summary')
  };
}

export function buildTrendIdIndexes({ allTrendPages = [], selectedTrendPages = [] } = {}) {
  const trendKeyByPageId = new Map();
  for (const page of allTrendPages) {
    const trendKey = richText(page, 'Trend ID');
    if (page?.id && trendKey) trendKeyByPageId.set(page.id, trendKey);
  }

  const selectedPageIdByTrendKey = new Map();
  for (const page of selectedTrendPages) {
    const trendKey = richText(page, 'Trend ID');
    if (page?.id && trendKey && !selectedPageIdByTrendKey.has(trendKey)) {
      selectedPageIdByTrendKey.set(trendKey, page.id);
    }
  }

  return { trendKeyByPageId, selectedPageIdByTrendKey };
}

export function filterTrendPagesWithEvidence(selectedTrendPages = [], evidenceByTrend = new Map()) {
  return selectedTrendPages.filter((page) => (evidenceByTrend.get(page.id) || []).length > 0);
}

export function partitionEvidenceBySelectedWeekTrend({
  evidencePages = [],
  allTrendPages = [],
  selectedTrendPages = [],
  selectedWeek
} = {}) {
  const { startDate, endDate } = selectedWeekDateRange(selectedWeek || {});
  const { trendKeyByPageId, selectedPageIdByTrendKey } = buildTrendIdIndexes({ allTrendPages, selectedTrendPages });
  const evidenceByTrend = new Map();
  const attachedEvidencePages = [];
  const attachedEvidencePageIds = new Set();
  const attachedPairs = new Set();

  for (const page of evidencePages) {
    const evidenceDate = dateStart(page, 'Evidence Date');
    if (!isDateWithinInclusiveRange(evidenceDate, startDate, endDate)) continue;

    for (const linkedTrendPageId of relationIds(page, 'Trend')) {
      const trendKey = trendKeyByPageId.get(linkedTrendPageId);
      const selectedTrendPageId = trendKey ? selectedPageIdByTrendKey.get(trendKey) : undefined;
      if (!selectedTrendPageId) continue;

      const pairKey = `${page.id}:${selectedTrendPageId}`;
      if (attachedPairs.has(pairKey)) continue;
      attachedPairs.add(pairKey);

      if (!evidenceByTrend.has(selectedTrendPageId)) evidenceByTrend.set(selectedTrendPageId, []);
      evidenceByTrend.get(selectedTrendPageId).push(evidenceFromPage(page));

      if (!attachedEvidencePageIds.has(page.id)) {
        attachedEvidencePages.push(page);
        attachedEvidencePageIds.add(page.id);
      }
    }
  }

  return { evidenceByTrend, attachedEvidencePages };
}
