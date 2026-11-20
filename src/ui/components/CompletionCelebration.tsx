import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mnemo } from './Mnemo';

type CompletionCelebrationProps = {
  oldStreak: number;
  newStreak: number;
  onContinue: () => void;
};

const CONFETTI_COLORS = ['var(--orange)', 'var(--indigo)', 'var(--wave)', 'var(--partial)'];

export function CompletionCelebration({
  oldStreak,
  newStreak,
  onContinue
}: CompletionCelebrationProps) {
  const clipId = useId().replaceAll(':', '') + '-celebration-drop';
  const [displayedStreak, setDisplayedStreak] = useState(oldStreak);

  // Generate ~24 confetti particles with deterministic attributes
  const confettiPieces = useMemo(() => {
    return Array.from({ length: 24 }, (_, index) => {
      const left = ((index * 17) % 90) + 5; // 5% to 95%
      const delay = (index % 6) * 0.08;
      const tx = ((index % 7) - 3) * 24; // spread left/right
      const ty = 280 + ((index * 13) % 80);
      const rot = ((index * 37) % 720) - 360;
      const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
      return { id: index, left, delay, tx, ty, rot, color };
    });
  }, []);

  useEffect(() => {
    // Haptic feedback
    try {
      navigator.vibrate?.([20, 40, 20]);
    } catch {
      // Ignored if not supported
    }

    // Streak number count-up over 600ms
    const startTime = performance.now();
    const duration = 600;
    let animId: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // ease-out curve
      const eased = 1 - Math.pow(1 - progress, 3);
      const val = Math.round(oldStreak + (newStreak - oldStreak) * eased);
      setDisplayedStreak(val);
      if (progress < 1) {
        animId = requestAnimationFrame(tick);
      }
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [oldStreak, newStreak]);

  const content = (
    <div className="celebration-overlay" role="dialog" aria-modal="true" aria-label="Streak celebration">
      <div className="celebration-card">
        <div className="celebration-confetti-container" aria-hidden="true">
          {confettiPieces.map((piece) => (
            <div
              key={piece.id}
              className="celebration-confetti-piece"
              style={
                {
                  left: `${piece.left}%`,
                  backgroundColor: piece.color,
                  animationDelay: `${piece.delay}s`,
                  '--tx': `${piece.tx}px`,
                  '--ty': `${piece.ty}px`,
                  '--rot': `${piece.rot}deg`
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        <Mnemo mood="excited" className="celebration-mascot" />
        <p className="celebration-eyebrow">Study streak extended</p>
        <h2 className="celebration-title">Daily streak unlocked!</h2>

        <div className="celebration-streak-display">
          <div className="celebration-drop-container">
            <svg className="celebration-drop-svg" viewBox="0 0 32 40" aria-hidden="true">
              <defs>
                <clipPath id={clipId}>
                  <path d="M16 2C13 8 4 17 4 25a12 12 0 0 0 24 0C28 17 19 8 16 2Z" />
                </clipPath>
              </defs>
              <path className="celebration-drop-outline" d="M16 2C13 8 4 17 4 25a12 12 0 0 0 24 0C28 17 19 8 16 2Z" />
              <g clipPath={`url(#${clipId})`}>
                <rect className="celebration-drop-water" x="0" y="0" width="32" height="40" />
                <path className="celebration-drop-shine" d="M10 24c.4-3.1 2.2-5.4 4.5-7" />
              </g>
            </svg>
          </div>

          <div className="celebration-streak-number-group">
            <span className="celebration-streak-number">{displayedStreak}</span>
            <span className="celebration-streak-label">
              {displayedStreak === 1 ? 'day streak' : 'days streak'}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="celebration-continue-button"
          onClick={onContinue}
        >
          Continue
        </button>
      </div>
    </div>
  );

  const mountTarget = (typeof document !== 'undefined' ? document.querySelector('.app-frame') : null) ?? (typeof document !== 'undefined' ? document.body : null);
  if (!mountTarget) return content;
  return createPortal(content, mountTarget);
}
