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
    this.version(3).stores({
      nodes: 'id, parentId, order, createdAt',
      notes: 'id, nodeId, updatedAt',
      cards: 'id, nodeId, due, createdAt',
      reviews: 'id, cardId, sessionId, timestamp',
      sessions: 'id, startedAt, endedAt, status, completedAt',
      settings: 'id'
    }).upgrade(async (tx) => {
      await tx.table('sessions').toCollection().modify((session: Record<string, unknown>) => {
        const plannedCount = typeof session.plannedCount === 'number' ? session.plannedCount : 0;
        const completedCount = typeof session.completedCount === 'number' ? session.completedCount : 0;
        const isCompleted = completedCount >= plannedCount && plannedCount > 0;
        session.status = isCompleted ? 'completed' : 'abandoned';
        session.queueCardIds = Array.isArray(session.queueCardIds) ? session.queueCardIds : [];
        session.position = typeof session.position === 'number' ? session.position : completedCount;
        const endedAt = typeof session.endedAt === 'number' ? session.endedAt : null;
        const startedAt = typeof session.startedAt === 'number' ? session.startedAt : null;
        session.completedAt = isCompleted ? (endedAt ?? startedAt ?? Date.now()) : null;
      });
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
  lastBackupAt: null,
  showTags: true,
  showMnemoInSession: true
};

export async function ensureDefaultSettings(): Promise<void> {
  const existing = await db.settings.get('settings');
  if (!existing) {
    await db.settings.put({ ...defaultSettings });
  }
}
