import type { Idea, IdeaMode, TrendTopic } from './types';
import { modeLabel } from './ideas';

export function buildDevelopmentPrompt(trend: TrendTopic, idea: Idea, mode: IdeaMode): string {
  const label = modeLabel(mode);

  return `아래 프로모션 기획안을 실제 실행 검토 가능한 수준으로 구체화해줘.\n\n` +
    `역할: 온스타일 프로모션 전략/CRM/콘텐츠 기획자\n` +
    `작성 방향: 근거 기반으로 구체화하되, 확정 사실과 가정을 명확히 구분해줘.\n` +
    `출력 형식:\n` +
    `1. 한 줄 기획 요약\n` +
    `2. 고객 인사이트와 근거\n` +
    `3. 타깃 세그먼트\n` +
    `4. 혜택 구조 상세\n` +
    `5. 카테고리/상품군 적용안\n` +
    `6. 고객 여정별 메시지: 앱홈, 배너, 푸시, 라이브/콘텐츠\n` +
    `7. 운영 체크리스트\n` +
    `8. 예상 KPI와 측정 방법\n` +
    `9. 리스크와 보완책\n` +
    `10. 회의에서 결정해야 할 질문\n\n` +
    `[선택 기획안]\n` +
    `유형: ${label}\n` +
    `기획명: ${idea.title}\n` +
    `트렌드: ${trend.name}\n` +
    `트렌드 요약: ${trend.summary}\n` +
    `주요 키워드: ${trend.keywords.join(', ')}\n` +
    `채널 신호: ${trend.channels.join(', ')}\n` +
    `카테고리: ${idea.category}\n` +
    `컨셉: ${idea.concept}\n` +
    `타깃: ${idea.target}\n` +
    `혜택 구조: ${idea.benefit}\n` +
    `현재 메시지: ${idea.message}\n` +
    `실행 채널: ${idea.channels.join(', ')}\n` +
    `기대 효과: ${idea.expectedEffect}\n` +
    `리스크: ${idea.risk}\n` +
    `체크리스트:\n- ${idea.checklist.join('\n- ')}\n\n` +
    `[근거 데이터 요약]\n` +
    `${trend.evidence.map((e) => `- ${e.type} / ${e.source} / ${e.date}: ${e.title} — ${e.summary}`).join('\n')}\n\n` +
    `[AI 해석]\n` +
    `소비자 관심 포인트: ${trend.aiInterpretation.consumerInsight}\n` +
    `프로모션 기회: ${trend.aiInterpretation.opportunity}\n` +
    `주의할 점: ${trend.aiInterpretation.caution}`;
}
