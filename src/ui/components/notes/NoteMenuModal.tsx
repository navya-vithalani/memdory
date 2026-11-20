import { createPortal } from 'react-dom';
import type { NoteRecord } from '../../../types';

type NoteMenuModalProps = {
  note: NoteRecord;
  onClose: () => void;
  onColorChange: (color: string | null) => void;
  onStyleChange: (style: NoteRecord['style']) => void;
  onStarToggle: () => void;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
};

const PALETTE = ['indigo', 'sky', 'mint', 'sun', 'rose', 'violet', 'slate'] as const;

export function NoteMenuModal({
  note,
  onClose,
  onColorChange,
  onStyleChange,
  onStarToggle,
  onEdit,
  onMoveUp,
  onMoveDown,
  onDelete
}: NoteMenuModalProps) {
  const currentStyle = note.style ?? {};

  const content = (
    <div
      className="import-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="note-menu-sheet" role="dialog" aria-modal="true" aria-label="Note options">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: '16px', color: 'var(--navy)' }}>
            {note.title || 'Note options'}
          </strong>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* 1. Colour swatches */}
        <div>
          <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink-soft)', marginBottom: '6px' }}>
            Card color
          </span>
          <div className="note-color-swatches">
            <button
              type="button"
              className={`note-swatch${!note.color ? ' active' : ''}`}
              style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
              title="None"
              onClick={() => onColorChange(null)}
            />
            {PALETTE.map((name) => (
              <button
                key={name}
                type="button"
                className={`note-swatch${note.color === name ? ' active' : ''}`}
                style={{ background: `var(--note-${name}-accent)` }}
                title={name}
                onClick={() => onColorChange(name)}
              />
            ))}
          </div>
        </div>

        {/* 2. Style: Bold, Size, Font */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* Bold */}
          <button
            type="button"
            className="secondary-button"
            style={{ fontWeight: 800, padding: '6px 12px', background: currentStyle.bold ? 'var(--indigo-tint)' : undefined }}
            onClick={() => onStyleChange({ ...currentStyle, bold: !currentStyle.bold })}
          >
            Bold
          </button>

          {/* Size */}
          <div style={{ display: 'flex', borderRadius: '8px', border: '1px solid var(--line)', overflow: 'hidden' }}>
            {(['sm', 'md', 'lg'] as const).map((sz) => (
              <button
                key={sz}
                type="button"
                style={{
                  padding: '6px 10px',
                  border: 'none',
                  background: currentStyle.size === sz ? 'var(--indigo)' : 'var(--surface)',
                  color: currentStyle.size === sz ? '#fff' : 'var(--ink)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
                onClick={() => onStyleChange({ ...currentStyle, size: sz })}
              >
                {sz.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Font */}
          <div style={{ display: 'flex', borderRadius: '8px', border: '1px solid var(--line)', overflow: 'hidden' }}>
            {(['sans', 'mono', 'serif'] as const).map((font) => (
              <button
                key={font}
                type="button"
                style={{
                  padding: '6px 10px',
                  border: 'none',
                  background: currentStyle.font === font ? 'var(--indigo)' : 'var(--surface)',
                  color: currentStyle.font === font ? '#fff' : 'var(--ink)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
                onClick={() => onStyleChange({ ...currentStyle, font })}
              >
                {font}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              onStarToggle();
              onClose();
            }}
          >
            {note.starred ? '★ Unstar' : '☆ Star note'}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              onClose();
              onEdit();
            }}
          >
            ✎ Edit note
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              onMoveUp();
              onClose();
            }}
          >
            ↑ Move up
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              onMoveDown();
              onClose();
            }}
          >
            ↓ Move down
          </button>
        </div>

        <button
          type="button"
          className="text-button"
          style={{ color: 'var(--wrong)', alignSelf: 'center', marginTop: '4px' }}
          onClick={() => {
            if (window.confirm('Delete this note permanently?')) {
              onDelete();
              onClose();
            }
          }}
        >
          🗑 Delete note
        </button>
      </div>
    </div>
  );

  const target = (typeof document !== 'undefined' ? document.querySelector('.app-frame') : null) ?? (typeof document !== 'undefined' ? document.body : null);
  if (!target) return content;
  return createPortal(content, target);
}
