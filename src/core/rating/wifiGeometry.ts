import type { ReviewRating } from '../../types';

/** Geometry for the "wifi" rating control. Pure maths so the layout can be unit tested. */
export const WIFI_VIEWBOX = { width: 360, height: 210 } as const;
export const WIFI_CENTER = { x: 180, y: 172 } as const;

const SPAN_START_DEG = -155;
const SPAN_END_DEG = -25;
const INSET = 4; // the shape is drawn inset by this much, then stroked 8px wide to get rounded corners
const GAP = 5; // visible gap between neighbouring segments, measured along the band's centre line
const DOT_RADIUS = 30;

export type WifiBand = 'outer' | 'middle' | 'dot';

export type WifiSegment = {
  id: ReviewRating;
  label: string;
  band: WifiBand;
  /** Fill shape (inset by 4px; stroke it 8px wide in the same colour for rounded corners). */
  shape: string;
  /** Centre-line arc the label is written along; null for the straight label on the dot. */
  labelPath: string | null;
  startDeg: number;
  endDeg: number;
  innerRadius: number;
  outerRadius: number;
};

const BANDS: Array<{ band: 'middle' | 'outer'; inner: number; outer: number; ids: Array<{ id: ReviewRating; label: string }> }> = [
  { band: 'middle', inner: 36, outer: 82, ids: [{ id: 'partial', label: 'Partial' }, { id: 'blank', label: 'Blank' }] },
  { band: 'outer', inner: 88, outer: 138, ids: [{ id: 'easy', label: 'Easy' }, { id: 'medium', label: 'Medium' }, { id: 'hard', label: 'Hard' }] }
];

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;
const round = (value: number) => Math.round(value * 100) / 100;

function point(radius: number, deg: number): string {
  return `${round(WIFI_CENTER.x + radius * Math.cos(toRad(deg)))} ${round(WIFI_CENTER.y + radius * Math.sin(toRad(deg)))}`;
}

function sectorShape(inner: number, outer: number, startDeg: number, endDeg: number): string {
  const ri = inner + INSET;
  const ro = outer - INSET;
  const outerStart = startDeg + toDeg(INSET / ro);
  const outerEnd = endDeg - toDeg(INSET / ro);
  const innerStart = startDeg + toDeg(INSET / ri);
  const innerEnd = endDeg - toDeg(INSET / ri);
  return [
    `M ${point(ro, outerStart)}`,
    `A ${ro} ${ro} 0 0 1 ${point(ro, outerEnd)}`,
    `L ${point(ri, innerEnd)}`,
    `A ${ri} ${ri} 0 0 0 ${point(ri, innerStart)}`,
    'Z'
  ].join(' ');
}

function labelArc(inner: number, outer: number, startDeg: number, endDeg: number): string {
  const mid = (inner + outer) / 2;
  return `M ${point(mid, startDeg)} A ${mid} ${mid} 0 0 1 ${point(mid, endDeg)}`;
}

export function buildWifiSegments(): WifiSegment[] {
  const segments: WifiSegment[] = [];

  for (const band of BANDS) {
    const mid = (band.inner + band.outer) / 2;
    const gapDeg = toDeg(GAP / mid);
    const count = band.ids.length;
    const width = (SPAN_END_DEG - SPAN_START_DEG - gapDeg * (count - 1)) / count;
    band.ids.forEach(({ id, label }, index) => {
      const startDeg = SPAN_START_DEG + index * (width + gapDeg);
      const endDeg = startDeg + width;
      segments.push({
        id,
        label,
        band: band.band,
        shape: sectorShape(band.inner, band.outer, startDeg, endDeg),
        labelPath: labelArc(band.inner, band.outer, startDeg, endDeg),
        startDeg,
        endDeg,
        innerRadius: band.inner,
        outerRadius: band.outer
      });
    });
  }

  const r = DOT_RADIUS - INSET;
  const { x, y } = WIFI_CENTER;
  segments.push({
    id: 'wrong',
    label: 'Wrong',
    band: 'dot',
    shape: `M ${x - r} ${y} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`,
    labelPath: null,
    startDeg: 0,
    endDeg: 360,
    innerRadius: 0,
    outerRadius: DOT_RADIUS
  });

  return segments;
}
