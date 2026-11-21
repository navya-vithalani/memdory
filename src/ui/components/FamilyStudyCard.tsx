import { useEffect, useState } from 'react';
import type { CardRecord, ReviewRating } from '../../types';
import { RichText } from './RichText';
import { db } from '../../data/db';

type FamilyStudyCardProps = {
  front: string;
  topicName?: string;
  cards: CardRecord[];
  gradedCards: Map<string, ReviewRating>;
  onRateCard: (card: CardRecord, rating: ReviewRating) => void;
  onNextFamily: () => void;
};

export function FamilyStudyCard({
  front,
  topicName,
  cards,
  gradedCards,
  onRateCard,
  onNextFamily
}: FamilyStudyCardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tagLabels, setTagLabels] = useState<Map<string, string>>(new Map());

  // Load tag labels for cards
  useEffect(() => {
    let active = true;
    const tagIds = [...new Set(cards.map((c) => c.tagIds?.[0]).filter((id): id is string => Boolean(id)))];
    if (tagIds.length === 0) return;

    void db.tags.bulkGet(tagIds).then((tags) => {
      if (!active) return;
      const map = new Map<string, string>();
      for (const t of tags) {
        if (t) map.set(t.id, t.label || t.name);
      }
      setTagLabels(map);
    });

    return () => {
      active = false;
    };
  }, [cards]);

  const allGraded = cards.every((c) => gradedCards.has(c.id));
  const gradedCount = cards.filter((c) => gradedCards.has(c.id)).length;

  return (
    <article className="family-study-container">
      {/* Header with topic and shared prompt */}
      <div className="family-header">
        <div className="family-header-meta">
          {topicName && (
            <span className="family-topic-name">
              {topicName}
            </span>
          )}
          <span className="family-mode-badge">
            Family Mode · {gradedCount} of {cards.length}
          </span>
        </div>

        <h2 className="family-prompt-title">
          <RichText text={front} />
        </h2>
      </div>

      {/* Member rows */}
      <div className="family-rows">
        {cards.map((card, idx) => {
          const isExpanded = expandedId === card.id;
          const rating = gradedCards.get(card.id);
          const firstTagId = card.tagIds?.[0];
          const label = (firstTagId ? tagLabels.get(firstTagId) : null) || `Part ${idx + 1}`;

          const cardStateClass = isExpanded ? ' is-active' : rating ? ' is-graded' : '';
          const badgeStateClass = isExpanded ? ' is-active' : rating ? ' is-graded' : '';
          const ratingClass = rating === 'medium' ? ' is-gotit' : rating === 'blank' ? ' is-blank' : rating === 'wrong' ? ' is-wrong' : '';

          return (
            <div
              key={card.id}
              className={`family-row-card${cardStateClass}`}
            >
              <div
                className="family-row-toggle"
                onClick={() => setExpandedId(isExpanded ? null : card.id)}
              >
                <div className="family-row-left">
                  <span className={`family-part-badge${badgeStateClass}`}>
                    {label}
                  </span>
                  <span className="family-action-text">
                    {isExpanded ? 'Hide' : rating ? 'Show answer' : 'Reveal answer'}
                  </span>
                </div>

                {rating ? (
                  <span className={`family-status-graded${ratingClass}`}>
                    {rating === 'medium' ? '✓ Got it' : rating === 'blank' ? '○ Blank' : '⚠ Wrong'}
                  </span>
                ) : (
                  <span className="family-caret">
                    {isExpanded ? '▲' : '▼'}
                  </span>
                )}
              </div>

              {/* Revealed content and grading */}
              {isExpanded && (
                <div className="family-revealed-section">
                  <div className="family-answer-content">
                    <RichText text={card.back} />
                    {card.explanation && (
                      <p className="family-explanation">
                        <RichText text={card.explanation} />
                      </p>
                    )}
                  </div>

                  {!rating && (
                    <div className="family-grade-buttons">
                      <button
                        type="button"
                        onClick={() => onRateCard(card, 'medium')}
                        className="family-grade-btn btn-gotit"
                      >
                        Got it
                      </button>
                      <button
                        type="button"
                        onClick={() => onRateCard(card, 'blank')}
                        className="family-grade-btn btn-blank"
                      >
                        Blank
                      </button>
                      <button
                        type="button"
                        onClick={() => onRateCard(card, 'wrong')}
                        className="family-grade-btn btn-wrong"
                      >
                        Wrong
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allGraded && (
        <div className="family-footer-actions">
          <button
            type="button"
            className="primary-button"
            onClick={onNextFamily}
          >
            Next Family →
          </button>
        </div>
      )}
    </article>
  );
}
