import Dexie, { type Table } from 'dexie';
import type { CardRecord, NoteRecord, ReviewRecord, SessionRecord, SettingsRecord, TreeNode } from '../types';

class remembreeDb extends Dexie {
  nodes!: Table<TreeNode, string>;
  notes!: Table<NoteRecord, string>;
  cards!: Table<CardRecord, string>;
  reviews!: Table<ReviewRecord, string>;
  sessions!: Table<SessionRecord, string>;
  settings!: Table<SettingsRecord, string>;

  constructor() {
    super('remembree-db');
    this.version(1).stores({
      nodes: 'id, parentId, createdAt',
      notes: 'id, nodeId, updatedAt',
      cards: 'id, nodeId, due, createdAt',
      reviews: 'id, cardId, timestamp',
      sessions: 'id, startedAt, endedAt',
      settings: 'id'
    });
    this.version(2).stores({
      nodes: 'id, parentId, order, createdAt',
      notes: 'id, nodeId, updatedAt',
      cards: 'id, nodeId, due, createdAt',
      reviews: 'id, cardId, sessionId, timestamp',
      sessions: 'id, startedAt, endedAt',
      settings: 'id'
    });
  }
}

export const db = new remembreeDb();
export const defaultSettings: SettingsRecord = {
  id: 'settings',
  theme: 'light',
  dayStartMinutes: 210,
  newCardsPerDay: 20,
  dailyGoal: 20,
  avgSecondsPerCard: 20,
  lastBackupAt: null
};

export async function ensureDefaultSettings(): Promise<void> {
  const existing = await db.settings.get('settings');
  if (!existing) {
    await db.settings.put({ ...defaultSettings });
  }
}
