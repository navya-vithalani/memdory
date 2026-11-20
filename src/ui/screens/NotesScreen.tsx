import { useEffect, useState } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { useTree } from '../../hooks/useTree';
import { NodeSelect } from '../components/NodeSelect';
import { NotesMarkdown } from '../components/NotesMarkdown';
import { ImportModal } from '../components/ImportModal';

export function NotesScreen() {
  const { nodes, error: treeError, refresh: refreshTree } = useTree();
  const [nodeId, setNodeId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const { notes, error: notesError, create: createNote, save: saveNote, refresh: refreshNotes } = useNotes(nodeId);

  useEffect(() => {
    setNodeId((current) => nodes.some((node) => node.id === current) ? current : nodes[0]?.id ?? '');
  }, [nodes]);

  useEffect(() => {
    setSelectedId((current) => notes.some((note) => note.id === current) ? current : notes[0]?.id ?? '');
  }, [notes]);

  const selectedNote = notes.find((note) => note.id === selectedId);

  useEffect(() => {
    if (!selectedNote) return;
    setTitle(selectedNote.title ?? '');
    setBody(selectedNote.body);
    setEditing(false);
  }, [selectedId, selectedNote?.updatedAt]);

  async function handleCreate() {
    try {
      const note = await createNote(title, body);
      setSelectedId(note.id);
      setCreating(false);
      setEditing(false);
      setTitle('');
      setBody('');
      setSuccess('Your note is saved.');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save your note.');
      setSuccess('');
    }
  }

  async function handleSave() {
    if (!selectedNote) return;
    try {
      await saveNote(selectedNote.id, title, body);
      setEditing(false);
      setCreating(false);
      setSuccess('Your changes are saved.');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the note.');
    }
  }

  return (
    <main className="screen notes-screen">
      <div className="panel-header notes-action-bar">
        {nodeId && (
          <div className="notes-header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button
              className="secondary-button"
              onClick={() => {
                setCreating(true);
                setEditing(true);
                setTitle('');
                setBody('');
                setSelectedId('');
              }}
            >
              ＋ Write note
            </button>
            <button className="primary-button" onClick={() => setImportOpen(true)}>
              Import file
            </button>
          </div>
        )}
      </div>
      {(error || treeError || notesError) && <p className="error-message" role="alert">{error || treeError || notesError}</p>}
      {success && <p className="success-message" role="status">{success}</p>}
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
            {creating && (
              <article className="markdown-card note-composer">
                <div className="panel-header"><div><p className="eyebrow">Start with one good idea</p><h2>Write a note</h2></div>
                  <div className="button-row"><button className="text-button" onClick={() => { setCreating(false); setEditing(false); }}>Cancel</button><button className="primary-button" onClick={() => void handleCreate()} disabled={!title.trim() || !body.trim()}>Save note</button></div>
                </div>
                <div className="editor-fields">
                  <label className="field"><span>Title</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Cell structure" /></label>
                  <label className="field"><span>Note content</span><textarea rows={14} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Capture what you want to remember…" /></label>
                </div>
              </article>
            )}
            {selectedNote && !creating && (
              <article className="markdown-card">
                <div className="panel-header">
                  <h2>{editing ? 'Edit note' : selectedNote.title}</h2>
                  {editing ? (
                    <div className="button-row">
                      <button className="secondary-button" onClick={() => {
                        setTitle(selectedNote.title ?? '');
                        setBody(selectedNote.body);
                        setEditing(false);
                      }}>Cancel</button>
                      <button className="primary-button" onClick={() => void handleSave()}>Save</button>
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
                ) : <NotesMarkdown body={selectedNote.body} />}
              </article>
            )}
          </div>
        </>
      )}
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
