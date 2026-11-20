import { useCallback } from 'react';
import { getRecallProbability, scheduleCardReview } from '../core/scheduler/reviewCard';
import { minutesToCount, selectSessionCards } from '../core/session/selectSessionCards';
import { spreadFamilies, getCardFamilyKey } from '../core/session/spreadFamilies';
import { getStudyDayStartTimestamp } from '../core/streak/streak';
import { db } from '../data/db';
import {
  abandonSession,
  completeSession,
  countNewCardsIntroducedSince,
  countReviews,
  createCard,
  createSession,
  getActiveSession,
  getSession,
  getSessionReviews,
  importCards,
  listAllCompletedSessions,
  listCardsInScope,
  listRecentSessions,
  previewCardImport,
  saveReview,
  updateSessionProgress
} from '../data/repositories/cardRepository';
import type { CardRecord, ReviewRating, SessionRecord, SettingsRecord, StudyMode } from '../types';

export function useCards() {
  const loadSessions = useCallback((): Promise<SessionRecord[]> => listRecentSessions(), []);
  const previewImport = useCallback(previewCardImport, []);
  const importFile = useCallback(importCards, []);
  const addCard = useCallback(createCard, []);

  const startSession = useCallback(async (
    scopeNodeId: string,
    mode: StudyMode,
    amount: number,
    unit: 'cards' | 'minutes',
    includeNew: boolean,
    settings: SettingsRecord,
    options?: {
      viewMode?: 'cards' | 'families';
      selectedFamilyKeys?: string[];
      starredOnly?: boolean;
    }
  ): Promise<{ session: SessionRecord | null; cards: CardRecord[] }> => {
    const now = Date.now();
    let [cards, reviewCount, newCardsToday] = await Promise.all([
      listCardsInScope(scopeNodeId),
      countReviews(),
      countNewCardsIntroducedSince(getStudyDayStartTimestamp(now, settings.dayStartMinutes))
    ]);

    if (options?.starredOnly) {
      cards = cards.filter((card) => card.starred);
    }

    if (options?.viewMode === 'families') {
      if (options.selectedFamilyKeys?.length) {
        const allowed = new Set(options.selectedFamilyKeys);
        cards = cards.filter((c) => allowed.has(getCardFamilyKey(c)));
      } else {
        // Keep all cards belonging to families of >= 2
        const counts = new Map<string, number>();
        for (const c of cards) {
          const k = getCardFamilyKey(c);
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
        cards = cards.filter((c) => (counts.get(getCardFamilyKey(c)) ?? 0) >= 2);
      }
    }

    const count = unit === 'minutes'
      ? minutesToCount(amount, settings.avgSecondsPerCard)
      : Math.max(0, Math.floor(amount));
    const selection = selectSessionCards(cards.map((card) => ({
      id: card.id,
      front: card.front,
      due: card.due ?? now,
      reviewed: card.lastReview != null,
      trap: Boolean(card.trap),
      recall: getRecallProbability(card, now)
    })), mode, count, {
      now,
      includeNew,
      newCardLimit: Math.max(0, settings.newCardsPerDay - newCardsToday),
      totalReviews: reviewCount
    });
    let selectedCards = selection
      .map((selected) => cards.find((card) => card.id === selected.id))
      .filter((card): card is CardRecord => card !== undefined);
    if (selectedCards.length === 0) return { session: null, cards: [] };

    // In single cards mode, ensure family members are kept >= 5 positions apart
    if (options?.viewMode !== 'families') {
      selectedCards = spreadFamilies(selectedCards, 5);
    }

    const session = await createSession({
      startedAt: now,
      scopeNodeId,
      mode,
      viewMode: options?.viewMode ?? 'cards',
      plannedCount: selectedCards.length,
      queueCardIds: selectedCards.map((c) => c.id)
    });
    return { session, cards: selectedCards };
  }, []);

  const resumeSession = useCallback(async (
    sessionOrId: SessionRecord | string
  ): Promise<{ session: SessionRecord; cards: CardRecord[] } | null> => {
    const session = typeof sessionOrId === 'string'
      ? await getSession(sessionOrId)
      : sessionOrId;
    if (!session) return null;
    const queueCardIds = session.queueCardIds ?? session.queueItemIds ?? [];
    const cards = await db.cards.where('id').anyOf(queueCardIds).toArray();
    const cardMap = new Map(cards.map((c) => [c.id, c]));
    const orderedCards = queueCardIds
      .map((id) => cardMap.get(id))
      .filter((card): card is CardRecord => card !== undefined);
    return { session, cards: orderedCards };
  }, []);

  const review = useCallback(async (
    card: CardRecord,
    sessionId: string,
    rating: ReviewRating,
    durationMs: number,
    studyMode: 'single' | 'family' = 'single'
  ) => {
    const now = Date.now();
    const updatedCard = scheduleCardReview(card, rating, now);
    await saveReview(card, sessionId, rating, durationMs, now, updatedCard, undefined, studyMode);
    return updatedCard;
  }, []);

  const loadReviews = useCallback(getSessionReviews, []);
  const loadCompletedSessions = useCallback(listAllCompletedSessions, []);
  const saveProgress = useCallback(updateSessionProgress, []);
  const finish = useCallback(completeSession, []);
  const discard = useCallback(abandonSession, []);
  const checkActiveSession = useCallback(getActiveSession, []);

  return {
    loadSessions,
    previewImport,
    importFile,
    addCard,
    startSession,
    resumeSession,
    review,
    loadReviews,
    loadCompletedSessions,
    saveProgress,
    finish,
    discard,
    checkActiveSession
  };
}
