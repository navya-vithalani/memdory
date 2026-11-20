import { useCallback } from 'react';
import { getRecallProbability, scheduleCardReview } from '../core/scheduler/reviewCard';
import { minutesToCount, selectSessionCards } from '../core/session/selectSessionCards';
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
    settings: SettingsRecord
  ): Promise<{ session: SessionRecord | null; cards: CardRecord[] }> => {
    const now = Date.now();
    const [cards, reviewCount, newCardsToday] = await Promise.all([
      listCardsInScope(scopeNodeId),
      countReviews(),
      countNewCardsIntroducedSince(getStudyDayStartTimestamp(now, settings.dayStartMinutes))
    ]);
    const count = unit === 'minutes'
      ? minutesToCount(amount, settings.avgSecondsPerCard)
      : Math.max(0, Math.floor(amount));
    const selection = selectSessionCards(cards.map((card) => ({
      id: card.id,
      front: card.front,
      due: card.due,
      reviewed: card.lastReview !== null,
      trap: card.trap,
      recall: getRecallProbability(card, now)
    })), mode, count, {
      now,
      includeNew,
      newCardLimit: Math.max(0, settings.newCardsPerDay - newCardsToday),
      totalReviews: reviewCount
    });
    const selectedCards = selection
      .map((selected) => cards.find((card) => card.id === selected.id))
      .filter((card): card is CardRecord => card !== undefined);
    if (selectedCards.length === 0) return { session: null, cards: [] };

    const session = await createSession({
      startedAt: now,
      scopeNodeId,
      mode,
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
    const cards = await db.cards.where('id').anyOf(session.queueCardIds).toArray();
    const cardMap = new Map(cards.map((c) => [c.id, c]));
    const orderedCards = session.queueCardIds
      .map((id) => cardMap.get(id))
      .filter((card): card is CardRecord => card !== undefined);
    return { session, cards: orderedCards };
  }, []);

  const review = useCallback(async (
    card: CardRecord,
    sessionId: string,
    rating: ReviewRating,
    durationMs: number
  ) => {
    const now = Date.now();
    const updatedCard = scheduleCardReview(card, rating, now);
    await saveReview(card, sessionId, rating, durationMs, now, updatedCard);
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
