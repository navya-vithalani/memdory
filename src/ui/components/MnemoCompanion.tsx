import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { ReviewRating } from '../../types';
import { Mnemo, type MnemoMood } from './Mnemo';

export type MnemoPlacement = { x: number; y: number; scale: number };

type MnemoCompanionProps = {
  containerRef: RefObject<HTMLElement | null>;
  placement: MnemoPlacement;
  reaction: { rating: ReviewRating; id: number } | null;
  onPlacementChange: (placement: MnemoPlacement) => void;
};

const BASE_WIDTH = 96;
const BASE_HEIGHT = 86;
const MIN_SCALE = 0.6;
const MAX_SCALE = 1.8;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const reactions: Record<ReviewRating, { mood: MnemoMood; motion: string }> = {
  easy: { mood: 'front-happy', motion: 'hop' },
  medium: { mood: 'front-happy', motion: 'hop' },
  hard: { mood: 'front', motion: 'wiggle' },
  partial: { mood: 'front', motion: 'wiggle' },
  blank: { mood: 'front-sad', motion: 'droop' },
  wrong: { mood: 'front-shocked', motion: 'shake' }
};

type Gesture =
  | { kind: 'drag'; pointerId: number; startX: number; startY: number; originX: number; originY: number; moved: boolean }
  | { kind: 'pinch'; startDistance: number; startScale: number; centerX: number; centerY: number };

/**
 * Mnemo lives in the study screen: drag him anywhere, pinch (or ctrl + wheel) to resize.
 * Position is stored as 0-1 fractions of the free space so it survives rotation and resizing.
 */
export function MnemoCompanion({ containerRef, placement, reaction, onPlacementChange }: MnemoCompanionProps) {
  const [view, setView] = useState(placement);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const [tilt, setTilt] = useState(0);
  const [tapId, setTapId] = useState(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const latest = useRef(view);
  const wheelTimer = useRef<number | undefined>(undefined);
  latest.current = view;

  useEffect(() => setView(placement), [placement.x, placement.y, placement.scale]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef]);

  useEffect(() => () => window.clearTimeout(wheelTimer.current), []);

  const width = BASE_WIDTH * view.scale;
  const height = BASE_HEIGHT * view.scale;
  const freeX = Math.max(1, size.width - width);
  const freeY = Math.max(1, size.height - height);
  const left = clamp(view.x, 0, 1) * freeX;
  const top = clamp(view.y, 0, 1) * freeY;

  const commit = useCallback(() => onPlacementChange(latest.current), [onPlacementChange]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      gesture.current = { kind: 'drag', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: left, originY: top, moved: false };
      setDragging(true);
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        kind: 'pinch',
        startDistance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        startScale: latest.current.scale,
        centerX: left + width / 2,
        centerY: top + height / 2
      };
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const active = gesture.current;
    if (!active) return;

    if (active.kind === 'drag' && active.pointerId === event.pointerId) {
      const dx = event.clientX - active.startX;
      const dy = event.clientY - active.startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) active.moved = true;
      setTilt(clamp(dx / 12, -10, 10));
      setView((prev) => ({
        ...prev,
        x: clamp((active.originX + dx) / freeX, 0, 1),
        y: clamp((active.originY + dy) / freeY, 0, 1)
      }));
    } else if (active.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const scale = clamp(active.startScale * (Math.hypot(a.x - b.x, a.y - b.y) / active.startDistance), MIN_SCALE, MAX_SCALE);
      const nextFreeX = Math.max(1, size.width - BASE_WIDTH * scale);
      const nextFreeY = Math.max(1, size.height - BASE_HEIGHT * scale);
      setView({
        scale,
        x: clamp((active.centerX - (BASE_WIDTH * scale) / 2) / nextFreeX, 0, 1),
        y: clamp((active.centerY - (BASE_HEIGHT * scale) / 2) / nextFreeY, 0, 1)
      });
    }
  }

  function onPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) {
      setDragging(false);
      setTilt(0);
      gesture.current = null;
      if (active?.kind === 'drag' && !active.moved) setTapId((value) => value + 1);
      else commit();
    } else if (active?.kind === 'pinch') {
      // One finger left: carry on dragging from where it is.
      const [id, point] = [...pointers.current.entries()][0];
      gesture.current = { kind: 'drag', pointerId: id, startX: point.x, startY: point.y, originX: clamp(latest.current.x, 0, 1) * freeX, originY: clamp(latest.current.y, 0, 1) * freeY, moved: true };
    }
  }

  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey) return;
    setView((prev) => ({ ...prev, scale: clamp(prev.scale - event.deltaY * 0.004, MIN_SCALE, MAX_SCALE) }));
    window.clearTimeout(wheelTimer.current);
    wheelTimer.current = window.setTimeout(commit, 350);
  }

  const reacting = reaction ? reactions[reaction.rating] : null;
  const motionName = reacting?.motion ?? (tapId > 0 ? 'hop' : 'idle');

  return (
    <div
      className={`mnemo-companion${dragging ? ' is-dragging' : ''}`}
      style={{
        ['--mx' as string]: `${left}px`,
        ['--my' as string]: `${top}px`,
        ['--ms' as string]: `${view.scale}`,
        ['--tilt' as string]: `${tilt}deg`
      }}
      role="img"
      aria-label="Mnemo, your study buddy. Drag to move, pinch to resize."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onWheel={onWheel}
    >
      <div key={`${reaction?.id ?? 0}-${tapId}`} className={`mnemo-body mnemo-motion-${motionName}`}>
        <Mnemo mood={reacting?.mood ?? 'front'} />
      </div>
    </div>
  );
}
