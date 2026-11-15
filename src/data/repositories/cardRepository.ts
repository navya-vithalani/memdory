import { createEmptyCard, State } from 'ts-fsrs';
import { getDescendantIds } from '../../core/tree/tree';
import { parseCards, type ParsedCard } from '../../core/importers/cardParser';
import { db, defaultSettings } from '../db';
import type { CardRecord, ReviewRating, StudyMode } from '../../types';

function normalizeFront(front: string): string {
  return front.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

export async function listCardsInScope(nodeId: string | null): Promise<CardRecord[]> {
  const cards = nodeId === null
    ? await db.cards.toArray()
    : await (async () => {
      const nodes = await db.nodes.toArray();
      const nodeIds = getDescendantIds(nodes, nodeId);
      return db.cards.where('nodeId').anyOf(nodeIds).toArray();
    })();
  return cards.sort((a, b) => a.due - b.due || a.createdAt - b.createdAt);
}

export async function previewCardImport(nodeId: string, source: string): Promise<{
  cards: ParsedCard[];
  skipped: number;
  invalid: number;
}> {
  const parsed = parseCards(source);
  const existing = await db.cards.where('nodeId').equals(nodeId).toArray();
  const knownFronts = new Set(existing.map((card) => normalizeFront(card.front)));
  const cards: ParsedCard[] = [];
  let duplicateCount = 0;
  for (const card of parsed.cards) {
    const key = normalizeFront(card.front);
    if (knownFronts.has(key)) {
      duplicateCount += 1;
      continue;
    }
    knownFronts.add(key);
    cards.push(card);
  }
  return { cards, skipped: parsed.skipped + duplicateCount, invalid: parsed.invalid };
}

export async function importCards(nodeId: string, source: string): Promise<{ added: number; skipped: number; invalid: number }> {
  const preview = await previewCardImport(nodeId, source);
  const now = Date.now();
  const records = preview.cards.map((parsed) => {
    const empty = createEmptyCard(new Date(now));
    const card: CardRecord = {
      id: crypto.randomUUID(),
      nodeId,
      front: parsed.front,
      back: parsed.back,
      trap: false,
      createdAt: now,
      due: now,
      stability: empty.stability,
      difficulty: empty.difficulty,
      state: State.New,
      reps: empty.reps,
      lapses: empty.lapses,
      lastReview: null
    };
    return card;
  });
  if (records.length) await db.cards.bulkAdd(records);
  return { added: records.length, skipped: preview.skipped, invalid: preview.invalid };
}

export async function createCard(nodeId: string, front: string, back: string): Promise<CardRecord> {
  const cleanFront = front.trim();
  const cleanBack = back.trim();
  if (!cleanFront || !cleanBack) throw new Error('Add both a question and an answer.');
  if (!await db.nodes.get(nodeId)) throw new Error('The selected topic no longer exists.');
  const now = Date.now();
  const empty = createEmptyCard(new Date(now));
  const card: CardRecord = {
    id: crypto.randomUUID(),
    nodeId,
    front: cleanFront,
    back: cleanBack,
    trap: false,
    createdAt: now,
    due: now,
    stability: empty.stability,
    difficulty: empty.difficulty,
    state: State.New,
    reps: empty.reps,
    lapses: empty.lapses,
    lastReview: null
  };
  await db.cards.add(card);
  return card;
}

export async function createSession(startedAt: number, scopeNodeId: string | null, mode: StudyMode, plannedCount: number): Promise<string> {
  const id = crypto.randomUUID();
  await db.sessions.add({
    id,
    startedAt,
    endedAt: startedAt,
    scopeNodeId,
    mode,
    plannedCount,
    completedCount: 0
  });
  return id;
}

export async function saveReview(
  card: CardRecord,
  sessionId: string,
  rating: ReviewRating,
  durationMs: number,
  timestamp: number,
  updatedCard: CardRecord
): Promise<void> {
  await db.transaction('rw', db.cards, db.reviews, db.settings, async () => {
    const [settings, previousReviewCount] = await Promise.all([
      db.settings.get('settings'),
      db.reviews.count()
    ]);
    await db.cards.put(updatedCard);
    await db.reviews.add({
      id: crypto.randomUUID(),
      cardId: card.id,
      sessionId,
      rating,
      durationMs,
      timestamp
    });
    const priorAverage = settings?.avgSecondsPerCard ?? defaultSettings.avgSecondsPerCard;
    const average = previousReviewCount === 0
      ? durationMs / 1000
      : (priorAverage * previousReviewCount + durationMs / 1000) / (previousReviewCount + 1);
    await db.settings.put({
      ...(settings ?? defaultSettings),
      avgSecondsPerCard: Math.max(1, average)
    });
  });
}

export async function finishSession(sessionId: string, completedCount: number): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error('Session not found.');
  await db.sessions.put({ ...session, endedAt: Date.now(), completedCount });
}

export async function listRecentSessions(limit = 10) {
  return db.sessions.orderBy('startedAt').reverse().limit(limit).toArray();
}

export async function countReviews(): Promise<number> {
  return db.reviews.count();
}

export async function countNewCardsIntroducedSince(startedAt: number): Promise<number> {
  const reviews = await db.reviews.where('timestamp').aboveOrEqual(startedAt).toArray();
  const cardIds = [...new Set(reviews.map((review) => review.cardId))];
  let count = 0;
  for (const cardId of cardIds) {
    const cardReviews = await db.reviews.where('cardId').equals(cardId).toArray();
    const firstReviewedAt = Math.min(...cardReviews.map((review) => review.timestamp));
    if (firstReviewedAt >= startedAt) count += 1;
  }
  return count;
}
