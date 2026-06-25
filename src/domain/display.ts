export function riskClass(score: number): 'risk-low' | 'risk-mid' | 'risk-high' {
  if (score < 40) return 'risk-low';
  if (score < 60) return 'risk-mid';
  return 'risk-high';
}

export function riskLabel(score: number): '낮음' | '중간' | '높음' {
  if (score < 40) return '낮음';
  if (score < 60) return '중간';
  return '높음';
}
