type AddCardModalProps = {
  onClose: () => void;
  onChoose: (choice: 'manual' | 'import') => void;
};

export function AddCardModal({ onClose, onChoose }: AddCardModalProps) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="manual-card-modal" role="dialog" aria-modal="true" aria-labelledby="add-card-title">
        <button className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <p className="eyebrow">Grow your deck</p><h2 id="add-card-title">Add cards</h2>
        <div className="add-choice">
          <button onClick={() => onChoose('manual')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            <span><strong>Add a card manually</strong><small>Write one from scratch</small></span>
          </button>
          <button onClick={() => onChoose('import')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></svg>
            <span><strong>Import from file</strong><small>Add many cards from a .txt file</small></span>
          </button>
        </div>
      </section>
    </div>
  );
}
