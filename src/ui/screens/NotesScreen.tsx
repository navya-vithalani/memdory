import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { NoteRecord, TreeNode } from '../../types';
import { listNodes } from '../../data/repositories/treeRepository';
import { createNoteFromFile, listNotes, updateNote } from '../../data/repositories/noteRepository';
import { NodeSelect } from '../components/NodeSelect';

export function NotesScreen() {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [nodeId, setNodeId] = useState('');
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void listNodes().then((items) => {
      if (!active) return;
      setNodes(items);
      setNodeId((current) => items.some((node) => node.id === current) ? current : items[0]?.id ?? '');
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load the study tree.');
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!nodeId) {
      setNotes([]);
      setSelectedId('');
      return;
    }
    let active = true;
    void listNotes(nodeId).then((items) => {
      if (!active) return;
      setNotes(items);
      setSelectedId((current) => items.some((note) => note.id === current) ? current : items[0]?.id ?? '');
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load notes.');
    });
    return () => {
      active = false;
    };
  }, [nodeId]);

  const selectedNote = notes.find((note) => note.id === selectedId);

  useEffect(() => {
    if (!selectedNote) return;
    setTitle(selectedNote.title);
    setBody(selectedNote.body);
    setEditing(false);
  }, [selectedId, selectedNote?.updatedAt]);

  async function importFile(file?: File) {
    if (!file || !nodeId) return;
    try {
      const source = await file.text();
      const note = await createNoteFromFile(nodeId, file.name, source);
      const next = await listNotes(nodeId);
      setNotes(next);
      setSelectedId(note.id);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not import the note.');
    }
  }

  async function save() {
    if (!selectedNote) return;
    try {
      await updateNote(selectedNote.id, title, body);
      setNotes(await listNotes(nodeId));
      setEditing(false);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the note.');
    }
  }

  return (
    <main className="screen">
      <div className="panel-header">
        <h1>Notes</h1>
        {nodeId && (
          <label className="primary-button file-button">
            Import note
            <input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(event) => {
              const file = event.target.files?.[0];
              void importFile(file);
              event.target.value = '';
            }} />
          </label>
        )}
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      {nodes.length === 0 ? (
        <p className="empty-message">Create a study area on Home before importing notes.</p>
      ) : (
        <>
          <NodeSelect nodes={nodes} value={nodeId} onChange={setNodeId} label="Browse by topic" />
          <div className="note-layout">
            <nav className="note-list" aria-label="Notes in selected topic">
              {notes.map((note) => (
                <button key={note.id} className={note.id === selectedId ? 'note-list-item active' : 'note-list-item'} onClick={() => setSelectedId(note.id)}>
                  {note.title}
                </button>
              ))}
              {notes.length === 0 && <p className="muted">No notes in this topic yet.</p>}
            </nav>
            {selectedNote && (
              <article className="markdown-card">
                <div className="panel-header">
                  <h2>{editing ? 'Edit note' : selectedNote.title}</h2>
                  {editing ? (
                    <div className="button-row">
                      <button className="secondary-button" onClick={() => {
                        setTitle(selectedNote.title);
                        setBody(selectedNote.body);
                        setEditing(false);
                      }}>Cancel</button>
                      <button className="primary-button" onClick={() => void save()}>Save</button>
                    </div>
                  ) : <button className="secondary-button" onClick={() => setEditing(true)}>Edit</button>}
                </div>
                {editing ? (
                  <div className="editor-fields">
                    <label className="field">
                      <span>Title</span>
                      <input value={title} onChange={(event) => setTitle(event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Markdown text</span>
                      <textarea rows={18} value={body} onChange={(event) => setBody(event.target.value)} />
                    </label>
                  </div>
                ) : <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedNote.body}</ReactMarkdown>}
              </article>
            )}
          </div>
        </>
      )}
    </main>
  );
}
