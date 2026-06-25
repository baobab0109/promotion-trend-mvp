import type { SourceSummary, TrendTopic } from '../domain/types';
import { unique } from '../domain/ideas';

interface WeeklyOverviewProps {
  trends: TrendTopic[];
  sourceSummary: SourceSummary[];
  onSelectTrend: (id: string, jump?: boolean) => void;
  onKeyword: (keyword: string) => void;
}

function MixBars({ rows, orange = false }: { rows: { name: string; value: number }[]; orange?: boolean }) {
  const max = Math.max(...rows.map((row) => row.value));
  return (
    <div className="bar-list">
      {rows.map((row) => (
        <div className="bar-row" key={row.name}>
          <span>{row.name}</span>
          <div className="bar-track"><div className={`bar-fill ${orange ? 'orange' : ''}`} style={{ width: `${Math.round(row.value / max * 100)}%` }} /></div>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}

export default function WeeklyOverview({ trends, sourceSummary, onSelectTrend, onKeyword }: WeeklyOverviewProps) {
  const top = [...trends]
    .sort((a, b) => (b.scores.momentum + b.scores.onstyleFit) - (a.scores.momentum + a.scores.onstyleFit))
    .slice(0, 4);
  const keywords = unique(trends.flatMap((trend) => trend.keywords)).slice(0, 16);
  const typeCounts = trends
    .flatMap((trend) => trend.promotionTypes)
    .reduce<Record<string, number>>((acc, type) => ({ ...acc, [type]: (acc[type] ?? 0) + 1 }), {});
  const typeRows = Object.entries(typeCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <section id="overview">
      <div className="section-head">
        <div>
          <h2>Weekly Trend Overview</h2>
          <p>이번 주 프로모션 기획 회의에서 먼저 볼 신호입니다.</p>
        </div>
        <span className="badge violet">근거 데이터와 AI 제안을 분리 표시</span>
      </div>
      <div className="overview">
        <div className="panel">
          <div className="section-head" style={{ marginTop: 0 }}>
            <div>
              <h2 style={{ fontSize: 18 }}>Top Trends</h2>
              <p>Momentum와 OnStyle Fit이 높은 순서</p>
            </div>
          </div>
          <div className="top-trend-grid">
            {top.map((trend) => (
              <button className="mini-trend" type="button" key={trend.id} onClick={() => onSelectTrend(trend.id, true)}>
                <strong>{trend.name}</strong>
                <p>{trend.summary}</p>
                <div className="chips" style={{ marginTop: 10 }}>{trend.keywords.slice(0, 3).map((keyword) => <span className="badge" key={keyword}>{keyword}</span>)}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="panel">
          <h3 style={{ margin: '0 0 14px' }}>Rising Keywords</h3>
          <div className="chips">
            {keywords.map((keyword) => <button className="chip" type="button" key={keyword} onClick={() => onKeyword(keyword)}>{keyword}</button>)}
          </div>
          <h3 style={{ margin: '24px 0 10px' }}>Channel Mix</h3>
          <MixBars rows={sourceSummary.map((source) => ({ name: source.name.replace('/기사', ''), value: source.count }))} />
          <h3 style={{ margin: '24px 0 10px' }}>Promotion Type Mix</h3>
          <MixBars rows={typeRows} orange />
        </div>
      </div>
    </section>
  );
}
