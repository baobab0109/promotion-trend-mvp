import type { BookmarkedIdea, Idea, IdeaMode, TrendTopic } from './types';
import { modeLabel } from './ideas';

export const BOOKMARK_STORAGE_KEY = 'promotionTrendBookmarkedIdeas';

export function bookmarkKey(trendId: string, mode: IdeaMode): string {
  return `${trendId}::${mode}`;
}

export function addBookmark(
  bookmarks: BookmarkedIdea[],
  trend: TrendTopic,
  idea: Idea,
  mode: IdeaMode,
  prompt: string,
  createdAt = new Date().toISOString()
): BookmarkedIdea {
  const key = bookmarkKey(trend.id, mode);
  const existing = bookmarks.find((item) => item.key === key);
  if (existing) return existing;

  return {
    key,
    id: `${trend.id}-${mode}`,
    createdAt,
    trendId: trend.id,
    trendName: trend.name,
    modeKey: mode,
    mode: modeLabel(mode),
    title: idea.title,
    summary: idea.concept,
    keywords: [...trend.keywords],
    scores: { ...trend.scores },
    prompt,
    status: '찜한 기획안',
    trendSnapshot: structuredCloneFallback(trend),
    ideaSnapshot: structuredCloneFallback(idea)
  };
}

export function removeBookmark(bookmarks: BookmarkedIdea[], key: string): BookmarkedIdea[] {
  return bookmarks.filter((item) => item.key !== key);
}

export function readBookmarks(storage: Storage = localStorage): BookmarkedIdea[] {
  try {
    const raw = storage.getItem(BOOKMARK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeBookmarks(bookmarks: BookmarkedIdea[], storage: Storage = localStorage): void {
  storage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(bookmarks.slice(0, 100)));
}

export function isBookmarked(trendId: string, mode: IdeaMode, storage: Storage = localStorage): boolean {
  const key = bookmarkKey(trendId, mode);
  return readBookmarks(storage).some((item) => item.key === key);
}

export function toggleBookmark(
  trend: TrendTopic,
  idea: Idea,
  mode: IdeaMode,
  prompt: string,
  storage: Storage = localStorage
): 'added' | 'removed' {
  const key = bookmarkKey(trend.id, mode);
  const bookmarks = readBookmarks(storage);
  if (bookmarks.some((item) => item.key === key)) {
    writeBookmarks(removeBookmark(bookmarks, key), storage);
    return 'removed';
  }

  const item = addBookmark(bookmarks, trend, idea, mode, prompt);
  writeBookmarks([item, ...bookmarks], storage);
  return 'added';
}

function structuredCloneFallback<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
