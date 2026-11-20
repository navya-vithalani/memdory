import { useCallback, useEffect, useState } from 'react';
import {
  createNote,
  deleteNote,
  importNotesFromMarkdown,
  listNotes,
  moveNote,
  updateNote,
  type CreateNoteOptions
} from '../data/repositories/noteRepository';
import type { NoteRecord } from '../types';

export function useNotes(nodeId: string) {
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!nodeId) {
      setNotes([]);
      return [];
    }
    const items = await listNotes(nodeId);
    setNotes(items);
    setError('');
    return items;
  }, [nodeId]);

  useEffect(() => {
    let active = true;
    if (!nodeId) {
      setNotes([]);
      return () => {
        active = false;
      };
    }
    void listNotes(nodeId)
      .then((items) => {
        if (active) {
          setNotes(items);
          setError('');
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load notes.');
      });
    return () => {
      active = false;
    };
  }, [nodeId]);

  const importFile = useCallback(
    async (file: File) => {
      const result = await importNotesFromMarkdown(nodeId, file.name, await file.text());
      await refresh();
      return result;
    },
    [nodeId, refresh]
  );

  const create = useCallback(
    async (title: string | null, body: string, options?: CreateNoteOptions) => {
      const note = await createNote(nodeId, title, body, options);
      await refresh();
      return note;
    },
    [nodeId, refresh]
  );

  const save = useCallback(
    async (noteId: string, title: string | null, body: string, options?: CreateNoteOptions) => {
      await updateNote(noteId, title, body, options);
      return refresh();
    },
    [refresh]
  );

  const move = useCallback(
    async (noteId: string, direction: 'up' | 'down') => {
      await moveNote(nodeId, noteId, direction);
      return refresh();
    },
    [nodeId, refresh]
  );

  const remove = useCallback(
    async (noteId: string) => {
      await deleteNote(noteId);
      return refresh();
    },
    [refresh]
  );

  return { notes, error, refresh, importFile, create, save, move, remove };
}
