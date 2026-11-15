import { useState } from 'react';
import type { TreeNode } from '../../types';
import { importCards, previewCardImport } from '../../data/repositories/cardRepository';
import { NodeSelect } from './NodeSelect';

type CardImportPanelProps = {
  nodes: TreeNode[];
  onImported: () => void;
};

export function CardImportPanel({ nodes, onImported }: CardImportPanelProps) {
  const [nodeId, setNodeId] = useState(nodes[0]?.id ?? '');
  const [source, setSource] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<{ cards: { front: string; back: string }[]; skipped: number; invalid: number } | null>(null);
  const [error, setError] = useState('');

  async function loadFile(file?: File) {
    if (!file) return;
    try {
      const text = await file.text();
      const result = await previewCardImport(nodeId, text);
      setSource(text);
      setFileName(file.name);
      setPreview(result);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not read the card file.');
    }
  }

  async function confirmImport() {
    if (!preview || !nodeId) return;
    try {
      await importCards(nodeId, source);
      setPreview(null);
      setSource('');
      setFileName('');
      setError('');
      onImported();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not import cards.');
    }
  }

  return (
    <section className="stacked-panel">
      <h2>Add cards</h2>
      <p className="muted">Import Q:/A: blocks or front-tab-back lines. Imports never create topics.</p>
      {nodes.length > 0 && <NodeSelect nodes={nodes} value={nodeId} onChange={(value) => {
        setNodeId(value);
        setPreview(null);
      }} label="Target topic" />}
      <label className="secondary-button file-button">
        Choose .txt file
        <input type="file" accept=".txt,text/plain" onChange={(event) => {
          void loadFile(event.target.files?.[0]);
          event.target.value = '';
        }} />
      </label>
      {error && <p className="error-message" role="alert">{error}</p>}
      {preview && (
        <div className="import-preview">
          <strong>{fileName}</strong>
          <p>{preview.cards.length} new cards · {preview.skipped} duplicates/skipped · {preview.invalid} invalid</p>
          {preview.cards.slice(0, 3).map((card, index) => (
            <div className="card-preview" key={`${card.front}-${index}`}>
              <p>{card.front}</p><p>{card.back}</p>
            </div>
          ))}
          <button className="primary-button" onClick={() => void confirmImport()} disabled={preview.cards.length === 0}>Import {preview.cards.length} cards</button>
        </div>
      )}
    </section>
  );
}
