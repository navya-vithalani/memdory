import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { memdoryDb } from '../db';
import { previewImportFile, applyImport, undoImport } from '../repositories/importRepository';

describe('import repository transactional apply and undo', () => {
  it('applies an import, handles two-way reviewItems, updates by ID, and undos cleanly', async () => {
    const content = `
@ Math > Calculus
Q: Derivative of sin(x)
A: cos(x)
TAGS: trig, derivatives
TWO-WAY: yes
ID: math-der-sin

NOTE: Chain Rule
TYPE: formula
BODY: $$(f \\circ g)'(x) = f'(g(x))g'(x)$$
ID: math-note-chain
`;

    const preview = await previewImportFile(content, 'test.txt', 'paths');
    expect(preview.counts.cards).toBe(1);
    expect(preview.counts.notes).toBe(1);
    expect(preview.counts.nodes).toBe(2); // Math, Calculus

    const record = await applyImport(preview, 'paths');
    expect(record.status).toBe('applied');

    // Check that cards and reviewItems exist
    const { db } = await import('../db');
    const cards = await db.cards.toArray();
    expect(cards).toHaveLength(1);
    expect(cards[0].direction).toBe('both');

    const reviewItems = await db.reviewItems.where('cardId').equals(cards[0].id).toArray();
    expect(reviewItems).toHaveLength(2); // forward + reverse!

    const notes = await db.notes.toArray();
    expect(notes).toHaveLength(1);
    expect(notes[0].sourceKey).toBe('math-note-chain');

    // Test update by ID
    const updateContent = `
@ Math > Calculus
Q: Derivative of sin(x)
A: cos(x) [updated]
TAGS: trig
TWO-WAY: no
ID: math-der-sin
`;
    const previewUpdate = await previewImportFile(updateContent, 'test-update.txt', 'paths', undefined, true);
    expect(previewUpdate.counts.updated).toBe(1);
    await applyImport(previewUpdate, 'paths', undefined, true);

    const updatedCard = await db.cards.get(cards[0].id);
    expect(updatedCard?.back).toContain('[updated]');
    expect(updatedCard?.direction).toBe('one-way');

    // Reverse item should have been removed
    const afterUpdateItems = await db.reviewItems.where('cardId').equals(cards[0].id).toArray();
    expect(afterUpdateItems).toHaveLength(1);

    // Test undo of the first import
    await undoImport(record.id);
    const imports = await db.imports.get(record.id);
    expect(imports?.status).toBe('undone');
    const remainingCards = await db.cards.where('importId').equals(record.id).toArray();
    expect(remainingCards).toHaveLength(0);
  });
});
