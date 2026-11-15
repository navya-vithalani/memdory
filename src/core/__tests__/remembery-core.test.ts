import { describe, expect, it } from 'vitest';
import { parseCards } from '../importers/cardParser';
import { parseNoteTitle } from '../importers/noteParser';
import { getSchedulerRating } from '../scheduler/ratingMap';
import { getRecallProbability, scheduleCardReview } from '../scheduler/reviewCard';
import { minutesToCount, selectSessionCards } from '../session/selectSessionCards';
import { calculateLongestStreak, calculateStreak, getStudyDayStartTimestamp, studyDayKey } from '../streak/streak';
import { getDescendantIds, isValidParent } from '../tree/tree';
import type { CardRecord, TreeNode } from '../../types';

describe('scheduler rating map', () => {
  it('maps common ratings to expected FSRS states', () => {
    expect(getSchedulerRating('easy').fsrs).toBe('easy');
    expect(getSchedulerRating('medium').fsrs).toBe('good');
    expect(getSchedulerRating('partial').label).toBe('Partial');
    expect(getSchedulerRating('wrong').fsrs).toBe('again');
  });
});

describe('session selection', () => {
  it('sorts due cards earliest first', () => {
    const cards = [
      { id: 'b', front: 'B', due: 2000, reviewed: true, recall: 0.6 },
      { id: 'a', front: 'A', due: 1000, reviewed: true, recall: 0.7 },
      { id: 'c', front: 'C', due: 3000, reviewed: false, recall: 0.5 }
    ];

    expect(selectSessionCards(cards, 'due', 2).map((card) => card.id)).toEqual(['a', 'b']);
  });

  it('prefers lower recall for about-to-forget mode', () => {
    const cards = [
      { id: 'high', front: 'High recall', due: 1000, reviewed: true, recall: 0.93 },
      { id: 'low', front: 'Low recall', due: 2000, reviewed: true, recall: 0.38 },
      { id: 'new', front: 'New', due: 4000, reviewed: false, recall: 0.5 }
    ];

    expect(selectSessionCards(cards, 'about-to-forget', 3).map((card) => card.id)).toEqual(['low', 'high', 'new']);
  });

  it('only includes due reviewed cards and respects the new-card limit', () => {
    const cards = [
      { id: 'late', front: 'Late', due: 200, reviewed: true, recall: 0.2 },
      { id: 'due', front: 'Due', due: 50, reviewed: true, recall: 0.8 },
      { id: 'new-a', front: 'New A', due: 300, reviewed: false, recall: 1 },
      { id: 'new-b', front: 'New B', due: 300, reviewed: false, recall: 1 }
    ];

    expect(selectSessionCards(cards, 'due', 10, { now: 100, newCardLimit: 1 }).map((card) => card.id))
      .toEqual(['due', 'new-a']);
    expect(selectSessionCards(cards, 'due', 0, { now: 100 })).toEqual([]);
  });

  it('falls back to due cards and boosts traps until review history is sufficient', () => {
    const cards = [
      { id: 'future', front: 'Future', due: 500, reviewed: true, recall: 0.1 },
      { id: 'due', front: 'Due', due: 50, reviewed: true, recall: 0.8 },
      { id: 'trap', front: 'Trap', due: 500, reviewed: true, trap: true, recall: 0.45 },
      { id: 'regular', front: 'Regular', due: 500, reviewed: true, recall: 0.3 },
      { id: 'new', front: 'New', due: 500, reviewed: false, recall: 1 }
    ];
    expect(selectSessionCards(cards, 'about-to-forget', 10, { now: 100, totalReviews: 49 }).map((card) => card.id))
      .toEqual(['due', 'new']);
    expect(selectSessionCards(cards, 'about-to-forget', 2, { now: 100, totalReviews: 50 }).map((card) => card.id))
      .toEqual(['future', 'trap']);
  });
});

