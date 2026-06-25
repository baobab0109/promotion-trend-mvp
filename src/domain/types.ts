export type SourceType = '기사' | '검색' | 'SNS' | '경쟁사';
export type IdeaMode = 'stable' | 'aggressive' | 'mixed';
export type TrendModeBias = 'stable' | 'aggressive';

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
