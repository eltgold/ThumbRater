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

export interface BotAnalysisResult {
  botScore: number; // 0-100 (100 = Total Bot)
  verdict: 'HUMAN' | 'CYBORG' | 'NPC_FARM';
  evidence: string[];
  summary: string;
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

export type SavedItemType = 'THUMB_RATER' | 'BOT_HUNTER';

export interface SavedItem {
  id: string;
  date: string;
  type: SavedItemType;
  // Thumb Rater Data
  thumbnailBase64?: string;
  thumbnailResult?: AnalysisResult;
  videoTitle?: string | null;
  videoDesc?: string | null;
  videoKeywords?: string[];
  // Bot Hunter Data
  botResult?: BotAnalysisResult;
  channelDetails?: any; // Avoiding circular dependency with utils, simple object
}