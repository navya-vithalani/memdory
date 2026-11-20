import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { useStudySession } from '../../hooks/useStudySession';
import { useTree } from '../../hooks/useTree';
import { db } from '../../data/db';
import type { CardRecord } from '../../types';
import { CompletionCelebration } from './CompletionCelebration';
import { FamilyStudyCard } from './FamilyStudyCard';
import { Mnemo } from './Mnemo';
import { MnemoCompanion, type MnemoPlacement } from './MnemoCompanion';
import { StudyCard } from './StudyCard';
import { StudyTopBar } from './StudyTopBar';
import { WifiRating } from './WifiRating';

type StudySessionProps = {
  sessionId: string;
  cards: CardRecord[];
  initialPosition?: number;
  onExit: () => void;
};

export function StudySession({ sessionId, cards, initialPosition = 0, onExit }: StudySessionProps) {
  const session = useStudySession({ sessionId, cards, initialPosition });
  const { settings, updateSettings } = useSettings();
  const { nodes } = useTree();
  const [labelTag, setLabelTag] = useState<string | undefined>(undefined);
  const reduceMotion = useReducedMotion();
  const screenRef = useRef<HTMLElement>(null);
  const startedAt = useRef(Date.now());
  const [showExitModal, setShowExitModal] = useState(false);

  const placement = useMemo<MnemoPlacement>(
    () => ({ x: settings.mnemoX ?? 0.86, y: settings.mnemoY ?? 0.5, scale: settings.mnemoScale ?? 1 }),
    [settings.mnemoX, settings.mnemoY, settings.mnemoScale]
  );
  const savePlacement = useCallback(
    (next: MnemoPlacement) => void updateSettings({ mnemoX: next.x, mnemoY: next.y, mnemoScale: next.scale }),
    [updateSettings]
  );

  const { current } = session;
  const slide = reduceMotion ? 0 : 56;
  const topicName = nodes.find((n) => n.id === current?.nodeId)?.name;

  useEffect(() => {
    const firstTagId = current?.tagIds?.[0];
    if (!firstTagId) {
      setLabelTag(undefined);
      return;
    }
    let active = true;
    void db.tags.get(firstTagId).then((t) => {
      if (active) setLabelTag(t?.label ?? t?.name);
    });
    return () => {
      active = false;
    };
  }, [current?.tagIds]);

  if (session.finished) {
    const minutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    const percent = session.completed ? Math.round((session.correct / session.completed) * 100) : 0;
    return (
      <main className="screen study-end" ref={screenRef}>
        {session.celebration && (
          <CompletionCelebration
            oldStreak={session.celebration.oldStreak}
            newStreak={session.celebration.newStreak}
            onContinue={session.dismissCelebration}
          />
        )}
        <Mnemo mood="excited" className="session-celebration-mascot" />
        <p className="eyebrow">Session complete</p>
        <h1>Nice work!</h1>
        <p>{session.completed} reviews · {percent}% remembered</p>
        <p>{minutes} {minutes === 1 ? 'minute' : 'minutes'}</p>
        <button className="primary-button" onClick={onExit}>Done</button>
        {session.error && <p className="error-message" role="alert">{session.error}</p>}
      </main>
    );
  }

  return (
    <main className="screen study-screen" ref={screenRef}>
      <StudyTopBar
        position={session.viewMode === 'families' ? session.familyIndex : session.position}
        total={session.viewMode === 'families' ? session.familyGroups.length : session.queue.length}
        elapsedSeconds={session.elapsedSeconds}
        disabled={session.submitting}
        onClose={() => setShowExitModal(true)}
      />
      {session.error && <p className="error-message study-error" role="alert">{session.error}</p>}

      {session.viewMode === 'families' && session.currentFamily ? (
        <div className="study-stage family-stage" style={{ padding: '0 16px 20px', width: '100%' }}>
          <FamilyStudyCard
            front={session.currentFamily.front}
            topicName={nodes.find((n) => n.id === session.currentFamily?.nodeId)?.name}
            cards={session.currentFamily.cards}
            gradedCards={session.gradedInFamily}
            onRateCard={session.rateFamilyCard}
            onNextFamily={() => void session.nextFamily()}
          />
        </div>
      ) : (
        <>
          <div className="study-stage">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${current?.id ?? 'card'}-${session.position}`}
                className="study-slot"
                initial={{ x: slide, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -slide, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              >
                {current && (
                  <StudyCard
                    front={current.front}
                    back={current.back}
                    explanation={current.explanation}
                    topicName={topicName}
                    labelTag={labelTag}
                    flipped={session.flipped}
                    wrong={session.wrongFeedback}
                    onFlip={session.flip}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="study-rating">
            <WifiRating enabled={session.revealed && !session.submitting && session.hydrated} onRate={(rating) => void session.rate(rating)} />
          </div>
        </>
      )}

      {settings.showMnemoInSession !== false && (
        <MnemoCompanion
          containerRef={screenRef}
          placement={placement}
          reaction={session.ratingEvent}
          onPlacementChange={savePlacement}
        />
      )}

      {showExitModal && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowExitModal(false); }}>
          <section className="session-modal exit-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="exit-modal-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Pause session</p>
                <h2 id="exit-modal-title">Save and exit?</h2>
              </div>
            </div>
            <p className="modal-copy">You can continue this session later.</p>
            <div className="exit-modal-actions">
              <button type="button" className="primary-button" onClick={onExit}>Exit</button>
              <button type="button" className="secondary-button" onClick={() => setShowExitModal(false)}>Keep studying</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
