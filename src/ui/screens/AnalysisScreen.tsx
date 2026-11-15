import { useState } from 'react';
import { useAnalysisStats } from '../../hooks/useAnalysisStats';
import { Mnemo } from '../components/Mnemo';
import {
  ActivityDashboard,
  OverviewDashboard,
  TopicsDashboard
} from '../components/AnalysisDashboards';

type AnalysisView = 'overview' | 'activity' | 'topics';

const tabs: Array<{ id: AnalysisView; label: string; icon: string }> = [
  { id: 'overview', label: 'Overview', icon: '✦' },
  { id: 'activity', label: 'Activity', icon: '〰' },
  { id: 'topics', label: 'Topics', icon: '◈' }
];

export function AnalysisScreen() {
  const { snapshot, error } = useAnalysisStats();
  const [activeView, setActiveView] = useState<AnalysisView>('overview');

  if (!snapshot) {
    return <main className="screen"><h1>Study insights</h1>{error ? <p className="error-message" role="alert">{error}</p> : <p className="muted">Gathering your study insights…</p>}</main>;
  }

  const recentAccuracies = snapshot.accuracyTrend
    .map((day) => day.accuracy)
    .filter((accuracy): accuracy is number => accuracy !== null);
  const weeklyAccuracy = recentAccuracies.length
    ? `${Math.round(recentAccuracies.reduce((sum, accuracy) => sum + accuracy, 0) / recentAccuracies.length)}%`
    : '—';

  return (
    <main className="screen analysis-screen">
      <header className="screen-intro analysis-intro">
        <p className="eyebrow">Your progress, at a glance</p>
        <h1>Study insights</h1>
        <p className="muted">Every little session matters.</p>
        <Mnemo mood="excited" className="screen-mascot analysis-mascot" />
      </header>
      {error && <p className="error-message" role="alert">{error}</p>}
      <section className="analysis-hero-stats">
        <div><span className="analysis-stat-icon" aria-hidden="true">✦</span><strong>{snapshot.totalReviews}</strong><small>total reviews</small></div>
        <div><span className="analysis-stat-icon activity" aria-hidden="true">◌</span><strong>{snapshot.streakHistory.filter((day) => day.count).length}</strong><small>active days · 2 wk</small></div>
        <div><span className="analysis-stat-icon recall" aria-hidden="true">↗</span><strong>{weeklyAccuracy}</strong><small>weekly recall</small></div>
      </section>
      <nav className="analysis-tabs" aria-label="Study insights sections">
        {tabs.map((tab) => (
          <button key={tab.id} className={activeView === tab.id ? 'active' : ''} aria-pressed={activeView === tab.id} onClick={() => setActiveView(tab.id)}>
            <span aria-hidden="true">{tab.icon}</span>{tab.label}
          </button>
        ))}
      </nav>
      <div className="analysis-view" key={activeView}>
        {activeView === 'overview' && <OverviewDashboard snapshot={snapshot} />}
        {activeView === 'activity' && <ActivityDashboard snapshot={snapshot} />}
        {activeView === 'topics' && <TopicsDashboard snapshot={snapshot} />}
      </div>
    </main>
  );
}
