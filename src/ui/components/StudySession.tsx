import { useEffect, useRef, useState } from 'react';
import { scheduleCardReview } from '../../core/scheduler/reviewCard';
import { finishSession, saveReview } from '../../data/repositories/cardRepository';
import type { CardRecord, ReviewRating } from '../../types';

type StudySessionProps = {
  sessionId: string;
  cards: CardRecord[];
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

export function StudySession({ sessionId, cards, onExit }: StudySessionProps) {
  const [queue, setQueue] = useState(cards);
  const [position, setPosition] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [cardStartedAt, setCardStartedAt] = useState(Date.now());
  const [clock, setClock] = useState(Date.now());
  const [completed, setCompleted] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const requeuedWrong = useRef(new Set<string>());
  const startedAt = useRef(Date.now());
  const current = queue[position];

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function rate(rating: ReviewRating) {
    if (!current || !flipped) return;
    const now = Date.now();
    const updatedCard = scheduleCardReview(current, rating, now);
    try {
      await saveReview(current, sessionId, rating, Math.max(0, now - cardStartedAt), now, updatedCard);
      const nextQueue = [...queue];
      nextQueue[position] = updatedCard;
      if (rating === 'wrong' && !requeuedWrong.current.has(current.id)) {
        requeuedWrong.current.add(current.id);
        nextQueue.splice(Math.min(position + 3, nextQueue.length), 0, updatedCard);
      }
      const nextCompleted = completed + 1;
      const nextCorrect = correct + (rating === 'easy' || rating === 'medium' || rating === 'hard' || rating === 'partial' ? 1 : 0);
      setQueue(nextQueue);
      setCompleted(nextCompleted);
      setCorrect(nextCorrect);
      const nextPosition = position + 1;
      if (nextPosition >= nextQueue.length) {
        await finishSession(sessionId, nextCompleted);
        setFinished(true);
        return;
      }
      setPosition(nextPosition);
      setCardStartedAt(Date.now());
      setFlipped(false);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this review.');
    }
  }

  async function exit() {
    if (!window.confirm('Exit this session? Your completed reviews will be saved.')) return;
    try {
      await finishSession(sessionId, completed);
      onExit();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the session.');
    }
  }

  if (finished || !current) {
    const durationMinutes = Math.floor((Date.now() - startedAt.current) / 60000);
    return (
      <section className="study-end stacked-panel">
        <p className="eyebrow">Session complete</p>
        <h1>Nice work!</h1>
        <p>{completed} reviews · {completed ? Math.round((correct / completed) * 100) : 0}% remembered</p>
        <p>{durationMinutes} minutes</p>
        <button className="primary-button" onClick={onExit}>Done</button>
      </section>
    );
  }

  const elapsedSeconds = Math.floor((clock - cardStartedAt) / 1000);
  return (
    <main className="screen study-screen">
      <div className="study-topbar">
        <progress value={position} max={queue.length} aria-label="Session progress" />
        <span>{position + 1} / {queue.length}</span>
        <button className="text-button" onClick={() => void exit()}>Exit</button>
      </div>
      <p className="study-timer">{Math.floor(elapsedSeconds / 60)}:{`${elapsedSeconds % 60}`.padStart(2, '0')}</p>
      {error && <p className="error-message" role="alert">{error}</p>}
      <button className={flipped ? 'study-card is-flipped' : 'study-card'} onClick={() => setFlipped((value) => !value)} aria-label={flipped ? 'Show question' : 'Reveal answer'}>
        <span>{flipped ? current.back : current.front}</span>
        <small>{flipped ? 'Tap to see question' : 'Tap to reveal answer'}</small>
      </button>
      <section className={flipped ? 'rating-control enabled' : 'rating-control'} aria-label="Rate your recall">
        {ratings.map((rating) => (
          <button
            key={rating.value}
            className={`rating-button ${rating.className}`}
            disabled={!flipped}
            onClick={() => {
              if (rating.value === 'wrong') navigator.vibrate?.(30);
              else navigator.vibrate?.(10);
              void rate(rating.value);
            }}
          >{rating.label}</button>
        ))}
      </section>
    </main>
  );
}
