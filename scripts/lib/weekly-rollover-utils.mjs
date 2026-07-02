const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function parseDateUtc(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`Invalid YYYY-MM-DD date: ${value}`);
  const [, year, month, day] = match.map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatDateUtc(value) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLabel(startDate, endDate) {
  return `${startDate.replaceAll('-', '.')} - ${endDate.replaceAll('-', '.')}`;
}

function addDays(dateString, days) {
  return formatDateUtc(parseDateUtc(dateString) + days * DAY_MS);
}

function kstDateString(now = new Date()) {
  return formatDateUtc(now.getTime() + KST_OFFSET_MS);
}

function incrementWeekId(previousWeekId, nextStartDate) {
  const match = String(previousWeekId || '').match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) throw new Error(`Invalid Week ID: ${previousWeekId}`);

  const previousYear = Number(match[1]);
  const previousNumber = Number(match[2]);
  const nextStartYear = Number(nextStartDate.slice(0, 4));
  const nextNumber = nextStartYear > previousYear && previousNumber >= 52 ? 1 : previousNumber + 1;
  return `${nextStartYear}-W${String(nextNumber).padStart(2, '0')}`;
}

export function buildNextWeek(previousWeek) {
  if (!previousWeek?.weekId || !previousWeek?.endDate) {
    throw new Error('previousWeek.weekId and previousWeek.endDate are required');
  }

  const startDate = addDays(previousWeek.endDate, 1);
  const endDate = addDays(startDate, 6);
  const weekId = incrementWeekId(previousWeek.weekId, startDate);

  return {
    weekId,
    label: formatLabel(startDate, endDate),
    status: 'Published',
    startDate,
    endDate
  };
}

export function latestCompletedDate(now = new Date()) {
  return addDays(kstDateString(now), -1);
}

export function planMissingWeeksThroughCurrent(existingWeeks, now = new Date()) {
  const normalized = [...(existingWeeks || [])]
    .filter((week) => week?.weekId && week?.startDate && week?.endDate && (week.status || 'Published') === 'Published')
    .sort((a, b) => a.endDate.localeCompare(b.endDate));

  if (!normalized.length) return [];

  const existingPublishedIds = new Set(normalized.map((week) => week.weekId));
  const currentDate = kstDateString(now);
  const planned = [];
  let cursor = normalized.at(-1);

  for (let guard = 0; guard < 60; guard += 1) {
    const next = buildNextWeek(cursor);
    if (next.startDate > currentDate) break;

    if (!existingPublishedIds.has(next.weekId)) {
      planned.push(next);
      existingPublishedIds.add(next.weekId);
    }
    cursor = next;
  }

  return planned;
}

export function planMissingCompletedWeeks(existingWeeks, now = new Date()) {
  return planMissingWeeksThroughCurrent(existingWeeks, now);
}
