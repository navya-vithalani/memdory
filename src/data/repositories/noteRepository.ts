import { db } from '../db';
import { parseNoteBody, parseNoteTitle } from '../../core/importers/noteParser';
import type { NoteRecord } from '../../types';

export async function listNotes(nodeId: string): Promise<NoteRecord[]> {
  const notes = await db.notes.where('nodeId').equals(nodeId).toArray();
  return notes.sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
}

export async function createNoteFromFile(nodeId: string, fileName: string, source: string): Promise<NoteRecord> {
  const now = Date.now();
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
    order: 0,
    sourceKey: null,
    importId: null,
    createdAt: now,
    updatedAt: now
  };
  await db.notes.add(note);
  return note;
}

export async function importNotesFromMarkdown(nodeId: string, fileName: string, source: string): Promise<{ notes: NoteRecord[]; createdNodes: number }> {
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
      const existing = knownNodes.find((node) =>
        node.parentId === parentId && node.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase()
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
        order: 0,
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

export async function createNote(nodeId: string, title: string, body: string): Promise<NoteRecord> {
  const cleanTitle = title.trim();
  if (!cleanTitle) throw new Error('Note title cannot be empty.');
  if (!body.trim()) throw new Error('Add some note content before saving.');
  if (!await db.nodes.get(nodeId)) throw new Error('The selected topic no longer exists.');
  const now = Date.now();
  const note: NoteRecord = {
    id: crypto.randomUUID(),
    nodeId,
    type: 'normal',
    title: cleanTitle,
    body: body.trim(),
    data: null,
    tagIds: [],
    color: null,
    style: null,
    starred: false,
    order: 0,
    sourceKey: null,
    importId: null,
    createdAt: now,
    updatedAt: now
  };
  await db.notes.add(note);
  return note;
}

export async function updateNote(noteId: string, title: string, body: string): Promise<void> {
  const note = await db.notes.get(noteId);
  if (!note) throw new Error('Note not found.');
  const cleanTitle = title.trim();
  if (!cleanTitle) throw new Error('Note title cannot be empty.');
  await db.notes.put({ ...note, title: cleanTitle, body, updatedAt: Date.now() });
}
