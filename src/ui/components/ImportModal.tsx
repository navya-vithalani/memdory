import type { TreeNode } from '../../types';
import { CardImportPanel } from './CardImportPanel';

type ImportModalProps = {
  nodes: TreeNode[];
  onClose: () => void;
  onImported: () => void;
};

export function ImportModal({ nodes, onClose, onImported }: ImportModalProps) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="manual-card-modal" role="dialog" aria-modal="true" aria-label="Import cards">
        <button className="modal-close" aria-label="Close import" onClick={onClose}>×</button>
        <CardImportPanel nodes={nodes} onImported={onImported} />
      </section>
    </div>
  );
}
