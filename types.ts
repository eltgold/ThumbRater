export interface ThumbnailScores {
  clarity: number;
  curiosity: number;
  text_readability: number;
  emotion: number;
  overall: number;
}

export interface AnalysisResult {
  scores: ThumbnailScores;
  summary: string;
  suggestions: string[];
  isSus: boolean;
  susReason?: string;
}

export interface VideoDetails {
  id: string;
  url: string;
  thumbnailUrl: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export enum AppState {
  IDLE = 'IDLE',
  LOADING_IMAGE = 'LOADING_IMAGE',
  READY_TO_ANALYZE = 'READY_TO_ANALYZE',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: string[];
}