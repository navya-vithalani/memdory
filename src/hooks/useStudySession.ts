import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getStreakCelebration, type StreakCelebration } from '../core/streak/streak';
import { deriveCardFamilies, type CardFamilyGroup } from '../core/session/familyCards';
import { db } from '../data/db';
import type { CardRecord, ReviewRating } from '../types';
import { useCards } from './useCards';
import { useSettings } from './useSettings';

const POSITIVE: ReviewRating[] = ['easy', 'medium', 'hard', 'partial'];

type Options = {
  sessionId: string;
  cards: CardRecord[];
  initialPosition: number;
};

export type RatingEvent = { rating: ReviewRating; id: number };

/** Owns the study-session state machine so the screen components only render. */
export function useStudySession({ sessionId, cards, initialPosition }: Options) {
  const { review, loadReviews, loadCompletedSessions, saveProgress, finish } = useCards();
  const { settings } = useSettings();

  const [queue, setQueue] = useState(cards);
  const [position, setPosition] = useState(initialPosition);
  const [revealed, setRevealed] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [hydrated, setHydrated] = useState(initialPosition === 0);
  const [submitting, setSubmitting] = useState(false);
  const [wrongFeedback, setWrongFeedback] = useState(false);
  const [finished, setFinished] = useState(false);
  const [celebration, setCelebration] = useState<StreakCelebration | null>(null);
  const [error, setError] = useState('');
  const [ratingEvent, setRatingEvent] = useState<RatingEvent | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [viewMode, setViewMode] = useState<'cards' | 'families'>('cards');
  const [familyIndex, setFamilyIndex] = useState(0);
  const [gradedInFamily, setGradedInFamily] = useState<Map<string, ReviewRating>>(new Map());

  const requeuedWrong = useRef(new Set<string>());
  const cardStartedAt = useRef(Date.now());
  const sittingStartedAt = useRef(Date.now());
  const eventCounter = useRef(0);
  const current = queue[position];

  useEffect(() => {
    void db.sessions.get(sessionId).then((s) => {
      if (s?.viewMode === 'families') {
        setViewMode('families');
      }
    });
  }, [sessionId]);

  const familyGroups = useMemo<CardFamilyGroup[]>(() => {
    if (viewMode !== 'families') return [];
    return deriveCardFamilies(queue);
  }, [queue, viewMode]);

  const currentFamily = familyGroups[familyIndex] ?? null;

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // A resumed session has already earned some answers: restore the counters from its saved reviews.
  useEffect(() => {
    if (initialPosition === 0) return;
    let active = true;
    loadReviews(sessionId)
      .then((reviews) => {
        if (!active) return;
        setCompleted(reviews.length);
        setCorrect(reviews.filter((item) => POSITIVE.includes(item.rating)).length);
        reviews.filter((item) => item.rating === 'wrong').forEach((item) => requeuedWrong.current.add(item.cardId));
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not restore this session.');
      })
      .finally(() => {
        if (active) {
          cardStartedAt.current = Date.now();
          setHydrated(true);
        }
      });
    return () => {
      active = false;
    };
  }, [initialPosition, loadReviews, sessionId]);

  // Mnemo reacts for a moment, then settles back.
  useEffect(() => {
    if (!ratingEvent) return;
    const timer = window.setTimeout(() => setRatingEvent(null), 1400);
    return () => window.clearTimeout(timer);
  }, [ratingEvent]);

  const flip = useCallback(() => {
    setFlipped((value) => !value);
    setRevealed(true);
  }, []);

  const finishSession = useCallback(async (total: number) => {
    setFinished(true);
    try {
      await finish(sessionId, total);
      // Load AFTER completing so the new session counts, and load all of them so long streaks are right.
      setCelebration(getStreakCelebration(await loadCompletedSessions(), sessionId, settings.dayStartMinutes));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not complete the session.');
    }
  }, [finish, loadCompletedSessions, sessionId, settings.dayStartMinutes]);

  const rate = useCallback(async (rating: ReviewRating) => {
    if (!current || !revealed || submitting || !hydrated) return;
    const answeredAfterMs = Math.max(0, Date.now() - cardStartedAt.current);
    setSubmitting(true);
    eventCounter.current += 1;
    setRatingEvent({ rating, id: eventCounter.current });
    if (rating === 'wrong') {
      setWrongFeedback(true);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 260));
    }
    try {
      const updated = await review(current, sessionId, rating, answeredAfterMs);
      const nextQueue = [...queue];
      nextQueue[position] = updated;
      let queueChanged = false;
      if (rating === 'wrong' && !requeuedWrong.current.has(current.id)) {
        requeuedWrong.current.add(current.id);
        nextQueue.splice(Math.min(position + 3, nextQueue.length), 0, updated);
        queueChanged = true;
      }
      const nextCompleted = completed + 1;
      setQueue(nextQueue);
      setCompleted(nextCompleted);
      setCorrect(correct + (POSITIVE.includes(rating) ? 1 : 0));

      if (position + 1 >= nextQueue.length) {
        await finishSession(nextCompleted);
        return;
      }
      await saveProgress(sessionId, position + 1, nextCompleted, queueChanged ? nextQueue.map((card) => card.id) : undefined);
      setPosition(position + 1);
      cardStartedAt.current = Date.now();
      setFlipped(false);
      setRevealed(false);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this review.');
    } finally {
      setWrongFeedback(false);
      setSubmitting(false);
    }
  }, [completed, correct, current, finishSession, hydrated, position, queue, review, revealed, saveProgress, sessionId, submitting]);

  const rateFamilyCard = useCallback(async (card: CardRecord, rating: ReviewRating) => {
    eventCounter.current += 1;
    setRatingEvent({ rating, id: eventCounter.current });
    try {
      await review(card, sessionId, rating, 1000, 'family');
      setGradedInFamily((prev) => new Map(prev).set(card.id, rating));
      setCompleted((c) => c + 1);
      if (POSITIVE.includes(rating)) {
        setCorrect((c) => c + 1);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save review.');
    }
  }, [review, sessionId]);

  const nextFamily = useCallback(async () => {
    if (familyIndex + 1 >= familyGroups.length) {
      await finishSession(completed);
    } else {
      setFamilyIndex((i) => i + 1);
      setGradedInFamily(new Map());
    }
  }, [familyIndex, familyGroups.length, finishSession, completed]);

  return {
    queue,
    position,
    current,
    flipped,
    revealed,
    flip,
    rate,
    submitting,
    hydrated,
    wrongFeedback,
    finished: viewMode === 'families' ? (familyGroups.length > 0 && familyIndex >= familyGroups.length) || finished : finished || !current,
    celebration,
    dismissCelebration: () => setCelebration(null),
    error,
    ratingEvent,
    completed,
    correct,
    elapsedSeconds: Math.max(0, Math.floor((clock - sittingStartedAt.current) / 1000)),
    viewMode,
    currentFamily,
    familyGroups,
    familyIndex,
    gradedInFamily,
    rateFamilyCard,
    nextFamily
  };
}
