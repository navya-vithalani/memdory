import type { ReviewRating } from '../../types';

export type SchedulerRating = {
  fsrs: 'easy' | 'good' | 'hard' | 'again';
  label: string;
  priorityBoost: number;
};

export const ratingMap: Record<ReviewRating, SchedulerRating> = {
  easy: { fsrs: 'easy', label: 'Easy', priorityBoost: 0 },
  medium: { fsrs: 'good', label: 'Medium', priorityBoost: 0 },
  hard: { fsrs: 'hard', label: 'Hard', priorityBoost: 0 },
  partial: { fsrs: 'hard', label: 'Partial', priorityBoost: 1 },
  blank: { fsrs: 'again', label: 'Blank', priorityBoost: 0 },
  wrong: { fsrs: 'again', label: 'Wrong', priorityBoost: 4 }
};

export function getSchedulerRating(rating: ReviewRating): SchedulerRating {
  return ratingMap[rating];
}
