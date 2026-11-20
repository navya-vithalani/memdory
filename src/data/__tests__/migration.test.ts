import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { MomdoryDb } from '../db';

describe('database v4 upgrade migration', () => {
  it('migrates v3 schema into v4 preserving content and moving scheduling to reviewItems', async () => {
    const dbName = `test-migration-${Date.now()}`;
    const oldDb = new Dexie(dbName);
    oldDb.version(3).stores({
      nodes: 'id, parentId, order, createdAt',
      notes: 'id, nodeId, updatedAt',
      cards: 'id, nodeId, due, createdAt',
      reviews: 'id, cardId, sessionId, timestamp',
      sessions: 'id, startedAt, endedAt, status, completedAt',
      settings: 'id'
    });
    await oldDb.open();

    const nodeId = 'node-1';
    const cardId = 'card-1';
    const noteId = 'note-1';
    const sessionId = 'session-1';
    const now = 1700000000000;

    await oldDb.table('nodes').add({
      id: nodeId,
      parentId: null,
      name: 'Organic Chemistry',
      order: 0,
      createdAt: now
    });

    await oldDb.table('cards').add({
      id: cardId,
      nodeId,
      front: 'What is Markovnikov rule?',
      back: 'Hydrogen attaches to the carbon with more hydrogens.',
      trap: true,
      due: now + 86400000,
      stability: 2.5,
      difficulty: 5.1,
      state: 1,
      reps: 2,
      lapses: 0,
      lastReview: now,
      createdAt: now
    });

    await oldDb.table('reviews').add({
      id: 'review-1',
      cardId,
      sessionId,
      rating: 'medium',
      durationMs: 3200,
      timestamp: now
    });

    await oldDb.table('sessions').add({
      id: sessionId,
      startedAt: now - 60000,
      endedAt: now,
      scopeNodeId: nodeId,
      mode: 'due',
      plannedCount: 1,
      completedCount: 1,
      status: 'completed',
      queueCardIds: [cardId],
      position: 1,
      completedAt: now
    });

    await oldDb.table('notes').add({
      id: noteId,
      nodeId,
      title: 'Electrophiles',
      body: 'Electron lovers like H+',
      createdAt: now,
      updatedAt: now
    });

    oldDb.close();

    // Now open with MomdoryDb (v4)
    const newDb = new MomdoryDb(dbName);
    await newDb.open();

    const migratedCard = await newDb.cards.get(cardId);
    expect(migratedCard).toBeDefined();
    expect(migratedCard?.front).toBe('What is Markovnikov rule?');
    expect(migratedCard?.direction).toBe('one-way');
    expect(migratedCard?.kind).toBe('basic');
    expect(migratedCard?.tagIds).toEqual([]);

    const items = await newDb.reviewItems.where('cardId').equals(cardId).toArray();
    expect(items).toHaveLength(1);
    expect(items[0].direction).toBe('forward');
    expect(items[0].trap).toBe(true);
    expect(items[0].stability).toBe(2.5);

    const migratedReview = await newDb.reviews.get('review-1');
    expect(migratedReview?.reviewItemId).toBe(items[0].id);
    expect(migratedReview?.fsrsRating).toBe('good');
    expect(migratedReview?.dayKey).toBeDefined();

    const migratedSession = await newDb.sessions.get(sessionId);
    expect(migratedSession?.scopeName).toBe('Organic Chemistry');
    expect(migratedSession?.queueItemIds).toEqual([items[0].id]);
    expect(migratedSession?.dayKey).toBeDefined();

    const migratedNote = await newDb.notes.get(noteId);
    expect(migratedNote?.type).toBe('normal');
    expect(migratedNote?.order).toBe(0);

    const migratedNode = await newDb.nodes.get(nodeId);
    expect(migratedNode?.updatedAt).toBe(now);

    newDb.close();
  });
});
