import { describe, expect, it } from 'vitest';
import { parseCards } from '../importers/cardParser';
import { parseNoteTitle } from '../importers/noteParser';
import { getSchedulerRating } from '../scheduler/ratingMap';
import { minutesToCount, selectSessionCards } from '../session/selectSessionCards';
import { calculateStreak, studyDayKey } from '../streak/streak';

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
});

describe('importers', () => {
  it('parses Q/A card blocks from plain text', () => {
    const source = `Q: Which is the first member of Group 13?\nA: Boron\n\nQ: Why is BF3 a weaker Lewis acid than BCl3?\nA: Back-donation from F lone pairs fills boron's empty p orbital.`;
    const parsed = parseCards(source);

    expect(parsed.cards).toHaveLength(2);
    expect(parsed.invalid).toBe(0);
    expect(parsed.cards[0].front).toContain('Which is the first member of Group 13');
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
  });
});
