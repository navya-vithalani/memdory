import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import type { ReactNode } from 'react';
import type { AnalysisSnapshot, TagPerformanceItem } from '../../hooks/useAnalysisStats';
import { useSettings } from '../../hooks/useSettings';

type DashboardProps = {
  snapshot: AnalysisSnapshot;
  selectedTopicId?: string | null;
  selectedTagId?: string | null;
};

function DashboardCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="chart-panel analysis-card">
      <div className="analysis-card-heading">
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 800, color: 'var(--navy)' }}>
            {title}
          </h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function RatingMix({ snapshot }: DashboardProps) {
  const total = snapshot.ratings.reduce((sum, rating) => sum + rating.value, 0);
  return (
    <DashboardCard title="Recall Quality & Mix">
      <div className="donut-layout">
        <div className="donut-chart">
          {total > 0 && (
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie
                  data={snapshot.ratings.filter((rating) => rating.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={72}
                  paddingAngle={3}
                  stroke="none"
                >
                  {snapshot.ratings
                    .filter((rating) => rating.value > 0)
                    .map((rating) => (
                      <Cell key={rating.name} fill={rating.color} />
                    ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="donut-center">
            <strong>{total}</strong>
            <small>reviews</small>
          </div>
        </div>
        <div className="rating-legend">
          {snapshot.ratings.map((rating) => (
            <div key={rating.name}>
              <i style={{ backgroundColor: rating.color }} />
              <span>{rating.name}</span>
              <strong>{rating.value}</strong>
            </div>
          ))}
          {total === 0 && <p className="muted">Your rating mix will appear after your first session.</p>}
        </div>
      </div>
    </DashboardCard>
  );
}

function WeeklyReviews({ snapshot }: DashboardProps) {
  const { settings } = useSettings();
  const targetCards = settings.targetCardsPerDay ?? settings.dailyGoal ?? 20;

  return (
    <DashboardCard title="Daily Review Volume">
      <div className="analysis-chart">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={snapshot.cardsPerDay} margin={{ top: 12, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 4" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-soft)', fontSize: 10 }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-soft)', fontSize: 10 }} />
            <Tooltip />
            <ReferenceLine
              y={targetCards}
              stroke="var(--orange)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Goal (${targetCards})`,
                fill: 'var(--orange-pressed)',
                fontSize: 10,
                position: 'insideTopRight'
              }}
            />
            <Bar dataKey="count" name="Cards" fill="var(--indigo)" radius={[6, 6, 2, 2]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DashboardCard>
  );
}

function RevisitTopics({ snapshot }: DashboardProps) {
  return (
    <section className="stacked-panel analysis-card topic-analysis">
      <div className="analysis-card-heading">
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 800, color: 'var(--navy)' }}>
            Topics to Revisit
          </h2>
        </div>
      </div>
      {snapshot.weakestTopics.length ? (
        snapshot.weakestTopics.map((topic) => (
          <div key={topic.name} className="topic-row">
            <span>{topic.name}</span>
            <div className="topic-meter">
              <i style={{ width: `${topic.recall}%` }} />
            </div>
            <strong>{topic.recall}%</strong>
          </div>
        ))
      ) : (
        <p className="muted">Keep practicing to see where a quick refresher can help.</p>
      )}
    </section>
  );
}

function TopicMasteryChart({ snapshot }: DashboardProps) {
  const { settings } = useSettings();
  const targetRetentionPct = Math.round((settings.desiredRetention ?? 0.9) * 100);

  const topicData = snapshot.weakestTopics.map((t) => ({
    name: t.name,
    recall: t.recall
  }));

  return (
    <DashboardCard title="Topic Retention Comparison">
      {topicData.length > 0 ? (
        <div className="analysis-chart">
          <ResponsiveContainer width="100%" height={Math.max(160, topicData.length * 36)}>
            <BarChart data={topicData} layout="vertical" margin={{ top: 8, right: 30, left: 10, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="var(--line)" />
              <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-soft)', fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={100} tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-soft)', fontSize: 10 }} />
              <Tooltip formatter={(val: unknown) => [`${val}%`, 'Recall']} />
              <ReferenceLine
                x={targetRetentionPct}
                stroke="var(--orange)"
                strokeDasharray="4 4"
                label={{
                  value: `Target (${targetRetentionPct}%)`,
                  fill: 'var(--orange-pressed)',
                  fontSize: 10,
                  position: 'insideTopRight'
                }}
              />
              <Bar dataKey="recall" name="Recall %" fill="var(--medium)" radius={[0, 6, 6, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="muted" style={{ padding: '16px 0', textAlign: 'center' }}>
          Complete a few reviews to compare retention across your topics.
        </p>
      )}
    </DashboardCard>
  );
}

function StudyTime({ snapshot }: DashboardProps) {
  return (
    <DashboardCard title="Study Time by Area">
      {snapshot.timePerArea.length ? (
        <div className="analysis-chart">
          <ResponsiveContainer width="100%" height={Math.max(150, snapshot.timePerArea.length * 38)}>
            <BarChart data={snapshot.timePerArea} layout="vertical" margin={{ top: 5, right: 20, left: 8, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="var(--line)" />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={95} tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-soft)', fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="minutes" name="Minutes" fill="var(--wave)" radius={[0, 7, 7, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="muted analysis-empty">Your time by topic will show up after a few reviews.</p>
      )}
    </DashboardCard>
  );
}

function DueForecast({ snapshot }: DashboardProps) {
  return (
    <DashboardCard title="Upcoming Review Forecast">
      <div className="analysis-chart">
        <ResponsiveContainer width="100%" height={175}>
          <BarChart data={snapshot.forecast} margin={{ top: 8, right: 2, left: -26, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 4" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-soft)', fontSize: 10 }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-soft)', fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="count" name="Due cards" fill="var(--medium)" radius={[6, 6, 2, 2]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DashboardCard>
  );
}

export function OverviewDashboard({ snapshot }: DashboardProps) {
  return (
    <>
      <RatingMix snapshot={snapshot} />
      <WeeklyReviews snapshot={snapshot} />
      <RevisitTopics snapshot={snapshot} />
    </>
  );
}

export function TopicsDashboard({ snapshot, selectedTopicId }: DashboardProps) {
  return (
    <>
      <TopicMasteryChart snapshot={snapshot} selectedTopicId={selectedTopicId} />
      <StudyTime snapshot={snapshot} selectedTopicId={selectedTopicId} />
      <DueForecast snapshot={snapshot} selectedTopicId={selectedTopicId} />
    </>
  );
}

export function TagsDashboard({ snapshot }: DashboardProps) {
  // Group tags into Struggling (< 60%) and Strong (>= 90%)
  const tagsList: TagPerformanceItem[] = snapshot.tagPerformance ?? [];
  const struggling = tagsList.filter((t: TagPerformanceItem) => t.accuracy < 60);
  const strong = tagsList.filter((t: TagPerformanceItem) => t.accuracy >= 90);
  const learning = tagsList.filter((t: TagPerformanceItem) => t.accuracy >= 60 && t.accuracy < 90);

  return (
    <>
      <DashboardCard title="Tag Performance Breakdown">
        {tagsList.length === 0 ? (
          <p className="muted" style={{ padding: '16px 0', textAlign: 'center' }}>
            Tag statistics will appear as you tag and review flashcards.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Struggling Tags */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--wrong)', margin: '0 0 8px' }}>
                Struggling Tags (&lt; 60% Recall)
              </h3>
              {struggling.length > 0 ? (
                struggling.map((t) => (
                  <div key={t.tag} className="topic-row">
                    <span>#{t.tag} <small>({t.reviews} reviews)</small></span>
                    <div className="topic-meter">
                      <i style={{ width: `${t.accuracy}%`, background: 'var(--wrong)' }} />
                    </div>
                    <strong style={{ color: 'var(--wrong)' }}>{t.accuracy}%</strong>
                  </div>
                ))
              ) : (
                <p className="muted" style={{ fontSize: '13px' }}>No struggling tags! Great retention.</p>
              )}
            </div>

            {/* Strong Tags */}
            <div style={{ paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--easy)', margin: '0 0 8px' }}>
                Strong Tags (≥ 90% Recall)
              </h3>
              {strong.length > 0 ? (
                strong.map((t) => (
                  <div key={t.tag} className="topic-row">
                    <span>#{t.tag} <small>({t.reviews} reviews)</small></span>
                    <div className="topic-meter">
                      <i style={{ width: `${t.accuracy}%`, background: 'var(--easy)' }} />
                    </div>
                    <strong style={{ color: 'var(--easy)' }}>{t.accuracy}%</strong>
                  </div>
                ))
              ) : (
                <p className="muted" style={{ fontSize: '13px' }}>Keep reviewing to build tags up to 90%+ mastery.</p>
              )}
            </div>

            {/* Learning Tags */}
            {learning.length > 0 && (
              <div style={{ paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--indigo)', margin: '0 0 8px' }}>
                  In Progress (60% – 89%)
                </h3>
                {learning.map((t) => (
                  <div key={t.tag} className="topic-row">
                    <span>#{t.tag} <small>({t.reviews} reviews)</small></span>
                    <div className="topic-meter">
                      <i style={{ width: `${t.accuracy}%`, background: 'var(--indigo)' }} />
                    </div>
                    <strong style={{ color: 'var(--indigo)' }}>{t.accuracy}%</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DashboardCard>
    </>
  );
}

// Retain ActivityDashboard for backward compatibility
export function ActivityDashboard({ snapshot }: DashboardProps) {
  return <DueForecast snapshot={snapshot} />;
}
