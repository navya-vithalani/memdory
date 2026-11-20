import { motion, useReducedMotion } from 'framer-motion';
import type { KeyboardEvent } from 'react';
import { RichText } from './RichText';

type StudyCardProps = {
  front: string;
  back: string;
  explanation?: string | null;
  topicName?: string;
  labelTag?: string;
  flipped: boolean;
  wrong: boolean;
  onFlip: () => void;
};

export function StudyCard({
  front,
  back,
  explanation,
  topicName,
  labelTag,
  flipped,
  wrong,
  onFlip
}: StudyCardProps) {
  const reduceMotion = useReducedMotion();

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onFlip();
    }
  }

  const face = (side: 'front' | 'back') => (
    <div className={`study-face study-face-${side}`} aria-hidden={(side === 'back') !== flipped}>
      {(topicName || labelTag) && (
        <div className="study-card-meta">
          {topicName && <span className="study-card-topic">{topicName}</span>}
          {labelTag && <span className="study-card-label">{labelTag}</span>}
        </div>
      )}
      <div className="study-face-body">
        <RichText text={side === 'front' ? front : back} />
        {side === 'back' && explanation && (
          <div className="study-card-explanation">
            <RichText text={explanation} />
          </div>
        )}
      </div>
      <small>{side === 'front' ? 'Tap to reveal answer' : 'Tap to see question'}</small>
    </div>
  );

  return (
    <div className="study-scene">
      {reduceMotion ? (
        <div
          key={flipped ? 'back' : 'front'}
          className={`study-card study-card-fade${wrong ? ' is-wrong' : ''}`}
          role="button"
          tabIndex={0}
          aria-label={flipped ? 'Show question' : 'Reveal answer'}
          onClick={onFlip}
          onKeyDown={onKeyDown}
        >
          {face(flipped ? 'back' : 'front')}
        </div>
      ) : (
        <motion.div
          className={`study-card${wrong ? ' is-wrong' : ''}`}
          role="button"
          tabIndex={0}
          aria-label={flipped ? 'Show question' : 'Reveal answer'}
          onClick={onFlip}
          onKeyDown={onKeyDown}
          initial={false}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 150, damping: 19, mass: 0.9 }}
        >
          {face('front')}
          {face('back')}
        </motion.div>
      )}
    </div>
  );
}
