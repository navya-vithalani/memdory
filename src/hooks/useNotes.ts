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

export function useNotes(nodeIdOrIds: string | string[]) {
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [error, setError] = useState('');

  const key = Array.isArray(nodeIdOrIds) ? nodeIdOrIds.slice().sort().join(',') : nodeIdOrIds;
  const targetNodeId = Array.isArray(nodeIdOrIds) ? nodeIdOrIds[0] ?? '' : nodeIdOrIds;

  const refresh = useCallback(async () => {
    if (!key) {
      setNotes([]);
      return [];
    }
    const items = await listNotes(nodeIdOrIds);
    setNotes(items);
    setError('');
    return items;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let active = true;
    if (!key) {
      setNotes([]);
      return () => {
        active = false;
      };
    }
    void listNotes(nodeIdOrIds)
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
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const importFile = useCallback(
    async (file: File) => {
      const result = await importNotesFromMarkdown(targetNodeId, file.name, await file.text());
      await refresh();
      return result;
    },
    [targetNodeId, refresh]
  );

  const create = useCallback(
    async (title: string | null, body: string, options?: CreateNoteOptions) => {
      const note = await createNote(targetNodeId, title, body, options);
      await refresh();
      return note;
    },
    [targetNodeId, refresh]
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
      await moveNote(targetNodeId, noteId, direction);
      return refresh();
    },
    [targetNodeId, refresh]
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
