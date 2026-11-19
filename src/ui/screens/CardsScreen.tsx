import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCards } from '../../hooks/useCards';
import { useSettings } from '../../hooks/useSettings';
import { useTree } from '../../hooks/useTree';
import type { CardRecord, SessionRecord } from '../../types';
import { AddCardModal } from '../components/AddCardModal';
import { ImportModal } from '../components/ImportModal';
import { ManualCardModal } from '../components/ManualCardModal';
import { SessionList } from '../components/SessionList';
import { SessionPromptModal } from '../components/SessionPromptModal';
import { SessionSetupModal, type SessionParams } from '../components/SessionSetupModal';
import { StudySession } from '../components/StudySession';
import { SummaryCard } from '../components/SummaryCard';

type Modal = null | 'session' | 'add' | 'manual' | 'import';

export function CardsScreen() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { settings, ready } = useSettings();
  const { nodes, error: treeError } = useTree();
  const {
    loadSessions,
    startSession: buildSession,
    resumeSession: fetchResumeSession,
    discard,
    addCard: saveCard
  } = useCards();

  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [studyQueue, setStudyQueue] = useState<CardRecord[] | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [sessionPosition, setSessionPosition] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(0);
  const [modal, setModal] = useState<Modal>(null);
  const [promptSession, setPromptSession] = useState<SessionRecord | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const refreshSessions = () => loadSessions().then(setSessions);

  useEffect(() => {
    let active = true;
    void loadSessions()
      .then((loaded) => {
        if (active) setSessions(loaded);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load cards and sessions.');
      });
    return () => {
      active = false;
    };
  }, [loadSessions]);

  async function handleResume(id: string) {
    try {
      const result = await fetchResumeSession(id);
      if (!result || result.cards.length === 0) {
        setError('Could not resume this session: cards are no longer available.');
        return;
      }
      setStudyQueue(result.cards);
      setSessionId(result.session.id);
      setSessionPosition(result.session.position);
      setSessionCompleted(result.session.completedCount);
      setPromptSession(null);
      setModal(null);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not resume session.');
    }
  }

  useEffect(() => {
    const action = params.get('action');
    if (!action) return;

    if (action === 'import') setModal('import');
    if (action === 'start') {
      const inProgress = sessions.find((s) => s.status === 'in-progress');
      if (inProgress) {
        setPromptSession(inProgress);
      } else {
        setModal('session');
      }
    }
    if (action === 'resume') {
      const resumeId = params.get('sessionId');
      if (resumeId) void handleResume(resumeId);
    }
    if (action === 'add') setModal('add');
    setParams({}, { replace: true });
  }, [params, setParams, sessions]);

  useEffect(() => {
    if (!modal) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModal(null);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [modal]);

  function handleStartClick() {
    const inProgress = sessions.find((s) => s.status === 'in-progress');
    if (inProgress) {
      setPromptSession(inProgress);
    } else {
      open('session');
    }
  }

  async function startSession({ scopeNodeId, mode, amount, unit, includeNew }: SessionParams) {
    try {
      const { session, cards } = await buildSession(scopeNodeId, mode, amount, unit, includeNew, settings);
      if (!session || cards.length === 0) {
        setError('No cards are available for this scope and session mode.');
        return;
      }
      setStudyQueue(cards);
      setSessionId(session.id);
      setSessionPosition(0);
      setSessionCompleted(0);
      setModal(null);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start the study session.');
    }
  }

  async function addManualCard(nodeId: string, front: string, back: string) {
    try {
      await saveCard(nodeId, front, back);
      setModal(null);
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
    setSessionPosition(0);
    setSessionCompleted(0);
    try {
      await refreshSessions();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not refresh session history.');
    }
  }

  if (studyQueue && sessionId) {
    return (
      <StudySession
        sessionId={sessionId}
        cards={studyQueue}
        initialPosition={sessionPosition}
        initialCompleted={sessionCompleted}
        onExit={() => void leaveSession()}
      />
    );
  }

  const open = (next: Modal) => {
    setError('');
    setModal(next);
  };

  return (
    <main className="screen cards-screen">
      <header className="screen-intro">
        <p className="eyebrow">Practice that sticks</p>
        <h1>Cards</h1>
      </header>
      {(error || treeError) && modal === null && (
        <p className="error-message" role="alert">
          {error || treeError}
        </p>
      )}
      {success && (
        <p className="success-message" role="status">
          {success}
        </p>
      )}
      {nodes.length === 0 ? (
        <p className="empty-message">
          Create a study area on <Link to="/">Home</Link> before adding cards.
        </p>
      ) : (
        <>
          <div className="cards-actions">
            <button
              className="cards-action start"
              onClick={handleStartClick}
              aria-label="Start a session"
            >
              <span className="cards-action-button">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              Start
            </button>
            <button className="cards-action" onClick={() => open('add')} aria-label="Add cards">
              <span className="cards-action-button">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              Add
            </button>
            <button
              className="cards-action"
              onClick={() => navigate('/cards/browse')}
              aria-label="Browse cards"
            >
              <span className="cards-action-button">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="4" y="4" width="7" height="7" rx="1.5" />
                  <rect x="13" y="4" width="7" height="7" rx="1.5" />
                  <rect x="4" y="13" width="7" height="7" rx="1.5" />
                  <rect x="13" y="13" width="7" height="7" rx="1.5" />
                </svg>
              </span>
              Browse
            </button>
          </div>
          <SummaryCard sessionCount={sessions.length} />
          <SessionList
            sessions={sessions}
            nodes={nodes}
            onResume={(id) => void handleResume(id)}
          />
        </>
      )}
      {modal === 'session' && (
        <SessionSetupModal
          nodes={nodes}
          settings={settings}
          ready={ready}
          error={error}
          onClose={() => setModal(null)}
          onStart={(p) => void startSession(p)}
        />
      )}
      {modal === 'add' && <AddCardModal onClose={() => setModal(null)} onChoose={open} />}
      {modal === 'manual' && (
        <ManualCardModal
          nodes={nodes}
          error={error}
          onClose={() => setModal(null)}
          onSave={(n, f, b) => void addManualCard(n, f, b)}
        />
      )}
      {modal === 'import' && (
        <ImportModal
          nodes={nodes}
          onClose={() => setModal(null)}
          onImported={() => {
            setError('');
            void refreshSessions().catch(() => undefined);
          }}
        />
      )}

      {promptSession && (
        <SessionPromptModal
          session={promptSession}
          nodes={nodes}
          onResume={(id) => void handleResume(id)}
          onDiscardAndStartNew={async (id) => {
            await discard(id);
            await refreshSessions();
            setPromptSession(null);
            open('session');
          }}
          onClose={() => setPromptSession(null)}
        />
      )}
    </main>
  );
}
