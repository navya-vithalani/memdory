import { db } from '../db';
import { parseNoteBody, parseNoteTitle } from '../../core/importers/noteParser';
import type { NoteRecord } from '../../types';

export async function listNotes(nodeId: string): Promise<NoteRecord[]> {
  const notes = await db.notes.where('nodeId').equals(nodeId).toArray();
  return notes.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createNoteFromFile(nodeId: string, fileName: string, source: string): Promise<NoteRecord> {
  const now = Date.now();
  const note: NoteRecord = {
    id: crypto.randomUUID(),
    nodeId,
    title: parseNoteTitle(fileName, source),
    body: parseNoteBody(source),
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
