import { useState } from 'react';
import type { TreeNode } from '../../types';
import { NodeSelect } from './NodeSelect';

type ManualCardModalProps = {
  nodes: TreeNode[];
  error: string;
  onClose: () => void;
  onSave: (nodeId: string, front: string, back: string) => void;
};

export function ManualCardModal({ nodes, error, onClose, onSave }: ManualCardModalProps) {
  const [nodeId, setNodeId] = useState(nodes[0]?.id ?? '');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="manual-card-modal" role="dialog" aria-modal="true" aria-labelledby="manual-card-title" onSubmit={(event) => { event.preventDefault(); onSave(nodeId, front, back); }}>
        <button type="button" className="modal-close" aria-label="Close card form" onClick={onClose}>×</button>
        <p className="eyebrow">A new idea to remember</p><h2 id="manual-card-title">Create a card</h2>
        <NodeSelect nodes={nodes} value={nodeId} onChange={setNodeId} label="Add to topic" />
        <label className="field"><span>Front · question or prompt</span><textarea rows={3} value={front} onChange={(event) => setFront(event.target.value)} placeholder="What do you want to remember?" required /></label>
        <label className="field"><span>Back · answer</span><textarea rows={4} value={back} onChange={(event) => setBack(event.target.value)} placeholder="Write the answer here…" required /></label>
        {error && <p className="error-message" role="alert">{error}</p>}
        <button className="primary-button session-start-button" disabled={!nodeId || !front.trim() || !back.trim()}>Save card <span aria-hidden="true">✓</span></button>
      </form>
    </div>
  );
}
