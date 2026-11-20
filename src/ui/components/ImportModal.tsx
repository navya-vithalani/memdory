import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { TreeNode } from '../../types';
import { NodeSelect } from './NodeSelect';
import { Mnemo } from './Mnemo';
import { applyImport, previewImportFile, type ImportPreview } from '../../data/repositories/importRepository';

type ImportModalProps = {
  nodes: TreeNode[];
  defaultNodeId?: string;
  onClose: () => void;
  onImported?: () => void;
};

type Step = 'file' | 'mode' | 'preview' | 'success';

export function ImportModal({ nodes, defaultNodeId, onClose, onImported }: ImportModalProps) {
  const [step, setStep] = useState<Step>('file');
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState<'paths' | 'into-node'>('paths');
  const [targetNodeId, setTargetNodeId] = useState(defaultNodeId ?? nodes[0]?.id ?? '');
  const [updateWithId, setUpdateWithId] = useState(true);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [importSummary, setImportSummary] = useState<string>('');

  async function handleFileSelected(file?: File) {
    if (!file) return;
    setError('');
    try {
      const text = await file.text();
      setFileContent(text);
      setFileName(file.name);
      setStep('mode');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read file.');
    }
  }

  async function generatePreview(selectedMode = mode, selectedTarget = targetNodeId, updateFlag = updateWithId) {
    setLoading(true);
    setError('');
    try {
      const prev = await previewImportFile(fileContent, fileName, selectedMode, selectedTarget, updateFlag);
      setPreview(prev);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate preview.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmImport() {
    if (!preview) return;
    setLoading(true);
    setError('');
    try {
      const record = await applyImport(preview, mode, targetNodeId, updateWithId);
      const total = record.counts.cards + record.counts.notes;
      setImportSummary(
        `Imported ${total} items (${record.counts.cards} cards, ${record.counts.notes} notes${
          record.counts.nodes ? `, ${record.counts.nodes} new topics` : ''
        }).`
      );
      setStep('success');
      onImported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import items.');
    } finally {
      setLoading(false);
    }
  }

  const hasBlockingErrors = preview ? preview.errors.length > 0 && preview.parsed.totalItems === 0 : false;
  const totalItemsToImport = preview ? preview.counts.cards + preview.counts.notes + preview.counts.updated : 0;

  const content = (
    <div
      className="import-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="import-modal-sheet" role="dialog" aria-modal="true" aria-label="Import files">
        <header className="import-modal-header">
          <h3>Import cards & notes</h3>
          <button className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        </header>

        {error && (
          <div className="import-error-banner" role="alert">
            <Mnemo mood="front-shocked" className="import-mascot-inline" />
            <p>{error}</p>
          </div>
        )}

        {step === 'file' && (
          <div className="import-step import-step-file">
            <p className="muted">
              Import a <code>.txt</code> or <code>.md</code> file with <code>Q:</code>/<code>A:</code> flashcards, <code>NOTE:</code> blocks, or <code>@ Topic</code> trees.
            </p>
            <label className="primary-button file-button import-choose-btn">
              Choose file (.txt / .md)
              <input
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                onChange={(e) => {
                  void handleFileSelected(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        )}

        {step === 'mode' && (
          <div className="import-step import-step-mode">
            <p className="import-file-name">Selected: <strong>{fileName}</strong></p>

            <fieldset className="import-mode-group">
              <legend>How should topics be arranged?</legend>
              <label className={`import-mode-option${mode === 'paths' ? ' active' : ''}`}>
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === 'paths'}
                  onChange={() => setMode('paths')}
                />
                <div>
                  <strong>Use paths in file</strong>
                  <small>Follows <code>@ Area &gt; Topic</code> lines inside the file to create or match hierarchy.</small>
                </div>
              </label>

              <label className={`import-mode-option${mode === 'into-node' ? ' active' : ''}`}>
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === 'into-node'}
                  onChange={() => setMode('into-node')}
                />
                <div>
                  <strong>Put inside selected topic</strong>
                  <small>Places all cards and notes inside the chosen topic (paths inside file become sub-topics).</small>
                </div>
              </label>
            </fieldset>

            {mode === 'into-node' && nodes.length > 0 && (
              <div className="import-target-select">
                <NodeSelect
                  nodes={nodes}
                  value={targetNodeId}
                  onChange={setTargetNodeId}
                  label="Target topic"
                />
              </div>
            )}

            <div className="import-step-actions">
              <button className="text-button" onClick={() => setStep('file')}>Back</button>
              <button
                className="primary-button"
                onClick={() => void generatePreview(mode, targetNodeId, updateWithId)}
                disabled={loading || (mode === 'into-node' && !targetNodeId)}
              >
                {loading ? 'Analyzing…' : 'Continue to preview'}
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="import-step import-step-preview">
            <div className="import-stats-summary">
              <div className="import-stat-chip"><strong>{preview.counts.cards}</strong> cards</div>
              <div className="import-stat-chip"><strong>{preview.counts.notes}</strong> notes</div>
              {preview.counts.nodes > 0 && (
                <div className="import-stat-chip"><strong>{preview.counts.nodes}</strong> new topics</div>
              )}
              {preview.counts.tags > 0 && (
                <div className="import-stat-chip"><strong>{preview.counts.tags}</strong> new tags</div>
              )}
              {preview.counts.updated > 0 && (
                <div className="import-stat-chip updated"><strong>{preview.counts.updated}</strong> updates</div>
              )}
              {preview.counts.skipped > 0 && (
                <div className="import-stat-chip skipped"><strong>{preview.counts.skipped}</strong> skipped</div>
              )}
            </div>

            <label className="import-toggle-label">
              <input
                type="checkbox"
                checked={updateWithId}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setUpdateWithId(checked);
                  void generatePreview(mode, targetNodeId, checked);
                }}
              />
              <span>Update existing items with matching ID</span>
            </label>

            {preview.warnings.length > 0 && (
              <div className="import-warning-box">
                {preview.warnings.map((w, idx) => <p key={idx}>{w}</p>)}
              </div>
            )}

            {preview.errors.length > 0 && (
              <div className="import-errors-container">
                <button
                  type="button"
                  className="import-errors-toggle text-button"
                  onClick={() => setShowErrors((prev) => !prev)}
                >
                  {showErrors ? 'Hide' : 'Show'} {preview.errors.length} formatting {preview.errors.length === 1 ? 'error' : 'errors'}
                </button>
                {showErrors && (
                  <ul className="import-error-list">
                    {preview.errors.map((err, idx) => (
                      <li key={idx}>Line {err.line}: {err.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="import-step-actions">
              <button className="text-button" onClick={() => setStep('mode')}>Back</button>
              <button
                className="primary-button"
                onClick={() => void handleConfirmImport()}
                disabled={loading || hasBlockingErrors || totalItemsToImport === 0}
              >
                {loading ? 'Importing…' : `Import ${totalItemsToImport} items`}
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="import-step import-step-success">
            <Mnemo mood="excited" className="import-success-mascot" />
            <h4>Import complete!</h4>
            <p className="muted">{importSummary}</p>
            <button className="primary-button" onClick={onClose}>Done</button>
          </div>
        )}
      </section>
    </div>
  );

  const mountTarget = (typeof document !== 'undefined' ? document.querySelector('.app-frame') : null) ?? (typeof document !== 'undefined' ? document.body : null);
  if (!mountTarget) return content;
  return createPortal(content, mountTarget);
}
