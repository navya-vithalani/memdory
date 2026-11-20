import { createEmptyCard, forgetting_curve, fsrs, Rating, State, type Card as FsrsCard, type Grade } from 'ts-fsrs';
import type { CardRecord, ReviewItemRecord, ReviewRating } from '../../types';
import { getSchedulerRating } from './ratingMap';

const DAY_MS = 24 * 60 * 60 * 1000;

const gradeByName: Record<'easy' | 'good' | 'hard' | 'again', Grade> = {
  easy: Rating.Easy,
  good: Rating.Good,
  hard: Rating.Hard,
  again: Rating.Again
};

function getState(value: number): State {
  if (value === State.Learning || value === State.Review || value === State.Relearning) return value;
  return State.New;
}

export function getRecallProbability(item: { lastReview?: number | null; stability?: number }, now: number): number {
  if (item.lastReview == null || !item.stability || item.stability <= 0) return 1;
  const elapsedDays = Math.max(0, (now - item.lastReview) / DAY_MS);
  return forgetting_curve(elapsedDays, item.stability);
}

export function scheduleReviewItem(
  item: ReviewItemRecord,
  rating: ReviewRating,
  now: number,
  desiredRetention = 0.9
): {
  item: ReviewItemRecord;
  fsrsRating: 'again' | 'hard' | 'good' | 'easy';
  fsrsLog: Record<string, unknown>;
} {
  const nowDate = new Date(now);
  const emptyCard = createEmptyCard(nowDate);
  const lastReview = item.lastReview === null ? undefined : new Date(item.lastReview);
  const fsrsCard: FsrsCard = {
    ...emptyCard,
    due: new Date(item.due),
    stability: item.stability,
    difficulty: item.difficulty,
    state: getState(item.state),
    reps: item.reps,
    lapses: item.lapses,
    elapsed_days: lastReview ? Math.max(0, (now - lastReview.getTime()) / DAY_MS) : 0,
    scheduled_days: lastReview ? Math.max(0, (item.due - lastReview.getTime()) / DAY_MS) : 0,
    ...(lastReview ? { last_review: lastReview } : {})
  };

  const schedulerGrade = getSchedulerRating(rating).fsrs;
  const f = fsrs({ request_retention: desiredRetention });
  const result = f.repeat(fsrsCard, nowDate)[gradeByName[schedulerGrade]];
  const scheduledDue = rating === 'partial'
    ? now + Math.max(DAY_MS, (result.card.due.getTime() - now) / 2)
    : result.card.due.getTime();

  const updatedItem: ReviewItemRecord = {
    ...item,
    due: scheduledDue,
    stability: result.card.stability,
    difficulty: result.card.difficulty,
    state: result.card.state,
    reps: result.card.reps,
    lapses: result.card.lapses,
    lastReview: now,
    trap: rating === 'wrong' || item.trap
  };

  return {
    item: updatedItem,
    fsrsRating: schedulerGrade,
    fsrsLog: {
      due: result.card.due.getTime(),
      stability: result.card.stability,
      difficulty: result.card.difficulty,
      state: result.card.state,
      elapsed_days: result.log.elapsed_days,
      scheduled_days: result.log.scheduled_days
    }
  };
}

export function scheduleCardReview(card: CardRecord, rating: ReviewRating, now: number): CardRecord {
  const item: ReviewItemRecord = {
    id: card.id,
    cardId: card.id,
    direction: 'forward',
    due: card.due ?? now,
    stability: (card as unknown as { stability: number }).stability ?? 0,
    difficulty: (card as unknown as { difficulty: number }).difficulty ?? 0,
    state: (card as unknown as { state: number }).state ?? 0,
    reps: (card as unknown as { reps: number }).reps ?? 0,
    lapses: (card as unknown as { lapses: number }).lapses ?? 0,
    lastReview: (card as unknown as { lastReview: number | null }).lastReview ?? null,
    trap: Boolean(card.trap),
    createdAt: card.createdAt
  };

  const { item: updatedItem } = scheduleReviewItem(item, rating, now);

  return {
    ...card,
    due: updatedItem.due,
    trap: updatedItem.trap,
    ...({
      stability: updatedItem.stability,
      difficulty: updatedItem.difficulty,
      state: updatedItem.state,
      reps: updatedItem.reps,
      lapses: updatedItem.lapses,
      lastReview: updatedItem.lastReview
    })
  };
}
