import { useState } from 'react';
import type { SettingsRecord, StudyMode, TreeNode } from '../../types';
import { NodeSelect } from './NodeSelect';

export type SessionParams = {
  scopeNodeId: string;
  mode: StudyMode;
  amount: number;
  unit: 'cards' | 'minutes';
  includeNew: boolean;
};

type SessionSetupModalProps = {
  nodes: TreeNode[];
  settings: SettingsRecord;
  ready: boolean;
  error: string;
  onClose: () => void;
  onStart: (params: SessionParams) => void;
};

const modes = [
  ['about-to-forget', 'About to forget', 'Strengthen the shaky ones'],
  ['due', 'Due cards', 'Keep your rhythm going'],
  ['random', 'A little of everything', 'Mix up your practice']
] as const;

export function SessionSetupModal({ nodes, settings, ready, error, onClose, onStart }: SessionSetupModalProps) {
  const [scopeNodeId, setScopeNodeId] = useState(nodes[0]?.id ?? '');
  const [mode, setMode] = useState<StudyMode>('about-to-forget');
  const [amount, setAmount] = useState(10);
  const [unit, setUnit] = useState<'cards' | 'minutes'>('cards');
  const [includeNew, setIncludeNew] = useState(true);
  const max = unit === 'cards' ? 100 : 60;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="session-modal" role="dialog" aria-modal="true" aria-labelledby="session-modal-title">
        <button className="modal-close" aria-label="Close session setup" onClick={onClose}>×</button>
        <div className="section-heading">
          <div><p className="eyebrow">Make it count</p><h2 id="session-modal-title">Plan your session</h2></div>
          <span className="session-spark" aria-hidden="true">✦</span>
        </div>
        <NodeSelect nodes={nodes} value={scopeNodeId} onChange={setScopeNodeId} label="Study area (includes topics)" />
        <fieldset className="mode-picker">
          <legend>Choose your focus</legend>
          {modes.map(([value, label, description]) => (
            <button key={value} type="button" className={`mode-option${mode === value ? ' selected' : ''}`} aria-pressed={mode === value} onClick={() => setMode(value)}>
              <span className="mode-option-check" aria-hidden="true">{mode === value ? '✓' : ''}</span>
              <span><strong>{label}</strong><small>{description}</small></span>
            </button>
          ))}
        </fieldset>
        <div className="amount-heading"><label htmlFor="session-amount">Session length</label><strong>{amount} <span>{unit}</span></strong></div>
        <input id="session-amount" className="amount-slider" type="range" min="1" max={max} value={Math.min(amount, max)} onChange={(event) => setAmount(Number(event.target.value))} />
        <div className="session-options-row">
          <div className="unit-toggle" aria-label="Session length unit">
            <button type="button" className={unit === 'cards' ? 'active' : ''} aria-pressed={unit === 'cards'} onClick={() => { setUnit('cards'); setAmount(Math.min(amount, 100)); }}>Cards</button>
            <button type="button" className={unit === 'minutes' ? 'active' : ''} aria-pressed={unit === 'minutes'} onClick={() => { setUnit('minutes'); setAmount(Math.min(amount, 60)); }}>Minutes</button>
          </div>
          <label className="checkbox-row"><input type="checkbox" checked={includeNew} onChange={(event) => setIncludeNew(event.target.checked)} /><span>Include new cards <small>Daily cap: {settings.newCardsPerDay}</small></span></label>
        </div>
        {error && <p className="error-message" role="alert">{error}</p>}
        <button className="primary-button session-start-button" onClick={() => onStart({ scopeNodeId, mode, amount, unit, includeNew })} disabled={!ready || !scopeNodeId}>Start studying <span aria-hidden="true">→</span></button>
      </section>
    </div>
  );
}
