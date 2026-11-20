import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db';
import { createBackup, restoreBackup, exportContentAsText } from '../backup/backup';
import { parseImportFile } from '../../core/importers/importParser';

describe('backup and content export round-trip', () => {
  it('creates full backup with dynamic tables and restores with replace', async () => {
    const now = Date.now();
    await db.nodes.add({ id: 'n1', parentId: null, name: 'Physics', order: 0, createdAt: now });
    await db.cards.add({
      id: 'c1',
      nodeId: 'n1',
      front: 'E=mc^2',
      back: 'Energy mass equivalence',
      explanation: null,
      tagIds: [],
      kind: 'basic',
      direction: 'one-way',
      starred: false,
      paused: false,
      sourceKey: 'phy-emc2',
      importId: null,
      createdAt: now,
      updatedAt: now
    });

    const backup = await createBackup();
    expect(backup.schemaVersion).toBe(4);
    expect(backup.tables.cards).toBeDefined();

    // Clear and restore
    await db.cards.clear();
    expect(await db.cards.count()).toBe(0);

    const restoreRes = await restoreBackup(JSON.stringify(backup), 'replace');
    expect(restoreRes.counts.cards).toBe(1);
    expect(await db.cards.count()).toBe(1);
  });

  it('exports content as text and parses back identically', async () => {
    const text = await exportContentAsText();
    expect(text).toContain('@ Physics');
    expect(text).toContain('Q: E=mc^2');
    expect(text).toContain('A: Energy mass equivalence');

    const parsed = parseImportFile(text, 'paths');
    expect(parsed.cards).toHaveLength(1);
    expect(parsed.cards[0].front).toBe('E=mc^2');
  });
});
