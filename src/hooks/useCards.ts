import { useCallback } from 'react';
import { getRecallProbability, scheduleCardReview } from '../core/scheduler/reviewCard';
import { minutesToCount, selectSessionCards } from '../core/session/selectSessionCards';
import { getStudyDayStartTimestamp } from '../core/streak/streak';
import {
  countNewCardsIntroducedSince,
  countReviews,
  createCard,
  createSession,
  finishSession,
  importCards,
  listCardsInScope,
  listRecentSessions,
  previewCardImport,
  saveReview
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
  ): Promise<{ sessionId: string; cards: CardRecord[] }> => {
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
    if (selectedCards.length === 0) return { sessionId: '', cards: [] };
    const sessionId = await createSession(now, scopeNodeId, mode, selectedCards.length);
    return { sessionId, cards: selectedCards };
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

  const finish = useCallback(finishSession, []);

  return { loadSessions, previewImport, importFile, addCard, startSession, review, finish };
}
