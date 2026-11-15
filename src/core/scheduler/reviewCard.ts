import { createEmptyCard, forgetting_curve, fsrs, Rating, State, type Card as FsrsCard, type Grade } from 'ts-fsrs';
import type { CardRecord, ReviewRating } from '../../types';

const DAY_MS = 24 * 60 * 60 * 1000;

const ratingToFsrs: Record<ReviewRating, Grade> = {
  easy: Rating.Easy,
  medium: Rating.Good,
  hard: Rating.Hard,
  partial: Rating.Hard,
  blank: Rating.Again,
  wrong: Rating.Again
};

function getState(value: number): State {
  if (value === State.Learning || value === State.Review || value === State.Relearning) return value;
  return State.New;
}

export function getRecallProbability(card: CardRecord, now: number): number {
  if (card.lastReview === null || card.stability <= 0) return 1;
  const elapsedDays = Math.max(0, (now - card.lastReview) / DAY_MS);
  return forgetting_curve(elapsedDays, card.stability);
}

export function scheduleCardReview(card: CardRecord, rating: ReviewRating, now: number): CardRecord {
  const nowDate = new Date(now);
  const emptyCard = createEmptyCard(nowDate);
  const lastReview = card.lastReview === null ? undefined : new Date(card.lastReview);
  const fsrsCard: FsrsCard = {
    ...emptyCard,
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    state: getState(card.state),
    reps: card.reps,
    lapses: card.lapses,
    elapsed_days: lastReview ? Math.max(0, (now - lastReview.getTime()) / DAY_MS) : 0,
    scheduled_days: lastReview ? Math.max(0, (card.due - lastReview.getTime()) / DAY_MS) : 0,
    ...(lastReview ? { last_review: lastReview } : {})
  };
  const result = fsrs().repeat(fsrsCard, nowDate)[ratingToFsrs[rating]];
  const scheduledDue = rating === 'partial'
    ? now + Math.max(DAY_MS, (result.card.due.getTime() - now) / 2)
    : result.card.due.getTime();

  return {
    ...card,
    due: scheduledDue,
    stability: result.card.stability,
    difficulty: result.card.difficulty,
    state: result.card.state,
    reps: result.card.reps,
    lapses: result.card.lapses,
    lastReview: now,
    trap: rating === 'wrong' || card.trap
  };
}
