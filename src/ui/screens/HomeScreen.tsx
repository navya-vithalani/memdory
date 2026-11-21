import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCards } from '../../hooks/useCards';
import { useHomeStats } from '../../hooks/useHomeStats';
import { useSettings } from '../../hooks/useSettings';
import { useTree } from '../../hooks/useTree';
import type { SessionRecord } from '../../types';
import { Mnemo } from '../components/Mnemo';
import { ImportModal } from '../components/ImportModal';
import { SessionPromptModal } from '../components/SessionPromptModal';
import { StatCard } from '../components/StatCard';
import { TreeManager } from '../components/TreeManager';
import { WeeklyStreak } from '../components/WeeklyStreak';

export function HomeScreen() {
  const { nodes, error, actions, refresh: refreshTree } = useTree();
  const { settings, error: settingsError } = useSettings();
  const { snapshot, error: statsError, refresh } = useHomeStats(settings, nodes);
  const { discard } = useCards();
  const navigate = useNavigate();
  const [promptSession, setPromptSession] = useState<SessionRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const areaMastery = Object.fromEntries(
    (snapshot?.areas ?? []).map(({ node, mastery }) => [node.id, mastery])
  );

  const scopeName = (id: string | null) =>
    nodes.find((node) => node.id === id)?.name ?? 'All topics';

  const userName = settings.userName?.trim() || 'dory';
  let mascotMood: 'happy' | 'sleepy' | 'sad' | 'rotten' = 'happy';
  let greetingLine = `Welcome, ${userName}!`;

  if (!snapshot?.lastSession?.completedAt) {
    mascotMood = 'happy';
    greetingLine = `Welcome, ${userName}!`;
  } else {
    const daysSinceLast = Math.floor(
      (Date.now() - snapshot.lastSession.completedAt) / (24 * 60 * 60 * 1000)
    );
    const streak = snapshot.currentStreak ?? 0;
    const completedToday = snapshot.completedToday;

    if (completedToday) {
      mascotMood = 'happy';
      if (streak >= 7) {
        greetingLine = `Crushing it, ${userName}! 🔥`;
      } else if (streak > 1) {
        greetingLine = `Streak extended, ${userName}!`;
      } else {
        greetingLine = `Welcome back, ${userName}!`;
      }
    } else if (daysSinceLast <= 1) {
      mascotMood = 'happy';
      if (streak >= 3) {
        greetingLine = `Keep the streak alive, ${userName}!`;
      } else {
        greetingLine = `Welcome back, ${userName}!`;
      }
    } else if (daysSinceLast === 2) {
      mascotMood = 'sleepy';
      greetingLine = `Missing you, ${userName}!`;
    } else if (daysSinceLast <= 4) {
      mascotMood = 'sad';
      greetingLine = `We miss you, ${userName}!`;
    } else {
      mascotMood = 'rotten';
      greetingLine = `Long time no see, ${userName}!`;
    }
  }

  const atRiskCount = snapshot?.atRiskCards ?? snapshot?.dueCards ?? 0;

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

  // Sensible mascot insight for the home hero summary
  let insightText = "Every short session helps you remember more. Let's make today count!";
  if (snapshot?.inProgressSession) {
    insightText = 'You have a session in progress. Pick it right back up!';
  } else if (atRiskCount > 0) {
    insightText = `${atRiskCount} cards are ready for review today before they fade.`;
  } else if (nodes.length === 0) {
    insightText = 'Welcome! Add a learning area below or import your notes and flashcards.';
  }

  return (
    <main className="screen home-screen">
      <header className="home-header">
        <div className="home-welcome">
          <h2>{greetingLine}</h2>
        </div>
        <div className="home-header-actions">
          <button
            className="home-import-btn secondary-button"
            onClick={() => setImportOpen(true)}
            aria-label="Import files"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
            </svg>
          </button>
          <button
            className="home-quick-start"
            onClick={handleStartSession}
            disabled={nodes.length === 0}
            aria-label="Start session"
          >
            <span aria-hidden="true">▶</span>
          </button>
        </div>
      </header>

      {/* Remade Hero: mascot insight & analysis summary */}
      <section className="home-hero home-summary-hero">
        <div className="home-hero-copy">
          <div className="home-insight-bubble">
            <p>{insightText}</p>
            <Link to="/analysis" className="home-insight-link">See full analysis →</Link>
          </div>
        </div>
        <Mnemo mood={mascotMood} className="home-mascot" />
        <div className="home-wave" aria-hidden="true" />
      </section>

      {/* Resume session card (if an incomplete session exists) */}
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
          label="Mastered"
          value={`${snapshot?.masteredCards ?? 0}`}
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

      {/* Import Modal */}
      {importOpen && (
        <ImportModal
          nodes={nodes}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            void refreshTree();
            void refresh();
          }}
        />
      )}
    </main>
  );
}
