import { db } from '../db';
import type { ReviewRecord, SessionRecord, StudyMode } from '../../types';

export interface CreateSessionParams {
  startedAt?: number;
  scopeNodeId: string | null;
  mode: StudyMode;
  plannedCount: number;
  queueCardIds: string[];
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
    mode: params.mode,
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
