import { useMemo } from 'react';
import { Mnemo } from './Mnemo';
import { buildInsights, type InsightInput } from '../../core/stats/insights';

type MnemoSummaryCardProps = {
  stats: InsightInput;
  className?: string;
};

export function MnemoSummaryCard({ stats, className = '' }: MnemoSummaryCardProps) {
  const insights = useMemo(() => buildInsights(stats), [stats]);
  const topInsight = insights[0];

  const words = useMemo(() => {
    return (topInsight?.text ?? '').split(' ');
  }, [topInsight?.text]);

  return (
    <section className={`mnemo-summary-card ${className}`} style={{
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      padding: '16px 18px',
      borderRadius: 'var(--radius-large)',
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      boxShadow: 'var(--shadow-card)',
      margin: '0 0 16px'
    }}>
      <div style={{ flex: '0 0 54px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Mnemo mood={topInsight?.mood ?? 'front'} />
      </div>

      <div className="mnemo-speech-bubble" style={{
        position: 'relative',
        flex: 1,
        background: 'var(--indigo-tint)',
        padding: '10px 14px',
        borderRadius: '16px',
        fontSize: '13px',
        fontWeight: 700,
        lineHeight: 1.45,
        color: 'var(--navy)'
      }}>
        {/* Pointer triangle */}
        <span
          style={{
            position: 'absolute',
            left: '-6px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: 0,
            height: 0,
            borderTop: '6px solid transparent',
            borderBottom: '6px solid transparent',
            borderRight: '7px solid var(--indigo-tint)'
          }}
          aria-hidden="true"
        />

        <p style={{ margin: 0 }}>
          {words.map((word, index) => (
            <span
              key={`${word}-${index}`}
              className="insight-word-token"
              style={{
                display: 'inline-block',
                marginRight: '0.28em',
                animation: 'insight-fade-in 250ms ease-out forwards',
                animationDelay: `${index * 35}ms`
              }}
            >
              {word}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
