import { useEffect, useState } from 'react';
import type { SettingsRecord, StudyMode, TreeNode } from '../../types';
import { NodeSelect } from './NodeSelect';
import { listCardsInScope } from '../../data/repositories/cardRepository';
import { deriveCardFamilies, type CardFamilyGroup } from '../../core/session/familyCards';

export type SessionParams = {
  scopeNodeId: string;
  mode: StudyMode;
  amount: number;
  unit: 'cards' | 'minutes';
  includeNew: boolean;
  viewMode?: 'cards' | 'families';
  selectedFamilyKeys?: string[];
  starredOnly?: boolean;
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
  const [viewMode, setViewMode] = useState<'cards' | 'families'>('cards');
  const [families, setFamilies] = useState<CardFamilyGroup[]>([]);
  const [selectedFamilyKeys, setSelectedFamilyKeys] = useState<string[]>([]);
  const [starredOnly, setStarredOnly] = useState(false);

  const max = unit === 'cards' ? 100 : 60;

  useEffect(() => {
    let active = true;
    void listCardsInScope(scopeNodeId).then((cards) => {
      if (!active) return;
      const derived = deriveCardFamilies(cards);
      setFamilies(derived);
      if (derived.length === 0 && viewMode === 'families') {
        setViewMode('cards');
      }
    });
    return () => {
      active = false;
    };
  }, [scopeNodeId, viewMode]);

  function toggleFamilyKey(key: string) {
    setSelectedFamilyKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function handleSelectAllFamilies() {
    if (selectedFamilyKeys.length === families.length) {
      setSelectedFamilyKeys([]);
    } else {
      setSelectedFamilyKeys(families.map((f) => f.familyKey));
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="session-modal" role="dialog" aria-modal="true" aria-labelledby="session-modal-title">
        <button className="modal-close" aria-label="Close session setup" onClick={onClose}>
          ×
        </button>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Make it count</p>
            <h2 id="session-modal-title">Plan your session</h2>
          </div>
          <span className="session-spark" aria-hidden="true">✦</span>
        </div>

        <NodeSelect nodes={nodes} value={scopeNodeId} onChange={setScopeNodeId} label="Study area (includes topics)" />

        {/* Study Type: Single cards vs Families */}
        <div className="session-mode-switch" style={{ margin: '12px 0 16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: 'var(--ink-soft)', marginBottom: '6px' }}>
            Study format
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className={viewMode === 'cards' ? 'primary-button' : 'secondary-button'}
              style={{ flex: 1, minHeight: '40px', fontSize: '14px' }}
              onClick={() => setViewMode('cards')}
            >
              Single cards
            </button>
            <button
              type="button"
              className={viewMode === 'families' ? 'primary-button' : 'secondary-button'}
              style={{
                flex: 1,
                minHeight: '40px',
                fontSize: '14px',
                opacity: families.length === 0 ? 0.45 : 1,
                cursor: families.length === 0 ? 'not-allowed' : 'pointer'
              }}
              disabled={families.length === 0}
              title={families.length === 0 ? 'No card families found in this topic' : undefined}
              onClick={() => {
                if (families.length > 0) setViewMode('families');
              }}
            >
              Families {families.length > 0 ? `(${families.length})` : '(None)'}
            </button>
          </div>
        </div>

        {/* When Families mode is selected: family multi-select */}
        {viewMode === 'families' && (
          <div className="families-picker" style={{ margin: '0 0 16px', padding: '12px', background: 'var(--indigo-tint)', borderRadius: 'var(--radius-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--navy)' }}>
                Select families to study
              </span>
              <button
                type="button"
                className="text-button"
                style={{ fontSize: '12px', padding: '2px 6px' }}
                onClick={handleSelectAllFamilies}
              >
                {selectedFamilyKeys.length === families.length ? 'Deselect all' : 'All families'}
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
              {families.map((f) => {
                const isSelected = selectedFamilyKeys.includes(f.familyKey);
                return (
                  <button
                    key={f.familyKey}
                    type="button"
                    onClick={() => toggleFamilyKey(f.familyKey)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      border: '1px solid var(--line)',
                      background: isSelected ? 'var(--indigo)' : 'var(--surface)',
                      color: isSelected ? '#fff' : 'var(--ink)',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {f.front} <small style={{ opacity: 0.8 }}>({f.cards.length})</small>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <fieldset className="mode-picker">
          <legend>Choose your focus</legend>
          {modes.map(([value, label, description]) => (
            <button
              key={value}
              type="button"
              className={`mode-option${mode === value ? ' selected' : ''}`}
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              <span className="mode-option-check" aria-hidden="true">{mode === value ? '✓' : ''}</span>
              <span><strong>{label}</strong><small>{description}</small></span>
            </button>
          ))}
        </fieldset>

        <div className="amount-heading">
          <label htmlFor="session-amount">Session length</label>
          <strong>{amount} <span>{unit}</span></strong>
        </div>
        <input
          id="session-amount"
          className="amount-slider"
          type="range"
          min="1"
          max={max}
          value={Math.min(amount, max)}
          onChange={(event) => setAmount(Number(event.target.value))}
        />

        <div className="session-options-row">
          <div className="unit-toggle" aria-label="Session length unit">
            <button
              type="button"
              className={unit === 'cards' ? 'active' : ''}
              aria-pressed={unit === 'cards'}
              onClick={() => { setUnit('cards'); setAmount(Math.min(amount, 100)); }}
            >
              Cards
            </button>
            <button
              type="button"
              className={unit === 'minutes' ? 'active' : ''}
              aria-pressed={unit === 'minutes'}
              onClick={() => { setUnit('minutes'); setAmount(Math.min(amount, 60)); }}>Minutes</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={includeNew}
                onChange={(event) => setIncludeNew(event.target.checked)}
              />
              <span>Include new cards <small>Daily cap: {settings.newCardsPerDay}</small></span>
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={starredOnly}
                onChange={(event) => setStarredOnly(event.target.checked)}
              />
              <span>⭐ Starred only</span>
            </label>
          </div>
        </div>

        {error && <p className="error-message" role="alert">{error}</p>}

        <button
          className="primary-button session-start-button"
          onClick={() =>
            onStart({
              scopeNodeId,
              mode,
              amount,
              unit,
              includeNew,
              viewMode,
              selectedFamilyKeys: selectedFamilyKeys.length > 0 ? selectedFamilyKeys : undefined,
              starredOnly
            })
          }
          disabled={!ready || !scopeNodeId}
        >
          Start studying <span aria-hidden="true">→</span>
        </button>
      </section>
    </div>
  );
}
