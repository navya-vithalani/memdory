import { useState } from 'react';
import type { TreeNode } from '../../types';
import { NodeSelect } from './NodeSelect';

type ManualCardModalProps = {
  nodes: TreeNode[];
  error: string;
  onClose: () => void;
  onSave: (
    nodeId: string,
    front: string,
    back: string,
    options?: {
      explanation?: string | null;
      tags?: string[];
      direction?: 'one-way' | 'both';
      starred?: boolean;
    }
  ) => void;
};

export function ManualCardModal({ nodes, error, onClose, onSave }: ManualCardModalProps) {
  const [nodeId, setNodeId] = useState(nodes[0]?.id ?? '');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [explanation, setExplanation] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [twoWay, setTwoWay] = useState(false);
  const [starred, setStarred] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onSave(nodeId, front, back, {
      explanation: explanation.trim() || null,
      tags: tags.length ? tags : undefined,
      direction: twoWay ? 'both' : 'one-way',
      starred
    });
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="manual-card-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-card-title"
        onSubmit={handleSubmit}
      >
        <button type="button" className="modal-close" aria-label="Close card form" onClick={onClose}>
          ×
        </button>
        <p className="eyebrow">A new idea to remember</p>
        <h2 id="manual-card-title">Create a card</h2>

        <NodeSelect nodes={nodes} value={nodeId} onChange={setNodeId} label="Add to topic" />

        <label className="field">
          <span>Front · question or prompt</span>
          <textarea
            rows={2}
            value={front}
            onChange={(event) => setFront(event.target.value)}
            placeholder="e.g. XeF4 (supports LaTeX: $...$)"
            required
          />
        </label>

        <label className="field">
          <span>Back · answer</span>
          <textarea
            rows={3}
            value={back}
            onChange={(event) => setBack(event.target.value)}
            placeholder="e.g. sp3d2, square planar"
            required
          />
        </label>

        <label className="field">
          <span>Explanation · why is this true? (optional)</span>
          <textarea
            rows={2}
            value={explanation}
            onChange={(event) => setExplanation(event.target.value)}
            placeholder="Shown after answer is revealed…"
          />
        </label>

        <label className="field">
          <span>Tags (comma-separated, first tag = label chip)</span>
          <input
            type="text"
            value={tagsInput}
            onChange={(event) => setTagsInput(event.target.value)}
            placeholder="e.g. hybridisation, vsepr, chemistry"
          />
        </label>

        <div className="card-options-row" style={{ display: 'flex', gap: '16px', margin: '8px 0 16px', flexWrap: 'wrap' }}>
          <label className="checkbox-field" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={twoWay}
              onChange={(e) => setTwoWay(e.target.checked)}
            />
            <span>Two-way (creates reverse card)</span>
          </label>

          <label className="checkbox-field" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={starred}
              onChange={(e) => setStarred(e.target.checked)}
            />
            <span>⭐ Starred</span>
          </label>
        </div>

        {error && <p className="error-message" role="alert">{error}</p>}

        <button
          type="submit"
          className="primary-button session-start-button"
          disabled={!nodeId || !front.trim() || !back.trim()}
        >
          Save card <span aria-hidden="true">✓</span>
        </button>
      </form>
    </div>
  );
}
