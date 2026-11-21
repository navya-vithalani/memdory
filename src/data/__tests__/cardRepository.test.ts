import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db';
import { hydrateCardsWithReviewItems, listCardsInScope } from '../repositories/cardRepository';
import type { CardRecord, ReviewItemRecord } from '../../types';

describe('cardRepository hydration and scheduling join', () => {
  const nodeId = 'chem-101';
  const now = 1700000000000;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await db.nodes.add({
      id: nodeId,
      parentId: null,
      name: 'Chemistry',
      order: 0,
      createdAt: now
    });
  });

  it('correctly joins cards with reviewItems to populate scheduling fields', async () => {
    const cardId1 = 'c1';
    const cardId2 = 'c2';

    const card1: CardRecord = {
      id: cardId1,
      nodeId,
      front: 'XeF4 shape',
      back: 'Square planar',
      createdAt: now
    };

    const card2: CardRecord = {
      id: cardId2,
      nodeId,
      front: 'SF6 shape',
      back: 'Octahedral',
      createdAt: now + 1000
    };

    await db.cards.bulkAdd([card1, card2]);

    const item1: ReviewItemRecord = {
      id: 'item-1',
      cardId: cardId1,
      direction: 'forward',
      due: now + 50000,
      stability: 3.5,
      difficulty: 4.0,
      state: 2,
      reps: 5,
      lapses: 1,
      lastReview: now,
      trap: true,
      createdAt: now
    };

    const item2: ReviewItemRecord = {
      id: 'item-2',
      cardId: cardId2,
      direction: 'forward',
      due: now + 100000,
      stability: 1.0,
      difficulty: 5.0,
      state: 1,
      reps: 1,
      lapses: 0,
      lastReview: null,
      trap: false,
      createdAt: now
    };

    await db.reviewItems.bulkAdd([item1, item2]);

    const hydrated = await hydrateCardsWithReviewItems([card1, card2]);
    expect(hydrated).toHaveLength(2);

    const h1 = hydrated.find((c) => c.id === cardId1);
    expect(h1).toBeDefined();
    expect(h1?.due).toBe(now + 50000);
    expect(h1?.stability).toBe(3.5);
    expect(h1?.lastReview).toBe(now);
    expect(h1?.trap).toBe(true);
    expect(h1?.reviewItemId).toBe('item-1');

    const h2 = hydrated.find((c) => c.id === cardId2);
    expect(h2).toBeDefined();
    expect(h2?.due).toBe(now + 100000);
    expect(h2?.lastReview).toBeNull();
    expect(h2?.trap).toBe(false);

    // Also verify listCardsInScope returns hydrated cards
    const scoped = await listCardsInScope(nodeId);
    expect(scoped).toHaveLength(2);
    expect(scoped[0].id).toBe(cardId1); // earlier due
    expect(scoped[0].stability).toBe(3.5);
  });
});
