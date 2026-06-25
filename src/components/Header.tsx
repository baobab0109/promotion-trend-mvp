import type { SourceSummary } from '../domain/types';

interface HeaderProps {
  sourceSummary: SourceSummary[];
  weekLabel: string;
  dataSourceLabel: string;
  onReset: () => void;
}

export default function Header({ sourceSummary, weekLabel, dataSourceLabel, onReset }: HeaderProps) {
  return (
    <header className="hero">
      <section className="hero-main">
        <span className="eyebrow"><span className="dot" /> {dataSourceLabel} · {weekLabel}</span>
        <h1>프로모션 트렌드를 근거와 기획안으로 연결하는 AI Planner</h1>
        <p className="hero-copy">SNS·검색·기사·경쟁사 신호를 한 화면에서 탐색하고, 온스타일에 맞춘 안정형/공격형 프로모션 기획안을 비교하는 React MVP입니다.</p>
        <div className="hero-actions">
          <a className="btn primary" href="#overview">이번 주 요약 보기</a>
          <a className="btn" href="#compare">기획안 비교하기</a>
          <button className="btn ghost" type="button" onClick={onReset}>필터 초기화</button>
        </div>
      </section>
      <aside className="hero-side">
        <p className="side-title">데이터 소스 구성</p>
        <div className="source-list">
          {sourceSummary.map((source) => (
            <div className="source-row" key={source.name}>
              <div><strong>{source.name}</strong><br /><span>{source.note}</span></div>
              <span className="badge">{source.count}건</span>
            </div>
          ))}
        </div>
        <div className="disclaimer">Notion CMS에서 Published 상태로 정리된 데이터를 정적 JSON으로 변환해 표시합니다. 실제 운영 전에는 출처 검증, 플랫폼 약관, 사내 보안 기준 검토가 필요합니다.</div>
      </aside>
    </header>
  );
}
