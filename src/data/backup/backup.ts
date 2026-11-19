import { db } from '../db';
import type { CardRecord, NoteRecord, ReviewRecord, SessionRecord, SettingsRecord, TreeNode } from '../../types';

const schemaVersion = 1;

export type BackupPayload = {
  schemaVersion: number;
  exportedAt: string;
  tables: {
    nodes: TreeNode[];
    notes: NoteRecord[];
    cards: CardRecord[];
    reviews: ReviewRecord[];
    sessions: SessionRecord[];
    settings: SettingsRecord[];
  };
};

type BackupMode = 'merge' | 'replace';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRecordArray<T>(value: unknown, requiredFields: string[]): value is T[] {
  return Array.isArray(value) && value.every((item) =>
    isRecord(item)
    && typeof item.id === 'string'
    && requiredFields.every((field) => field in item)
  );
}

function parseBackup(source: string): BackupPayload {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (!isRecord(value) || value.schemaVersion !== schemaVersion || !isRecord(value.tables)) {
    throw new Error('This backup version is not supported.');
  }
  const tables = value.tables;
  if (
    !isRecordArray<TreeNode>(tables.nodes, ['parentId', 'name', 'order', 'createdAt'])
    || !isRecordArray<NoteRecord>(tables.notes, ['nodeId', 'title', 'body', 'createdAt', 'updatedAt'])
    || !isRecordArray<CardRecord>(tables.cards, ['nodeId', 'front', 'back', 'due', 'stability', 'difficulty', 'lastReview'])
    || !isRecordArray<ReviewRecord>(tables.reviews, ['cardId', 'sessionId', 'rating', 'durationMs', 'timestamp'])
    || !isRecordArray<SessionRecord>(tables.sessions, ['startedAt', 'endedAt', 'mode', 'plannedCount', 'completedCount'])
    || !isRecordArray<SettingsRecord>(tables.settings, ['theme', 'dayStartMinutes', 'newCardsPerDay', 'dailyGoal'])
    || !tables.settings.some((setting) => setting.id === 'settings')
  ) {
    throw new Error('This backup is missing required data or contains an invalid table.');
  }
  return value as BackupPayload;
}

export async function createBackup(): Promise<BackupPayload> {
  const [nodes, notes, cards, reviews, sessions, settings] = await Promise.all([
    db.nodes.toArray(),
    db.notes.toArray(),
    db.cards.toArray(),
    db.reviews.toArray(),
    db.sessions.toArray(),
    db.settings.toArray()
  ]);
  return {
    schemaVersion,
    exportedAt: new Date().toISOString(),
    tables: { nodes, notes, cards, reviews, sessions, settings }
  };
}

export async function restoreBackup(source: string, mode: BackupMode): Promise<SettingsRecord | undefined> {
  const backup = parseBackup(source);
  const tables = backup.tables;
  await db.transaction('rw', db.tables, async () => {
    if (mode === 'replace') {
      await Promise.all([
        db.nodes.clear(),
        db.notes.clear(),
        db.cards.clear(),
        db.reviews.clear(),
        db.sessions.clear(),
        db.settings.clear()
      ]);
    }
    const normalizedSessions = tables.sessions.map((session) => {
      const isCompleted = (session.completedCount ?? 0) >= (session.plannedCount ?? 0) && (session.plannedCount ?? 0) > 0;
      return {
        ...session,
        status: session.status || (isCompleted ? 'completed' : 'abandoned'),
        queueCardIds: session.queueCardIds || [],
        position: session.position ?? session.completedCount ?? 0,
        completedAt: session.completedAt !== undefined ? session.completedAt : (isCompleted ? (session.endedAt || session.startedAt) : null)
      };
    });
    await Promise.all([
      tables.nodes.length && db.nodes.bulkPut(tables.nodes),
      tables.notes.length && db.notes.bulkPut(tables.notes),
      tables.cards.length && db.cards.bulkPut(tables.cards),
      tables.reviews.length && db.reviews.bulkPut(tables.reviews),
      normalizedSessions.length && db.sessions.bulkPut(normalizedSessions),
      tables.settings.length && db.settings.bulkPut(tables.settings)
    ]);
  });
  return tables.settings.find((setting) => setting.id === 'settings');
}
