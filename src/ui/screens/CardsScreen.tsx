import { useEffect, useState } from 'react';
import { getRecallProbability } from '../../core/scheduler/reviewCard';
import { minutesToCount, selectSessionCards } from '../../core/session/selectSessionCards';
import { getStudyDayStartTimestamp } from '../../core/streak/streak';
import {
  countNewCardsIntroducedSince,
  countReviews,
  createSession,
  listCardsInScope,
  listRecentSessions
} from '../../data/repositories/cardRepository';
import { listNodes } from '../../data/repositories/treeRepository';
import { useSettings } from '../../hooks/useSettings';
import type { CardRecord, SessionRecord, StudyMode, TreeNode } from '../../types';
import { CardImportPanel } from '../components/CardImportPanel';
import { NodeSelect } from '../components/NodeSelect';
import { StudySession } from '../components/StudySession';

export function CardsScreen() {
  const { settings, ready } = useSettings();
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [scopeNodeId, setScopeNodeId] = useState('');
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [mode, setMode] = useState<StudyMode>('about-to-forget');
  const [amount, setAmount] = useState(10);
  const [unit, setUnit] = useState<'cards' | 'minutes'>('cards');
  const [includeNew, setIncludeNew] = useState(true);
  const [studyQueue, setStudyQueue] = useState<CardRecord[] | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState('');

  async function refreshSessions() {
    setSessions(await listRecentSessions());
  }

  useEffect(() => {
    let active = true;
    void Promise.all([listNodes(), listRecentSessions()]).then(([loadedNodes, loadedSessions]) => {
      if (!active) return;
      setNodes(loadedNodes);
      setScopeNodeId((current) => loadedNodes.some((node) => node.id === current) ? current : loadedNodes[0]?.id ?? '');
      setSessions(loadedSessions);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load cards and sessions.');
    });
    return () => {
      active = false;
    };
  }, []);

  async function startSession() {
    if (!scopeNodeId) return;
    try {
      const now = Date.now();
      const [cards, reviewCount, newCardsToday] = await Promise.all([
        listCardsInScope(scopeNodeId),
        countReviews(),
        countNewCardsIntroducedSince(getStudyDayStartTimestamp(now, settings.dayStartMinutes))
      ]);
      const requestedCount = unit === 'minutes'
        ? minutesToCount(amount, settings.avgSecondsPerCard)
        : Math.max(0, Math.floor(amount));
      const selectableCards = cards.map((card) => ({
        id: card.id,
        front: card.front,
        due: card.due,
        reviewed: card.lastReview !== null,
        trap: card.trap,
        recall: getRecallProbability(card, now)
      }));
      const selectedIds = selectSessionCards(selectableCards, mode, requestedCount, {
        now,
        includeNew,
        newCardLimit: Math.max(0, settings.newCardsPerDay - newCardsToday),
        totalReviews: reviewCount
      }).map((card) => card.id);
      const selectedCards = selectedIds.map((id) => cards.find((card) => card.id === id)).filter((card): card is CardRecord => card !== undefined);
      if (selectedCards.length === 0) {
        setError('No cards are available for this scope and session mode.');
        return;
      }
      const id = await createSession(now, scopeNodeId, mode, selectedCards.length);
      setStudyQueue(selectedCards);
      setSessionId(id);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start the study session.');
    }
  }

  async function leaveSession() {
    setStudyQueue(null);
    setSessionId('');
    try {
      await refreshSessions();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not refresh session history.');
    }
  }

  if (studyQueue && sessionId) {
    return <StudySession sessionId={sessionId} cards={studyQueue} onExit={() => void leaveSession()} />;
  }

  return (
    <main className="screen">
      <div className="panel-header">
        <h1>Cards</h1>
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      {nodes.length === 0 ? (
        <p className="empty-message">Create a study area on Home before adding cards.</p>
      ) : (
        <>
          <section className="stacked-panel session-setup">
            <h2>Start session</h2>
            <NodeSelect nodes={nodes} value={scopeNodeId} onChange={setScopeNodeId} label="Scope (includes descendants)" />
            <div className="form-grid">
              <label className="field">
                <span>Session mode</span>
                <select value={mode} onChange={(event) => setMode(event.target.value as StudyMode)}>
                  <option value="about-to-forget">About to forget</option>
                  <option value="due">Due</option>
                  <option value="random">Random</option>
                </select>
              </label>
              <label className="field">
                <span>Amount type</span>
                <select value={unit} onChange={(event) => setUnit(event.target.value as 'cards' | 'minutes')}>
                  <option value="cards">Cards</option>
                  <option value="minutes">Minutes</option>
                </select>
              </label>
              <label className="field">
                <span>{unit === 'cards' ? 'Number of cards' : 'Minutes'}</span>
                <input type="number" min="1" value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
              </label>
            </div>
            <label className="checkbox-row">
              <input type="checkbox" checked={includeNew} onChange={(event) => setIncludeNew(event.target.checked)} />
              Include new cards (daily cap: {settings.newCardsPerDay})
            </label>
            <button className="primary-button" onClick={() => void startSession()} disabled={!ready || !scopeNodeId}>Start studying</button>
          </section>

          <CardImportPanel nodes={nodes} onImported={() => {
            setError('');
            void refreshSessions().catch((reason: unknown) => {
              setError(reason instanceof Error ? reason.message : 'Could not refresh session history.');
            });
          }} />

          <section className="stacked-panel">
            <h2>Previous sessions</h2>
            {sessions.length === 0 ? <p className="muted">Sessions you complete will appear here.</p> : sessions.map((session) => (
              <div className="session-row" key={session.id}>
                <div>
                  <strong>{session.mode.replaceAll('-', ' ')}</strong>
                  <small>{new Date(session.startedAt).toLocaleString()}</small>
                </div>
                <span>{session.completedCount}/{session.plannedCount} cards</span>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
