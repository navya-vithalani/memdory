import { useRef, useState } from 'react';
import type { NoteRecord } from '../../../types';
import { ConceptNote } from './ConceptNote';
import { FormulaNote } from './FormulaNote';
import { MnemonicNote } from './MnemonicNote';
import { NormalNote } from './NormalNote';
import { TableNote } from './TableNote';
import { TrickNote } from './TrickNote';

type NoteCardProps = {
  note: NoteRecord;
  tagsMap: Map<string, string>;
  onOpenMenu: (note: NoteRecord) => void;
  onStarToggle: (note: NoteRecord) => void;
  highlighted?: boolean;
};

export function NoteCard({ note, tagsMap, onOpenMenu, onStarToggle, highlighted = false }: NoteCardProps) {
  const [mnemonicExpanded, setMnemonicExpanded] = useState(false);
  const pressTimer = useRef<number | undefined>(undefined);
  const isLongPress = useRef(false);

  const type = note.type || 'normal';

  // 5.4 Default widths: mnemonic, trick, formula = half width; normal, concept, table = full width.
  // Expanded mnemonic spans full width.
  let isFullWidth = type === 'normal' || type === 'concept' || type === 'table';
  if (type === 'mnemonic' && mnemonicExpanded) {
    isFullWidth = true;
  }

  // Color class: default color by type if note.color is not set
  let colorName = note.color;
  if (!colorName) {
    if (type === 'concept') colorName = 'indigo';
    else if (type === 'formula') colorName = 'sky';
    else if (type === 'mnemonic') colorName = 'violet';
    else if (type === 'trick') colorName = 'sun';
    else if (type === 'table') colorName = 'mint';
  }

  const colorClass = colorName ? `note-color-${colorName}` : '';
  const styleObj = note.style ?? {};
  const fontClass = styleObj.font ? `note-font-${styleObj.font}` : '';
  const sizeClass = styleObj.size ? `note-size-${styleObj.size}` : '';
  const boldClass = styleObj.bold ? 'note-bold' : '';

  function handleTouchStart() {
    isLongPress.current = false;
    pressTimer.current = window.setTimeout(() => {
      isLongPress.current = true;
      try {
        navigator.vibrate?.(30);
      } catch {
        // Ignored
      }
      onOpenMenu(note);
    }, 500);
  }

  function handleTouchEnd() {
    window.clearTimeout(pressTimer.current);
  }

  return (
    <article
      id={`note-${note.id}`}
      className={`note-card ${isFullWidth ? 'note-span-full' : 'note-span-half'} ${colorClass} ${fontClass} ${sizeClass} ${boldClass}${highlighted ? ' highlight-pulse' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={() => window.clearTimeout(pressTimer.current)}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenMenu(note);
      }}
    >
      {/* Top right quick actions */}
      <div className="note-card-actions" style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 3 }}>
        <button
          type="button"
          className="note-star-btn"
          onClick={(e) => {
            e.stopPropagation();
            onStarToggle(note);
          }}
          aria-label={note.starred ? 'Starred note' : 'Star note'}
        >
          {note.starred ? '★' : '☆'}
        </button>
        <button
          type="button"
          className="note-star-btn"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu(note);
          }}
          aria-label="Note options"
          style={{ fontSize: '16px', fontWeight: 800 }}
        >
          ⋮
        </button>
      </div>

      {/* Render specialized note body based on type */}
      {type === 'concept' ? (
        <ConceptNote title={note.title || 'Concept'} body={note.body} />
      ) : type === 'formula' ? (
        <FormulaNote title={note.title} body={note.body} />
      ) : type === 'trick' ? (
        <TrickNote title={note.title} body={note.body} />
      ) : type === 'table' ? (
        <TableNote title={note.title} body={note.body} />
      ) : type === 'mnemonic' ? (
        <MnemonicNote
          cue={(note.data?.cue as string) || note.title || 'Mnemonic Cue'}
          meaning={(note.data?.meaning as string) || note.body || ''}
          story={(note.data?.story as string) || null}
          isExpanded={mnemonicExpanded}
          onExpandToggle={() => setMnemonicExpanded((prev) => !prev)}
        />
      ) : (
        <NormalNote title={note.title} body={note.body} />
      )}

      {/* Tags row */}
      {note.tagIds && note.tagIds.length > 0 && (
        <div className="note-tags-row">
          {note.tagIds.map((tId) => {
            const label = tagsMap.get(tId);
            if (!label) return null;
            return (
              <span key={tId} className="note-tag-chip">
                {label}
              </span>
            );
          })}
        </div>
      )}
    </article>
  );
}
