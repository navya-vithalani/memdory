import { useEffect, useState } from 'react';
import { getRecallProbability } from '../core/scheduler/reviewCard';
import { db } from '../data/db';
import { hydrateCardsWithReviewItems } from '../data/repositories/cardRepository';
import type { ReviewRating } from '../types';

const ratingLabels: ReviewRating[] = ['easy', 'medium', 'hard', 'partial', 'blank', 'wrong'];
const positiveRatings = new Set<ReviewRating>(['easy', 'medium', 'hard', 'partial']);

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
}

function shiftDate(date: Date, amount: number): Date {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + amount);
  return shifted;
}

function dayLabel(date: Date, weekday = false): string {
  return new Intl.DateTimeFormat(undefined, weekday
    ? { weekday: 'short' }
    : { month: 'short', day: 'numeric' }).format(date);
}

export type TagPerformanceItem = {
  tag: string;
  reviews: number;
  correct: number;
  accuracy: number;
};

export type AnalysisSnapshot = {
  totalReviews: number;
  ratings: Array<{ name: string; value: number; color: string }>;
  heatmap: Array<{ key: string; label: string; count: number }>;
  cardsPerDay: Array<{ day: string; count: number }>;
  timePerArea: Array<{ name: string; minutes: number }>;
  accuracyTrend: Array<{ day: string; accuracy: number | null }>;
  weakestTopics: Array<{ name: string; recall: number }>;
  forecast: Array<{ day: string; count: number }>;
  streakHistory: Array<{ key: string; label: string; count: number }>;
  tagPerformance?: TagPerformanceItem[];
};

const colors: Record<ReviewRating, string> = {
  easy: '#1FB58F',
  medium: '#4A7BF7',
  hard: '#F2B134',
  partial: '#9B7BEF',
  blank: '#8A93B8',
  wrong: '#EF5B6B'
};

export function useAnalysisStats() {
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.all([db.cards.toArray(), db.reviews.toArray(), db.nodes.toArray(), db.tags.toArray()]).then(async ([rawCards, reviews, nodes, tags]) => {
      const cards = await hydrateCardsWithReviewItems(rawCards);
      if (!active) return;
      const now = new Date();
      const countsByDay = new Map<string, number>();
      const accuracyByDay = new Map<string, { total: number; correct: number }>();
      const ratingCounts = new Map<ReviewRating, number>(ratingLabels.map((rating) => [rating, 0]));
      const cardById = new Map(cards.map((card) => [card.id, card]));
      const nodeById = new Map(nodes.map((node) => [node.id, node]));
      const tagById = new Map(tags.map((t) => [t.id, t.label || t.name]));
      const timeByNode = new Map<string, number>();

      for (const review of reviews) {
        const key = dayKey(new Date(review.timestamp));
        countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
        ratingCounts.set(review.rating, (ratingCounts.get(review.rating) ?? 0) + 1);
        const dailyAccuracy = accuracyByDay.get(key) ?? { total: 0, correct: 0 };
        dailyAccuracy.total += 1;
        if (positiveRatings.has(review.rating)) dailyAccuracy.correct += 1;
        accuracyByDay.set(key, dailyAccuracy);
        const nodeId = cardById.get(review.cardId)?.nodeId;
        if (nodeId) timeByNode.set(nodeId, (timeByNode.get(nodeId) ?? 0) + review.durationMs);
      }

      const heatmap = Array.from({ length: 35 }, (_, index) => {
        const date = shiftDate(now, index - 34);
        const key = dayKey(date);
        return { key, label: dayLabel(date), count: countsByDay.get(key) ?? 0 };
      });
      const cardsPerDay = Array.from({ length: 7 }, (_, index) => {
        const date = shiftDate(now, index - 6);
        const key = dayKey(date);
        return { day: dayLabel(date, true), count: countsByDay.get(key) ?? 0 };
      });
      const accuracyTrend = Array.from({ length: 7 }, (_, index) => {
        const key = dayKey(shiftDate(now, index - 6));
        const total = accuracyByDay.get(key);
        return {
          day: dayLabel(shiftDate(now, index - 6), true),
          accuracy: total ? Math.round(total.correct / total.total * 100) : null
        };
      });
      const timePerArea = [...timeByNode.entries()]
        .map(([nodeId, milliseconds]) => ({
          name: nodeById.get(nodeId)?.name ?? 'Unknown area',
          minutes: Math.round(milliseconds / 60000 * 10) / 10
        }))
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, 5);
      const recallByNode = new Map<string, { total: number; count: number }>();
      for (const card of cards) {
        if (card.lastReview == null) continue;
        const recall = recallByNode.get(card.nodeId) ?? { total: 0, count: 0 };
        recall.total += getRecallProbability(card, now.getTime());
        recall.count += 1;
        recallByNode.set(card.nodeId, recall);
      }
      const weakestTopics = [...recallByNode.entries()]
        .map(([nodeId, recall]) => ({
          name: nodeById.get(nodeId)?.name ?? 'Unknown area',
          recall: Math.round(recall.total / recall.count * 100)
        }))
        .sort((a, b) => a.recall - b.recall)
        .slice(0, 4);
      const forecast = Array.from({ length: 7 }, (_, index) => {
        const date = shiftDate(now, index);
        const key = dayKey(date);
        return {
          day: index === 0 ? 'Today' : dayLabel(date, true),
          count: cards.filter((card) => {
            if (card.due == null) return false;
            const due = new Date(card.due);
            return dayKey(due) === key && (index > 0 || due.getTime() <= now.getTime());
          }).length
        };
      });
      const streakHistory = Array.from({ length: 14 }, (_, index) => {
        const date = shiftDate(now, index - 13);
        const key = dayKey(date);
        return { key, label: dayLabel(date), count: countsByDay.get(key) ?? 0 };
      });

      // Compute tag performance
      const tagStatsMap = new Map<string, { total: number; correct: number }>();
      for (const review of reviews) {
        const card = cardById.get(review.cardId);
        if (!card?.tagIds || card.tagIds.length === 0) continue;
        const isCorrect = review.rating === 'easy' || review.rating === 'medium' || review.rating === 'hard';
        for (const tagId of card.tagIds) {
          const tagName = tagById.get(tagId);
          if (!tagName) continue;
          const norm = tagName.toLowerCase().trim();
          if (!norm) continue;
          const curr = tagStatsMap.get(norm) ?? { total: 0, correct: 0 };
          curr.total += 1;
          if (isCorrect) curr.correct += 1;
          tagStatsMap.set(norm, curr);
        }
      }

      const tagPerformance: TagPerformanceItem[] = Array.from(tagStatsMap.entries())
        .map(([tag, data]) => ({
          tag,
          reviews: data.total,
          correct: data.correct,
          accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
        }))
        .sort((a, b) => b.reviews - a.reviews);

      const next: AnalysisSnapshot = {
        totalReviews: reviews.length,
        ratings: ratingLabels.map((rating) => ({
          name: `${rating[0].toUpperCase()}${rating.slice(1)}`,
          value: ratingCounts.get(rating) ?? 0,
          color: colors[rating]
        })),
        heatmap,
        cardsPerDay,
        timePerArea,
        accuracyTrend,
        weakestTopics,
        forecast,
        streakHistory,
        tagPerformance
      };
      if (active) {
        setSnapshot(next);
        setError('');
      }
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load analysis.');
    });
    return () => {
      active = false;
    };
  }, []);

  return { snapshot, error };
}
