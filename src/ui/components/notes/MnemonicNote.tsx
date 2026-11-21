import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { RichText } from '../RichText';

type MnemonicFace = 'cue' | 'meaning' | 'story';

type MnemonicNoteProps = {
  cue: string;
  meaning: string;
  story?: string | null;
  onExpandToggle?: () => void;
  isExpanded?: boolean;
};

export function MnemonicNote({ cue, meaning, story, onExpandToggle, isExpanded = false }: MnemonicNoteProps) {
  const [activeFace, setActiveFace] = useState<MnemonicFace>('cue');
  const [dragOffset, setDragOffset] = useState(0);
  const reduceMotion = useReducedMotion();

  const faces: MnemonicFace[] = ['cue', 'meaning'];
  if (story?.trim()) faces.push('story');

  function nextFace() {
    const currentIndex = faces.indexOf(activeFace);
    const next = faces[(currentIndex + 1) % faces.length];
    setActiveFace(next);
  }

  function prevFace() {
    const currentIndex = faces.indexOf(activeFace);
    const prev = faces[(currentIndex - 1 + faces.length) % faces.length];
    setActiveFace(prev);
  }

  // Morph recipe: split text into words for staggered token fade/blur animation while preserving LaTeX math blocks
  function renderWords(text: string): ReactNode {
    if (reduceMotion) {
      return <RichText text={text} />;
    }

    const tokens: string[] = [];
    const regex = /(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|\s+)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const subWords = text.slice(lastIndex, match.index).split(/(\s+)/);
        tokens.push(...subWords);
      }
      tokens.push(match[0]);
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      const subWords = text.slice(lastIndex).split(/(\s+)/);
      tokens.push(...subWords);
    }

    return (
      <motion.span
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={{
          visible: { transition: { staggerChildren: 0.015, delayChildren: 0.05 } },
          exit: { transition: { staggerChildren: 0.012, staggerDirection: -1 } }
        }}
        style={{ display: 'inline' }}
      >
        {tokens.filter(Boolean).map((chunk, index) => {
          if (/^\s+$/.test(chunk)) {
            return chunk;
          }
          return (
            <motion.span
              key={`${index}-${chunk.slice(0, 16)}`}
              variants={{
                hidden: { opacity: 0, filter: 'blur(6px)', y: 6 },
                visible: { opacity: 1, filter: 'blur(0px)', y: 0, transition: { duration: 0.25 } },
                exit: { opacity: 0, filter: 'blur(6px)', y: -6, transition: { duration: 0.2 } }
              }}
              style={{ display: 'inline-block' }}
            >
              <RichText text={chunk} />
            </motion.span>
          );
        })}
      </motion.span>
    );
  }

  const currentText =
    activeFace === 'cue'
      ? cue
      : activeFace === 'meaning'
      ? meaning
      : story || '';

  return (
    <motion.div
      layout
      className="mnemonic-box"
      style={{
        transform: `translateX(${dragOffset}px)`,
        transition: dragOffset === 0 ? 'transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)' : 'none'
      }}
      onTouchStart={(e) => {
        const startX = e.touches[0].clientX;
        const handleTouchMove = (ev: TouchEvent) => {
          const delta = ev.touches[0].clientX - startX;
          // Elastic hint: at most 8px then spring back
          setDragOffset(Math.sign(delta) * Math.min(8, Math.abs(delta) * 0.15));
        };
        const handleTouchEnd = (ev: TouchEvent) => {
          const delta = ev.changedTouches[0].clientX - startX;
          setDragOffset(0);
          if (delta > 35) prevFace();
          else if (delta < -35) nextFace();
          window.removeEventListener('touchmove', handleTouchMove);
          window.removeEventListener('touchend', handleTouchEnd);
        };
        window.addEventListener('touchmove', handleTouchMove);
        window.addEventListener('touchend', handleTouchEnd);
      }}
      onDoubleClick={nextFace}
    >
      {/* 3-dot indicator with tiny labels */}
      <div className="mnemonic-indicator">
        {faces.map((face) => (
          <button
            key={face}
            type="button"
            className={`mnemonic-dot-btn${activeFace === face ? ' active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveFace(face);
            }}
          >
            <span className="mnemonic-dot" />
            <span>{face === 'cue' ? 'Cue' : face === 'meaning' ? 'Meaning' : 'Story'}</span>
          </button>
        ))}
      </div>

      {/* Morphing text face content */}
      <div className="mnemonic-face-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeFace}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.2 : 0.4 }}
          >
            {renderWords(currentText)}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation and expand action */}
      <div className="mnemonic-nav-row">
        <button
          type="button"
          className="mnemonic-nav-btn"
          onClick={(e) => {
            e.stopPropagation();
            prevFace();
          }}
        >
          ← Prev
        </button>

        {onExpandToggle && (
          <button
            type="button"
            className="mnemonic-nav-btn"
            style={{ color: 'var(--ink-soft)' }}
            onClick={(e) => {
              e.stopPropagation();
              onExpandToggle();
            }}
          >
            {isExpanded ? 'Collapse' : 'Expand full'}
          </button>
        )}

        <button
          type="button"
          className="mnemonic-nav-btn"
          onClick={(e) => {
            e.stopPropagation();
            nextFace();
          }}
        >
          Next →
        </button>
      </div>
    </motion.div>
  );
}
