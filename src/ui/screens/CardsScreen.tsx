import { useEffect, useState } from 'react';
import { useCards } from '../../hooks/useCards';
import { useSettings } from '../../hooks/useSettings';
import { useTree } from '../../hooks/useTree';
import type { CardRecord, SessionRecord, StudyMode } from '../../types';
import { CardImportPanel } from '../components/CardImportPanel';
import { NodeSelect } from '../components/NodeSelect';
import { StudySession } from '../components/StudySession';
import { Mnemo } from '../components/Mnemo';

export function CardsScreen() {
  const { settings, ready } = useSettings();
  const { nodes, error: treeError } = useTree();
  const { loadSessions, startSession: buildSession, addCard: saveCard } = useCards();
  const [scopeNodeId, setScopeNodeId] = useState('');
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [mode, setMode] = useState<StudyMode>('about-to-forget');
  const [amount, setAmount] = useState(10);
  const [unit, setUnit] = useState<'cards' | 'minutes'>('cards');
  const [includeNew, setIncludeNew] = useState(true);
  const [studyQueue, setStudyQueue] = useState<CardRecord[] | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState('');
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [manualNodeId, setManualNodeId] = useState('');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [success, setSuccess] = useState('');

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
    setManualNodeId((current) => nodes.some((node) => node.id === current) ? current : nodes[0]?.id ?? '');
  }, [nodes]);

  useEffect(() => {
    if (!sessionModalOpen && !cardModalOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSessionModalOpen(false);
        setCardModalOpen(false);
      }
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [sessionModalOpen, cardModalOpen]);

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
      setSessionModalOpen(false);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start the study session.');
    }
  }

  async function addManualCard() {
    try {
      await saveCard(manualNodeId, front, back);
      setFront('');
      setBack('');
      setCardModalOpen(false);
      setError('');
      setSuccess('Your card is ready to study.');
      window.setTimeout(() => setSuccess(''), 3500);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save your card.');
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
      <header className="screen-intro"><p className="eyebrow">Practice that sticks</p><h1>Cards</h1><p className="muted">Pick a focus and make a little progress.</p><Mnemo className="screen-mascot cards-mascot" /></header>
      {(error || treeError) && <p className="error-message" role="alert">{error || treeError}</p>}
      {success && <p className="success-message" role="status">{success}</p>}
      {nodes.length === 0 ? (
        <p className="empty-message">Create a study area on Home before adding cards.</p>
      ) : (
        <>
          <div className="cards-action-grid">
            <section className="session-launch-card">
              <span><small>Your next little win</small><strong>Start new session</strong><i>Choose your focus and dive in</i></span>
              <button className="session-launch-button" aria-label="Start new session" onClick={() => { setSessionModalOpen(true); setError(''); }}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              </button>
            </section>
            <button className="manual-card-launch" onClick={() => { setCardModalOpen(true); setError(''); }}>
              <span aria-hidden="true">＋</span><strong>Add a card</strong><small>Write one from scratch</small>
            </button>
          </div>

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
      {sessionModalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSessionModalOpen(false); }}>
          <section className="session-modal" role="dialog" aria-modal="true" aria-labelledby="session-modal-title">
            <button className="modal-close" aria-label="Close session setup" onClick={() => setSessionModalOpen(false)}>×</button>
            <div className="section-heading">
              <div><p className="eyebrow">Make it count</p><h2 id="session-modal-title">Plan your session</h2></div>
              <span className="session-spark" aria-hidden="true">✦</span>
            </div>
            <NodeSelect nodes={nodes} value={scopeNodeId} onChange={setScopeNodeId} label="Study area (includes topics)" />
            <fieldset className="mode-picker">
              <legend>Choose your focus</legend>
              {([
                ['about-to-forget', 'About to forget', 'Strengthen the shaky ones'],
                ['due', 'Due cards', 'Keep your rhythm going'],
                ['random', 'A little of everything', 'Mix up your practice']
              ] as const).map(([value, label, description]) => (
                <button key={value} type="button" className={`mode-option${mode === value ? ' selected' : ''}`} aria-pressed={mode === value} onClick={() => setMode(value)}>
                  <span className="mode-option-check" aria-hidden="true">{mode === value ? '✓' : ''}</span>
                  <span><strong>{label}</strong><small>{description}</small></span>
                </button>
              ))}
            </fieldset>
            <div className="amount-heading"><label htmlFor="session-amount">Session length</label><strong>{amount} <span>{unit}</span></strong></div>
            <input id="session-amount" className="amount-slider" type="range" min="1" max={unit === 'cards' ? 100 : 60} value={Math.min(amount, unit === 'cards' ? 100 : 60)} onChange={(event) => setAmount(Number(event.target.value))} />
            <div className="session-options-row">
              <div className="unit-toggle" aria-label="Session length unit">
                <button type="button" className={unit === 'cards' ? 'active' : ''} aria-pressed={unit === 'cards'} onClick={() => { setUnit('cards'); setAmount(Math.min(amount, 100)); }}>Cards</button>
                <button type="button" className={unit === 'minutes' ? 'active' : ''} aria-pressed={unit === 'minutes'} onClick={() => { setUnit('minutes'); setAmount(Math.min(amount, 60)); }}>Minutes</button>
              </div>
              <label className="checkbox-row"><input type="checkbox" checked={includeNew} onChange={(event) => setIncludeNew(event.target.checked)} /><span>Include new cards <small>Daily cap: {settings.newCardsPerDay}</small></span></label>
            </div>
            {error && <p className="error-message" role="alert">{error}</p>}
            <button className="primary-button session-start-button" onClick={() => void startSession()} disabled={!ready || !scopeNodeId}>Start studying <span aria-hidden="true">→</span></button>
          </section>
        </div>
      )}
      {cardModalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCardModalOpen(false); }}>
          <form className="manual-card-modal" role="dialog" aria-modal="true" aria-labelledby="manual-card-title" onSubmit={(event) => { event.preventDefault(); void addManualCard(); }}>
            <button type="button" className="modal-close" aria-label="Close card form" onClick={() => setCardModalOpen(false)}>×</button>
            <p className="eyebrow">A new idea to remember</p><h2 id="manual-card-title">Create a card</h2>
            <NodeSelect nodes={nodes} value={manualNodeId} onChange={setManualNodeId} label="Add to topic" />
            <label className="field"><span>Front · question or prompt</span><textarea rows={3} value={front} onChange={(event) => setFront(event.target.value)} placeholder="What do you want to remember?" required /></label>
            <label className="field"><span>Back · answer</span><textarea rows={4} value={back} onChange={(event) => setBack(event.target.value)} placeholder="Write the answer here…" required /></label>
            {error && <p className="error-message" role="alert">{error}</p>}
            <button className="primary-button session-start-button" disabled={!manualNodeId || !front.trim() || !back.trim()}>Save card <span aria-hidden="true">✓</span></button>
          </form>
        </div>
      )}
    </main>
  );
}
