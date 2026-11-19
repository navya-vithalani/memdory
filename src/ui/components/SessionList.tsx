import { useState } from 'react';
import type { SessionRecord, TreeNode } from '../../types';

type SessionListProps = {
  sessions: SessionRecord[];
  nodes: TreeNode[];
  onResume?: (sessionId: string) => void;
};

export function SessionList({ sessions, nodes, onResume }: SessionListProps) {
  const [query, setQuery] = useState('');
  const scopeName = (id: string | null) => nodes.find((node) => node.id === id)?.name ?? 'All topics';
  const text = query.trim().toLowerCase();
  const visible = sessions.filter(
    (session) =>
      !text ||
      [scopeName(session.scopeNodeId), session.mode.replaceAll('-', ' '), new Date(session.startedAt).toLocaleDateString()]
        .join(' ')
        .toLowerCase()
        .includes(text)
  );

  return (
    <>
      <label className="sessions-search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search past sessions"
          aria-label="Search past sessions"
        />
      </label>
      <section className="stacked-panel">
        <h2>Past sessions</h2>
        {sessions.length === 0 && <p className="muted">Sessions you finish will appear here.</p>}
        {sessions.length > 0 && visible.length === 0 && <p className="muted">No sessions match your search.</p>}
        {visible.map((session) => {
          const isCompleted = session.status === 'completed';
          const isInProgress = session.status === 'in-progress';
          return (
            <div className="session-row" key={session.id}>
              <div>
                <strong>{scopeName(session.scopeNodeId)}</strong>
                <small>
                  {new Date(session.startedAt).toLocaleDateString()} · {session.mode.replaceAll('-', ' ')}
                </small>
              </div>
              <div className="session-row-meta">
                <span>
                  {session.completedCount}/{session.plannedCount} cards
                </span>
                <span className={`status-badge ${isCompleted ? 'completed' : 'incomplete'}`}>
                  {isCompleted ? 'Completed' : 'Incomplete'}
                </span>
                {isInProgress && onResume && (
                  <button
                    type="button"
                    className="session-row-resume-button"
                    onClick={() => onResume(session.id)}
                  >
                    Resume
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
