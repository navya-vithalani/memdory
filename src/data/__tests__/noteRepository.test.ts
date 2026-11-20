import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db';
import { createNote, listNotes, moveNote, updateNote, deleteNote } from '../repositories/noteRepository';

describe('Note repository (Phase 5)', () => {
  const nodeId = 'topic-1';

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await db.nodes.add({
      id: nodeId,
      parentId: null,
      name: 'Chemistry',
      order: 0,
      createdAt: 1000
    });
  });

  it('creates notes with type, color, starred, tags, and orders them sequentially', async () => {
    const note1 = await createNote(nodeId, 'Concept 1', 'Some concept text', {
      type: 'concept',
      color: 'indigo',
      starred: true
    });
    const note2 = await createNote(nodeId, null, 'E = mc^2', {
      type: 'formula',
      color: 'sky'
    });

    expect(note1.order).toBe(0);
    expect(note2.order).toBe(1);
    expect(note1.type).toBe('concept');
    expect(note2.type).toBe('formula');

    const list = await listNotes(nodeId);
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(note1.id);
    expect(list[1].id).toBe(note2.id);
  });

  it('moves notes up and down within a topic', async () => {
    const note1 = await createNote(nodeId, 'Note 1', 'Content 1');
    const note2 = await createNote(nodeId, 'Note 2', 'Content 2');
    const note3 = await createNote(nodeId, 'Note 3', 'Content 3');

    // Move note 2 down -> should now be at the end
    await moveNote(nodeId, note2.id, 'down');
    let list = await listNotes(nodeId);
    expect(list.map((n) => n.id)).toEqual([note1.id, note3.id, note2.id]);

    // Move note 3 up -> should now be first
    await moveNote(nodeId, note3.id, 'up');
    list = await listNotes(nodeId);
    expect(list.map((n) => n.id)).toEqual([note3.id, note1.id, note2.id]);
  });

  it('updates note content, type, color, and style', async () => {
    const note = await createNote(nodeId, 'Old Title', 'Old body');
    await updateNote(note.id, 'New Title', 'New body', {
      type: 'trick',
      color: 'sun',
      style: { bold: true, size: 'lg' }
    });

    const updated = await db.notes.get(note.id);
    expect(updated?.title).toBe('New Title');
    expect(updated?.type).toBe('trick');
    expect(updated?.color).toBe('sun');
    expect(updated?.style?.bold).toBe(true);
    expect(updated?.style?.size).toBe('lg');
  });

  it('deletes a note', async () => {
    const note = await createNote(nodeId, 'To Delete', 'Body');
    expect(await db.notes.count()).toBe(1);

    await deleteNote(note.id);
    expect(await db.notes.count()).toBe(0);
  });
});
