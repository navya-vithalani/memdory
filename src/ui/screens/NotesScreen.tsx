import { useEffect, useMemo, useState } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { useTree } from '../../hooks/useTree';
import { db } from '../../data/db';
import type { NoteRecord, TagRecord } from '../../types';
import { NodeSelect } from '../components/NodeSelect';
import { ImportModal } from '../components/ImportModal';
import { NoteCard } from '../components/notes/NoteCard';
import { TableOfContents } from '../components/notes/TableOfContents';
import { NoteMenuModal } from '../components/notes/NoteMenuModal';
import { NoteEditorModal } from '../components/notes/NoteEditorModal';

export function NotesScreen() {
  const { nodes, error: treeError, refresh: refreshTree } = useTree();
  const [nodeId, setNodeId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeType, setActiveType] = useState<string | null>(null);
  const [starredFilter, setStarredFilter] = useState(false);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);

  const [allTags, setAllTags] = useState<TagRecord[]>([]);
  const [tagsMap, setTagsMap] = useState<Map<string, string>>(new Map());

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteRecord | null>(null);
  const [menuNote, setMenuNote] = useState<NoteRecord | null>(null);
  const [highlightedNoteId, setHighlightedNoteId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { notes, error: notesError, create, save, move, remove, refresh: refreshNotes } = useNotes(nodeId);

  // Default to first node
  useEffect(() => {
    setNodeId((current) => (nodes.some((node) => node.id === current) ? current : nodes[0]?.id ?? ''));
  }, [nodes]);

  // Load all tags
  useEffect(() => {
    let active = true;
    void db.tags.toArray().then((tags) => {
      if (!active) return;
      setAllTags(tags);
      const map = new Map<string, string>();
      for (const t of tags) {
        map.set(t.id, t.label || t.name);
      }
      setTagsMap(map);
    });
    return () => {
      active = false;
    };
  }, [notes]);

  // 5.7 Combined search and filters: title, body, cue, meaning, story, tags
  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return notes.filter((note) => {
      // 1. Starred filter
      if (starredFilter && !note.starred) return false;

      // 2. Type filter
      if (activeType !== null && (note.type || 'normal') !== activeType) return false;

      // 3. Tag filter
      if (activeTagId !== null && (!note.tagIds || !note.tagIds.includes(activeTagId))) return false;

      // 4. Search query
      if (q) {
        const titleMatch = (note.title ?? '').toLowerCase().includes(q);
        const bodyMatch = (note.body ?? '').toLowerCase().includes(q);
        const cueMatch = typeof note.data?.cue === 'string' && note.data.cue.toLowerCase().includes(q);
        const meaningMatch = typeof note.data?.meaning === 'string' && note.data.meaning.toLowerCase().includes(q);
        const storyMatch = typeof note.data?.story === 'string' && note.data.story.toLowerCase().includes(q);
        const tagsMatch = (note.tagIds ?? []).some((tId) => (tagsMap.get(tId) ?? '').toLowerCase().includes(q));

        if (!titleMatch && !bodyMatch && !cueMatch && !meaningMatch && !storyMatch && !tagsMatch) {
          return false;
        }
      }

      return true;
    });
  }, [notes, searchQuery, activeType, starredFilter, activeTagId, tagsMap]);

  // Scroll to note on TOC chip tap
  function handleSelectNote(noteId: string) {
    setHighlightedNoteId(noteId);
    const element = document.getElementById(`note-${noteId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    window.setTimeout(() => setHighlightedNoteId(null), 2000);
  }

  async function handleSaveNote(
    title: string | null,
    body: string,
    options: {
      type: string;
      data?: Record<string, unknown> | null;
      tags: string[];
      color: string | null;
      starred: boolean;
    }
  ) {
    try {
      if (editingNote) {
        await save(editingNote.id, title, body, options);
      } else {
        await create(title, body, options);
      }
      setEditorOpen(false);
      setEditingNote(null);
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : 'Could not save note.');
    }
  }

  return (
    <main className="screen notes-screen">
      <div className="notes-container">
        {/* Top actions bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <NodeSelect nodes={nodes} value={nodeId} onChange={setNodeId} label="Select topic" />
          </div>
          {nodeId && (
            <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end', marginBottom: '8px' }}>
              <button
                className="secondary-button"
                style={{ minHeight: '40px', padding: '0 12px', fontSize: '13px' }}
                onClick={() => {
                  setEditingNote(null);
                  setEditorOpen(true);
                }}
              >
                ＋ Write note
              </button>
              <button
                className="primary-button"
                style={{ minHeight: '40px', padding: '0 12px', fontSize: '13px' }}
                onClick={() => setImportOpen(true)}
              >
                Import
              </button>
            </div>
          )}
        </div>

        {(treeError || notesError) && (
          <p className="error-message" role="alert">
            {treeError || notesError}
          </p>
        )}

        {nodes.length === 0 ? (
          <p className="empty-message">Create a study area on Home before adding notes.</p>
        ) : (
          <>
            {/* Search Input */}
            <div className="notes-search-box">
              <svg className="notes-search-icon" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                className="notes-search-input"
                type="search"
                placeholder="Search notes, cues, formulas, tags…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Table of contents & Filters Bar */}
            <TableOfContents
              notes={notes}
              allTags={allTags}
              activeType={activeType}
              onTypeFilter={setActiveType}
              starredFilter={starredFilter}
              onStarredFilter={setStarredFilter}
              activeTagId={activeTagId}
              onTagFilter={setActiveTagId}
              onSelectNote={handleSelectNote}
            />

            {/* Note Grid (5.4: two-column grid preserving order) */}
            {filteredNotes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--ink-soft)' }}>
                <p style={{ margin: '0 0 8px', fontWeight: 700 }}>No notes found</p>
                <small>Write a new note or import files to see them here.</small>
              </div>
            ) : (
              <div className="notes-grid">
                {filteredNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    tagsMap={tagsMap}
                    highlighted={highlightedNoteId === note.id}
                    onOpenMenu={setMenuNote}
                    onStarToggle={async (n) => {
                      await save(n.id, n.title ?? null, n.body, { starred: !n.starred });
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Note Editor Modal */}
      {editorOpen && (
        <NoteEditorModal
          initialNote={editingNote}
          onClose={() => {
            setEditorOpen(false);
            setEditingNote(null);
          }}
          onSave={(title, body, opts) => void handleSaveNote(title, body, opts)}
        />
      )}

      {/* Note Options / Long-press Menu (5.3) */}
      {menuNote && (
        <NoteMenuModal
          note={menuNote}
          onClose={() => setMenuNote(null)}
          onColorChange={async (col) => {
            await save(menuNote.id, menuNote.title ?? null, menuNote.body, { color: col });
            setMenuNote(null);
          }}
          onStyleChange={async (st) => {
            await save(menuNote.id, menuNote.title ?? null, menuNote.body, { style: st });
            setMenuNote(null);
          }}
          onStarToggle={async () => {
            await save(menuNote.id, menuNote.title ?? null, menuNote.body, { starred: !menuNote.starred });
            setMenuNote(null);
          }}
          onEdit={() => {
            setEditingNote(menuNote);
            setEditorOpen(true);
            setMenuNote(null);
          }}
          onMoveUp={async () => {
            await move(menuNote.id, 'up');
            setMenuNote(null);
          }}
          onMoveDown={async () => {
            await move(menuNote.id, 'down');
            setMenuNote(null);
          }}
          onDelete={async () => {
            await remove(menuNote.id);
            setMenuNote(null);
          }}
        />
      )}

      {/* Import Modal */}
      {importOpen && (
        <ImportModal
          nodes={nodes}
          defaultNodeId={nodeId}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            void refreshTree();
            void refreshNotes();
          }}
        />
      )}
    </main>
  );
}
