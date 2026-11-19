import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCards } from '../../hooks/useCards';
import { useHomeStats } from '../../hooks/useHomeStats';
import { useSettings } from '../../hooks/useSettings';
import { useTree } from '../../hooks/useTree';
import type { SessionRecord } from '../../types';
import { Mnemo } from '../components/Mnemo';
import { SessionPromptModal } from '../components/SessionPromptModal';
import { StatCard } from '../components/StatCard';
import { TreeManager } from '../components/TreeManager';
import { WeeklyStreak } from '../components/WeeklyStreak';

export function HomeScreen() {
  const { nodes, error, actions } = useTree();
  const { settings, error: settingsError } = useSettings();
  const { snapshot, error: statsError, refresh } = useHomeStats(settings, nodes);
  const { discard } = useCards();
  const navigate = useNavigate();
  const [promptSession, setPromptSession] = useState<SessionRecord | null>(null);

  const areaMastery = Object.fromEntries(
    (snapshot?.areas ?? []).map(({ node, mastery }) => [node.id, mastery])
  );

  const scopeName = (id: string | null) =>
    nodes.find((node) => node.id === id)?.name ?? 'All topics';

  // Mascot mood and greeting based on days since last completed session
  let mascotMood: 'happy' | 'sleepy' | 'sad' | 'rotten' = 'happy';
  let greetingLine = 'Ready when you are.';
  if (snapshot?.lastSession?.completedAt) {
    const daysSinceLast = Math.floor(
      (Date.now() - snapshot.lastSession.completedAt) / (24 * 60 * 60 * 1000)
    );
    if (daysSinceLast <= 1) {
      mascotMood = 'happy';
      greetingLine = 'Ready when you are.';
    } else if (daysSinceLast === 2) {
      mascotMood = 'sleepy';
      greetingLine = 'A good day to dive back in.';
    } else if (daysSinceLast <= 4) {
      mascotMood = 'sad';
      greetingLine = 'Your cards miss you.';
    } else {
      mascotMood = 'rotten';
      greetingLine = 'Time to revive your memory!';
    }
  }

  const atRiskCount = snapshot?.atRiskCards ?? snapshot?.dueCards ?? 0;
  const startButtonText =
    atRiskCount > 0
      ? `Start session (${atRiskCount} cards about to be forgotten)`
      : 'Start session';

  function handleStartSession() {
    if (snapshot?.inProgressSession) {
      setPromptSession(snapshot.inProgressSession);
      return;
    }
    navigate('/cards?action=start');
  }

  async function handleDiscard(sessionId: string) {
    try {
      await discard(sessionId);
      await refresh();
    } catch {
      // Ignored
    }
  }

  return (
    <main className="screen home-screen">
      <header className="home-header">
        <div className="home-welcome">
          <p className="eyebrow">A little progress adds up</p>
          <h1>{greetingLine}</h1>
        </div>
        <button
          className="home-quick-start"
          onClick={handleStartSession}
          disabled={nodes.length === 0}
          aria-label="Start a study session"
        >
          <span aria-hidden="true">▶</span>
        </button>
      </header>

      {/* Greeting card & Start session CTA */}
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow">Your next small win</p>
          <h2>
            Make today
            <br />a day to remember.
          </h2>
          <p>You're doing great. Let's keep it going.</p>
          <button
            className="primary-button"
            onClick={handleStartSession}
            disabled={nodes.length === 0}
          >
            <span aria-hidden="true">▶</span> {startButtonText}
          </button>
          {nodes.length === 0 && (
            <span className="hero-hint">Add your first study area below to begin.</span>
          )}
        </div>
        <Mnemo mood={mascotMood} className="home-mascot" />
        <div className="home-wave" aria-hidden="true" />
      </section>

      {/* Resume session card (only if an incomplete session exists) */}
      {snapshot?.inProgressSession && (
        <section className="resume-session-card">
          <div className="resume-session-copy">
            <p className="eyebrow">Session in progress</p>
            <strong>{scopeName(snapshot.inProgressSession.scopeNodeId)}</strong>
            <p className="muted">
              {snapshot.inProgressSession.position} of {snapshot.inProgressSession.plannedCount} cards done
            </p>
          </div>
          <div className="resume-session-actions">
            <button
              type="button"
              className="secondary-button resume-button"
              onClick={() =>
                navigate(`/cards?action=resume&sessionId=${snapshot.inProgressSession!.id}`)
              }
            >
              Resume
            </button>
            <button
              type="button"
              className="text-button discard-button"
              onClick={() => void handleDiscard(snapshot.inProgressSession!.id)}
            >
              Discard
            </button>
          </div>
        </section>
      )}

      {/* Stat overview */}
      <section className="stats-grid">
        <StatCard label="Due today" value={`${snapshot?.dueCards ?? 0}`} tone="indigo" />
        <StatCard label="At risk" value={`${snapshot?.atRiskCards ?? 0}`} tone="mint" />
        <StatCard
          label="Best streak"
          value={`${snapshot?.longestStreak ?? 0} days`}
          tone="orange"
        />
      </section>

      {/* Weekly streak widget */}
      <WeeklyStreak
        streak={snapshot?.currentStreak ?? 0}
        completedDayKeys={snapshot?.completedDayKeys ?? []}
        dayStartMinutes={settings.dayStartMinutes}
      />

      {/* Weakest topic nudge */}
      {snapshot?.weakestTopic && (
        <section className="nudge-panel">
          <span className="nudge-icon" aria-hidden="true">
            ↗
          </span>
          <div>
            <p className="eyebrow">A good one to revisit</p>
            <strong>{snapshot.weakestTopic.node.name}</strong>
            <p className="muted">
              {Math.round(snapshot.weakestTopic.recall * 100)}% estimated recall
            </p>
          </div>
          <button className="secondary-button" onClick={handleStartSession}>
            Review
          </button>
        </section>
      )}

      {/* Area cards and TreeManager */}
      {(error || settingsError || statsError) && (
        <p className="error-message" role="alert">
          {error || settingsError || statsError}
        </p>
      )}
      <TreeManager nodes={nodes} actions={actions} areaMastery={areaMastery} />

      {/* In-progress prompt modal */}
      {promptSession && (
        <SessionPromptModal
          session={promptSession}
          nodes={nodes}
          onResume={(id) => {
            setPromptSession(null);
            navigate(`/cards?action=resume&sessionId=${id}`);
          }}
          onDiscardAndStartNew={async (id) => {
            await handleDiscard(id);
            setPromptSession(null);
            navigate('/cards?action=start');
          }}
          onClose={() => setPromptSession(null)}
        />
      )}
    </main>
  );
}
