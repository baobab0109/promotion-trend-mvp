import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import IdeaCompare from './components/IdeaCompare';
import PeriodSelector from './components/PeriodSelector';
import SelectedIdeaDetail from './components/SelectedIdeaDetail';
import SummaryCards from './components/SummaryCards';
import TrendDetail from './components/TrendDetail';
import TrendExplorer from './components/TrendExplorer';
import WeeklyOverview from './components/WeeklyOverview';
import { readBookmarks, removeBookmark, toggleBookmark, writeBookmarks } from './domain/bookmarks';
import { loadTrendDataset, loadTrendDatasets, loadWeeksManifest } from './domain/dataLoader';
import { filterTrends } from './domain/filters';
import { getIdeaForMode } from './domain/ideas';
import { buildPeriodControlModel, getPeriodLabel, resolvePeriodDataFiles } from './domain/periods';
import { buildDevelopmentPrompt } from './domain/prompts';
import { buildFilterOptions, createSampleTrendDataset } from './domain/trendData';
import type { FilterState, IdeaMode, PeriodPreset, PeriodSelection, WeekManifestItem } from './domain/types';

const initialFilters: FilterState = {
  query: '',
  channel: '전체',
  category: '전체',
  type: '전체',
  mode: '전체'
};

const fallbackDataset = createSampleTrendDataset();

const initialPeriodSelection: PeriodSelection = {
  preset: 'recent-30',
  weeklyValue: 'latest'
};

