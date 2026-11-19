import { describe, expect, it } from 'vitest';
import { parseCards } from '../importers/cardParser';
import { parseNoteTitle } from '../importers/noteParser';
import { getSchedulerRating } from '../scheduler/ratingMap';
import { getRecallProbability, scheduleCardReview } from '../scheduler/reviewCard';
import { minutesToCount, selectSessionCards } from '../session/selectSessionCards';
import {
  calculateLongestStreak,
  calculateStreak,
  calculateStreakFromSessions,
  getCompletedStudyDays,
  getCurrentWeekStudyDays,
  getStudyDayStartTimestamp,
  isFirstCompletedSessionOfDay,
  studyDayKey,
  type StreakSession
} from '../streak/streak';
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

  it('uses the 3:30 AM study-day boundary: 03:29 counts for previous day, 03:30 for new day', () => {
    const at0329 = new Date(2025, 2, 9, 3, 29, 59).getTime();
    const at0330 = new Date(2025, 2, 9, 3, 30, 0).getTime();
    expect(studyDayKey(at0329, 210)).toBe('2025-03-08');
    expect(studyDayKey(at0330, 210)).toBe('2025-03-09');
    expect(getStudyDayStartTimestamp(at0330, 210)).toBe(new Date(2025, 2, 9, 3, 30, 0).getTime());
  });

  it('calculates the longest streak from unique local study days', () => {
    expect(calculateLongestStreak(['2025-03-08', '2025-03-09', '2025-03-10', '2025-03-12', '2025-03-12'])).toBe(3);
  });

  it('returns 0 when completed session was on Sunday and now is Thursday', () => {
    // 2026-11-15 is Sunday, 2026-11-19 is Thursday
    const sundayCompleted = new Date(2026, 10, 15, 14, 0, 0).getTime();
    const nowThursday = new Date(2026, 10, 19, 10, 0, 0).getTime();
    const sessions: StreakSession[] = [
      { status: 'completed', completedAt: sundayCompleted }
    ];
    expect(calculateStreakFromSessions(sessions, nowThursday, 210)).toBe(0);
  });

  it('handles streak alive at risk and dead: Mon/Tue/Wed completed, Wed -> 3, Thu none -> 3, Fri -> 0', () => {
    // 2026-11-16 = Mon, 2026-11-17 = Tue, 2026-11-18 = Wed, 2026-11-19 = Thu, 2026-11-20 = Fri
    const mon = new Date(2026, 10, 16, 10, 0, 0).getTime();
    const tue = new Date(2026, 10, 17, 10, 0, 0).getTime();
    const wed = new Date(2026, 10, 18, 10, 0, 0).getTime();
    const sessions: StreakSession[] = [
      { status: 'completed', completedAt: mon },
      { status: 'completed', completedAt: tue },
      { status: 'completed', completedAt: wed }
    ];

    const nowWed = new Date(2026, 10, 18, 12, 0, 0).getTime();
    expect(calculateStreakFromSessions(sessions, nowWed, 210)).toBe(3);

    const nowThuNone = new Date(2026, 10, 19, 12, 0, 0).getTime();
    expect(calculateStreakFromSessions(sessions, nowThuNone, 210)).toBe(3); // at risk

    const nowFriNone = new Date(2026, 10, 20, 12, 0, 0).getTime();
    expect(calculateStreakFromSessions(sessions, nowFriNone, 210)).toBe(0); // dead
  });

  it('never counts abandoned or in-progress sessions', () => {
    const today = new Date(2026, 10, 19, 12, 0, 0).getTime();
    const sessions: StreakSession[] = [
      { status: 'in-progress', completedAt: null },
      { status: 'abandoned', completedAt: today }
    ];
    expect(getCompletedStudyDays(sessions, 210)).toEqual([]);
    expect(calculateStreakFromSessions(sessions, today, 210)).toBe(0);
  });

  it('produces Monday-to-Sunday 7 drops with correct flags in getCurrentWeekStudyDays', () => {
    // 2026-11-18 is Wednesday
    const wednesday = new Date(2026, 10, 18, 12, 0, 0).getTime();
    const completedDays = ['2026-11-16', '2026-11-17']; // Mon, Tue completed
    const days = getCurrentWeekStudyDays(completedDays, wednesday, 210);

    expect(days).toHaveLength(7);
    expect(days.map((d) => d.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(days[0].dayKey).toBe('2026-11-16'); // Mon
    expect(days[0].isCompleted).toBe(true);
    expect(days[1].isCompleted).toBe(true);
    expect(days[2].dayKey).toBe('2026-11-18'); // Wed (today)
    expect(days[2].isToday).toBe(true);
    expect(days[2].isCompleted).toBe(false);
    expect(days[3].isFuture).toBe(true); // Thu
    expect(days[6].dayKey).toBe('2026-11-22'); // Sun
    expect(days[6].isFuture).toBe(true);
  });

  it('identifies if a session is the first completed session of a study day', () => {
    const t1 = new Date(2026, 10, 18, 10, 0, 0).getTime();
    const t2 = new Date(2026, 10, 18, 15, 0, 0).getTime();
    const sessions = [
      { id: 's1', status: 'completed', completedAt: t1 },
      { id: 's2', status: 'completed', completedAt: t2 }
    ];
    expect(isFirstCompletedSessionOfDay(sessions, 's1', 210)).toBe(true);
    expect(isFirstCompletedSessionOfDay(sessions, 's2', 210)).toBe(false);
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
