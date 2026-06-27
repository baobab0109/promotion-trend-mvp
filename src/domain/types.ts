export type SourceType = '기사' | '검색' | 'SNS' | '경쟁사';
export type IdeaMode = 'stable' | 'aggressive' | 'mixed';
export type TrendModeBias = 'stable' | 'aggressive';
export type PeriodPreset = 'recent-7' | 'recent-14' | 'recent-30' | 'weekly';

export interface EvidenceItem {
  type: SourceType;
  title: string;
  source: string;
  date: string;
  url: string;
  summary: string;
}

export interface Idea {
  title: string;
  concept: string;
  target: string;
  category: string;
  benefit: string;
  message: string;
  channels: string[];
  expectedEffect: string;
  risk: string;
  buzz: string;
  difficulty: string;
  copy: {
    banner: string;
    push: string;
    live: string;
  };
  checklist: string[];
  teams: string[];
}

export interface TrendTopic {
  id: string;
  name: string;
  summary: string;
  keywords: string[];
  channels: string[];
  categories: string[];
  promotionTypes: string[];
  modeBias: TrendModeBias;
  scores: {
    momentum: number;
    onstyleFit: number;
    risk: number;
  };
  evidence: EvidenceItem[];
  aiInterpretation: {
    consumerInsight: string;
    opportunity: string;
    caution: string;
  };
  ideas: {
    stable: Idea;
    aggressive: Idea;
  };
}

export interface SourceSummary {
  name: string;
  count: number;
  note: string;
}

export interface TrendDataset {
  weekId: string;
  label: string;
  status: 'Draft' | 'Published' | 'Archived' | string;
  generatedAt: string;
  source: 'sample' | 'notion';
  sourceSummary: SourceSummary[];
  trends: TrendTopic[];
}

export interface WeekManifestItem {
  weekId: string;
  label: string;
  status: 'Draft' | 'Published' | 'Archived' | string;
  startDate: string;
  endDate: string;
  file: string;
  isLatest: boolean;
}

export interface PeriodQuickOption {
  value: PeriodPreset;
  label: string;
  description: string;
}

export interface PeriodWeeklyOption {
  value: string;
  label: string;
  description: string;
  files: string[];
}

export interface PeriodControlModel {
  quickOptions: PeriodQuickOption[];
  weeklyOptions: PeriodWeeklyOption[];
  defaultWeeklyValue: string;
}

export interface PeriodSelection {
  preset: PeriodPreset;
  weeklyValue: string;
}

export interface FilterOptions {
  channels: string[];
  categories: string[];
  types: string[];
  modes: string[];
}

export interface FilterState {
  query: string;
  channel: string;
  category: string;
  type: string;
  mode: string;
}

export interface BookmarkedIdea {
  key: string;
  id: string;
  createdAt: string;
  trendId: string;
  trendName: string;
  modeKey: IdeaMode;
  mode: string;
  title: string;
  summary: string;
  keywords: string[];
  scores: TrendTopic['scores'];
  prompt: string;
  status: '찜한 기획안';
  trendSnapshot: TrendTopic;
  ideaSnapshot: Idea;
}
