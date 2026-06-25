import type { IdeaMode, TrendTopic } from '../domain/types';

interface IdeaCompareProps {
  trend: TrendTopic;
  selectedMode: IdeaMode;
  onSelectMode: (mode: IdeaMode) => void;
}

export default function IdeaCompare({ trend, selectedMode, onSelectMode }: IdeaCompareProps) {
  return (
    <section className="detail-card" id="compare">
      <div className="label-row">
        <span className="badge blue">안정형</span>
        <span className="badge orange">공격형</span>
        <span className="badge violet">AI 제안 · 검토 필요</span>
      </div>
      <div className="idea-grid">
        {(['stable', 'aggressive'] as const).map((mode) => {
          const idea = trend.ideas[mode];
          const isStable = mode === 'stable';
          return (
            <article className={`idea-card ${mode}`} key={mode}>
              <span className={`badge ${isStable ? 'blue' : 'orange'}`}>{isStable ? '안정형 기획안' : '공격형 기획안'}</span>
              <h3>{idea.title}</h3>
              <p>{idea.concept}</p>
              <div className="idea-meta">
                <div className="meta-row"><span>타깃</span><strong>{idea.target}</strong></div>
                <div className="meta-row"><span>혜택</span><strong>{idea.benefit}</strong></div>
                <div className="meta-row"><span>메시지</span><strong>{idea.message}</strong></div>
                <div className="meta-row"><span>채널</span><strong>{idea.channels.join(' · ')}</strong></div>
                <div className="meta-row"><span>리스크</span><strong>{idea.risk}</strong></div>
              </div>
              <div className="idea-actions"><button className={`btn small ${selectedMode === mode ? 'active' : ''}`} type="button" onClick={() => onSelectMode(mode)}>{isStable ? '안정형으로 디벨롭' : '공격형으로 디벨롭'}</button></div>
            </article>
          );
        })}
      </div>
      <div style={{ marginTop: 16, overflow: 'auto' }}>
        <table className="compare-table">
          <thead><tr><th>비교 항목</th><th>안정형</th><th>공격형</th></tr></thead>
          <tbody>
            <tr><td>실행 난이도</td><td>{trend.ideas.stable.difficulty}</td><td>{trend.ideas.aggressive.difficulty}</td></tr>
            <tr><td>화제성</td><td>{trend.ideas.stable.buzz}</td><td>{trend.ideas.aggressive.buzz}</td></tr>
            <tr><td>매출 직결성</td><td>중~높음</td><td>중간</td></tr>
            <tr><td>운영 리스크</td><td>{trend.ideas.stable.risk}</td><td>{trend.ideas.aggressive.risk}</td></tr>
            <tr><td>추천 상황</td><td>단기 실행/안정적 전환 목표</td><td>캠페인화/이슈화 목표</td></tr>
          </tbody>
        </table>
        <div className="idea-actions"><button className={`btn small ${selectedMode === 'mixed' ? 'active' : ''}`} type="button" onClick={() => onSelectMode('mixed')}>두 안을 섞어서 디벨롭</button></div>
      </div>
    </section>
  );
}
