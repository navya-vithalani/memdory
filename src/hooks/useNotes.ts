import { useCallback, useEffect, useState } from 'react';
import { createNoteFromFile, listNotes, updateNote } from '../data/repositories/noteRepository';
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
    void listNotes(nodeId).then((items) => {
      if (active) {
        setNotes(items);
        setError('');
      }
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load notes.');
    });
    return () => {
      active = false;
    };
  }, [nodeId]);

  const importFile = useCallback(async (file: File) => {
    const note = await createNoteFromFile(nodeId, file.name, await file.text());
    await refresh();
    return note;
  }, [nodeId, refresh]);

  const save = useCallback(async (noteId: string, title: string, body: string) => {
    await updateNote(noteId, title, body);
    return refresh();
  }, [refresh]);

  return { notes, error, refresh, importFile, save };
}
