import { describe, expect, it } from 'vitest';
import { buildInsights } from '../stats/insights';

describe('Rule-based Mnemo Insights (Phase 6.2)', () => {
  it('Rule 1: prioritizes incomplete session if present', () => {
    const insights = buildInsights({ hasIncompleteSession: true, totalReviews: 50 });
    expect(insights[0].id).toBe('incomplete-session');
    expect(insights[0].text).toContain('unfinished session');
  });

  it('Rule 2: detects streak milestone when completed today', () => {
    const insights = buildInsights({ currentStreak: 7, completedToday: true, totalReviews: 100 });
    expect(insights[0].id).toBe('streak-milestone');
    expect(insights[0].mood).toBe('excited');
    expect(insights[0].text).toContain('7-day');
  });

  it('Rule 3: alerts when streak is at risk (streak >= 3, not completed today)', () => {
    const insights = buildInsights({ currentStreak: 5, completedToday: false, totalReviews: 100 });
    expect(insights[0].id).toBe('streak-at-risk');
    expect(insights[0].mood).toBe('front-shocked');
    expect(insights[0].text).toContain('5-day streak is on the line');
  });

  it('Rule 4: flags struggling tag with >= 10 reviews and accuracy < 60%', () => {
    const insights = buildInsights({
      totalReviews: 80,
      tagAccuracies: [
        { tag: 'optics', reviews: 15, accuracy: 45 },
        { tag: 'mechanics', reviews: 20, accuracy: 85 }
      ]
    });
    expect(insights[0].id).toBe('struggling-tag');
    expect(insights[0].mood).toBe('front-sad');
    expect(insights[0].text).toContain('optics');
  });

  it('Rule 5: alerts confidently wrong when >= 5 wrong ratings in 7 days', () => {
    const insights = buildInsights({
      totalReviews: 80,
      wrongCount7Days: 6,
      mostWrongTopicName: 'Electrochemistry'
    });
    expect(insights[0].id).toBe('confidently-wrong');
    expect(insights[0].text).toContain('Electrochemistry');
  });

  it('Rule 6: praises strongest tag with >= 10 reviews and accuracy >= 90%', () => {
    const insights = buildInsights({
      totalReviews: 80,
      tagAccuracies: [
        { tag: 'kinetics', reviews: 12, accuracy: 95 }
      ]
    });
    expect(insights[0].id).toBe('strongest-tag');
    expect(insights[0].mood).toBe('front-happy');
    expect(insights[0].text).toContain('kinetics');
  });

  it('Rule 7: spots weakest topic by current recall < 80%', () => {
    const insights = buildInsights({
      totalReviews: 80,
      weakestTopic: { name: 'Thermodynamics', recall: 68 }
    });
    expect(insights[0].id).toBe('weakest-topic');
    expect(insights[0].text).toContain('Thermodynamics');
  });

  it('Rule 8: notices volume surge >= 30%', () => {
    const insights = buildInsights({
      totalReviews: 120,
      reviewsLast7Days: 50,
      reviewsPrior7Days: 30
    });
    expect(insights[0].id).toBe('volume-up');
    expect(insights[0].text).toContain('67%');
  });

  it('Rule 9: notices speed improvements >= 15%', () => {
    const insights = buildInsights({
      totalReviews: 120,
      avgSecondsLast7Days: 8,
      avgSecondsPrior7Days: 12
    });
    expect(insights[0].id).toBe('speed-faster');
    expect(insights[0].text).toContain('33%');
  });

  it('Rule 10: gives encouraging early message when total reviews < 20', () => {
    const insights = buildInsights({ totalReviews: 5 });
    expect(insights[0].id).toBe('early-learning');
    expect(insights[0].text).toContain('Finish a few sessions');
  });
});
