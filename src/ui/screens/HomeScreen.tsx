import { useNavigate } from 'react-router-dom';
import { useHomeStats } from '../../hooks/useHomeStats';
import { useSettings } from '../../hooks/useSettings';
import { useTree } from '../../hooks/useTree';
import { StatCard } from '../components/StatCard';
import { TreeManager } from '../components/TreeManager';
import { WeeklyStreak } from '../components/WeeklyStreak';
import { Mnemo } from '../components/Mnemo';

export function HomeScreen() {
  const { nodes, error, actions } = useTree();
  const { settings, error: settingsError } = useSettings();
  const { snapshot, error: statsError } = useHomeStats(settings, nodes);
  const navigate = useNavigate();
  const areaMastery = Object.fromEntries((snapshot?.areas ?? []).map(({ node, mastery }) => [node.id, mastery]));

  return (
    <main className="screen home-screen">
      <header className="home-header">
        <div className="home-welcome"><p className="eyebrow">A little progress adds up</p><h1>Ready when you are.</h1></div>
        <button className="home-quick-start" onClick={() => navigate('/cards?action=start')} disabled={nodes.length === 0} aria-label="Start a study session"><span aria-hidden="true">▶</span></button>
      </header>

      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow">Your next small win</p>
          <h2>Make today<br />a day to remember.</h2>
          <p>You're doing great. Let's keep it going.</p>
          <button className="primary-button" onClick={() => navigate('/cards?action=start')} disabled={nodes.length === 0}>
            <span aria-hidden="true">▶</span> Start a study session
          </button>
          {nodes.length === 0 && <span className="hero-hint">Add your first study area below to begin.</span>}
        </div>
        <Mnemo className="home-mascot" />
        <div className="home-wave" aria-hidden="true" />
      </section>

      <section className="stats-grid">
        <StatCard label="Due today" value={`${snapshot?.dueCards ?? 0}`} tone="indigo" />
        <StatCard label="At risk" value={`${snapshot?.atRiskCards ?? 0}`} tone="mint" />
        <StatCard label="Best streak" value={`${snapshot?.longestStreak ?? 0} days`} tone="orange" />
      </section>
      <WeeklyStreak streak={snapshot?.currentStreak ?? 0} reviewedToday={(snapshot?.reviewsToday ?? 0) > 0} />

      {snapshot?.weakestTopic && (
        <section className="nudge-panel">
          <span className="nudge-icon" aria-hidden="true">↗</span>
          <div><p className="eyebrow">A good one to revisit</p><strong>{snapshot.weakestTopic.node.name}</strong><p className="muted">{Math.round(snapshot.weakestTopic.recall * 100)}% estimated recall</p></div>
          <button className="secondary-button" onClick={() => navigate('/cards?action=start')}>Review</button>
        </section>
      )}
      {snapshot?.lastSession && (
        <section className="last-session-card">
          <span className="last-session-icon" aria-hidden="true">✓</span>
          <div><p className="eyebrow">Last session</p><strong>{snapshot.lastSession.completedCount} cards reviewed</strong><small>{new Date(snapshot.lastSession.endedAt).toLocaleString()}</small></div>
          <span className="last-session-arrow" aria-hidden="true">→</span>
        </section>
      )}
      {(error || settingsError || statsError) && <p className="error-message" role="alert">{error || settingsError || statsError}</p>}
      <TreeManager nodes={nodes} actions={actions} areaMastery={areaMastery} />
    </main>
  );
}
