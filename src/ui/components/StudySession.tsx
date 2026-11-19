import { useEffect, useRef, useState } from 'react';
import {
  calculateStreakFromDayKeys,
  getCompletedStudyDays,
  isFirstCompletedSessionOfDay,
  studyDayKey
} from '../../core/streak/streak';
import { useCards } from '../../hooks/useCards';
import { useSettings } from '../../hooks/useSettings';
import type { CardRecord, ReviewRating } from '../../types';
import { CompletionCelebration } from './CompletionCelebration';
import { Mnemo } from './Mnemo';

type StudySessionProps = {
  sessionId: string;
  cards: CardRecord[];
  initialPosition?: number;
  initialCompleted?: number;
  onExit: () => void;
};

const ratings: Array<{ value: ReviewRating; label: string; className: string }> = [
  { value: 'easy', label: 'Easy', className: 'rating-easy' },
  { value: 'medium', label: 'Medium', className: 'rating-medium' },
  { value: 'hard', label: 'Hard', className: 'rating-hard' },
  { value: 'partial', label: 'Partial', className: 'rating-partial' },
  { value: 'blank', label: 'Blank', className: 'rating-blank' },
  { value: 'wrong', label: 'Wrong', className: 'rating-wrong' }
];

export function StudySession({
  sessionId,
  cards,
  initialPosition = 0,
  initialCompleted = 0,
  onExit
}: StudySessionProps) {
  const { review: saveCardReview, saveProgress, finish, loadSessions } = useCards();
  const { settings } = useSettings();
  const [queue, setQueue] = useState(cards);
  const [position, setPosition] = useState(initialPosition);
  const [flipped, setFlipped] = useState(false);
  const [cardStartedAt, setCardStartedAt] = useState(Date.now());
  const [clock, setClock] = useState(Date.now());
  const [completed, setCompleted] = useState(initialCompleted);
  const [correct, setCorrect] = useState(0);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [wrongFeedback, setWrongFeedback] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{
    oldStreak: number;
    newStreak: number;
  } | null>(null);

  const requeuedWrong = useRef(new Set<string>());
  const startedAt = useRef(Date.now());
  const current = queue[position];

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleFinish(finalCompleted: number) {
    setFinished(true);
    try {
      const allSessions = await loadSessions();
      const dayStartMinutes = settings.dayStartMinutes;
      const isFirstToday = isFirstCompletedSessionOfDay(
        allSessions,
        sessionId,
        dayStartMinutes
      );

      await finish(sessionId, finalCompleted);

      if (isFirstToday) {
        const completedDays = getCompletedStudyDays(allSessions, dayStartMinutes);
        const oldStreak = calculateStreakFromDayKeys(completedDays, Date.now(), dayStartMinutes);
        const todayK = studyDayKey(Date.now(), dayStartMinutes);
        const newCompletedDays = Array.from(new Set([...completedDays, todayK]));
        const newStreak = calculateStreakFromDayKeys(newCompletedDays, Date.now(), dayStartMinutes);
        setCelebrationData({ oldStreak, newStreak });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not complete the session.');
    }
  }

  async function rate(rating: ReviewRating) {
    if (!current || !flipped || submitting) return;
    const now = Date.now();
    setSubmitting(true);
    if (rating === 'wrong') {
      setWrongFeedback(true);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 220));
    }
    try {
      const updatedCard = await saveCardReview(
        current,
        sessionId,
        rating,
        Math.max(0, now - cardStartedAt)
      );
      const nextQueue = [...queue];
      nextQueue[position] = updatedCard;
      let queueModified = false;
      if (rating === 'wrong' && !requeuedWrong.current.has(current.id)) {
        requeuedWrong.current.add(current.id);
        nextQueue.splice(Math.min(position + 3, nextQueue.length), 0, updatedCard);
        queueModified = true;
      }
      const nextCompleted = completed + 1;
      const nextCorrect =
        correct +
        (rating === 'easy' || rating === 'medium' || rating === 'hard' || rating === 'partial' ? 1 : 0);
      setQueue(nextQueue);
      setCompleted(nextCompleted);
      setCorrect(nextCorrect);
      const nextPosition = position + 1;

      if (nextPosition >= nextQueue.length) {
        await handleFinish(nextCompleted);
        return;
      }

      await saveProgress(
        sessionId,
        nextPosition,
        nextCompleted,
        queueModified ? nextQueue.map((c) => c.id) : undefined
      );

      setPosition(nextPosition);
      setCardStartedAt(Date.now());
      setFlipped(false);
      setWrongFeedback(false);
      setError('');
    } catch (reason) {
      setWrongFeedback(false);
      setError(reason instanceof Error ? reason.message : 'Could not save this review.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleExitClick() {
    if (submitting) return;
    setShowExitModal(true);
  }

  function confirmExit() {
    setShowExitModal(false);
    onExit();
  }

  if (celebrationData) {
    return (
      <CompletionCelebration
        oldStreak={celebrationData.oldStreak}
        newStreak={celebrationData.newStreak}
        onContinue={() => setCelebrationData(null)}
      />
    );
  }

  if (finished || !current) {
    const durationMinutes = Math.floor((Date.now() - startedAt.current) / 60000);
    return (
      <section className="study-end stacked-panel">
        <Mnemo mood="excited" className="session-celebration-mascot" />
        <p className="eyebrow">Session complete</p>
        <h1>Nice work!</h1>
        <p>
          {completed} reviews · {completed ? Math.round((correct / completed) * 100) : 0}% remembered
        </p>
        <p>{durationMinutes} minutes</p>
        <button
          className="primary-button"
          disabled={submitting}
          onClick={onExit}
        >
          Done
        </button>
        {error && <p className="error-message" role="alert">{error}</p>}
      </section>
    );
  }

  const elapsedSeconds = Math.max(0, Math.floor((clock - cardStartedAt) / 1000));
  return (
    <main className="screen study-screen">
      <div className="study-topbar">
        <div
          className="study-progress-track"
          role="progressbar"
          aria-label="Session progress"
          aria-valuenow={position}
          aria-valuemin={0}
          aria-valuemax={queue.length}
        >
          <span style={{ ['--progress' as string]: `${(position / queue.length) * 100}%` }} />
        </div>
        <span>
          {position + 1} / {queue.length}
        </span>
        <button
          className="text-button"
          disabled={submitting}
          onClick={handleExitClick}
        >
          Exit
        </button>
      </div>
      <div className="study-prompt-row">
        <Mnemo mood="front" />
        <span>Take your time. You’ve got this.</span>
        <p className="study-timer">
          {Math.floor(elapsedSeconds / 60)}:
          {`${elapsedSeconds % 60}`.padStart(2, '0')}
        </p>
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      <button
        key={`${current.id}-${position}`}
        className={`study-card${flipped ? ' is-flipped' : ''}${wrongFeedback ? ' is-wrong' : ''}`}
        onClick={() => setFlipped((value) => !value)}
        aria-label={flipped ? 'Show question' : 'Reveal answer'}
      >
        <span className="study-card-text">{flipped ? current.back : current.front}</span>
        <small>{flipped ? 'Tap to see question' : 'Tap to reveal answer'}</small>
      </button>
      <section
        className={flipped ? 'rating-control enabled' : 'rating-control'}
        aria-label="Rate your recall"
      >
        <svg className="rating-arcs" viewBox="0 0 320 158" aria-hidden="true">
          <path className="rating-arc rating-arc-outer" d="M22 145 Q160 -14 298 145" />
          <path className="rating-arc rating-arc-middle" d="M66 145 Q160 48 254 145" />
          <path className="rating-arc rating-arc-inner" d="M112 145 Q160 97 208 145" />
          <circle className="rating-dot" cx="160" cy="145" r="7" />
        </svg>
        {ratings.map((rating) => (
          <button
            key={rating.value}
            className={`rating-button ${rating.className} rating-${rating.value}`}
            disabled={!flipped || submitting}
            aria-label={`Rate ${rating.label}`}
            onClick={() => {
              if (rating.value === 'wrong') navigator.vibrate?.(30);
              else navigator.vibrate?.(10);
              void rate(rating.value);
            }}
          >
            <span>{rating.label}</span>
          </button>
        ))}
      </section>

      {showExitModal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowExitModal(false);
          }}
        >
          <section
            className="session-modal exit-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-modal-title"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Pause session</p>
                <h2 id="exit-modal-title">Save and exit?</h2>
              </div>
            </div>
            <p className="modal-copy">You can continue this session later.</p>
            <div className="exit-modal-actions">
              <button
                type="button"
                className="primary-button"
                onClick={confirmExit}
              >
                Exit
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowExitModal(false)}
              >
                Keep studying
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