describe('streak logic', () => {
  it('calculates a simple streak across study-day boundaries', () => {
    const now = new Date(2025, 1, 15, 12, 0, 0).getTime();
    const reviews = [
      { timestamp: new Date(2025, 1, 14, 7, 0, 0).getTime() },
      { timestamp: new Date(2025, 1, 15, 8, 0, 0).getTime() }
    ];

    expect(calculateStreak(reviews, now, 210)).toBe(2);
  });

  it('uses the 3:30 AM study-day boundary', () => {
    const timestamp = new Date(2025, 2, 15, 3, 0, 0).getTime();
    expect(studyDayKey(timestamp, 210)).toBe('2025-03-14');
  });

  it('calculates the study-day start using local calendar time', () => {
    const beforeBoundary = new Date(2025, 2, 9, 3, 29, 59).getTime();
    const afterBoundary = new Date(2025, 2, 9, 3, 30, 0).getTime();
    expect(studyDayKey(beforeBoundary, 210)).toBe('2025-03-08');
    expect(studyDayKey(afterBoundary, 210)).toBe('2025-03-09');
    expect(getStudyDayStartTimestamp(afterBoundary, 210)).toBe(new Date(2025, 2, 9, 3, 30, 0).getTime());
  });

  it('calculates the longest streak from unique local study days', () => {
    expect(calculateLongestStreak(['2025-03-08', '2025-03-09', '2025-03-10', '2025-03-12', '2025-03-12'])).toBe(3);
  });

  it('counts yesterday when today has no review, including before the day boundary', () => {
    const now = new Date(2025, 2, 15, 2, 0).getTime();
    const reviews = [{ timestamp: new Date(2025, 2, 14, 2, 45).getTime() }];
    expect(calculateStreak(reviews, now, 210)).toBe(1);
  });
});

describe('importers', () => {
  it('parses Q/A card blocks from plain text', () => {
    const source = `Q: Which is the first member of Group 13?\nA: Boron\n\nQ: Why is BF3 a weaker Lewis acid than BCl3?\nA: Back-donation from F lone pairs fills boron's empty p orbital.`;
    const parsed = parseCards(source);

    expect(parsed.cards).toHaveLength(2);
    expect(parsed.invalid).toBe(0);
    expect(parsed.cards[0].front).toContain('Which is the first member of Group 13');
  });

  it('parses multiple tab-separated cards in one block', () => {
    const parsed = parseCards('Boron\tGroup 13\nAluminium\tGroup 13');
    expect(parsed.cards).toEqual([
      { front: 'Boron', back: 'Group 13' },
      { front: 'Aluminium', back: 'Group 13' }
    ]);
  });

  it('parses note titles from markdown or filenames', () => {
    expect(parseNoteTitle('chapter-1.md', '# Chapter 1\n\nStudy note')).toBe('Chapter 1');
    expect(parseNoteTitle('revision.txt', 'Plain text note')).toBe('revision');
  });
});

describe('minutes conversion', () => {
  it('converts minutes to card count using average seconds per card', () => {
    expect(minutesToCount(5, 20)).toBe(15);
    expect(minutesToCount(3, 30)).toBe(6);
    expect(minutesToCount(0, 20)).toBe(0);
    expect(minutesToCount(Number.NaN, 20)).toBe(0);
  });
});

describe('tree helpers', () => {
  const nodes: TreeNode[] = [
    { id: 'area', parentId: null, name: 'Area', order: 0, createdAt: 0 },
    { id: 'subject', parentId: 'area', name: 'Subject', order: 0, createdAt: 0 },
    { id: 'deck', parentId: 'subject', name: 'Deck', order: 0, createdAt: 0 }
  ];

  it('finds descendants and prevents circular moves', () => {
    expect(getDescendantIds(nodes, 'subject')).toEqual(['subject', 'deck']);
    expect(isValidParent(nodes, 'area', 'deck')).toBe(false);
    expect(isValidParent(nodes, 'deck', 'area')).toBe(true);
  });
});

describe('FSRS review scheduling', () => {
  const newCard: CardRecord = {
    id: 'card',
    nodeId: 'deck',
    front: 'Question',
    back: 'Answer',
    trap: false,
    createdAt: 1000,
    due: 1000,
    stability: 0,
    difficulty: 0,
    state: 0,
    reps: 0,
    lapses: 0,
    lastReview: null
  };

  it('stores scheduler results and marks wrong answers as traps', () => {
    const hard = scheduleCardReview(newCard, 'hard', 1000);
    const easy = scheduleCardReview(newCard, 'easy', 1000);
    const wrong = scheduleCardReview(newCard, 'wrong', 1000);
    expect(easy.due).toBeGreaterThan(hard.due);
    expect(wrong.trap).toBe(true);
    expect(getRecallProbability(easy, easy.due)).toBeLessThan(1);
  });

  it('gives Partial a minimum one-day interval', () => {
    expect(scheduleCardReview(newCard, 'partial', 1000).due).toBeGreaterThanOrEqual(1000 + 24 * 60 * 60 * 1000);
  });
});
