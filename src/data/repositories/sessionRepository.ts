import { db } from '../db';
import type { CardRecord, ReviewRecord, SessionRecord, StudyMode } from '../../types';

export interface CreateSessionParams {
  startedAt?: number;
  scopeNodeId: string | null;
  mode: StudyMode;
  plannedCount: number;
  queueCardIds: string[];
  viewMode?: 'cards' | 'families';
  tagFilter?: string[];
  scopeName?: string;
}

export async function createSession(
  paramsOrStartedAt: CreateSessionParams | number,
  scopeNodeId?: string | null,
  mode?: StudyMode,
  plannedCount?: number,
  queueCardIds: string[] = []
): Promise<SessionRecord> {
  const params: CreateSessionParams = typeof paramsOrStartedAt === 'object'
    ? paramsOrStartedAt
    : {
        startedAt: paramsOrStartedAt,
        scopeNodeId: scopeNodeId ?? null,
        mode: mode ?? 'about-to-forget',
        plannedCount: plannedCount ?? queueCardIds.length,
        queueCardIds
      };

  const now = params.startedAt ?? Date.now();
  const session: SessionRecord = {
    id: crypto.randomUUID(),
    startedAt: now,
    endedAt: now,
    scopeNodeId: params.scopeNodeId,
    scopeName: params.scopeName,
    mode: params.mode,
    viewMode: params.viewMode ?? 'cards',
    tagFilter: params.tagFilter ?? [],
    plannedCount: params.plannedCount,
    completedCount: 0,
    status: 'in-progress',
    queueCardIds: params.queueCardIds,
    position: 0,
    completedAt: null
  };
  await db.sessions.add(session);
  return session;
}

export async function updateSessionProgress(
  sessionId: string,
  position: number,
  completedCount: number,
  queueCardIds?: string[]
): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) return;
  const updates: Partial<SessionRecord> = {
    position,
    completedCount
  };
  if (queueCardIds) {
    updates.queueCardIds = queueCardIds;
    updates.plannedCount = queueCardIds.length;
  }
  await db.sessions.update(sessionId, updates);
}

export async function completeSession(sessionId: string, completedCount: number): Promise<SessionRecord> {
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error('Session not found.');
  const now = Date.now();
  const updated: SessionRecord = {
    ...session,
    endedAt: now,
    completedAt: now,
    completedCount,
    status: 'completed'
  };
  await db.sessions.put(updated);
  return updated;
}

export async function finishSession(sessionId: string, completedCount: number): Promise<SessionRecord> {
  return completeSession(sessionId, completedCount);
}

export async function abandonSession(sessionId: string): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) return;
  await db.sessions.update(sessionId, {
    status: 'abandoned',
    endedAt: Date.now()
  });
}

export async function getActiveSession(): Promise<SessionRecord | null> {
  const inProgress = await db.sessions
    .where('status')
    .equals('in-progress')
    .reverse()
    .sortBy('startedAt');
  return inProgress[0] ?? null;
}

export async function getSession(id: string): Promise<SessionRecord | undefined> {
  return db.sessions.get(id);
}

export async function listRecentSessions(limit = 20): Promise<SessionRecord[]> {
  return db.sessions.orderBy('startedAt').reverse().limit(limit).toArray();
}

export async function listAllCompletedSessions(): Promise<SessionRecord[]> {
  return db.sessions.where('status').equals('completed').toArray();
}

export async function getSessionReviews(sessionId: string): Promise<ReviewRecord[]> {
  return db.reviews.where('sessionId').equals(sessionId).toArray();
}

export type SessionReviewItem = { review: ReviewRecord; card: CardRecord | null };

export type SessionDetail = {
  session: SessionRecord;
  items: SessionReviewItem[];
  /** Cards still waiting in an unfinished session's queue. */
  remaining: CardRecord[];
};

export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  const session = await db.sessions.get(sessionId);
  if (!session) return null;
  const reviews = (await getSessionReviews(sessionId)).sort((a, b) => a.timestamp - b.timestamp);
  const queue = session.queueCardIds ?? session.queueItemIds ?? [];
  const waitingIds = session.status === 'completed' ? [] : queue.slice(session.position);
  const ids = [...new Set([...reviews.map((review) => review.cardId), ...waitingIds])];
  const cards = await db.cards.bulkGet(ids);
  const byId = new Map(cards.filter((card): card is CardRecord => card !== undefined).map((card) => [card.id, card]));
  return {
    session,
    items: reviews.map((review) => ({ review, card: byId.get(review.cardId) ?? null })),
    remaining: waitingIds.map((id) => byId.get(id)).filter((card): card is CardRecord => card !== undefined)
  };
}
