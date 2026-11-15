import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNotes } from '../../hooks/useNotes';
import { useTree } from '../../hooks/useTree';
import { NodeSelect } from '../components/NodeSelect';

export function NotesScreen() {
  const { nodes, error: treeError } = useTree();
  const [nodeId, setNodeId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const { notes, error: notesError, importFile: importNoteFile, save: saveNote } = useNotes(nodeId);

  useEffect(() => {
    setNodeId((current) => nodes.some((node) => node.id === current) ? current : nodes[0]?.id ?? '');
  }, [nodes]);

  useEffect(() => {
    setSelectedId((current) => notes.some((note) => note.id === current) ? current : notes[0]?.id ?? '');
  }, [notes]);

  const selectedNote = notes.find((note) => note.id === selectedId);

  useEffect(() => {
    if (!selectedNote) return;
    setTitle(selectedNote.title);
    setBody(selectedNote.body);
    setEditing(false);
  }, [selectedId, selectedNote?.updatedAt]);

  async function handleImport(file?: File) {
    if (!file || !nodeId) return;
    try {
      const note = await importNoteFile(file);
      setSelectedId(note.id);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not import the note.');
    }
  }

  async function handleSave() {
    if (!selectedNote) return;
    try {
      await saveNote(selectedNote.id, title, body);
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
              void handleImport(file);
              event.target.value = '';
            }} />
          </label>
        )}
      </div>
      {(error || treeError || notesError) && <p className="error-message" role="alert">{error || treeError || notesError}</p>}
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
                ) : <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedNote.body}</ReactMarkdown>}
              </article>
            )}
          </div>
        </>
      )}
    </main>
  );
}
