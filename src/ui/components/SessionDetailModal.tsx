import { useEffect } from 'react';
import { useSessionDetail } from '../../hooks/useSessionDetail';
import type { ReviewRating, SessionRecord } from '../../types';

type SessionDetailModalProps = {
  session: SessionRecord;
  scopeName: string;
  onClose: () => void;
  onContinue: (sessionId: string) => void;
};

const ratingOrder: ReviewRating[] = ['easy', 'medium', 'hard', 'partial', 'blank', 'wrong'];
const ratingLabel: Record<ReviewRating, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  partial: 'Partial',
  blank: 'Blank',
  wrong: 'Wrong'
};

function formatDuration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function SessionDetailModal({ session, scopeName, onClose, onContinue }: SessionDetailModalProps) {
  const { detail, loading, error } = useSessionDetail(session.id);
  const live = detail?.session ?? session;
  const canContinue = live.status === 'in-progress';
  const counts = ratingOrder
    .map((rating) => ({ rating, count: detail?.items.filter((item) => item.review.rating === rating).length ?? 0 }))
    .filter((entry) => entry.count > 0);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="session-modal session-detail" role="dialog" aria-modal="true" aria-labelledby="session-detail-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{new Date(live.startedAt).toLocaleDateString()} · {live.mode.replaceAll('-', ' ')}</p>
            <h2 id="session-detail-title">{scopeName}</h2>
          </div>
        </div>
        <p className="muted">
          {live.completedCount}/{live.plannedCount} cards ·{' '}
          {live.status === 'completed' ? 'Completed' : live.status === 'in-progress' ? 'Incomplete' : 'Discarded'}
        </p>

        {loading && <p className="muted">Loading answers…</p>}
        {error && <p className="error-message" role="alert">{error}</p>}

        {counts.length > 0 && (
          <div className="detail-counts" aria-label="Answers by rating">
            {counts.map(({ rating, count }) => (
              <span key={rating} className={`rating-pill rating-pill-${rating}`}>{count} {ratingLabel[rating]}</span>
            ))}
          </div>
        )}

        {detail && detail.items.length === 0 && !loading && <p className="muted">No cards were answered in this session.</p>}
        <ol className="detail-list">
          {detail?.items.map(({ review, card }, index) => (
            <li key={review.id} className="detail-row">
              <span className="detail-index">{index + 1}</span>
              <span className="detail-front">{card ? card.front : 'Card was deleted'}</span>
              <span className="detail-meta">
                <span className={`rating-pill rating-pill-${review.rating}`}>{ratingLabel[review.rating]}</span>
                <small>{formatDuration(review.durationMs)}</small>
              </span>
            </li>
          ))}
        </ol>

        {detail && detail.remaining.length > 0 && (
          <p className="muted detail-remaining">{detail.remaining.length} {detail.remaining.length === 1 ? 'card is' : 'cards are'} still waiting.</p>
        )}

        <div className="exit-modal-actions">
          {canContinue && (
            <button type="button" className="primary-button" onClick={() => onContinue(live.id)}>Continue session</button>
          )}
          <button type="button" className="secondary-button" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  );
}
