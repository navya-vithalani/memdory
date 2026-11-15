import { useEffect, useState } from 'react';
import { useCards } from '../../hooks/useCards';
import { useSettings } from '../../hooks/useSettings';
import { useTree } from '../../hooks/useTree';
import type { CardRecord, SessionRecord, StudyMode } from '../../types';
import { CardImportPanel } from '../components/CardImportPanel';
import { NodeSelect } from '../components/NodeSelect';
import { StudySession } from '../components/StudySession';

export function CardsScreen() {
  const { settings, ready } = useSettings();
  const { nodes, error: treeError } = useTree();
  const { loadSessions, startSession: buildSession } = useCards();
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
    setSessions(await loadSessions());
  }

  useEffect(() => {
    let active = true;
    void loadSessions().then((loadedSessions) => {
      if (active) setSessions(loadedSessions);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load cards and sessions.');
    });
    return () => {
      active = false;
    };
  }, [loadSessions]);

  useEffect(() => {
    setScopeNodeId((current) => nodes.some((node) => node.id === current) ? current : nodes[0]?.id ?? '');
  }, [nodes]);

  async function startSession() {
    if (!scopeNodeId) return;
    try {
      const { sessionId: id, cards: selectedCards } = await buildSession(scopeNodeId, mode, amount, unit, includeNew, settings);
      if (selectedCards.length === 0) {
        setError('No cards are available for this scope and session mode.');
        return;
      }
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
      {(error || treeError) && <p className="error-message" role="alert">{error || treeError}</p>}
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
