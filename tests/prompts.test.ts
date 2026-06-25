import { describe, expect, it } from 'vitest';
import { buildDevelopmentPrompt } from '../src/domain/prompts';
import { sampleTrends } from '../src/data/sampleTrends';
import { getIdeaForMode } from '../src/domain/ideas';

describe('buildDevelopmentPrompt', () => {
  const trend = sampleTrends[0];
  const idea = getIdeaForMode(trend, 'stable');
  const prompt = buildDevelopmentPrompt(trend, idea, 'stable');

  it('역할 지시와 작성 방향을 포함한다', () => {
    expect(prompt).toContain('역할: 온스타일 프로모션 전략/CRM/콘텐츠 기획자');
    expect(prompt).toContain('확정 사실과 가정');
  });

  it('선택 기획안의 트렌드명/기획명/혜택 구조를 포함한다', () => {
    expect(prompt).toContain(trend.name);
    expect(prompt).toContain(idea.title);
    expect(prompt).toContain(idea.benefit);
  });

  it('근거 데이터와 AI 해석을 포함한다', () => {
    expect(prompt).toContain('[근거 데이터 요약]');
    expect(prompt).toContain(trend.evidence[0].title);
    expect(prompt).toContain(trend.aiInterpretation.consumerInsight);
  });

  it('KPI/리스크/회의 질문 출력 형식을 포함한다', () => {
    expect(prompt).toContain('예상 KPI와 측정 방법');
    expect(prompt).toContain('리스크와 보완책');
    expect(prompt).toContain('회의에서 결정해야 할 질문');
  });
});
