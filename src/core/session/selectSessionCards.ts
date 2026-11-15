export type SessionCard = {
  id: string;
  front: string;
  due: number;
  reviewed: boolean;
  trap?: boolean;
  recall: number;
};

export type SessionMode = 'about-to-forget' | 'due' | 'random';

export type SessionSelectionOptions = {
  now?: number;
  includeNew?: boolean;
  newCardLimit?: number;
  totalReviews?: number;
  random?: () => number;
};

export function minutesToCount(minutes: number, avgSecondsPerCard: number): number {
  if (!Number.isFinite(minutes) || !Number.isFinite(avgSecondsPerCard) || minutes <= 0) return 0;
  const secondsPerCard = Math.max(avgSecondsPerCard, 1);
  return Math.floor((minutes * 60) / secondsPerCard);
}

export function selectSessionCards(
  cards: SessionCard[],
  mode: SessionMode,
  count = 10,
  options: SessionSelectionOptions = {}
): SessionCard[] {
  if (!Number.isFinite(count) || count <= 0) return [];
  const safeCount = Math.floor(count);
  const now = options.now ?? Date.now();
  const includeNew = options.includeNew ?? true;
  const newCardLimit = includeNew ? Math.max(0, Math.floor(options.newCardLimit ?? cards.length)) : 0;
  const reviewed = cards.filter((card) => card.reviewed);
  const newCards = cards.filter((card) => !card.reviewed).slice(0, newCardLimit);
  const dueCards = reviewed.filter((card) => card.due <= now).sort((a, b) => a.due - b.due);

  if (mode === 'due') {
    return [...dueCards, ...newCards].slice(0, safeCount);
  }

  if (mode === 'random') {
    const randomized = [...reviewed, ...newCards];
    const random = options.random ?? Math.random;
    for (let index = randomized.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [randomized[index], randomized[target]] = [randomized[target], randomized[index]];
    }
    return randomized.slice(0, safeCount);
  }

  const ranked = (options.totalReviews ?? Number.MAX_SAFE_INTEGER) < 50
    ? dueCards
    : [...reviewed].sort((a, b) => {
      const priorityA = a.recall - (a.trap ? 0.2 : 0);
      const priorityB = b.recall - (b.trap ? 0.2 : 0);
      return priorityA - priorityB || a.id.localeCompare(b.id);
    });

  return [...ranked, ...newCards].slice(0, safeCount);
}
