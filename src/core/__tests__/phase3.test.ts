import { describe, expect, it } from 'vitest';
import { parseCards } from '../importers/cardParser';
import { buildWifiSegments, WIFI_CENTER, WIFI_VIEWBOX } from '../rating/wifiGeometry';
import { getSchedulerRating } from '../scheduler/ratingMap';
import { scheduleCardReview } from '../scheduler/reviewCard';
import { calculateStreakFromDayKeys, getStreakCelebration, studyDayKey } from '../streak/streak';
import type { CardRecord } from '../../types';

const noon = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0).getTime();
const session = (id: string, status: string, completedAt: number | null) => ({ id, status, completedAt });

describe('streak celebration', () => {
  it('fires for the first completed session of the day, even though the target was loaded as completed', () => {
    const sessions = [
      session('a', 'completed', noon(2026, 11, 17)),
      session('b', 'completed', noon(2026, 11, 18)),
      session('today', 'completed', noon(2026, 11, 19))
    ];
    expect(getStreakCelebration(sessions, 'today', 210)).toEqual({ oldStreak: 2, newStreak: 3 });
  });

  it('starts a fresh streak at 1 after a missed day', () => {
    const sessions = [session('a', 'completed', noon(2026, 11, 10)), session('today', 'completed', noon(2026, 11, 19))];
    expect(getStreakCelebration(sessions, 'today', 210)).toEqual({ oldStreak: 0, newStreak: 1 });
  });

  it('stays quiet for a second session on the same day', () => {
    const sessions = [session('first', 'completed', noon(2026, 11, 19) - 3600000), session('second', 'completed', noon(2026, 11, 19))];
    expect(getStreakCelebration(sessions, 'second', 210)).toBeNull();
  });

  it('does not celebrate a session that is not completed', () => {
    expect(getStreakCelebration([session('s', 'in-progress', null)], 's', 210)).toBeNull();
  });

  it('counts streaks longer than a year', () => {
    const now = noon(2026, 11, 19);
    const days: string[] = [];
    for (let i = 0; i < 400; i += 1) days.push(studyDayKey(now - i * 86400000, 210));
    expect(calculateStreakFromDayKeys(days, now, 210)).toBe(400);
  });
});

describe('card parser', () => {
  it('splits consecutive Q/A pairs that have no blank line between them', () => {
    const parsed = parseCards('Q: one\nA: 1\nQ: two\nA: 2');
    expect(parsed.cards).toEqual([{ front: 'one', back: '1' }, { front: 'two', back: '2' }]);
    expect(parsed.invalid).toBe(0);
  });

  it('keeps line breaks in multi-line answers', () => {
    const parsed = parseCards('Q: List the halogens\nA: Fluorine\nChlorine\nBromine');
    expect(parsed.cards).toEqual([{ front: 'List the halogens', back: 'Fluorine\nChlorine\nBromine' }]);
  });

  it('flags a question with no answer and ignores stray text once', () => {
    const parsed = parseCards('hello\nworld\n\nQ: lonely');
    expect(parsed.cards).toHaveLength(0);
    expect(parsed.invalid).toBe(2);
  });

  it('handles Windows line endings', () => {
    expect(parseCards('Q: a\r\nA: b\r\n\r\nQ: c\r\nA: d').cards).toHaveLength(2);
  });
});

describe('rating map is the single source of truth', () => {
  const card: CardRecord = {
    id: 'c', nodeId: 'n', front: 'f', back: 'b', trap: false, createdAt: 0,
    due: 0, stability: 0, difficulty: 0, state: 0, reps: 0, lapses: 0, lastReview: null
  };
  it('schedules partial like hard but never sooner than a day, and wrong marks a trap', () => {
    const now = noon(2026, 11, 19);
    expect(getSchedulerRating('partial').fsrs).toBe('hard');
    expect((scheduleCardReview(card, 'partial', now).due ?? 0) - now).toBeGreaterThanOrEqual(86400000);
    expect(scheduleCardReview(card, 'wrong', now).trap).toBe(true);
    expect(scheduleCardReview(card, 'easy', now).due ?? 0).toBeGreaterThan(scheduleCardReview(card, 'blank', now).due ?? 0);
  });
});

describe('wifi rating geometry', () => {
  const segments = buildWifiSegments();
  const byBand = (band: string) => segments.filter((s) => s.band === band);

  it('has the six ratings in the right bands and order', () => {
    expect(byBand('outer').map((s) => s.id)).toEqual(['easy', 'medium', 'hard']);
    expect(byBand('middle').map((s) => s.id)).toEqual(['partial', 'blank']);
    expect(byBand('dot').map((s) => s.id)).toEqual(['wrong']);
  });

  it('keeps neighbouring segments apart and inside the 130 degree fan', () => {
    for (const band of ['outer', 'middle']) {
      const list = byBand(band);
      expect(list[0].startDeg).toBeCloseTo(-155);
      expect(list[list.length - 1].endDeg).toBeCloseTo(-25);
      for (let i = 1; i < list.length; i += 1) expect(list[i].startDeg).toBeGreaterThan(list[i - 1].endDeg);
    }
  });

  it('leaves a radial gap between the dot, middle band and outer band', () => {
    const mid = byBand('middle')[0];
    const out = byBand('outer')[0];
    expect(mid.innerRadius).toBeGreaterThan(30);
    expect(out.innerRadius).toBeGreaterThan(mid.outerRadius);
  });

  it('fits inside the viewBox', () => {
    const top = WIFI_CENTER.y - Math.max(...segments.map((s) => s.outerRadius));
    expect(top).toBeGreaterThanOrEqual(0);
    expect(WIFI_CENTER.y + 30 + 4).toBeLessThanOrEqual(WIFI_VIEWBOX.height);
    expect(WIFI_CENTER.x - 138 * Math.cos((25 * Math.PI) / 180)).toBeGreaterThanOrEqual(0);
  });

  it('gives every arc segment a label path and the dot a straight label', () => {
    expect(segments.filter((s) => s.labelPath === null).map((s) => s.id)).toEqual(['wrong']);
  });
});
