import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { NoteRecord } from '../../../types';
import { RichText } from '../RichText';

type NoteEditorModalProps = {
  initialNote?: NoteRecord | null;
  tagsMap?: Map<string, string>;
  onClose: () => void;
  onSave: (
    title: string | null,
    body: string,
    options: {
      type: string;
      data?: Record<string, unknown> | null;
      tags: string[];
      color: string | null;
      starred: boolean;
    }
  ) => void;
};

const NOTE_TYPES = [
  { value: 'normal', label: 'Normal (Markdown)' },
  { value: 'concept', label: 'Concept (Toggle block)' },
  { value: 'formula', label: 'Formula (LaTeX)' },
  { value: 'mnemonic', label: 'Mnemonic (Memory box)' },
  { value: 'trick', label: 'Trick (Callout)' },
  { value: 'table', label: 'Table (Markdown table)' }
] as const;

const PALETTE = ['indigo', 'sky', 'mint', 'sun', 'rose', 'violet', 'slate'] as const;

export function NoteEditorModal({ initialNote, tagsMap, onClose, onSave }: NoteEditorModalProps) {
  const [type, setType] = useState<string>(initialNote?.type || 'normal');
  const [title, setTitle] = useState(initialNote?.title || '');
  const [body, setBody] = useState(initialNote?.body || '');
  const [color, setColor] = useState<string | null>(initialNote?.color || null);
  const [starred, setStarred] = useState(Boolean(initialNote?.starred));
  const initialTags = (initialNote?.tagIds ?? [])
    .map((id) => tagsMap?.get(id) || '')
    .filter(Boolean)
    .join(', ');
  const [tagsInput, setTagsInput] = useState(initialTags);
  const [previewTab, setPreviewTab] = useState<'edit' | 'preview'>('edit');

  // Mnemonic specific state
  const initialData = initialNote?.data ?? {};
  const [cue, setCue] = useState((initialData.cue as string) || initialNote?.title || '');
  const [meaning, setMeaning] = useState((initialData.meaning as string) || initialNote?.body || '');
  const [story, setStory] = useState((initialData.story as string) || '');

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (type === 'concept' && !title.trim()) {
      alert('Concept notes must have a title.');
      return;
    }

    if (type === 'mnemonic') {
      if (!cue.trim() || !meaning.trim()) {
        alert('Mnemonic notes must have both a cue and a meaning.');
        return;
      }
      onSave(title.trim() || cue.trim(), meaning.trim(), {
        type: 'mnemonic',
        data: {
          cue: cue.trim(),
          meaning: meaning.trim(),
          story: story.trim() || null
        },
        tags,
        color,
        starred
      });
      return;
    }

    if (!body.trim()) {
      alert('Add some note content before saving.');
      return;
    }

    onSave(title.trim() || null, body.trim(), {
      type,
      data: null,
      tags,
      color,
      starred
    });
  }

  const content = (
    <div
      className="import-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className="import-modal-sheet"
        style={{ maxHeight: 'calc(100dvh - 140px)', overflowY: 'auto' }}
        role="dialog"
        aria-modal="true"
        aria-label="Edit note"
        onSubmit={handleSave}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--navy)' }}>
            {initialNote ? 'Edit note' : 'Write a note'}
          </h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {/* Note Type Selector */}
        <label className="field" style={{ marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink-soft)' }}>Note type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={{
              height: '42px',
              padding: '0 12px',
              borderRadius: '10px',
              border: '1px solid var(--line)',
              background: 'var(--surface)',
              color: 'var(--ink)',
              fontFamily: 'inherit',
              fontWeight: 700
            }}
          >
            {NOTE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        {/* Title (Required for Concept, Optional for others) */}
        <label className="field" style={{ marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink-soft)' }}>
            Title {type === 'concept' ? '(required)' : '(optional)'}
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={type === 'concept' ? 'e.g. Le Chatelier’s Principle' : 'e.g. Formula summary'}
            required={type === 'concept'}
          />
        </label>

        {/* Mnemonic Fields vs Body Field */}
        {type === 'mnemonic' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
            <label className="field">
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink-soft)' }}>Cue (front trigger)</span>
              <input
                type="text"
                value={cue}
                onChange={(e) => setCue(e.target.value)}
                placeholder="e.g. OIL RIG"
                required
              />
            </label>
            <label className="field">
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink-soft)' }}>Meaning</span>
              <textarea
                rows={3}
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                placeholder="e.g. Oxidation Is Loss, Reduction Is Gain"
                required
              />
            </label>
            <label className="field">
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink-soft)' }}>Story / Association (optional)</span>
              <textarea
                rows={2}
                value={story}
                onChange={(e) => setStory(e.target.value)}
                placeholder="Picture an oil rig in the ocean leaking electrons…"
              />
            </label>
          </div>
        ) : (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink-soft)' }}>
                Content {type === 'formula' ? '(LaTeX: $...$ or $$...$$)' : '(Markdown)'}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  className={previewTab === 'edit' ? 'primary-button' : 'secondary-button'}
                  style={{ minHeight: '28px', padding: '2px 10px', fontSize: '12px' }}
                  onClick={() => setPreviewTab('edit')}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={previewTab === 'preview' ? 'primary-button' : 'secondary-button'}
                  style={{ minHeight: '28px', padding: '2px 10px', fontSize: '12px' }}
                  onClick={() => setPreviewTab('preview')}
                >
                  Preview
                </button>
              </div>
            </div>

            {previewTab === 'edit' ? (
              <textarea
                rows={8}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={
                  type === 'formula'
                    ? '$$E = mc^2$$'
                    : type === 'table'
                    ? '| Name | Formula |\n|---|---|\n| Water | H2O |'
                    : 'Capture your thoughts with Markdown and LaTeX…'
                }
                required
              />
            ) : (
              <div
                style={{
                  minHeight: '160px',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid var(--line)',
                  background: 'var(--bg)'
                }}
              >
                <RichText text={body || '*No content yet*'} />
              </div>
            )}
          </div>
        )}

        {/* Tags input */}
        <label className="field" style={{ marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink-soft)' }}>Tags (comma-separated)</span>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="e.g. physics, thermodynamics"
          />
        </label>

        {/* Color Palette & Star Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink-soft)', marginBottom: '4px' }}>
              Color
            </span>
            <div className="note-color-swatches">
              <button
                type="button"
                className={`note-swatch${!color ? ' active' : ''}`}
                style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
                title="None"
                onClick={() => setColor(null)}
              />
              {PALETTE.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`note-swatch${color === name ? ' active' : ''}`}
                  style={{ background: `var(--note-${name}-accent)` }}
                  title={name}
                  onClick={() => setColor(name)}
                />
              ))}
            </div>
          </div>

          <label className="checkbox-field" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={starred}
              onChange={(e) => setStarred(e.target.checked)}
            />
            <span>⭐ Starred</span>
          </label>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button type="button" className="secondary-button" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" style={{ flex: 1 }}>
            Save note
          </button>
        </div>
      </form>
    </div>
  );

  const target = (typeof document !== 'undefined' ? document.querySelector('.app-frame') : null) ?? (typeof document !== 'undefined' ? document.body : null);
  if (!target) return content;
  return createPortal(content, target);
}
