import { beforeEach, describe, expect, it } from 'vitest';
import { addBookmark, bookmarkKey, isBookmarked, removeBookmark, readBookmarks, toggleBookmark } from '../src/domain/bookmarks';
import { sampleTrends } from '../src/data/sampleTrends';
import { getIdeaForMode } from '../src/domain/ideas';
import { buildDevelopmentPrompt } from '../src/domain/prompts';

describe('bookmark domain', () => {
  const trend = sampleTrends[0];
  const idea = getIdeaForMode(trend, 'stable');
  const prompt = buildDevelopmentPrompt(trend, idea, 'stable');

  beforeEach(() => {
    localStorage.clear();
  });

  it('북마크 key를 trendId와 mode로 생성한다', () => {
    expect(bookmarkKey('routine-benefit', 'mixed')).toBe('routine-benefit::mixed');
  });

  it('찜 추가 시 snapshot과 prompt를 저장한다', () => {
    const item = addBookmark([], trend, idea, 'stable', prompt, '2026-06-25T00:00:00.000Z');
    expect(item.key).toBe(bookmarkKey(trend.id, 'stable'));
    expect(item.trendSnapshot).toEqual(trend);
    expect(item.ideaSnapshot).toEqual(idea);
    expect(item.prompt).toContain(idea.title);
  });

  it('중복 찜을 방지한다', () => {
    const first = addBookmark([], trend, idea, 'stable', prompt, '2026-06-25T00:00:00.000Z');
    const duplicate = addBookmark([first], trend, idea, 'stable', prompt, '2026-06-25T00:00:01.000Z');
    expect(duplicate).toEqual(first);
  });

  it('찜 해제 후 해당 key가 사라진다', () => {
    const first = addBookmark([], trend, idea, 'stable', prompt, '2026-06-25T00:00:00.000Z');
    const next = removeBookmark([first], first.key);
    expect(next).toEqual([]);
  });

  it('localStorage 어댑터로 toggle/read/isBookmarked를 수행한다', () => {
    const added = toggleBookmark(trend, idea, 'stable', prompt);
    expect(added).toBe('added');
    expect(isBookmarked(trend.id, 'stable')).toBe(true);
    expect(readBookmarks()).toHaveLength(1);
    const removed = toggleBookmark(trend, idea, 'stable', prompt);
    expect(removed).toBe('removed');
    expect(isBookmarked(trend.id, 'stable')).toBe(false);
  });
});
