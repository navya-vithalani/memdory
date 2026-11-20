import type { CardRecord } from '../../types';
import { getCardFamilyKey } from './spreadFamilies';

export type CardFamilyGroup = {
  familyKey: string;
  front: string;
  nodeId: string;
  cards: CardRecord[];
};

/**
 * Derives card families from a set of cards.
 * A family is defined by 2 or more cards sharing the same nodeId and normalized front.
 */
export function deriveCardFamilies(cards: CardRecord[]): CardFamilyGroup[] {
  const byKey = new Map<string, CardRecord[]>();

  for (const card of cards) {
    const key = getCardFamilyKey(card);
    const existing = byKey.get(key) ?? [];
    existing.push(card);
    byKey.set(key, existing);
  }

  const families: CardFamilyGroup[] = [];
  for (const [familyKey, familyCards] of byKey.entries()) {
    if (familyCards.length >= 2) {
      families.push({
        familyKey,
        front: familyCards[0].front,
        nodeId: familyCards[0].nodeId,
        cards: familyCards
      });
    }
  }

  return families;
}
