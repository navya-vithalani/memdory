import { useEffect } from 'react';
import type { SessionRecord, TreeNode } from '../../types';

type SessionPromptModalProps = {
  session: SessionRecord;
  nodes: TreeNode[];
  onResume: (sessionId: string) => void;
  onDiscardAndStartNew: (sessionId: string) => void;
  onClose: () => void;
};

export function SessionPromptModal({
  session,
  nodes,
  onResume,
  onDiscardAndStartNew,
  onClose
}: SessionPromptModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const scopeName = session.scopeNodeId
    ? nodes.find((n) => n.id === session.scopeNodeId)?.name ?? 'Selected topic'
    : 'All topics';

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="session-modal session-prompt-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-prompt-title"
      >
        <button className="modal-close" aria-label="Cancel" onClick={onClose}>
          ×
        </button>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Unfinished session</p>
            <h2 id="session-prompt-title">Pick up where you left off?</h2>
          </div>
        </div>
        <div className="session-prompt-info">
          <p>
            You have a session in <strong>{scopeName}</strong> with{' '}
            <strong>{session.position}</strong> of{' '}
            <strong>{session.plannedCount}</strong> cards reviewed.
          </p>
        </div>
        <div className="session-prompt-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => onResume(session.id)}
          >
            Resume session
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => onDiscardAndStartNew(session.id)}
          >
            Discard and start new
          </button>
          <button type="button" className="text-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
