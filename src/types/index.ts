export type StudyMode = 'about-to-forget' | 'due' | 'random';
export type ReviewRating = 'easy' | 'medium' | 'hard' | 'partial' | 'blank' | 'wrong';
export type ThemeName = 'light' | 'dark';
export type SessionStatus = 'in-progress' | 'completed' | 'abandoned';

export type TreeNode = {
  id: string;
  parentId: string | null;
  name: string;
  order: number;
  createdAt: number;
  updatedAt?: number;
};

export type TagRecord = {
  id: string;
  name: string; // normalised key: trimmed, lower-case, single spaces; unique
  label: string; // display text, casing of first use
  createdAt: number;
};

export type CardRecord = {
  id: string;
  nodeId: string;
  front: string;
  back: string;
  explanation?: string | null;
  tagIds?: string[]; // first tag = card's label
  kind?: 'basic';
  direction?: 'one-way' | 'both';
  starred?: boolean;
  paused?: boolean;
  sourceKey?: string | null;
  importId?: string | null;
  createdAt: number;
  updatedAt?: number;
  // Compatibility & in-memory join fields
  due?: number;
  stability?: number;
  difficulty?: number;
  state?: number;
  reps?: number;
  lapses?: number;
  lastReview?: number | null;
  trap?: boolean;
  reviewItemId?: string;
};

export type ReviewItemRecord = {
  id: string;
  cardId: string;
  direction: 'forward' | 'reverse';
  due: number;
  stability: number;
  difficulty: number;
  state: number;
  reps: number;
  lapses: number;
  lastReview: number | null;
  trap: boolean;
  createdAt: number;
};

export type ReviewRecord = {
  id: string;
  reviewItemId?: string;
  cardId: string;
  sessionId: string;
  rating: ReviewRating;
  fsrsRating?: 'again' | 'hard' | 'good' | 'easy';
  fsrsLog?: Record<string, unknown> | null;
  durationMs: number;
  timestamp: number;
  dayKey?: string;
  studyMode?: 'single' | 'family';
};

export type SessionRecord = {
  id: string;
  startedAt: number;
  endedAt: number;
  dayKey?: string;
  scopeNodeId: string | null;
  scopeName?: string;
  mode: StudyMode;
  tagFilter?: string[];
  viewMode?: 'cards' | 'families';
  plannedCount: number;
  completedCount: number;
  status: SessionStatus;
  queueItemIds?: string[];
  queueCardIds?: string[];
  position: number;
  completedAt: number | null;
};

export type NoteRecord = {
  id: string;
  nodeId: string;
  type?: string;
  title?: string | null;
  body: string;
  data?: Record<string, unknown> | null;
  tagIds?: string[];
  color?: string | null;
  style?: { bold?: boolean; size?: 'sm' | 'md' | 'lg'; font?: 'sans' | 'mono' | 'serif' } | null;
  starred?: boolean;
  order?: number;
  sourceKey?: string | null;
  importId?: string | null;
  createdAt: number;
  updatedAt?: number;
};

export type ImportRecord = {
  id: string;
  fileName: string;
  timestamp: number;
  mode: 'paths' | 'into-node';
  counts: {
    nodes: number;
    cards: number;
    notes: number;
    tags: number;
    updated: number;
    skipped: number;
  };
  status: 'applied' | 'undone';
};

export type SettingsRecord = {
  id: string;
  userName?: string;
  targetCardsPerDay?: number;
  theme: ThemeName;
  dayStartMinutes: number;
  newCardsPerDay: number;
  dailyGoal: number;
  avgSecondsPerCard: number;
  lastBackupAt: number | null;
  desiredRetention?: number;
  showTags?: boolean;
  showMnemoInSession?: boolean;
  mnemoX?: number;
  mnemoY?: number;
  mnemoScale?: number;
};
