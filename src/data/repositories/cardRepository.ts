import { createEmptyCard, State } from 'ts-fsrs';
import { getDescendantIds } from '../../core/tree/tree';
import { parseCards, type ParsedCard } from '../../core/importers/cardParser';
import { normalizeTagName } from '../../core/importers/importParser';
import { scheduleReviewItem } from '../../core/scheduler/reviewCard';
import { studyDayKey } from '../../core/streak/streak';
import { db, defaultSettings } from '../db';
import type { CardRecord, ReviewItemRecord, ReviewRating } from '../../types';

function normalizeFront(front: string): string {
  return front.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

export type StudyCardItem = {
  card: CardRecord;
  reviewItem: ReviewItemRecord;
  /** Effective front shown on card (swapped for reverse direction) */
  displayFront: string;
  /** Effective back shown on card (swapped for reverse direction) */
  displayBack: string;
};

export async function listStudyItemsInScope(nodeId: string | null): Promise<StudyCardItem[]> {
  const nodeIds = nodeId === null
    ? null
    : getDescendantIds(await db.nodes.toArray(), nodeId);

  const cards = nodeIds === null
    ? await db.cards.filter((c) => !c.paused).toArray()
    : await db.cards.where('nodeId').anyOf(nodeIds).filter((c) => !c.paused).toArray();

  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const cardIds = cards.map((c) => c.id);
  const items = await db.reviewItems.where('cardId').anyOf(cardIds).toArray();

  return items
    .map((reviewItem) => {
      const card = cardMap.get(reviewItem.cardId);
      if (!card) return null;
      const isRev = reviewItem.direction === 'reverse';
      return {
        card,
        reviewItem,
        displayFront: isRev ? card.back : card.front,
        displayBack: isRev ? card.front : card.back
      };
    })
    .filter((entry): entry is StudyCardItem => entry !== null);
}

export async function hydrateCardsWithReviewItems(cards: CardRecord[]): Promise<CardRecord[]> {
  if (cards.length === 0) return [];
  const cardIds = cards.map((c) => c.id);
  const reviewItems = await db.reviewItems.where('cardId').anyOf(cardIds).toArray();
  const itemMap = new Map<string, ReviewItemRecord>();
  for (const item of reviewItems) {
    const existing = itemMap.get(item.cardId);
    if (!existing) {
      itemMap.set(item.cardId, item);
    } else {
      if (existing.lastReview == null && item.lastReview != null) {
        itemMap.set(item.cardId, item);
      } else if (existing.lastReview != null && item.lastReview != null && item.due < existing.due) {
        itemMap.set(item.cardId, item);
      } else if (existing.lastReview == null && item.lastReview == null && item.due < existing.due) {
        itemMap.set(item.cardId, item);
      }
    }
  }

  return cards.map((card) => {
    const item = itemMap.get(card.id);
    if (!item) return card;
    return {
      ...card,
      due: item.due,
      stability: item.stability,
      difficulty: item.difficulty,
      state: item.state,
      reps: item.reps,
      lapses: item.lapses,
      lastReview: item.lastReview,
      trap: item.trap,
      reviewItemId: item.id
    };
  });
}

export async function listCardsInScope(nodeId: string | null): Promise<CardRecord[]> {
  const nodeIds = nodeId === null
    ? null
    : getDescendantIds(await db.nodes.toArray(), nodeId);

  const cards = nodeIds === null
    ? await db.cards.toArray()
    : await db.cards.where('nodeId').anyOf(nodeIds).toArray();

  const hydrated = await hydrateCardsWithReviewItems(cards);
  return hydrated.sort((a, b) => (a.due ?? a.createdAt) - (b.due ?? b.createdAt));
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
  const cardsToAdd: CardRecord[] = [];
  const reviewItemsToAdd: ReviewItemRecord[] = [];

  for (const parsed of preview.cards) {
    const cardId = crypto.randomUUID();
    const empty = createEmptyCard(new Date(now));

    cardsToAdd.push({
      id: cardId,
      nodeId,
      front: parsed.front,
      back: parsed.back,
      explanation: null,
      tagIds: [],
      kind: 'basic',
      direction: 'one-way',
      starred: false,
      paused: false,
      sourceKey: null,
      importId: null,
      createdAt: now,
      updatedAt: now
    });

    reviewItemsToAdd.push({
      id: crypto.randomUUID(),
      cardId,
      direction: 'forward',
      due: now,
      stability: empty.stability,
      difficulty: empty.difficulty,
      state: State.New,
      reps: empty.reps,
      lapses: empty.lapses,
      lastReview: null,
      trap: false,
      createdAt: now
    });
  }

  if (cardsToAdd.length) {
    await db.transaction('rw', db.cards, db.reviewItems, async () => {
      await db.cards.bulkAdd(cardsToAdd);
      await db.reviewItems.bulkAdd(reviewItemsToAdd);
    });
  }

  return { added: cardsToAdd.length, skipped: preview.skipped, invalid: preview.invalid };
}

export async function createCard(
  nodeId: string,
  front: string,
  back: string,
  options?: {
    explanation?: string | null;
    tags?: string[];
    direction?: 'one-way' | 'both';
    starred?: boolean;
  }
): Promise<CardRecord> {
  const cleanFront = front.trim();
  const cleanBack = back.trim();
  if (!cleanFront || !cleanBack) throw new Error('Add both a question and an answer.');
  if (!await db.nodes.get(nodeId)) throw new Error('The selected topic no longer exists.');
  const now = Date.now();
  const cardId = crypto.randomUUID();
  const empty = createEmptyCard(new Date(now));

  const tagIds: string[] = [];
  if (options?.tags?.length) {
    for (const rawTag of options.tags) {
      const { key, label } = normalizeTagName(rawTag);
      let existing = await db.tags.where('name').equals(key).first();
      if (!existing) {
        existing = { id: crypto.randomUUID(), name: key, label, createdAt: now };
        await db.tags.add(existing);
      }
      tagIds.push(existing.id);
    }
  }

  const direction = options?.direction ?? 'one-way';
  const card: CardRecord = {
    id: cardId,
    nodeId,
    front: cleanFront,
    back: cleanBack,
    explanation: options?.explanation ?? null,
    tagIds,
    kind: 'basic',
    direction,
    starred: Boolean(options?.starred),
    paused: false,
    sourceKey: null,
    importId: null,
    createdAt: now,
    updatedAt: now
  };

  await db.transaction('rw', db.cards, db.reviewItems, async () => {
    await db.cards.add(card);
    await db.reviewItems.add({
      id: crypto.randomUUID(),
      cardId,
      direction: 'forward',
      due: now,
      stability: empty.stability,
      difficulty: empty.difficulty,
      state: State.New,
      reps: empty.reps,
      lapses: empty.lapses,
      lastReview: null,
      trap: false,
      createdAt: now
    });
    if (direction === 'both') {
      await db.reviewItems.add({
        id: crypto.randomUUID(),
        cardId,
        direction: 'reverse',
        due: now,
        stability: empty.stability,
        difficulty: empty.difficulty,
        state: State.New,
        reps: empty.reps,
        lapses: empty.lapses,
        lastReview: null,
        trap: false,
        createdAt: now
      });
    }
  });

  return card;
}

export async function updateCardRecord(
  cardId: string,
  updates: {
    front?: string;
    back?: string;
    explanation?: string | null;
    tags?: string[];
    direction?: 'one-way' | 'both';
    starred?: boolean;
    paused?: boolean;
  }
): Promise<CardRecord> {
  const card = await db.cards.get(cardId);
  if (!card) throw new Error('Card not found');
  const now = Date.now();
  let tagIds = card.tagIds ?? [];

  if (updates.tags) {
    tagIds = [];
    for (const rawTag of updates.tags) {
      const { key, label } = normalizeTagName(rawTag);
      let existing = await db.tags.where('name').equals(key).first();
      if (!existing) {
        existing = { id: crypto.randomUUID(), name: key, label, createdAt: now };
        await db.tags.add(existing);
      }
      tagIds.push(existing.id);
    }
  }

  const updated: CardRecord = {
    ...card,
    front: updates.front !== undefined ? updates.front.trim() : card.front,
    back: updates.back !== undefined ? updates.back.trim() : card.back,
    explanation: updates.explanation !== undefined ? updates.explanation : card.explanation,
    tagIds,
    direction: updates.direction !== undefined ? updates.direction : card.direction,
    starred: updates.starred !== undefined ? updates.starred : card.starred,
    paused: updates.paused !== undefined ? updates.paused : card.paused,
    updatedAt: now
  };

  await db.cards.put(updated);
  return updated;
}

export async function deleteCardRecord(cardId: string): Promise<void> {
  await db.transaction('rw', [db.cards, db.reviewItems, db.reviews], async () => {
    await db.cards.delete(cardId);
    await db.reviewItems.where('cardId').equals(cardId).delete();
    await db.reviews.where('cardId').equals(cardId).delete();
  });
}

export {
  createSession,
  finishSession,
  completeSession,
  abandonSession,
  updateSessionProgress,
  getActiveSession,
  getSession,
  listRecentSessions,
  listAllCompletedSessions,
  getSessionReviews,
  getSessionDetail
} from './sessionRepository';
export type { SessionDetail, SessionReviewItem } from './sessionRepository';

export async function saveReview(
  card: CardRecord,
  sessionId: string,
  rating: ReviewRating,
  durationMs: number,
  timestamp: number,
  updatedCard?: CardRecord,
  reviewItemId?: string,
  studyMode: 'single' | 'family' = 'single'
): Promise<void> {
  await db.transaction('rw', db.cards, db.reviewItems, db.reviews, db.settings, async () => {
    const settings = await db.settings.get('settings');
    const dayStart = settings?.dayStartMinutes ?? 210;
    const dayKey = studyDayKey(timestamp, dayStart);
    const retention = settings?.desiredRetention ?? 0.9;

    const effectiveItemId = reviewItemId || (card as unknown as { reviewItemId?: string }).reviewItemId;
    let targetItem: ReviewItemRecord | undefined;
    if (effectiveItemId) {
      targetItem = await db.reviewItems.get(effectiveItemId);
    }
    if (!targetItem) {
      targetItem = await db.reviewItems.where('cardId').equals(card.id).first();
    }

    if (targetItem) {
      const scheduleResult = scheduleReviewItem(targetItem, rating, timestamp, retention);
      await db.reviewItems.put(scheduleResult.item);
      await db.reviews.add({
        id: crypto.randomUUID(),
        reviewItemId: scheduleResult.item.id,
        cardId: card.id,
        sessionId,
        rating,
        fsrsRating: scheduleResult.fsrsRating,
        fsrsLog: scheduleResult.fsrsLog,
        durationMs,
        timestamp,
        dayKey,
        studyMode
      });
    }

    if (updatedCard) {
      await db.cards.put(updatedCard);
    }

    const previousReviewCount = await db.reviews.count();
    const priorAverage = settings?.avgSecondsPerCard ?? defaultSettings.avgSecondsPerCard;
    const average = previousReviewCount <= 1
      ? durationMs / 1000
      : (priorAverage * (previousReviewCount - 1) + durationMs / 1000) / previousReviewCount;

    await db.settings.update('settings', {
      avgSecondsPerCard: Math.max(1, average)
    });
  });
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
