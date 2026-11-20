import Dexie, { type Table } from 'dexie';
import { studyDayKey } from '../core/streak/streak';
import type {
  CardRecord,
  ImportRecord,
  NoteRecord,
  ReviewItemRecord,
  ReviewRecord,
  SessionRecord,
  SettingsRecord,
  TagRecord,
  TreeNode
} from '../types';

export class MomdoryDb extends Dexie {
  nodes!: Table<TreeNode, string>;
  notes!: Table<NoteRecord, string>;
  cards!: Table<CardRecord, string>;
  reviewItems!: Table<ReviewItemRecord, string>;
  reviews!: Table<ReviewRecord, string>;
  sessions!: Table<SessionRecord, string>;
  tags!: Table<TagRecord, string>;
  imports!: Table<ImportRecord, string>;
  settings!: Table<SettingsRecord, string>;

  constructor(databaseName = 'momdory-db') {
    super(databaseName);
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
    this.version(4).stores({
      nodes: 'id, parentId, order, createdAt',
      cards: 'id, nodeId, *tagIds, sourceKey, importId, createdAt, updatedAt',
      reviewItems: 'id, cardId, due, [cardId+direction]',
      reviews: 'id, reviewItemId, cardId, sessionId, timestamp, dayKey',
      sessions: 'id, startedAt, endedAt, dayKey, status',
      notes: 'id, nodeId, [nodeId+order], *tagIds, sourceKey, importId, updatedAt',
      tags: 'id, &name',
      imports: 'id, timestamp',
      settings: 'id'
    }).upgrade(async (tx) => {
      const cardsTable = tx.table('cards');
      const reviewItemsTable = tx.table('reviewItems');
      const cardToReviewItemId = new Map<string, string>();

      await cardsTable.toCollection().modify((card: Record<string, unknown>) => {
        const cardId = String(card.id);
        const createdAt = typeof card.createdAt === 'number' ? card.createdAt : Date.now();
        const reviewItemId = crypto.randomUUID();
        cardToReviewItemId.set(cardId, reviewItemId);

        const due = typeof card.due === 'number' ? card.due : createdAt;
        const stability = typeof card.stability === 'number' ? card.stability : 0;
        const difficulty = typeof card.difficulty === 'number' ? card.difficulty : 0;
        const state = typeof card.state === 'number' ? card.state : 0;
        const reps = typeof card.reps === 'number' ? card.reps : 0;
        const lapses = typeof card.lapses === 'number' ? card.lapses : 0;
        const lastReview = typeof card.lastReview === 'number' ? card.lastReview : null;
        const trap = Boolean(card.trap);

        void reviewItemsTable.add({
          id: reviewItemId,
          cardId,
          direction: 'forward',
          due,
          stability,
          difficulty,
          state,
          reps,
          lapses,
          lastReview,
          trap,
          createdAt
        });

        card.tagIds = Array.isArray(card.tagIds) ? card.tagIds : [];
        card.kind = 'basic';
        card.direction = 'one-way';
        card.explanation = null;
        card.starred = false;
        card.paused = false;
        card.sourceKey = null;
        card.importId = null;
        card.updatedAt = createdAt;
      });

      const reviewsTable = tx.table('reviews');
      await reviewsTable.toCollection().modify((review: Record<string, unknown>) => {
        const cardId = String(review.cardId);
        review.reviewItemId = cardToReviewItemId.get(cardId) ?? cardId;
        const rating = String(review.rating);
        let fsrsRating = 'good';
        if (rating === 'easy') fsrsRating = 'easy';
        else if (rating === 'medium') fsrsRating = 'good';
        else if (rating === 'hard' || rating === 'partial') fsrsRating = 'hard';
        else if (rating === 'blank' || rating === 'wrong') fsrsRating = 'again';
        review.fsrsRating = fsrsRating;
        review.fsrsLog = null;
        review.studyMode = 'single';
        const timestamp = typeof review.timestamp === 'number' ? review.timestamp : Date.now();
        review.dayKey = studyDayKey(timestamp, 210);
      });

      const sessionsTable = tx.table('sessions');
      const nodesTable = tx.table('nodes');
      const allNodes = await nodesTable.toArray();
      const nodeMap = new Map(allNodes.map((n: Record<string, unknown>) => [String(n.id), String(n.name)]));

      await sessionsTable.toCollection().modify((session: Record<string, unknown>) => {
        const endedAt = typeof session.endedAt === 'number' ? session.endedAt : null;
        const startedAt = typeof session.startedAt === 'number' ? session.startedAt : Date.now();
        const timeForDay = endedAt ?? startedAt;
        session.dayKey = studyDayKey(timeForDay, 210);
        const scopeId = session.scopeNodeId ? String(session.scopeNodeId) : null;
        session.scopeName = scopeId ? (nodeMap.get(scopeId) ?? 'All topics') : 'All topics';
        session.tagFilter = [];
        session.viewMode = 'cards';
        const oldQueue = Array.isArray(session.queueCardIds) ? session.queueCardIds : [];
        session.queueItemIds = oldQueue.map((cId: string) => cardToReviewItemId.get(cId) ?? cId);
      });

      const notesTable = tx.table('notes');
      const notes = await notesTable.toArray();
      const nodeNotesMap = new Map<string, Array<Record<string, unknown>>>();
      for (const note of notes) {
        const nId = String(note.nodeId);
        if (!nodeNotesMap.has(nId)) nodeNotesMap.set(nId, []);
        nodeNotesMap.get(nId)!.push(note);
      }
      for (const list of nodeNotesMap.values()) {
        list.sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
        for (let i = 0; i < list.length; i += 1) {
          const note = list[i];
          const createdAt = typeof note.createdAt === 'number' ? note.createdAt : Date.now();
          void notesTable.update(note.id, {
            type: 'normal',
            data: null,
            tagIds: [],
            color: null,
            style: null,
            starred: false,
            sourceKey: null,
            importId: null,
            order: i,
            updatedAt: typeof note.updatedAt === 'number' ? note.updatedAt : createdAt
          });
        }
      }

      await nodesTable.toCollection().modify((node: Record<string, unknown>) => {
        if (!node.updatedAt) {
          node.updatedAt = typeof node.createdAt === 'number' ? node.createdAt : Date.now();
        }
      });
    });
  }
}

export const db = new MomdoryDb();

if (typeof window !== 'undefined') {
  db.on('versionchange', () => {
    db.close();
    window.location.reload();
  });
}

export const defaultSettings: SettingsRecord = {
  id: 'settings',
  theme: 'light',
  dayStartMinutes: 210,
  newCardsPerDay: 20,
  dailyGoal: 20,
  avgSecondsPerCard: 20,
  lastBackupAt: null,
  desiredRetention: 0.9,
  showTags: true,
  showMnemoInSession: true
};

export async function ensureDefaultSettings(): Promise<void> {
  const existing = await db.settings.get('settings');
  if (!existing) {
    await db.settings.put({ ...defaultSettings });
  } else if (existing.desiredRetention === undefined) {
    await db.settings.update('settings', { desiredRetention: 0.9 });
  }
}
