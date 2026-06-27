import type { PeriodControlModel, PeriodPreset } from '../domain/types';

interface PeriodSelectorProps {
  model: PeriodControlModel;
  preset: PeriodPreset;
  weeklyValue: string;
  activeLabel: string;
  loading: boolean;
  onPresetChange: (preset: PeriodPreset) => void;
  onWeeklyValueChange: (value: string) => void;
}

export default function PeriodSelector({
  model,
  preset,
  weeklyValue,
  activeLabel,
  loading,
  onPresetChange,
  onWeeklyValueChange
}: PeriodSelectorProps) {
  return (
    <section className="period-panel" aria-label="기간 필터">
      <div className="period-head">
        <div>
          <p className="filter-title">기간</p>
          <h2>분석 기간 선택</h2>
          <p>기본은 최근 30일, 주간 모드에서는 최신 완료주와 최근 N주 합산을 선택합니다.</p>
        </div>
        <span className="badge violet">현재 보기 · {activeLabel}{loading ? ' 로딩 중' : ''}</span>
      </div>

      <div className="period-controls">
        <div className="period-presets" role="group" aria-label="빠른 기간 선택">
          {model.quickOptions.map((option) => (
            <button
              key={option.value}
              className={`filter-btn period-btn ${preset === option.value ? 'active' : ''}`}
              type="button"
              title={option.description}
              onClick={() => onPresetChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {preset === 'weekly' ? (
          <label className="week-select-label">
            <span>주차 선택</span>
            <select
              aria-label="주차 선택"
              className="week-select"
              value={weeklyValue}
              onChange={(event) => onWeeklyValueChange(event.target.value)}
            >
              {model.weeklyOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="period-note">주차별 회고가 필요하면 <strong>주간</strong>을 선택하세요.</p>
        )}
      </div>
    </section>
  );
}
