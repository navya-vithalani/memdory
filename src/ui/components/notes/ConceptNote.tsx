import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RichText } from '../RichText';

type ConceptNoteProps = {
  title: string;
  body: string;
};

export function ConceptNote({ title, body }: ConceptNoteProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="note-concept-block">
      <button
        type="button"
        className="note-concept-toggle"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="note-card-title">{title}</span>
        <span className={`note-concept-chevron${open ? ' open' : ''}`} aria-hidden="true">
          ▶
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="concept-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="note-concept-body">
              <RichText text={body} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
