import { describe, expect, it } from 'vitest';
import { filterTrends } from '../src/domain/filters';
import { sampleTrends } from '../src/data/sampleTrends';

describe('filterTrends', () => {
  it('검색어가 트렌드 키워드와 일치하면 해당 트렌드를 반환한다', () => {
    const result = filterTrends(sampleTrends, { query: '멤버십', channel: '전체', category: '전체', type: '전체', mode: '전체' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((t) => t.name.includes('멤버십') || t.keywords.includes('멤버십'))).toBe(true);
  });

  it('채널 필터가 적용되면 해당 채널을 가진 트렌드만 반환한다', () => {
    const result = filterTrends(sampleTrends, { query: '', channel: '경쟁사', category: '전체', type: '전체', mode: '전체' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((t) => t.channels.includes('경쟁사'))).toBe(true);
  });

  it('공격형 추천 강함 필터는 modeBias가 aggressive인 트렌드만 반환한다', () => {
    const result = filterTrends(sampleTrends, { query: '', channel: '전체', category: '전체', type: '전체', mode: '공격형 추천 강함' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((t) => t.modeBias === 'aggressive')).toBe(true);
  });

  it('조건에 맞는 트렌드가 없으면 빈 배열을 반환한다', () => {
    const result = filterTrends(sampleTrends, { query: '존재하지않는키워드', channel: '전체', category: '전체', type: '전체', mode: '전체' });
    expect(result).toEqual([]);
  });
});
