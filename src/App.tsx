import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import IdeaCompare from './components/IdeaCompare';
import SelectedIdeaDetail from './components/SelectedIdeaDetail';
import SummaryCards from './components/SummaryCards';
import TrendDetail from './components/TrendDetail';
import TrendExplorer from './components/TrendExplorer';
import WeeklyOverview from './components/WeeklyOverview';
import { filterOptions, sampleTrends, sourceSummary } from './data/sampleTrends';
import { readBookmarks, removeBookmark, toggleBookmark, writeBookmarks } from './domain/bookmarks';
import { filterTrends } from './domain/filters';
import { getIdeaForMode } from './domain/ideas';
import { buildDevelopmentPrompt } from './domain/prompts';
import type { FilterState, IdeaMode } from './domain/types';

const initialFilters: FilterState = {
  query: '',
  channel: '전체',
  category: '전체',
  type: '전체',
  mode: '전체'
};

export default function App() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [selectedId, setSelectedId] = useState(sampleTrends[0].id);
  const [selectedIdeaMode, setSelectedIdeaMode] = useState<IdeaMode>('stable');
  const [bookmarks, setBookmarks] = useState(() => readBookmarks());
  const [toast, setToast] = useState('');

  const filteredTrends = useMemo(() => filterTrends(sampleTrends, filters), [filters]);
  const selectedTrend = filteredTrends.find((trend) => trend.id === selectedId)
    ?? sampleTrends.find((trend) => trend.id === selectedId)
    ?? filteredTrends[0]
    ?? sampleTrends[0];
  const selectedIdea = getIdeaForMode(selectedTrend, selectedIdeaMode);
  const selectedPrompt = buildDevelopmentPrompt(selectedTrend, selectedIdea, selectedIdeaMode);

  useEffect(() => {
    if (filteredTrends.length > 0 && !filteredTrends.some((trend) => trend.id === selectedId)) {
      const nextTrend = filteredTrends[0];
      setSelectedId(nextTrend.id);
      setSelectedIdeaMode(nextTrend.modeBias);
    }
  }, [filteredTrends, selectedId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function showToast(message: string) {
    setToast(message);
  }

  function handleReset() {
    setFilters(initialFilters);
    setSelectedId(sampleTrends[0].id);
    setSelectedIdeaMode('stable');
    showToast('필터를 초기화했습니다.');
  }

  function handleFilterChange(key: keyof FilterState, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handleQueryChange(query: string) {
    setFilters((current) => ({ ...current, query }));
  }

  function handleKeyword(keyword: string) {
    setFilters((current) => ({ ...current, query: keyword }));
  }

  function handleSelectTrend(id: string, jump = false) {
    const trend = sampleTrends.find((item) => item.id === id);
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
        <Header sourceSummary={sourceSummary} onReset={handleReset} />
        <SummaryCards sourceSummary={sourceSummary} trends={sampleTrends} />
        <WeeklyOverview trends={sampleTrends} sourceSummary={sourceSummary} onSelectTrend={handleSelectTrend} onKeyword={handleKeyword} />

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
