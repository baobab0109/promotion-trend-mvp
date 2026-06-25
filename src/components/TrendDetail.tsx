import type { TrendTopic } from '../domain/types';
import { riskClass, riskLabel } from '../domain/display';

export default function TrendDetail({ trend }: { trend: TrendTopic }) {
  return (
    <div className="detail-grid">
      <article className="detail-card">
        <div className="label-row">
          <span className="badge blue">Trend Summary</span>
          <span className={`badge ${riskClass(trend.scores.risk).replace('risk-', '')}`}>Risk {riskLabel(trend.scores.risk)}</span>
        </div>
        <h3>{trend.name}</h3>
        <p className="muted">{trend.summary}</p>
        <div className="chips" style={{ margin: '14px 0' }}>{trend.keywords.map((keyword) => <span className="badge" key={keyword}>{keyword}</span>)}</div>
        <div className="bar-list">
          <div className="bar-row"><span>Momentum</span><div className="bar-track"><div className="bar-fill" style={{ width: `${trend.scores.momentum}%` }} /></div><strong>{trend.scores.momentum}</strong></div>
          <div className="bar-row"><span>Fit</span><div className="bar-track"><div className="bar-fill" style={{ width: `${trend.scores.onstyleFit}%` }} /></div><strong>{trend.scores.onstyleFit}</strong></div>
          <div className="bar-row"><span>Risk</span><div className="bar-track"><div className="bar-fill orange" style={{ width: `${trend.scores.risk}%` }} /></div><strong>{trend.scores.risk}</strong></div>
        </div>
        <h4 style={{ marginTop: 20 }}>AI 해석</h4>
        <div className="interpretation">
          <div><strong>소비자 관심 포인트</strong><p>{trend.aiInterpretation.consumerInsight}</p></div>
          <div><strong>프로모션 기회</strong><p>{trend.aiInterpretation.opportunity}</p></div>
          <div><strong>주의할 점</strong><p>{trend.aiInterpretation.caution}</p></div>
        </div>
      </article>
      <article className="detail-card">
        <div className="label-row"><span className="badge green">근거 데이터</span><span className="badge">AI 생성 아님 · 원천 요약</span></div>
        <h3>Evidence</h3>
        <p className="muted">기획안 생성에 사용된 샘플 근거입니다. 실제 운영 시 원문 링크와 수집 시각을 저장합니다.</p>
        <div className="evidence-list">
          {trend.evidence.map((evidence) => (
            <div className="evidence-item" key={`${evidence.type}-${evidence.title}`}>
              <div className="evidence-top"><span className={`badge ${evidence.type === '경쟁사' ? 'orange' : evidence.type === '기사' ? 'green' : 'blue'}`}>{evidence.type}</span><span className="badge">{evidence.date}</span></div>
              <strong>{evidence.title}</strong>
              <p>{evidence.source} · {evidence.summary}</p>
              <a className="evidence-link" href={evidence.url} onClick={(event) => event.preventDefault()}>근거 링크 보기</a>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
