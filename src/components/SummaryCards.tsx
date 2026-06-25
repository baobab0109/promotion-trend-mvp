import type { SourceSummary, TrendTopic } from '../domain/types';

interface SummaryCardsProps {
  sourceSummary: SourceSummary[];
  trends: TrendTopic[];
}

export default function SummaryCards({ sourceSummary, trends }: SummaryCardsProps) {
  const total = sourceSummary.reduce((sum, source) => sum + source.count, 0);
  const competitor = sourceSummary.find((source) => source.name.includes('경쟁사'))?.count ?? 0;
  const averageMomentum = Math.round(trends.reduce((sum, trend) => sum + trend.scores.momentum, 0) / trends.length);
  const ideas = trends.length * 2;
  const metrics = [
    { label: '수집 신호', value: `${total}건`, sub: '뉴스 42 / SNS 51 / 검색 18 / 경쟁사 17' },
    { label: '상승 트렌드', value: `${trends.length}개`, sub: `Momentum 평균 ${averageMomentum}점` },
    { label: '경쟁사 프로모션', value: `${competitor}건`, sub: '사은품·한정·멤버십 집중' },
    { label: '추천 기획안', value: `${ideas}개`, sub: `안정형 ${trends.length} / 공격형 ${trends.length}` }
  ];

  return (
    <section className="metrics">
      {metrics.map((metric) => (
        <article className="metric-card" key={metric.label}>
          <div className="metric-label">{metric.label} <span className="badge">sample</span></div>
          <div className="metric-value">{metric.value}</div>
          <div className="metric-sub">{metric.sub}</div>
        </article>
      ))}
    </section>
  );
}
