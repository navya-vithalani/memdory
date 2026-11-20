import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { buildWifiSegments, WIFI_CENTER, WIFI_VIEWBOX } from '../../core/rating/wifiGeometry';
import type { ReviewRating } from '../../types';

type WifiRatingProps = {
  enabled: boolean;
  onRate: (rating: ReviewRating) => void;
};

const segments = buildWifiSegments();
const bands = ['outer', 'middle', 'dot'] as const;

export function WifiRating({ enabled, onRate }: WifiRatingProps) {
  const uid = useId().replace(/:/g, '');
  const [pressed, setPressed] = useState<ReviewRating | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function choose(rating: ReviewRating) {
    if (!enabled) return;
    setPressed(rating);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPressed(null), 240);
    navigator.vibrate?.(rating === 'wrong' ? 30 : 10);
    onRate(rating);
  }

  function onKeyDown(event: KeyboardEvent<SVGGElement>, rating: ReviewRating) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(rating);
    }
  }

  return (
    <div className={`wifi-rating${enabled ? ' is-enabled' : ''}`}>
      <svg
        className="wifi-svg"
        viewBox={`0 0 ${WIFI_VIEWBOX.width} ${WIFI_VIEWBOX.height}`}
        role="group"
        aria-label="Rate your recall"
      >
        <defs>
          {segments.map(
            (segment) =>
              segment.labelPath && (
                <path key={segment.id} id={`${uid}-${segment.id}`} d={segment.labelPath} />
              )
          )}
        </defs>
        {bands.map((band) => (
          <g key={band} className={`wifi-band wifi-band-${band}`}>
            {segments
              .filter((segment) => segment.band === band)
              .map((segment) => (
                <g
                  key={segment.id}
                  className={`wifi-seg wifi-seg-${segment.id}${
                    pressed === segment.id ? ' is-pressed' : ''
                  }`}
                  role="button"
                  tabIndex={enabled ? 0 : -1}
                  aria-label={`Rate ${segment.label}`}
                  aria-disabled={!enabled}
                  onClick={() => choose(segment.id)}
                  onKeyDown={(event) => onKeyDown(event, segment.id)}
                >
                  <path className="wifi-shadow" d={segment.shape} />
                  <g className="wifi-btn-cap">
                    <path className="wifi-ring" d={segment.shape} />
                    <path className="wifi-shape" d={segment.shape} />
                    {segment.labelPath ? (
                      <text className="wifi-label">
                        <textPath
                          href={`#${uid}-${segment.id}`}
                          startOffset="50%"
                          textAnchor="middle"
                          dy="0.35em"
                        >
                          {segment.label}
                        </textPath>
                      </text>
                    ) : (
                      <text
                        className="wifi-label wifi-label-dot"
                        x={WIFI_CENTER.x}
                        y={WIFI_CENTER.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                      >
                        {segment.label}
                      </text>
                    )}
                  </g>
                </g>
              ))}
          </g>
        ))}
      </svg>
    </div>
  );
}
