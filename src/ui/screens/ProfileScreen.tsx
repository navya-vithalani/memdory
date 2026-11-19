import { Link } from 'react-router-dom';
import { useAnalysisStats } from '../../hooks/useAnalysisStats';
import { useHomeStats } from '../../hooks/useHomeStats';
import { useSettings } from '../../hooks/useSettings';
import { useTree } from '../../hooks/useTree';
import { HeatmapCard, StreakHistoryCard } from '../components/AnalysisDashboards';
import { Mnemo } from '../components/Mnemo';
import { StatCard } from '../components/StatCard';

export function ProfileScreen() {
  const { nodes } = useTree();
  const { settings } = useSettings();
  const { snapshot: home } = useHomeStats(settings, nodes);
  const { snapshot: analysis, error } = useAnalysisStats();

  return (
    <main className="screen profile-screen">
      <header className="screen-intro"><p className="eyebrow">Your journey</p><h1>Streak & activity</h1><p className="muted">Showing up is what builds memory.</p><Mnemo mood="happy" className="screen-mascot profile-mascot" /></header>
      {error && <p className="error-message" role="alert">{error}</p>}
      <section className="stats-grid">
        <StatCard label="Current streak" value={`${home?.currentStreak ?? 0} days`} tone="orange" />
        <StatCard label="Best streak" value={`${home?.longestStreak ?? 0} days`} tone="indigo" />
        <StatCard label="Total reviews" value={`${analysis?.totalReviews ?? 0}`} tone="mint" />
      </section>
      {analysis && <><HeatmapCard snapshot={analysis} /><StreakHistoryCard snapshot={analysis} /></>}
      <div className="profile-links">
        <Link to="/settings#backup" className="profile-link"><span>Backup status</span><small>{settings.lastBackupAt ? `Last backup ${new Date(settings.lastBackupAt).toLocaleDateString()}` : 'No backup yet'}</small></Link>
        <Link to="/settings" className="profile-link"><span>Settings</span><small>Theme, new cards, day start</small></Link>
      </div>
    </main>
  );
}
