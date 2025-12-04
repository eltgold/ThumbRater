

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

export interface DirtyAnalysisResult {
  dirtyScore: number; // 0-100
  verdict: 'PURE' | 'SUS' | 'DOWN_BAD' | 'JAIL';
  explanation: string;
  alternatives: string[]; // Innocent meanings vs Dirty meanings
}

export interface XAnalysisResult {
  basedScore: number; // 0-10
  cringeScore: number; // 0-10
  ratioRisk: number; // 0-100%
  verdict: string;
  communityNotePrediction: string | null;
}

export interface VideoAnalysisResult {
  videoId: string;
  summary: string; // Initial AI analysis of the video topic
  topics: string[];
  tone: string;
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

export type SavedItemType = 'THUMB_RATER' | 'BOT_HUNTER' | 'VIDEO_CHAT' | 'DIRTY_TESTER' | 'X_RATER';

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
  channelDetails?: any;
  // Video Chat Data
  videoResult?: VideoAnalysisResult;
  // Dirty Tester Data
  dirtyResult?: DirtyAnalysisResult;
  dirtyInput?: string; // Text or Base64
  // X Rater Data
  xResult?: XAnalysisResult;
  xUrl?: string;
}

export type RiceTubeCategory = 'HOME' | 'TRENDING' | 'GAMING' | 'TECH' | 'MUSIC' | 'SUS';

export interface VideoMetadata {
  title: string | null;
  description: string | null;
  keywords: string[] | null;
  channelId?: string;
  channelTitle?: string;
}

export interface ChannelDetails {
  title: string;
  description: string;
  customUrl?: string;
  subscriberCount?: string;
  videoCount?: string;
  viewCount?: string;
  thumbnailUrl?: string;
}

export interface SearchResult {
  id: string;
  type: 'video' | 'channel';
  title: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt?: string;
  description?: string;
  isSus?: boolean;
}