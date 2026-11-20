import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCards } from '../../hooks/useCards';
import { useHomeStats } from '../../hooks/useHomeStats';
import { useSettings } from '../../hooks/useSettings';
import { useTree } from '../../hooks/useTree';
import type { CardRecord, SessionRecord } from '../../types';
import { AddCardModal } from '../components/AddCardModal';
import { ImportModal } from '../components/ImportModal';
import { ManualCardModal } from '../components/ManualCardModal';
import { MnemoSummaryCard } from '../components/MnemoSummaryCard';
import { SessionList } from '../components/SessionList';
import { SessionPromptModal } from '../components/SessionPromptModal';
import { SessionSetupModal, type SessionParams } from '../components/SessionSetupModal';
import { StudySession } from '../components/StudySession';

type Modal = null | 'session' | 'add' | 'manual' | 'import';

export function CardsScreen() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { settings, ready } = useSettings();
  const { nodes, error: treeError } = useTree();
  const { snapshot } = useHomeStats(settings, nodes);
  const {
    loadSessions,
    startSession: buildSession,
    resumeSession: fetchResumeSession,
    discard,
    addCard: saveCard
  } = useCards();

  const insightInput = useMemo(() => {
    return {
      hasIncompleteSession: Boolean(snapshot?.inProgressSession),
      currentStreak: snapshot?.currentStreak ?? 0,
      completedToday: snapshot?.completedToday ?? false,
      totalReviews: snapshot?.reviewsToday ?? 0,
      weakestTopic: snapshot?.weakestTopic ? { name: snapshot.weakestTopic.node.name, recall: snapshot.weakestTopic.recall * 100 } : undefined
    };
  }, [snapshot]);

  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [studyQueue, setStudyQueue] = useState<CardRecord[] | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [sessionPosition, setSessionPosition] = useState(0);
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

  async function startSession(params: SessionParams) {
    try {
      const { session, cards } = await buildSession(
        params.scopeNodeId,
        params.mode,
        params.amount,
        params.unit,
        params.includeNew,
        settings,
        {
          viewMode: params.viewMode,
          selectedFamilyKeys: params.selectedFamilyKeys,
          starredOnly: params.starredOnly
        }
      );
      if (!session || cards.length === 0) {
        setError('No cards are available for this scope and session mode.');
        return;
      }
      setStudyQueue(cards);
      setSessionId(session.id);
      setSessionPosition(0);
      setModal(null);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start the study session.');
    }
  }

  async function addManualCard(
    nodeId: string,
    front: string,
    back: string,
    options?: {
      explanation?: string | null;
      tags?: string[];
      direction?: 'one-way' | 'both';
      starred?: boolean;
    }
  ) {
    try {
      await saveCard(nodeId, front, back, options);
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
          <MnemoSummaryCard stats={insightInput} />
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
          onSave={(n, f, b, opts) => void addManualCard(n, f, b, opts)}
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
