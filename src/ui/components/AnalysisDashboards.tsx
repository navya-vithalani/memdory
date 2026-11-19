import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import type { ReactNode } from 'react';
import type { AnalysisSnapshot } from '../../hooks/useAnalysisStats';

type DashboardProps = {
  snapshot: AnalysisSnapshot;
};

function DashboardCard({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="chart-panel analysis-card">
      <div className="analysis-card-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div></div>
      {children}
    </section>
  );
}

function RatingMix({ snapshot }: DashboardProps) {
  const total = snapshot.ratings.reduce((sum, rating) => sum + rating.value, 0);
  return (
    <DashboardCard eyebrow="Recall quality" title="How it’s feeling">
      <div className="donut-layout">
        <div className="donut-chart">
          {total > 0 && <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={snapshot.ratings.filter((rating) => rating.value > 0)} dataKey="value" nameKey="name" innerRadius={52} outerRadius={72} paddingAngle={3} stroke="none">
                {snapshot.ratings.filter((rating) => rating.value > 0).map((rating) => <Cell key={rating.name} fill={rating.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>}
          <div className="donut-center"><strong>{total}</strong><small>reviews</small></div>
        </div>
        <div className="rating-legend">
          {snapshot.ratings.map((rating) => <div key={rating.name}><i style={{ backgroundColor: rating.color }} /><span>{rating.name}</span><strong>{rating.value}</strong></div>)}
          {total === 0 && <p className="muted">Your rating mix will appear after your first session.</p>}
        </div>
      </div>
    </DashboardCard>
  );
}

function WeeklyReviews({ snapshot }: DashboardProps) {
  return (
    <DashboardCard eyebrow="Daily rhythm" title="Cards reviewed">
      <div className="analysis-chart"><ResponsiveContainer width="100%" height={175}>
        <BarChart data={snapshot.cardsPerDay} margin={{ top: 8, right: 2, left: -26, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 4" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-soft)', fontSize: 10 }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-soft)', fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="count" name="Cards" fill="var(--indigo)" radius={[6, 6, 2, 2]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer></div>
    </DashboardCard>
  );
}

function RevisitTopics({ snapshot }: DashboardProps) {
  return (
    <section className="stacked-panel analysis-card topic-analysis">
      <div className="analysis-card-heading"><div><p className="eyebrow">A helpful nudge</p><h2>Topics to revisit</h2></div></div>
      {snapshot.weakestTopics.length
        ? snapshot.weakestTopics.map((topic) => <div key={topic.name} className="topic-row"><span>{topic.name}</span><div className="topic-meter"><i style={{ width: `${topic.recall}%` }} /></div><strong>{topic.recall}%</strong></div>)
        : <p className="muted">Keep practicing to see where a quick refresher can help.</p>}
    </section>
  );
}

export function HeatmapCard({ snapshot }: DashboardProps) {
  const maxHeat = Math.max(1, ...snapshot.heatmap.map((day) => day.count));
  return (
    <DashboardCard eyebrow="Consistency" title="Last 5 weeks">
      <p className="analysis-note">Each dot is one day</p>
      <div className="heatmap" aria-label="Review activity over the last 35 days">
        {snapshot.heatmap.map((day) => <span key={day.key} title={`${day.label}: ${day.count} reviews`} aria-label={`${day.label}: ${day.count} reviews`} style={{ ['--heat' as string]: day.count / maxHeat }} />)}
      </div>
    </DashboardCard>
  );
}

export function StreakHistoryCard({ snapshot }: DashboardProps) {
  const maxStreakDay = Math.max(1, ...snapshot.streakHistory.map((day) => day.count));
  return (
    <DashboardCard eyebrow="Showing up" title="Last 2 weeks">
      <div className="streak-history">
        {snapshot.streakHistory.map((day) => <span key={day.key} className={day.count ? 'studied' : ''} title={`${day.label}: ${day.count} reviews`} aria-label={`${day.label}: ${day.count} reviews`} style={{ ['--heat' as string]: day.count / maxStreakDay }}><small>{new Date(`${day.key}T12:00:00`).getDate()}</small></span>)}
      </div>
    </DashboardCard>
  );
}

function AccuracyTrendCard({ snapshot }: DashboardProps) {
  return (
    <>
      <DashboardCard eyebrow="Remembering more" title="Accuracy trend">
        <div className="analysis-chart"><ResponsiveContainer width="100%" height={170}>
          <AreaChart data={snapshot.accuracyTrend} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
            <defs><linearGradient id="accuracyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--indigo)" stopOpacity={0.24} /><stop offset="100%" stopColor="var(--indigo)" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 4" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-soft)', fontSize: 10 }} />
            <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-soft)', fontSize: 10 }} />
            <Tooltip />
            <Area dataKey="accuracy" name="Accuracy %" type="monotone" connectNulls fill="url(#accuracyFill)" stroke="var(--indigo)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer></div>
      </DashboardCard>
    </>
  );
}

function StudyTime({ snapshot }: DashboardProps) {
  return (
    <DashboardCard eyebrow="Time well spent" title="Study time by area">
      {snapshot.timePerArea.length
        ? <div className="analysis-chart"><ResponsiveContainer width="100%" height={Math.max(150, snapshot.timePerArea.length * 38)}>
          <BarChart data={snapshot.timePerArea} layout="vertical" margin={{ top: 5, right: 20, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke="var(--line)" />
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={95} tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-soft)', fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="minutes" name="Minutes" fill="var(--wave)" radius={[0, 7, 7, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer></div>
        : <p className="muted analysis-empty">Your time by topic will show up after a few reviews.</p>}
    </DashboardCard>
  );
}

function DueForecast({ snapshot }: DashboardProps) {
  return (
    <DashboardCard eyebrow="Plan ahead" title="Upcoming reviews">
      <div className="analysis-chart"><ResponsiveContainer width="100%" height={175}>
        <BarChart data={snapshot.forecast} margin={{ top: 8, right: 2, left: -26, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 4" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-soft)', fontSize: 10 }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-soft)', fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="count" name="Due cards" fill="var(--medium)" radius={[6, 6, 2, 2]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer></div>
    </DashboardCard>
  );
}

export function OverviewDashboard({ snapshot }: DashboardProps) {
  return <><RatingMix snapshot={snapshot} /><WeeklyReviews snapshot={snapshot} /><RevisitTopics snapshot={snapshot} /></>;
}

export function ActivityDashboard({ snapshot }: DashboardProps) {
  return <AccuracyTrendCard snapshot={snapshot} />;
}

export function TopicsDashboard({ snapshot }: DashboardProps) {
  return <><StudyTime snapshot={snapshot} /><DueForecast snapshot={snapshot} /></>;
}
