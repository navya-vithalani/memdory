import type { CardRecord } from '../../types';

export function normalizeFront(front: string): string {
  return front.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function getCardFamilyKey(card: CardRecord): string {
  return `${card.nodeId}|${normalizeFront(card.front)}`;
}

/**
 * Ensures cards with the same familyKey (nodeId + normalized front)
 * are spaced at least minDistance (default 5) positions apart when possible.
 */
export function spreadFamilies(cards: CardRecord[], minDistance = 5): CardRecord[] {
  if (cards.length <= 1) return [...cards];

  const result: CardRecord[] = [];
  const remaining = [...cards];
  const lastIndexByKey = new Map<string, number>();

  while (remaining.length > 0) {
    let chosenIndex = -1;
    const currentIndex = result.length;

    // First, look for a card whose family was placed at least minDistance ago
    for (let i = 0; i < remaining.length; i++) {
      const card = remaining[i];
      const key = getCardFamilyKey(card);
      const lastIndex = lastIndexByKey.get(key);

      if (lastIndex === undefined || currentIndex - lastIndex >= minDistance) {
        chosenIndex = i;
        break;
      }
    }

    // If no card satisfies the distance, pick the card whose family was seen longest ago
    if (chosenIndex === -1) {
      let maxGap = -1;
      chosenIndex = 0;
      for (let i = 0; i < remaining.length; i++) {
        const card = remaining[i];
        const key = getCardFamilyKey(card);
        const lastIndex = lastIndexByKey.get(key) ?? -Infinity;
        const gap = currentIndex - lastIndex;
        if (gap > maxGap) {
          maxGap = gap;
          chosenIndex = i;
        }
      }
    }

    const [selected] = remaining.splice(chosenIndex, 1);
    result.push(selected);
    lastIndexByKey.set(getCardFamilyKey(selected), currentIndex);
  }

  return result;
}
