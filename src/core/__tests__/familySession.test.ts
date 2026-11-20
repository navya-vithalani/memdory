import { describe, expect, it } from 'vitest';
import type { CardRecord } from '../../types';
import { deriveCardFamilies } from '../session/familyCards';
import { getCardFamilyKey, spreadFamilies } from '../session/spreadFamilies';

function mockCard(id: string, nodeId: string, front: string): CardRecord {
  return {
    id,
    nodeId,
    front,
    back: 'Answer ' + id,
    createdAt: 1000
  };
}

describe('family derivation', () => {
  it('groups cards by nodeId and normalized front into families of 2 or more', () => {
    const cards = [
      mockCard('c1', 'n1', 'XeF4'),
      mockCard('c2', 'n1', 'xef4 '),
      mockCard('c3', 'n1', 'CO2'),
      mockCard('c4', 'n2', 'XeF4') // different node -> different family
    ];

    const families = deriveCardFamilies(cards);
    expect(families).toHaveLength(1);
    expect(families[0].front).toBe('XeF4');
    expect(families[0].cards).toHaveLength(2);
  });
});

describe('spreadFamilies', () => {
  it('keeps cards of the same family spaced at least 5 positions apart when queue permits', () => {
    const cards = [
      mockCard('a1', 'n1', 'Alpha'),
      mockCard('a2', 'n1', 'alpha'),
      mockCard('b1', 'n1', 'Beta'),
      mockCard('c1', 'n1', 'Gamma'),
      mockCard('d1', 'n1', 'Delta'),
      mockCard('e1', 'n1', 'Epsilon'),
      mockCard('f1', 'n1', 'Zeta')
    ];

    const result = spreadFamilies(cards, 5);
    const alphaIndices = result
      .map((c, i) => (getCardFamilyKey(c) === 'n1|alpha' ? i : -1))
      .filter((i) => i !== -1);

    expect(alphaIndices).toHaveLength(2);
    expect(alphaIndices[1] - alphaIndices[0]).toBeGreaterThanOrEqual(5);
  });
});
