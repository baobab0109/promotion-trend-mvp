import { describe, expect, it } from 'vitest';
import { getIdeaForMode } from '../src/domain/ideas';
import { sampleTrends } from '../src/data/sampleTrends';

describe('getIdeaForMode', () => {
  const trend = sampleTrends[0];

  it('mode가 stable이면 stable idea를 반환한다', () => {
    expect(getIdeaForMode(trend, 'stable')).toEqual(trend.ideas.stable);
  });

  it('mode가 aggressive이면 aggressive idea를 반환한다', () => {
    expect(getIdeaForMode(trend, 'aggressive')).toEqual(trend.ideas.aggressive);
  });

  it('mode가 mixed이면 안정형과 공격형을 결합한 혼합안을 반환한다', () => {
    const mixed = getIdeaForMode(trend, 'mixed');
    expect(mixed.title).toContain(trend.ideas.stable.title);
    expect(mixed.concept).toContain(trend.keywords[0]);
    expect(mixed.expectedEffect).toContain('균형');
  });

  it('혼합안은 stable/aggressive 채널 중복을 제거한다', () => {
    const mixed = getIdeaForMode(trend, 'mixed');
    expect(new Set(mixed.channels).size).toBe(mixed.channels.length);
  });
});
