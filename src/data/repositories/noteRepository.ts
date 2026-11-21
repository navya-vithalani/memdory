import { db } from '../db';
import { parseNoteBody, parseNoteTitle } from '../../core/importers/noteParser';
import { normalizeTagName } from '../../core/importers/importParser';
import type { NoteRecord } from '../../types';

export async function listNotes(nodeIdOrIds: string | string[]): Promise<NoteRecord[]> {
  if (Array.isArray(nodeIdOrIds)) {
    if (nodeIdOrIds.length === 0) return [];
    if (nodeIdOrIds.length === 1) {
      const notes = await db.notes.where('nodeId').equals(nodeIdOrIds[0]).toArray();
      return notes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    const notes = await db.notes.where('nodeId').anyOf(nodeIdOrIds).toArray();
    return notes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  const notes = await db.notes.where('nodeId').equals(nodeIdOrIds).toArray();
  return notes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function createNoteFromFile(nodeId: string, fileName: string, source: string): Promise<NoteRecord> {
  const now = Date.now();
  const existingNotes = await db.notes.where('nodeId').equals(nodeId).toArray();
  const nextOrder = existingNotes.length;

  const note: NoteRecord = {
    id: crypto.randomUUID(),
    nodeId,
    type: 'normal',
    title: parseNoteTitle(fileName, source),
    body: parseNoteBody(source),
    data: null,
    tagIds: [],
    color: null,
    style: null,
    starred: false,
    order: nextOrder,
    sourceKey: null,
    importId: null,
    createdAt: now,
    updatedAt: now
  };
  await db.notes.add(note);
  return note;
}

export async function importNotesFromMarkdown(
  nodeId: string,
  fileName: string,
  source: string
): Promise<{ notes: NoteRecord[]; createdNodes: number }> {
  const headings = [...source.matchAll(/^(#{2,3})\s+(.+)$/gm)];
  const now = Date.now();
  const imported: NoteRecord[] = [];
  let createdNodes = 0;

  await db.transaction('rw', db.nodes, db.notes, async () => {
    const nodes = await db.nodes.toArray();
    if (!nodes.some((node) => node.id === nodeId)) throw new Error('The selected topic no longer exists.');
    const knownNodes = [...nodes];

    async function getOrCreateTopic(parentId: string, topicName: string): Promise<string> {
      const cleanName = topicName.trim();
      if (!cleanName) return parentId;
      const existing = knownNodes.find(
        (node) => node.parentId === parentId && node.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase()
      );
      if (existing) return existing.id;
      const siblings = knownNodes.filter((node) => node.parentId === parentId);
      const topic = {
        id: crypto.randomUUID(),
        parentId,
        name: cleanName,
        order: siblings.length,
        createdAt: now
      };
      await db.nodes.add(topic);
      knownNodes.push(topic);
      createdNodes += 1;
      return topic.id;
    }

    async function saveNote(targetNodeId: string, title: string, body: string): Promise<void> {
      const existingInNode = await db.notes.where('nodeId').equals(targetNodeId).toArray();
      const note: NoteRecord = {
        id: crypto.randomUUID(),
        nodeId: targetNodeId,
        type: 'normal',
        title: title.trim() || 'Untitled note',
        body: body.trim(),
        data: null,
        tagIds: [],
        color: null,
        style: null,
        starred: false,
        order: existingInNode.length,
        sourceKey: null,
        importId: null,
        createdAt: now,
        updatedAt: now
      };
      await db.notes.add(note);
      imported.push(note);
    }

    if (!headings.length) {
      await saveNote(nodeId, parseNoteTitle(fileName, source), parseNoteBody(source));
      return;
    }

    const firstHeadingIndex = headings[0].index ?? 0;
    const lead = source.slice(0, firstHeadingIndex).replace(/^#\s+.+(?:\r?\n|$)/, '').trim();
    if (lead) await saveNote(nodeId, parseNoteTitle(fileName, source), lead);

    let activeSectionId = nodeId;
    for (let index = 0; index < headings.length; index += 1) {
      const heading = headings[index];
      const headingIndex = heading.index ?? 0;
      const headingEnd = headingIndex + heading[0].length;
      const nextHeadingIndex = headings[index + 1]?.index ?? source.length;
      const content = source.slice(headingEnd, nextHeadingIndex).trim();
      const parentId = heading[1].length === 2 ? nodeId : activeSectionId;
      const topicId = await getOrCreateTopic(parentId, heading[2]);
      if (heading[1].length === 2) activeSectionId = topicId;
      await saveNote(topicId, heading[2], content);
    }
  });

  return { notes: imported, createdNodes };
}

export type CreateNoteOptions = {
  type?: string;
  data?: Record<string, unknown> | null;
  tags?: string[];
  color?: string | null;
  style?: { bold?: boolean; size?: 'sm' | 'md' | 'lg'; font?: 'sans' | 'mono' | 'serif' } | null;
  starred?: boolean;
};

export async function createNote(
  nodeId: string,
  title: string | null,
  body: string,
  options?: CreateNoteOptions
): Promise<NoteRecord> {
  const type = options?.type ?? 'normal';
  const cleanTitle = title?.trim() ?? null;
  if (type === 'concept' && !cleanTitle) {
    throw new Error('Concept notes must have a title.');
  }

  const cleanBody = body.trim();
  if (type !== 'mnemonic' && !cleanBody) {
    throw new Error('Add some note content before saving.');
  }

  if (!(await db.nodes.get(nodeId))) {
    throw new Error('The selected topic no longer exists.');
  }

  const now = Date.now();
  const existingNotes = await db.notes.where('nodeId').equals(nodeId).toArray();
  const nextOrder = existingNotes.length;

  const tagIds: string[] = [];
  if (options?.tags?.length) {
    for (const rawTag of options.tags) {
      const { key, label } = normalizeTagName(rawTag);
      let existing = await db.tags.where('name').equals(key).first();
      if (!existing) {
        existing = { id: crypto.randomUUID(), name: key, label, createdAt: now };
        await db.tags.add(existing);
      }
      tagIds.push(existing.id);
    }
  }

  const note: NoteRecord = {
    id: crypto.randomUUID(),
    nodeId,
    type,
    title: cleanTitle,
    body: cleanBody,
    data: options?.data ?? null,
    tagIds,
    color: options?.color ?? null,
    style: options?.style ?? null,
    starred: Boolean(options?.starred),
    order: nextOrder,
    sourceKey: null,
    importId: null,
    createdAt: now,
    updatedAt: now
  };

  await db.notes.add(note);
  return note;
}

export async function updateNote(
  noteId: string,
  title: string | null,
  body: string,
  options?: CreateNoteOptions
): Promise<void> {
  const note = await db.notes.get(noteId);
  if (!note) throw new Error('Note not found.');

  const type = options?.type ?? note.type ?? 'normal';
  const cleanTitle = title?.trim() ?? null;
  if (type === 'concept' && !cleanTitle) {
    throw new Error('Concept notes must have a title.');
  }

  const now = Date.now();
  let tagIds = note.tagIds ?? [];
  if (options?.tags !== undefined) {
    tagIds = [];
    for (const rawTag of options.tags) {
      const { key, label } = normalizeTagName(rawTag);
      let existing = await db.tags.where('name').equals(key).first();
      if (!existing) {
        existing = { id: crypto.randomUUID(), name: key, label, createdAt: now };
        await db.tags.add(existing);
      }
      tagIds.push(existing.id);
    }
  }

  await db.notes.put({
    ...note,
    type,
    title: cleanTitle,
    body: body.trim(),
    data: options?.data !== undefined ? options.data : note.data,
    tagIds,
    color: options?.color !== undefined ? options.color : note.color,
    style: options?.style !== undefined ? options.style : note.style,
    starred: options?.starred !== undefined ? options.starred : note.starred,
    updatedAt: now
  });
}

export async function moveNote(nodeId: string, noteId: string, direction: 'up' | 'down'): Promise<void> {
  await db.transaction('rw', db.notes, async () => {
    let targetNodeId = nodeId;
    const currentNote = await db.notes.get(noteId);
    if (currentNote?.nodeId) {
      targetNodeId = currentNote.nodeId;
    }
    const notes = await db.notes.where('nodeId').equals(targetNodeId).toArray();
    notes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const index = notes.findIndex((n) => n.id === noteId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= notes.length) return;

    // Swap positions
    const temp = notes[index];
    notes[index] = notes[targetIndex];
    notes[targetIndex] = temp;

    // Update orders
    for (let i = 0; i < notes.length; i++) {
      notes[i].order = i;
      await db.notes.put(notes[i]);
    }
  });
}

export async function deleteNote(noteId: string): Promise<void> {
  await db.notes.delete(noteId);
}
