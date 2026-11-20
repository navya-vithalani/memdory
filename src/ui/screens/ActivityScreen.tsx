import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useAnalysisStats } from '../../hooks/useAnalysisStats';
import { useHomeStats } from '../../hooks/useHomeStats';
import { useSettings } from '../../hooks/useSettings';
import { useTree } from '../../hooks/useTree';
import { StatCard } from '../components/StatCard';
import { studyDayKey, previousDateKey } from '../../core/streak/streak';

export function ActivityScreen() {
  const { nodes } = useTree();
  const { settings } = useSettings();
  const { snapshot: home } = useHomeStats(settings, nodes);
  const { snapshot: analysis, error } = useAnalysisStats();

  const targetRetentionPct = Math.round((settings.desiredRetention ?? 0.9) * 100);

  // Build an expanded 12-week (84 days) review activity heatmap
  const expandedHeatmap = useMemo(() => {
    const days: Array<{ key: string; label: string; count: number; dayOfWeek: number }> = [];
    const now = Date.now();
    const dayStart = settings.dayStartMinutes;
    const historyMap = new Map<string, number>();

    if (analysis?.heatmap) {
      for (const h of analysis.heatmap) {
        historyMap.set(h.key, h.count);
      }
    }

    let cursor = studyDayKey(now, dayStart);
    for (let i = 0; i < 84; i++) {
      const [year, month, day] = cursor.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day, 12);
      const dayOfWeek = (dateObj.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
      const count = historyMap.get(cursor) ?? 0;
      days.unshift({
        key: cursor,
        label: dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count,
        dayOfWeek
      });
      cursor = previousDateKey(cursor);
    }
    return days;
  }, [analysis?.heatmap, settings.dayStartMinutes]);

  const maxHeatmapCount = useMemo(() => {
    return Math.max(1, ...expandedHeatmap.map((d) => d.count));
  }, [expandedHeatmap]);

  function getHeatLevel(count: number): number {
    if (count <= 0) return 0;
    if (count <= 4) return 1;
    if (count <= 12) return 2;
    if (count <= 25) return 3;
    return 4;
  }

  return (
    <main className="screen activity-screen">
      {error && <p className="error-message" role="alert">{error}</p>}

      {/* Streak and Study Stats Strip */}
      <section className="stats-grid">
        <StatCard label="Current streak" value={`${home?.currentStreak ?? 0} days`} tone="orange" />
        <StatCard label="Best streak" value={`${home?.longestStreak ?? 0} days`} tone="indigo" />
        <StatCard label="Reviews today" value={`${home?.reviewsToday ?? 0}`} tone="mint" />
      </section>

      {/* Expanded Review Heatmap */}
      <section className="chart-panel analysis-card expanded-heatmap-card" style={{ marginTop: '16px' }}>
        <div className="analysis-card-heading">
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--navy)' }}>
              Review Activity (Last 12 Weeks)
            </h2>
          </div>
        </div>
        <p className="analysis-note" style={{ margin: '4px 0 12px', fontSize: '12px', color: 'var(--ink-soft)' }}>
          Color depth represents the number of cards reviewed each day
        </p>

        <div
          className="expanded-heatmap-grid"
          style={{
            display: 'grid',
            gridTemplateRows: 'repeat(7, 12px)',
            gridAutoFlow: 'column',
            gap: '4px',
            overflowX: 'auto',
            paddingBottom: '8px'
          }}
          aria-label="Daily card review activity over the last 12 weeks"
        >
          {expandedHeatmap.map((day) => {
            const level = getHeatLevel(day.count);
            const bgColors = [
              'var(--surface)',
              '#c7d2fe',
              '#818cf8',
              '#4f46e5',
              '#312e81'
            ];
            return (
              <span
                key={day.key}
                title={`${day.label}: ${day.count} cards reviewed`}
                aria-label={`${day.label}: ${day.count} cards reviewed`}
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '3px',
                  background: bgColors[level],
                  border: level === 0 ? '1px solid var(--line)' : 'none',
                  display: 'inline-block'
                }}
              />
            );
          })}
        </div>

        {/* Heatmap Legend */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', marginTop: '8px', fontSize: '11px', color: 'var(--ink-soft)' }}>
          <span>Less</span>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--surface)', border: '1px solid var(--line)' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#c7d2fe' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#818cf8' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#4f46e5' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#312e81' }} />
          <span>More</span>
        </div>
      </section>

      {/* Accuracy Trend Graph Shifted Below Heatmap */}
      {analysis && (
        <section className="chart-panel analysis-card" style={{ marginTop: '16px' }}>
          <div className="analysis-card-heading">
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--navy)' }}>
                Accuracy Trend
              </h2>
            </div>
          </div>
          <div className="analysis-chart" style={{ marginTop: '8px' }}>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={analysis.accuracyTrend} margin={{ top: 12, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="activityAccuracyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--indigo)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--indigo)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 4" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-soft)', fontSize: 10 }} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-soft)', fontSize: 10 }} />
                <Tooltip
                  formatter={(val: unknown) => [typeof val === 'number' ? `${val}%` : '—', 'Accuracy']}
                />
                <ReferenceLine
                  y={targetRetentionPct}
                  stroke="var(--orange)"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Target (${targetRetentionPct}%)`,
                    fill: 'var(--orange-pressed)',
                    fontSize: 10,
                    position: 'insideTopRight'
                  }}
                />
                <Area
                  dataKey="accuracy"
                  name="Accuracy %"
                  type="monotone"
                  connectNulls
                  fill="url(#activityAccuracyFill)"
                  stroke="var(--indigo)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </main>
  );
}
