import { useState, useMemo } from 'react';
import { useAnalysisStats, type TagPerformanceItem } from '../../hooks/useAnalysisStats';
import { useHomeStats } from '../../hooks/useHomeStats';
import { useSettings } from '../../hooks/useSettings';
import { useTree } from '../../hooks/useTree';
import { MnemoSummaryCard } from '../components/MnemoSummaryCard';
import {
  OverviewDashboard,
  TopicsDashboard,
  TagsDashboard
} from '../components/AnalysisDashboards';

type AnalysisView = 'overview' | 'topics' | 'tags';

const tabs: Array<{ id: AnalysisView; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'topics', label: 'Topics' },
  { id: 'tags', label: 'Tags' }
];

export function AnalysisScreen() {
  const { snapshot, error } = useAnalysisStats();
  const { nodes } = useTree();
  const { settings } = useSettings();
  const { snapshot: home } = useHomeStats(settings, nodes);
  const [activeView, setActiveView] = useState<AnalysisView>('overview');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  const insightInput = useMemo(() => {
    return {
      hasIncompleteSession: Boolean(home?.inProgressSession),
      currentStreak: home?.currentStreak ?? 0,
      completedToday: home?.completedToday ?? false,
      totalReviews: snapshot?.totalReviews ?? 0,
      weakestTopic: snapshot?.weakestTopics?.[0]
        ? { name: snapshot.weakestTopics[0].name, recall: snapshot.weakestTopics[0].recall }
        : undefined,
      tagAccuracies: snapshot?.tagPerformance?.map((t: TagPerformanceItem) => ({
        tag: t.tag,
        reviews: t.reviews,
        accuracy: t.accuracy
      }))
    };
  }, [home, snapshot]);

  if (!snapshot) {
    return (
      <main className="screen">
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--navy)' }}>Study Insights</h1>
        {error ? (
          <p className="error-message" role="alert">{error}</p>
        ) : (
          <p className="muted">Gathering your study insights…</p>
        )}
      </main>
    );
  }

  const recentAccuracies = snapshot.accuracyTrend
    .map((day) => day.accuracy)
    .filter((accuracy): accuracy is number => accuracy !== null);
  const weeklyAccuracy = recentAccuracies.length
    ? `${Math.round(recentAccuracies.reduce((sum, accuracy) => sum + accuracy, 0) / recentAccuracies.length)}%`
    : '—';

  // Extract unique tag names for filter dropdown
  const allTagNames = snapshot.tagPerformance?.map((t: TagPerformanceItem) => t.tag) ?? [];

  return (
    <main className="screen analysis-screen" style={{ padding: '16px' }}>
      {error && <p className="error-message" role="alert">{error}</p>}

      {/* Mnemo Summary Insight Card at top of Analysis (Phase 6.2) */}
      <MnemoSummaryCard stats={insightInput} />

      {/* Analysis Hero Stats (no ✦ stars) */}
      <section className="analysis-hero-stats">
        <div>
          <strong style={{ fontSize: '24px' }}>{snapshot.totalReviews}</strong>
          <small>total reviews</small>
        </div>
        <div>
          <strong style={{ fontSize: '24px' }}>{snapshot.streakHistory.filter((day) => day.count).length}</strong>
          <small>active days · 2 wk</small>
        </div>
        <div>
          <strong style={{ fontSize: '24px' }}>{weeklyAccuracy}</strong>
          <small>weekly recall</small>
        </div>
      </section>

      {/* Global Filter Bar for Charts (Topic & Tag) */}
      <div
        className="analysis-filters-bar"
        style={{
          display: 'flex',
          gap: '10px',
          margin: '14px 0',
          padding: '12px',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--line)'
        }}
      >
        <label style={{ flex: 1, margin: 0, fontSize: '12px', fontWeight: 700, color: 'var(--ink-soft)' }}>
          Topic
          <select
            value={selectedTopicId}
            onChange={(e) => setSelectedTopicId(e.target.value)}
            style={{ width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '13px' }}
          >
            <option value="all">All topics</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
        </label>

        <label style={{ flex: 1, margin: 0, fontSize: '12px', fontWeight: 700, color: 'var(--ink-soft)' }}>
          Tag
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            style={{ width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '13px' }}
          >
            <option value="all">All tags</option>
            {allTagNames.map((tag: string) => (
              <option key={tag} value={tag}>#{tag}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Navigation tabs */}
      <nav className="analysis-tabs" aria-label="Study insights sections" style={{ marginBottom: '14px' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeView === tab.id ? 'active' : ''}
            aria-pressed={activeView === tab.id}
            onClick={() => setActiveView(tab.id)}
            style={{ fontWeight: 800 }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Dashboard View */}
      <div className="analysis-view" key={activeView}>
        {activeView === 'overview' && (
          <OverviewDashboard
            snapshot={snapshot}
            selectedTopicId={selectedTopicId === 'all' ? null : selectedTopicId}
            selectedTagId={selectedTag === 'all' ? null : selectedTag}
          />
        )}
        {activeView === 'topics' && (
          <TopicsDashboard
            snapshot={snapshot}
            selectedTopicId={selectedTopicId === 'all' ? null : selectedTopicId}
            selectedTagId={selectedTag === 'all' ? null : selectedTag}
          />
        )}
        {activeView === 'tags' && (
          <TagsDashboard
            snapshot={snapshot}
            selectedTopicId={selectedTopicId === 'all' ? null : selectedTopicId}
            selectedTagId={selectedTag === 'all' ? null : selectedTag}
          />
        )}
      </div>
    </main>
  );
}