export default function App() {
  const [dataset, setDataset] = useState(fallbackDataset);
  const [weeks, setWeeks] = useState<WeekManifestItem[]>([]);
  const [periodSelection, setPeriodSelection] = useState<PeriodSelection>(initialPeriodSelection);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [manifestLoaded, setManifestLoaded] = useState(false);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [selectedId, setSelectedId] = useState(fallbackDataset.trends[0].id);
  const [selectedIdeaMode, setSelectedIdeaMode] = useState<IdeaMode>('stable');
  const [bookmarks, setBookmarks] = useState(() => readBookmarks());
  const [toast, setToast] = useState('');
  const [loadState, setLoadState] = useState<'loading' | 'notion' | 'fallback'>('loading');

  const trends = dataset.trends;
  const sourceSummary = dataset.sourceSummary;
  const filterOptions = useMemo(() => buildFilterOptions(trends), [trends]);
  const periodModel = useMemo(() => buildPeriodControlModel(weeks), [weeks]);
  const activePeriodLabel = useMemo(() => getPeriodLabel(periodSelection, weeks), [periodSelection, weeks]);
  const dataSourceLabel = dataset.source === 'notion' ? 'NOTION CMS' : 'SAMPLE MVP';
  const statusLabel = loadState === 'loading' ? '데이터 로드 중' : dataSourceLabel;

  const filteredTrends = useMemo(() => filterTrends(trends, filters), [filters, trends]);
  const selectedTrend = filteredTrends.find((trend) => trend.id === selectedId)
    ?? trends.find((trend) => trend.id === selectedId)
    ?? filteredTrends[0]
    ?? trends[0];
  const selectedIdea = getIdeaForMode(selectedTrend, selectedIdeaMode);
  const selectedPrompt = buildDevelopmentPrompt(selectedTrend, selectedIdea, selectedIdeaMode);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      loadTrendDataset(),
      loadWeeksManifest().catch(() => [] as WeekManifestItem[])
    ])
      .then(([nextDataset, nextWeeks]) => {
        if (cancelled) return;
        setDataset(nextDataset);
        setWeeks(nextWeeks);
        setSelectedId(nextDataset.trends[0].id);
        setSelectedIdeaMode(nextDataset.trends[0].modeBias);
        setLoadState('notion');
        setManifestLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadState('fallback');
        setManifestLoaded(true);
        setToast(`Notion 데이터 로드 실패로 샘플 데이터를 표시합니다: ${error instanceof Error ? error.message : 'unknown error'}`);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!manifestLoaded) return;
    let cancelled = false;
    const files = resolvePeriodDataFiles(periodSelection, weeks);
    const nextLabel = getPeriodLabel(periodSelection, weeks);
    setPeriodLoading(true);

    loadTrendDatasets(files, nextLabel)
      .then((nextDataset) => {
        if (cancelled) return;
        setDataset(nextDataset);
        setSelectedId(nextDataset.trends[0].id);
        setSelectedIdeaMode(nextDataset.trends[0].modeBias);
        setLoadState('notion');
      })
      .catch((error) => {
        if (cancelled) return;
        setToast(`기간 데이터를 불러오지 못했습니다: ${error instanceof Error ? error.message : 'unknown error'}`);
      })
      .finally(() => {
        if (!cancelled) setPeriodLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [manifestLoaded, periodSelection, weeks]);

  useEffect(() => {
    if (filteredTrends.length > 0 && !filteredTrends.some((trend) => trend.id === selectedId)) {
      const nextTrend = filteredTrends[0];
      setSelectedId(nextTrend.id);
      setSelectedIdeaMode(nextTrend.modeBias);
    }
  }, [filteredTrends, selectedId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function showToast(message: string) {
    setToast(message);
  }

  function handleReset() {
    setFilters(initialFilters);
    setSelectedId(trends[0].id);
    setSelectedIdeaMode(trends[0].modeBias);
    showToast('필터를 초기화했습니다.');
  }

  function handleFilterChange(key: keyof FilterState, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handlePresetChange(preset: PeriodPreset) {
    setPeriodSelection((current) => ({
      preset,
      weeklyValue: current.weeklyValue || periodModel.defaultWeeklyValue
    }));
  }

  function handleWeeklyValueChange(weeklyValue: string) {
    setPeriodSelection({ preset: 'weekly', weeklyValue });
  }

  function handleQueryChange(query: string) {
    setFilters((current) => ({ ...current, query }));
  }

  function handleKeyword(keyword: string) {
    setFilters((current) => ({ ...current, query: keyword }));
  }

  function handleSelectTrend(id: string, jump = false) {
    const trend = trends.find((item) => item.id === id);
    setSelectedId(id);
    setSelectedIdeaMode(trend?.modeBias ?? 'stable');
    if (jump) {
      window.setTimeout(() => document.querySelector('.workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    }
  }

  function handleSelectIdeaMode(mode: IdeaMode) {
    setSelectedIdeaMode(mode);
    window.setTimeout(() => document.getElementById('selectedIdeaDetail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0);
  }

  async function handleCopyPrompt() {
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API is unavailable');
      }
      await navigator.clipboard.writeText(selectedPrompt);
      showToast('기획안 구체화 프롬프트를 복사했습니다.');
    } catch {
      showToast('클립보드 복사 권한이 없어 실패했습니다.');
    }
  }

  function handleToggleBookmark() {
    const result = toggleBookmark(selectedTrend, selectedIdea, selectedIdeaMode, selectedPrompt);
    setBookmarks(readBookmarks());
    showToast(result === 'added' ? '찜한 기획안에 저장했습니다.' : '찜한 기획안에서 제거했습니다.');
  }

  function handleRemoveBookmark(key: string) {
    writeBookmarks(removeBookmark(bookmarks, key));
    setBookmarks(readBookmarks());
    showToast('찜한 기획안에서 제거했습니다.');
  }

  function handleOpenBookmark(trendId: string, mode: IdeaMode) {
    setSelectedId(trendId);
    setSelectedIdeaMode(mode);
    window.setTimeout(() => document.getElementById('selectedIdeaDetail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0);
  }

  return (
    <>
      <div className="app">
        <Header sourceSummary={sourceSummary} weekLabel={dataset.label} dataSourceLabel={statusLabel} onReset={handleReset} />
        <PeriodSelector
          model={periodModel}
          preset={periodSelection.preset}
          weeklyValue={periodSelection.weeklyValue}
          activeLabel={activePeriodLabel}
          loading={periodLoading}
          onPresetChange={handlePresetChange}
          onWeeklyValueChange={handleWeeklyValueChange}
        />
        <SummaryCards sourceSummary={sourceSummary} trends={trends} dataSourceLabel={dataSourceLabel} />
        <WeeklyOverview trends={trends} sourceSummary={sourceSummary} onSelectTrend={handleSelectTrend} onKeyword={handleKeyword} />

        <main className="workspace">
          <TrendExplorer
            filters={filters}
            filterOptions={filterOptions}
            trends={filteredTrends}
            selectedId={selectedTrend.id}
            onFilterChange={handleFilterChange}
            onQueryChange={handleQueryChange}
            onSelectTrend={handleSelectTrend}
          />

          <section className="detail-stack">
            <TrendDetail trend={selectedTrend} />
            <IdeaCompare trend={selectedTrend} selectedMode={selectedIdeaMode} onSelectMode={handleSelectIdeaMode} />
            <SelectedIdeaDetail
              trend={selectedTrend}
              idea={selectedIdea}
              mode={selectedIdeaMode}
              bookmarks={bookmarks}
              onCopyPrompt={handleCopyPrompt}
              onToggleBookmark={handleToggleBookmark}
              onOpenBookmark={handleOpenBookmark}
              onRemoveBookmark={handleRemoveBookmark}
            />
          </section>
        </main>
      </div>
      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}
