import { useCallback, useEffect, useState } from 'react';
import { getRecallProbability } from '../core/scheduler/reviewCard';
import { calculateLongestStreak, calculateStreakFromDayKeys, getStudyDayStartTimestamp, studyDayKey } from '../core/streak/streak';
import { getDescendantIds } from '../core/tree/tree';
import { db } from '../data/db';
import { listRecentSessions } from '../data/repositories/cardRepository';
import type { CardRecord, SessionRecord, SettingsRecord, TreeNode } from '../types';

const AT_RISK_RECALL = 0.9;

export type HomeSnapshot = {
  currentStreak: number;
  longestStreak: number;
  reviewsToday: number;
  dailyGoal: number;
  dueCards: number;
  atRiskCards: number;
  areas: Array<{ node: TreeNode; mastery: number }>;
  weakestTopic: { node: TreeNode; recall: number } | null;
  lastSession: SessionRecord | null;
};

async function loadSnapshot(settings: SettingsRecord, nodes: TreeNode[]): Promise<HomeSnapshot> {
  const now = Date.now();
  const [cards, reviewsToday, recentSessions] = await Promise.all([
    db.cards.toArray(),
    db.reviews.where('timestamp').aboveOrEqual(getStudyDayStartTimestamp(now, settings.dayStartMinutes)).count(),
    listRecentSessions(1)
  ]);
  const dayKeys: string[] = [];
  await db.reviews.orderBy('timestamp').eachKey((timestamp) => {
    if (typeof timestamp === 'number') dayKeys.push(studyDayKey(timestamp, settings.dayStartMinutes));
  });

  const areas = nodes
    .filter((node) => node.parentId === null)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map((node) => {
      const scope = new Set(getDescendantIds(nodes, node.id));
      const reviewed = cards.filter((card) => scope.has(card.nodeId) && card.lastReview !== null);
      const mastery = reviewed.length
        ? Math.round(reviewed.reduce((sum, card) => sum + getRecallProbability(card, now), 0) / reviewed.length * 100)
        : 0;
      return { node, mastery };
    });

  const weakestTopic = nodes
    .filter((node) => node.parentId !== null)
    .map((node) => {
      const reviewed = cards.filter((card) => card.nodeId === node.id && card.lastReview !== null);
      if (reviewed.length === 0) return null;
      const recall = reviewed.reduce((sum, card) => sum + getRecallProbability(card, now), 0) / reviewed.length;
      return { node, recall };
    })
    .filter((topic): topic is { node: TreeNode; recall: number } => topic !== null)
    .sort((a, b) => a.recall - b.recall)[0] ?? null;

  return {
    currentStreak: calculateStreakFromDayKeys(dayKeys, now, settings.dayStartMinutes),
    longestStreak: calculateLongestStreak(dayKeys),
    reviewsToday,
    dailyGoal: settings.dailyGoal,
    dueCards: cards.filter((card) => card.lastReview !== null && card.due <= now).length,
    atRiskCards: cards.filter((card) => card.lastReview !== null && (card.trap || getRecallProbability(card, now) <= AT_RISK_RECALL)).length,
    areas,
    weakestTopic,
    lastSession: recentSessions[0] ?? null
  };
}

export function useHomeStats(settings: SettingsRecord, nodes: TreeNode[]) {
  const [snapshot, setSnapshot] = useState<HomeSnapshot | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(() => loadSnapshot(settings, nodes), [settings, nodes]);

  useEffect(() => {
    let active = true;
    void refresh().then((next) => {
      if (active) {
        setSnapshot(next);
        setError('');
      }
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load study progress.');
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  return { snapshot, error };
}
