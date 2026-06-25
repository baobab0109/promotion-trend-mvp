import type { SourceSummary, TrendTopic } from '../domain/types';

interface SummaryCardsProps {
  sourceSummary: SourceSummary[];
  trends: TrendTopic[];
  dataSourceLabel: string;
}

export default function SummaryCards({ sourceSummary, trends, dataSourceLabel }: SummaryCardsProps) {
  const total = sourceSummary.reduce((sum, source) => sum + source.count, 0);
  const competitor = sourceSummary.find((source) => source.name.includes('경쟁사'))?.count ?? 0;
  const averageMomentum = trends.length > 0
    ? Math.round(trends.reduce((sum, trend) => sum + trend.scores.momentum, 0) / trends.length)
    : 0;
  const ideas = trends.length * 2;
  const sourceBreakdown = sourceSummary.map((source) => `${source.name.replace('/기사', '')} ${source.count}`).join(' / ');
  const topTypes = trends
    .flatMap((trend) => trend.promotionTypes)
    .reduce<Record<string, number>>((acc, type) => ({ ...acc, [type]: (acc[type] ?? 0) + 1 }), {});
  const topTypeText = Object.entries(topTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => type)
    .join('·') || '데이터 없음';
  const metrics = [
    { label: '수집 신호', value: `${total}건`, sub: sourceBreakdown },
    { label: '상승 트렌드', value: `${trends.length}개`, sub: `Momentum 평균 ${averageMomentum}점` },
    { label: '경쟁사 프로모션', value: `${competitor}건`, sub: `${topTypeText} 집중` },
    { label: '추천 기획안', value: `${ideas}개`, sub: `안정형 ${trends.length} / 공격형 ${trends.length}` }
  ];

  return (
    <section className="metrics">
      {metrics.map((metric) => (
        <article className="metric-card" key={metric.label}>
          <div className="metric-label">{metric.label} <span className="badge">{dataSourceLabel}</span></div>
          <div className="metric-value">{metric.value}</div>
          <div className="metric-sub">{metric.sub}</div>
        </article>
      ))}
    </section>
  );
}
