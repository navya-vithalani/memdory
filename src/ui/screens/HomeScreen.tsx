import { useNavigate } from 'react-router-dom';
import mascotHappy from '../../assets/mascot/mnemo-side-happy.svg';
import { useHomeStats } from '../../hooks/useHomeStats';
import { useSettings } from '../../hooks/useSettings';
import { useTree } from '../../hooks/useTree';
import { StatCard } from '../components/StatCard';
import { TreeManager } from '../components/TreeManager';

export function HomeScreen() {
  const { nodes, error, actions } = useTree();
  const { settings, error: settingsError } = useSettings();
  const { snapshot, error: statsError } = useHomeStats(settings, nodes);
  const navigate = useNavigate();
  const progress = snapshot?.dailyGoal ? Math.min(100, snapshot.reviewsToday / snapshot.dailyGoal * 100) : 0;

  return (
    <main className="screen home-screen">
      <header className="home-header">
        <div>
          <p className="eyebrow">remembree</p>
          <h1>Ready when you are</h1>
        </div>
        <button className="primary-button" onClick={() => navigate('/cards')} disabled={nodes.length === 0}>
          Start session ({snapshot?.atRiskCards ?? 0} about to forget)
        </button>
      </header>

      <section className="hero-panel">
        <div>
          <p className="eyebrow">Current streak</p>
          <h2>{snapshot?.currentStreak ?? 0} {snapshot?.currentStreak === 1 ? 'day' : 'days'}</h2>
          <p className="muted">Longest: {snapshot?.longestStreak ?? 0} {snapshot?.longestStreak === 1 ? 'day' : 'days'}</p>
          <p className="muted">Your notes and cards stay on this device.</p>
        </div>
        <div className="home-progress-ring" style={{ ['--progress' as string]: progress }}>
          <span>{snapshot?.reviewsToday ?? 0}/{snapshot?.dailyGoal ?? settings.dailyGoal}</span>
        </div>
      </section>

      <img className="home-mascot" src={mascotHappy} alt="" />
      <section className="stats-grid">
        <StatCard label="Due today" value={`${snapshot?.dueCards ?? 0}`} tone="orange" />
        <StatCard label="About to forget" value={`${snapshot?.atRiskCards ?? 0}`} tone="indigo" />
        <StatCard label="Today's goal" value={`${snapshot?.reviewsToday ?? 0}/${snapshot?.dailyGoal ?? settings.dailyGoal}`} tone="mint" />
      </section>
      {!!snapshot?.areas.length && (
        <section className="card-list">
          <h2>Areas</h2>
          {snapshot.areas.map(({ node, mastery }) => (
            <div key={node.id} className="area-row">
              <div><strong>{node.name}</strong><small>Mastery</small></div>
              <div className="mini-ring" style={{ ['--value' as string]: mastery }}><span>{mastery}%</span></div>
            </div>
          ))}
        </section>
      )}
      {snapshot?.weakestTopic && (
        <section className="stacked-panel">
          <p className="eyebrow">Weakest topic</p>
          <strong>{snapshot.weakestTopic.node.name}</strong>
          <p className="muted">{Math.round(snapshot.weakestTopic.recall * 100)}% recall probability</p>
        </section>
      )}
      {snapshot?.lastSession && (
        <section className="stacked-panel">
          <p className="eyebrow">Last session</p>
          <strong>{snapshot.lastSession.completedCount} cards reviewed</strong>
          <p className="muted">{new Date(snapshot.lastSession.endedAt).toLocaleString()}</p>
        </section>
      )}
      {(error || settingsError || statsError) && <p className="error-message" role="alert">{error || settingsError || statsError}</p>}
      <TreeManager nodes={nodes} actions={actions} />
    </main>
  );
}
