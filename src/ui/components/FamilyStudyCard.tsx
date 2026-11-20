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
  const [expandedId, setExpandedId] = useState<string | null>(cards[0]?.id ?? null);
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
    <article className="family-study-container" style={{ width: '100%', maxWidth: '420px', margin: '0 auto' }}>
      {/* Header with topic and shared prompt */}
      <div
        className="family-header"
        style={{
          background: 'var(--surface)',
          padding: '16px 20px',
          borderRadius: 'var(--radius-card)',
          boxShadow: '0 4px 20px var(--shadow-card)',
          marginBottom: '16px',
          textAlign: 'center'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          {topicName && (
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-soft)' }}>
              {topicName}
            </span>
          )}
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px',
              background: 'var(--indigo-tint)',
              color: 'var(--indigo)'
            }}
          >
            Family Mode · {gradedCount} of {cards.length}
          </span>
        </div>

        <h2 style={{ margin: '4px 0', fontSize: '22px', fontWeight: 800, color: 'var(--ink)' }}>
          <RichText text={front} />
        </h2>
      </div>

      {/* Member rows */}
      <div className="family-rows" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {cards.map((card, idx) => {
          const isExpanded = expandedId === card.id;
          const rating = gradedCards.get(card.id);
          const firstTagId = card.tagIds?.[0];
          const label = (firstTagId ? tagLabels.get(firstTagId) : null) || `Part ${idx + 1}`;

          return (
            <div
              key={card.id}
              className="family-row-card"
              style={{
                background: 'var(--surface)',
                border: rating ? '1px solid var(--line)' : isExpanded ? '2px solid var(--indigo)' : '1px solid var(--line)',
                borderRadius: '16px',
                padding: '12px 16px',
                boxShadow: '0 2px 10px var(--shadow-soft)',
                transition: 'all 0.2s ease'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer'
                }}
                onClick={() => setExpandedId(isExpanded ? null : card.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '8px',
                      background: 'var(--indigo-tint)',
                      color: 'var(--indigo)'
                    }}
                  >
                    {label}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>
                    {isExpanded ? 'Hide' : rating ? 'Show answer' : 'Reveal answer'}
                  </span>
                </div>

                {rating ? (
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      color:
                        rating === 'medium'
                          ? 'var(--easy)'
                          : rating === 'blank'
                          ? 'var(--hard)'
                          : 'var(--wrong)'
                    }}
                  >
                    {rating === 'medium' ? '✓ Got it' : rating === 'blank' ? '○ Blank' : '⚠ Wrong'}
                  </span>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
                    {isExpanded ? '▲' : '▼'}
                  </span>
                )}
              </div>

              {/* Revealed content and grading */}
              {isExpanded && (
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
                  <div style={{ fontSize: '15px', color: 'var(--ink)', lineHeight: 1.5, marginBottom: '10px' }}>
                    <RichText text={card.back} />
                    {card.explanation && (
                      <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--ink-soft)' }}>
                        <RichText text={card.explanation} />
                      </p>
                    )}
                  </div>

                  {!rating && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '12px' }}>
                      <button
                        type="button"
                        onClick={() => onRateCard(card, 'medium')}
                        style={{
                          padding: '8px',
                          borderRadius: '10px',
                          border: 'none',
                          background: 'var(--easy)',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        Got it
                      </button>
                      <button
                        type="button"
                        onClick={() => onRateCard(card, 'blank')}
                        style={{
                          padding: '8px',
                          borderRadius: '10px',
                          border: 'none',
                          background: 'var(--hard)',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        Blank
                      </button>
                      <button
                        type="button"
                        onClick={() => onRateCard(card, 'wrong')}
                        style={{
                          padding: '8px',
                          borderRadius: '10px',
                          border: 'none',
                          background: 'var(--wrong)',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
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
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            type="button"
            className="primary-button"
            style={{ width: '100%', minHeight: '48px', fontSize: '16px' }}
            onClick={onNextFamily}
          >
            Next Family →
          </button>
        </div>
      )}
    </article>
  );
}
