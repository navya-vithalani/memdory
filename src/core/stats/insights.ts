import type { MnemoMood } from '../../ui/components/Mnemo';

export type InsightInput = {
  hasIncompleteSession?: boolean;
  currentStreak?: number;
  completedToday?: boolean;
  totalReviews?: number;
  reviewsLast7Days?: number;
  reviewsPrior7Days?: number;
  avgSecondsLast7Days?: number;
  avgSecondsPrior7Days?: number;
  wrongCount7Days?: number;
  mostWrongTopicName?: string;
  tagAccuracies?: Array<{ tag: string; reviews: number; accuracy: number }>; // accuracy in % (0-100)
  weakestTopic?: { name: string; recall: number }; // recall in %
};

export type Insight = {
  id: string;
  text: string;
  mood: MnemoMood;
  priority: number;
};

const STREAK_MILESTONES = [7, 14, 30, 50, 100];

export function buildInsights(stats: InsightInput): Insight[] {
  const insights: Insight[] = [];

  // Rule 1: Incomplete session exists
  if (stats.hasIncompleteSession) {
    insights.push({
      id: 'incomplete-session',
      text: 'You have an unfinished session. Want to pick it up?',
      mood: 'front-happy',
      priority: 1
    });
  }

  // Rule 2: Streak milestone
  if (stats.currentStreak && STREAK_MILESTONES.includes(stats.currentStreak) && stats.completedToday) {
    insights.push({
      id: 'streak-milestone',
      text: `Incredible! You hit a ${stats.currentStreak}-day study streak! Keep swimming!`,
      mood: 'excited',
      priority: 2
    });
  }

  // Rule 3: Streak at risk (streak >= 3 and no completed session today)
  if ((stats.currentStreak ?? 0) >= 3 && !stats.completedToday) {
    insights.push({
      id: 'streak-at-risk',
      text: `Your ${stats.currentStreak}-day streak is on the line today! Ready for a quick dive?`,
      mood: 'front-shocked',
      priority: 3
    });
  }

  // Rule 4: Struggling tag (>= 10 reviews and accuracy < 60%)
  if (stats.tagAccuracies && stats.tagAccuracies.length > 0) {
    const strugglingTags = stats.tagAccuracies
      .filter((t) => t.reviews >= 10 && t.accuracy < 60)
      .sort((a, b) => a.accuracy - b.accuracy);
    if (strugglingTags.length > 0) {
      const topStruggle = strugglingTags[0];
      insights.push({
        id: 'struggling-tag',
        text: `"${topStruggle.tag}" is giving you trouble: ${Math.round(topStruggle.accuracy)}% right over ${topStruggle.reviews} reviews.`,
        mood: 'front-sad',
        priority: 4
      });
    }
  }

  // Rule 5: Confidently wrong: >= 5 Wrong ratings in 7 days
  if ((stats.wrongCount7Days ?? 0) >= 5 && stats.mostWrongTopicName) {
    insights.push({
      id: 'confidently-wrong',
      text: `Tricky cards in ${stats.mostWrongTopicName} tripped you up recently. A quick revisit will lock them down!`,
      mood: 'front-shocked',
      priority: 5
    });
  }

  // Rule 6: Strongest tag: >= 10 reviews and accuracy >= 90%
  if (stats.tagAccuracies && stats.tagAccuracies.length > 0) {
    const strongTags = stats.tagAccuracies
      .filter((t) => t.reviews >= 10 && t.accuracy >= 90)
      .sort((a, b) => b.accuracy - a.accuracy);
    if (strongTags.length > 0) {
      const topStrong = strongTags[0];
      insights.push({
        id: 'strongest-tag',
        text: `You have mastered "${topStrong.tag}" with ${Math.round(topStrong.accuracy)}% accuracy! Stellar recall!`,
        mood: 'front-happy',
        priority: 6
      });
    }
  }

  // Rule 7: Weakest topic by current recall
  if (stats.weakestTopic && stats.weakestTopic.recall < 80) {
    insights.push({
      id: 'weakest-topic',
      text: `${stats.weakestTopic.name} is down to ${Math.round(stats.weakestTopic.recall)}% recall. Time for a quick refresher!`,
      mood: 'front-sad',
      priority: 7
    });
  }

  // Rule 8: Volume change vs previous 7 days (±30%)
  if (
    typeof stats.reviewsLast7Days === 'number' &&
    typeof stats.reviewsPrior7Days === 'number' &&
    stats.reviewsPrior7Days >= 10
  ) {
    const change = (stats.reviewsLast7Days - stats.reviewsPrior7Days) / stats.reviewsPrior7Days;
    if (change >= 0.3) {
      insights.push({
        id: 'volume-up',
        text: `Review volume is up ${Math.round(change * 100)}% compared to last week! Excellent consistency!`,
        mood: 'front-happy',
        priority: 8
      });
    } else if (change <= -0.3) {
      insights.push({
        id: 'volume-down',
        text: `Review volume dipped ${Math.round(Math.abs(change) * 100)}% this week. Let's get the rhythm going!`,
        mood: 'front',
        priority: 8
      });
    }
  }

  // Rule 9: Speed change in average seconds per card (±15%)
  if (
    typeof stats.avgSecondsLast7Days === 'number' &&
    typeof stats.avgSecondsPrior7Days === 'number' &&
    stats.avgSecondsPrior7Days > 0
  ) {
    const speedChange = (stats.avgSecondsLast7Days - stats.avgSecondsPrior7Days) / stats.avgSecondsPrior7Days;
    if (speedChange <= -0.15) {
      insights.push({
        id: 'speed-faster',
        text: `Your recall speed jumped by ${Math.round(Math.abs(speedChange) * 100)}% this week! Razor-sharp answers!`,
        mood: 'front-happy',
        priority: 9
      });
    }
  }

  // Rule 10: Fewer than 20 total reviews
  if ((stats.totalReviews ?? 0) < 20) {
    insights.push({
      id: 'early-learning',
      text: "Finish a few sessions and I'll start spotting patterns in your memory.",
      mood: 'front-happy',
      priority: 10
    });
  }

  // Fallback default
  if (insights.length === 0) {
    insights.push({
      id: 'steady-practice',
      text: "Every short session helps you remember more. Let's make today count!",
      mood: 'front',
      priority: 99
    });
  }

  return insights.sort((a, b) => a.priority - b.priority);
}
