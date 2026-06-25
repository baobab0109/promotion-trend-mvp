import type { FilterOptions, FilterState, TrendTopic } from '../domain/types';
import { riskClass, riskLabel } from '../domain/display';

interface TrendExplorerProps {
  filters: FilterState;
  filterOptions: FilterOptions;
  trends: TrendTopic[];
  selectedId: string;
  onFilterChange: (key: keyof FilterState, value: string) => void;
  onQueryChange: (query: string) => void;
  onSelectTrend: (id: string) => void;
}

function FilterButtons({ options, value, onChange }: { options: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="filter-buttons">
      {options.map((option) => (
        <button className={`filter-btn ${value === option ? 'active' : ''}`} type="button" key={option} onClick={() => onChange(option)}>{option}</button>
      ))}
    </div>
  );
}

export default function TrendExplorer({ filters, filterOptions, trends, selectedId, onFilterChange, onQueryChange, onSelectTrend }: TrendExplorerProps) {
  return (
    <aside className="panel explorer" aria-label="Trend Explorer">
      <div className="section-head" style={{ marginTop: 0 }}>
        <div>
          <h2>Trend Explorer</h2>
          <p>{trends.length}개 트렌드</p>
        </div>
      </div>
      <input className="search" value={filters.query} onChange={(event) => onQueryChange(event.target.value)} placeholder="키워드, 카테고리, 혜택 유형 검색" />
      <div className="filter-group">
        <div className="filter-title">채널</div>
        <FilterButtons options={filterOptions.channels} value={filters.channel} onChange={(value) => onFilterChange('channel', value)} />
      </div>
      <div className="filter-group">
        <div className="filter-title">카테고리</div>
        <FilterButtons options={filterOptions.categories} value={filters.category} onChange={(value) => onFilterChange('category', value)} />
      </div>
      <div className="filter-group">
        <div className="filter-title">프로모션 유형</div>
        <FilterButtons options={filterOptions.types} value={filters.type} onChange={(value) => onFilterChange('type', value)} />
      </div>
      <div className="filter-group">
        <div className="filter-title">기획 성향</div>
        <FilterButtons options={filterOptions.modes} value={filters.mode} onChange={(value) => onFilterChange('mode', value)} />
      </div>
      <div className="trend-list">
        {trends.length === 0 ? (
          <div className="empty">조건에 맞는 트렌드가 없습니다. 필터를 초기화해보세요.</div>
        ) : trends.map((trend) => (
          <button className={`trend-card ${selectedId === trend.id ? 'selected' : ''}`} type="button" key={trend.id} onClick={() => onSelectTrend(trend.id)}>
            <div className="label-row" style={{ marginBottom: 0 }}>
              {trend.channels.map((channel) => <span className={`badge ${channel === '경쟁사' ? 'orange' : channel === '기사' ? 'green' : 'blue'}`} key={channel}>{channel}</span>)}
              <span className="badge">근거 {trend.evidence.length}</span>
            </div>
            <h3>{trend.name}</h3>
            <p>{trend.summary}</p>
            <div className="chips" style={{ marginBottom: 10 }}>{trend.keywords.slice(0, 4).map((keyword) => <span className="badge" key={keyword}>{keyword}</span>)}</div>
            <div className="score-row">
              <div className="score-pill"><span>Momentum</span><strong>{trend.scores.momentum}</strong></div>
              <div className="score-pill"><span>Fit</span><strong>{trend.scores.onstyleFit}</strong></div>
              <div className="score-pill"><span>Risk</span><strong className={riskClass(trend.scores.risk)}>{riskLabel(trend.scores.risk)}</strong></div>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
