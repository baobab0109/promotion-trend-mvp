import type { FilterState, TrendTopic } from './types';

const ALL = '전체';

export function filterTrends(trends: TrendTopic[], filters: FilterState): TrendTopic[] {
  const query = filters.query.trim().toLowerCase();

  return trends.filter((trend) => {
    const haystack = [
      trend.name,
      trend.summary,
      ...trend.keywords,
      ...trend.channels,
      ...trend.categories,
      ...trend.promotionTypes
    ].join(' ').toLowerCase();

    const queryOk = !query || haystack.includes(query);
    const channelOk = filters.channel === ALL || trend.channels.includes(filters.channel);
    const categoryOk = filters.category === ALL || trend.categories.includes(filters.category);
    const typeOk = filters.type === ALL || trend.promotionTypes.includes(filters.type);
    const modeOk =
      filters.mode === ALL ||
      (filters.mode.includes('안정형') ? trend.modeBias === 'stable' : trend.modeBias === 'aggressive');

    return queryOk && channelOk && categoryOk && typeOk && modeOk;
  });
}
