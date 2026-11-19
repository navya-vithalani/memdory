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
};

export type NoteRecord = {
  id: string;
  nodeId: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
};

export type CardRecord = {
  id: string;
  nodeId: string;
  front: string;
  back: string;
  trap: boolean;
  createdAt: number;
  due: number;
  stability: number;
  difficulty: number;
  state: number;
  reps: number;
  lapses: number;
  lastReview: number | null;
};

export type ReviewRecord = {
  id: string;
  cardId: string;
  sessionId: string;
  rating: ReviewRating;
  durationMs: number;
  timestamp: number;
};

export type SessionRecord = {
  id: string;
  startedAt: number;
  endedAt: number;
  scopeNodeId: string | null;
  mode: StudyMode;
  plannedCount: number;
  completedCount: number;
  status: SessionStatus;
  queueCardIds: string[];
  position: number;
  completedAt: number | null;
};

export type SettingsRecord = {
  id: string;
  theme: ThemeName;
  dayStartMinutes: number;
  newCardsPerDay: number;
  dailyGoal: number;
  avgSecondsPerCard: number;
  lastBackupAt: number | null;
  showTags?: boolean;
  showMnemoInSession?: boolean;
};
