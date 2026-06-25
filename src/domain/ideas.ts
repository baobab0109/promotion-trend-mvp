import type { Idea, IdeaMode, TrendTopic } from './types';

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function buildMixedIdea(trend: TrendTopic): Idea {
  const stable = trend.ideas.stable;
  const aggressive = trend.ideas.aggressive;

  return {
    title: `${stable.title} + ${aggressive.title.split(':')[0]} 혼합안`,
    concept: `안정형 혜택 구조를 기본으로 두고, ${trend.keywords[0]} 트렌드를 활용한 참여/화제성 요소만 선택적으로 더합니다.`,
    target: stable.target,
    category: stable.category,
    benefit: `${stable.benefit} + 선택 참여 고객 대상 ${aggressive.benefit.split('+')[0].trim()}`,
    message: `${stable.message} ${aggressive.message}`,
    channels: unique([...stable.channels, ...aggressive.channels]).slice(0, 5),
    expectedEffect: '실행 안정성과 화제성 사이의 균형 확보',
    risk: '메시지가 복잡해지지 않도록 핵심 CTA를 하나로 정리해야 함',
    buzz: '중~높음',
    difficulty: '중간',
    copy: {
      banner: `${trend.keywords[0]} 트렌드를 담은 이번 주 추천 혜택`,
      push: '안정적인 혜택에 특별 참여 리워드까지 확인하세요',
      live: `${trend.name} 하이브리드 딜`
    },
    checklist: unique([...stable.checklist, ...aggressive.checklist]).slice(0, 5),
    teams: unique([...stable.teams, ...aggressive.teams]).slice(0, 5)
  };
}

export function getIdeaForMode(trend: TrendTopic, mode: IdeaMode): Idea {
  if (mode === 'mixed') return buildMixedIdea(trend);
  return trend.ideas[mode];
}

export function modeLabel(mode: IdeaMode): string {
  if (mode === 'stable') return '안정형';
  if (mode === 'aggressive') return '공격형';
  return '혼합형';
}
