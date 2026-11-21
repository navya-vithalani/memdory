import { useCallback, useEffect, useState } from 'react';
import { getRecallProbability } from '../core/scheduler/reviewCard';
import {
  calculateLongestStreak,
  calculateStreakFromDayKeys,
  getCompletedStudyDays,
  getStudyDayStartTimestamp,
  studyDayKey
} from '../core/streak/streak';
import { getDescendantIds } from '../core/tree/tree';
import { db } from '../data/db';
import { hydrateCardsWithReviewItems } from '../data/repositories/cardRepository';
import type { SessionRecord, SettingsRecord, TreeNode } from '../types';

const AT_RISK_RECALL = 0.9;

export type HomeSnapshot = {
  currentStreak: number;
  longestStreak: number;
  reviewsToday: number;
  dailyGoal: number;
  dueCards: number;
  atRiskCards: number;
  masteredCards: number;
  areas: Array<{ node: TreeNode; mastery: number }>;
  weakestTopic: { node: TreeNode; recall: number } | null;
  lastSession: SessionRecord | null;
  inProgressSession: SessionRecord | null;
  completedDayKeys: string[];
  completedToday: boolean;
};

async function loadSnapshot(settings: SettingsRecord, nodes: TreeNode[]): Promise<HomeSnapshot> {
  const now = Date.now();
  const [rawCards, reviewsToday, allSessions] = await Promise.all([
    db.cards.toArray(),
    db.reviews.where('timestamp').aboveOrEqual(getStudyDayStartTimestamp(now, settings.dayStartMinutes)).count(),
    db.sessions.toArray()
  ]);
  const cards = await hydrateCardsWithReviewItems(rawCards);

  const completedDayKeys = getCompletedStudyDays(allSessions, settings.dayStartMinutes);
  const todayKey = studyDayKey(now, settings.dayStartMinutes);
  const completedToday = completedDayKeys.includes(todayKey);

  const inProgressSession = allSessions
    .filter((s) => s.status === 'in-progress')
    .sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;

  const lastSession = allSessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => (b.completedAt ?? b.endedAt) - (a.completedAt ?? a.endedAt))[0] ?? null;

  const areas = nodes
    .filter((node) => node.parentId === null)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map((node) => {
      const scope = new Set(getDescendantIds(nodes, node.id));
      const reviewed = cards.filter((card) => scope.has(card.nodeId) && card.lastReview != null);
      const mastery = reviewed.length
        ? Math.round(reviewed.reduce((sum, card) => sum + getRecallProbability(card, now), 0) / reviewed.length * 100)
        : 0;
      return { node, mastery };
    });

  const weakestTopic = nodes
    .filter((node) => node.parentId !== null)
    .map((node) => {
      const reviewed = cards.filter((card) => card.nodeId === node.id && card.lastReview != null);
      if (reviewed.length === 0) return null;
      const recall = reviewed.reduce((sum, card) => sum + getRecallProbability(card, now), 0) / reviewed.length;
      return { node, recall };
    })
    .filter((topic): topic is { node: TreeNode; recall: number } => topic !== null)
    .sort((a, b) => a.recall - b.recall)[0] ?? null;

  return {
    currentStreak: calculateStreakFromDayKeys(completedDayKeys, now, settings.dayStartMinutes),
    longestStreak: calculateLongestStreak(completedDayKeys),
    reviewsToday,
    dailyGoal: settings.dailyGoal,
    dueCards: cards.filter((card) => card.lastReview != null && (card.due ?? 0) <= now).length,
    atRiskCards: cards.filter((card) => card.lastReview != null && (Boolean(card.trap) || getRecallProbability(card, now) <= AT_RISK_RECALL)).length,
    masteredCards: cards.filter((card) => card.lastReview != null && !card.trap && ((card.stability ?? 0) >= 21 || (getRecallProbability(card, now) >= 0.9 && (card.reps ?? 0) >= 2))).length,
    areas,
    weakestTopic,
    lastSession,
    inProgressSession,
    completedDayKeys,
    completedToday
  };
}

export function useHomeStats(settings: SettingsRecord, nodes: TreeNode[]) {
  const [snapshot, setSnapshot] = useState<HomeSnapshot | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      const next = await loadSnapshot(settings, nodes);
      setSnapshot(next);
      setError('');
      return next;
    } catch (reason) {
      const msg = reason instanceof Error ? reason.message : 'Could not load study progress.';
      setError(msg);
      throw reason;
    }
  }, [settings, nodes]);

  useEffect(() => {
    let active = true;
    void refresh().catch(() => {});
    return () => {
      active = false;
    };
  }, [refresh]);

  return { snapshot, error, refresh };
}
