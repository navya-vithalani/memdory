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

const IDLE_EXPRESSIONS: MnemoMood[] = ['front', 'front-happy', 'front'];

type Gesture =
  | { kind: 'drag'; pointerId: number; startX: number; startY: number; originX: number; originY: number; moved: boolean }
  | { kind: 'pinch'; startDistance: number; startScale: number };

/**
 * Mnemo lives in the study screen: drag him anywhere, pinch (or ctrl + wheel) to resize.
 * Sits actively on the study screen, swimming gently and expressing moods while the user thinks.
 */
export function MnemoCompanion({ containerRef, placement, reaction, onPlacementChange }: MnemoCompanionProps) {
  const [view, setView] = useState(placement);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const [tilt, setTilt] = useState(0);
  const [isSomersaulting, setIsSomersaulting] = useState(false);
  const [somersaultCount, setSomersaultCount] = useState(0);
  const [idleMoodIndex, setIdleMoodIndex] = useState(0);
  const [flipDirection, setFlipDirection] = useState<'left' | 'right'>('right');
  const [isSleepy, setIsSleepy] = useState(false);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const latest = useRef(view);
  const wheelTimer = useRef<number | undefined>(undefined);
  const lastActionTime = useRef<number>(Date.now());
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

  // Sleepy check: user made no action for more than 12 seconds
  useEffect(() => {
    const timer = window.setInterval(() => {
      const inactiveMs = Date.now() - lastActionTime.current;
      if (inactiveMs >= 12000 && !isSleepy && !reaction && !dragging && !isSomersaulting) {
        setIsSleepy(true);
      } else if (inactiveMs < 12000 && isSleepy) {
        setIsSleepy(false);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isSleepy, reaction, dragging, isSomersaulting]);

  // Idle alive expressions and swimming direction cycling (front views only)
  useEffect(() => {
    if (reaction || dragging || isSleepy || isSomersaulting) return;

    const interval = window.setInterval(() => {
      setIdleMoodIndex((prev) => (prev + 1) % IDLE_EXPRESSIONS.length);
      if (Math.random() > 0.5) {
        setFlipDirection((dir) => (dir === 'left' ? 'right' : 'left'));
      }
    }, 4000);

    return () => window.clearInterval(interval);
  }, [reaction, dragging, isSleepy, isSomersaulting]);

  // Reset thinking timer when reaction changes (user answered)
  useEffect(() => {
    if (reaction) {
      lastActionTime.current = Date.now();
      setIsSleepy(false);
    }
  }, [reaction?.id]);

  const width = BASE_WIDTH * view.scale;
  const height = BASE_HEIGHT * view.scale;
  const freeX = Math.max(1, size.width - width);
  const freeY = Math.max(1, size.height - height);
  const left = clamp(view.x, 0, 1) * freeX;
  const top = clamp(view.y, 0, 1) * freeY;

  const commit = useCallback(() => onPlacementChange(latest.current), [onPlacementChange]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    lastActionTime.current = Date.now();
    setIsSleepy(false);
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
        startScale: latest.current.scale
      };
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const active = gesture.current;
    if (!active) return;

    lastActionTime.current = Date.now();
    setIsSleepy(false);

    if (active.kind === 'drag' && active.pointerId === event.pointerId) {
      const dx = event.clientX - active.startX;
      const dy = event.clientY - active.startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) active.moved = true;
      setTilt(clamp(dx / 12, -15, 15));
      if (dx > 4) setFlipDirection('right');
      else if (dx < -4) setFlipDirection('left');

      setView((prev) => ({
        ...prev,
        x: clamp((active.originX + dx) / freeX, 0, 1),
        y: clamp((active.originY + dy) / freeY, 0, 1)
      }));
    } else if (active.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const currentDist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const factor = currentDist / active.startDistance;
      const nextScale = clamp(active.startScale * factor, MIN_SCALE, MAX_SCALE);
      setView((prev) => ({ ...prev, scale: nextScale }));
    }
  }

  function onPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) {
      setDragging(false);
      setTilt(0);
      gesture.current = null;
      if (active?.kind === 'drag' && !active.moved) {
        // Tap -> exactly 1 somersault with normal side view ('happy'), then reset
        setIsSomersaulting(true);
        setSomersaultCount((c) => c + 1);
        lastActionTime.current = Date.now();
        setIsSleepy(false);
        window.setTimeout(() => {
          setIsSomersaulting(false);
        }, 750);
      } else {
        commit();
      }
    }
  }

  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey) return;
    lastActionTime.current = Date.now();
    setIsSleepy(false);
    setView((prev) => ({ ...prev, scale: clamp(prev.scale - event.deltaY * 0.004, MIN_SCALE, MAX_SCALE) }));
    window.clearTimeout(wheelTimer.current);
    wheelTimer.current = window.setTimeout(commit, 350);
  }

  const reacting = reaction ? reactions[reaction.rating] : null;
  const motionName = reacting?.motion ?? (isSomersaulting ? 'somersault' : 'swim-idle');

  let activeMood: MnemoMood = 'front';
  if (reacting) {
    activeMood = reacting.mood;
  } else if (isSomersaulting) {
    // Normal side view for somersault, NOT excited
    activeMood = 'happy';
  } else if (isSleepy) {
    activeMood = 'sleepy';
  } else {
    // Idle front expressions only
    activeMood = IDLE_EXPRESSIONS[idleMoodIndex % IDLE_EXPRESSIONS.length];
  }

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
      aria-label="Mnemo, your study buddy. Drag to move, tap to interact, pinch to resize."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onWheel={onWheel}
    >
      <div
        key={`${reaction?.id ?? 0}-${somersaultCount}-${idleMoodIndex}-${isSleepy ? 'sleepy' : 'active'}`}
        className={`mnemo-body mnemo-motion-${motionName} facing-${flipDirection}`}
      >
        <Mnemo mood={activeMood} />
        <span className="mnemo-bubble bubble-1" aria-hidden="true" />
        <span className="mnemo-bubble bubble-2" aria-hidden="true" />
        <span className="mnemo-bubble bubble-3" aria-hidden="true" />
        <span className="mnemo-bubble bubble-4" aria-hidden="true" />
        <span className="mnemo-bubble bubble-5" aria-hidden="true" />
      </div>
    </div>
  );
}
