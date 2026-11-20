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
  ['about-to-forget', 'About to forget'],
  ['due', 'Due cards'],
  ['random', 'Random']
] as const;

export function SessionSetupModal({ nodes, settings, ready, error, onClose, onStart }: SessionSetupModalProps) {
  const [scopeNodeId, setScopeNodeId] = useState(nodes[0]?.id ?? '');
  const [mode, setMode] = useState<StudyMode>('about-to-forget');
  const [amount, setAmount] = useState(10);
  const [includeNew, setIncludeNew] = useState(true);
  const [viewMode, setViewMode] = useState<'cards' | 'families'>('cards');
  const [families, setFamilies] = useState<CardFamilyGroup[]>([]);
  const [selectedFamilyKeys, setSelectedFamilyKeys] = useState<string[]>([]);
  const [starredOnly, setStarredOnly] = useState(false);

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
        <div className="section-heading" style={{ marginBottom: '14px' }}>
          <div>
            <h2 id="session-modal-title" style={{ margin: 0, fontSize: '20px' }}>Plan your session</h2>
          </div>
        </div>

        <NodeSelect nodes={nodes} value={scopeNodeId} onChange={setScopeNodeId} label="Study area (includes topics)" />

        {/* Study Type: Single cards vs Families */}
        <div className="session-mode-switch" style={{ margin: '12px 0 14px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: 'var(--ink-soft)', marginBottom: '6px' }}>
            Study format
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className={viewMode === 'cards' ? 'primary-button' : 'secondary-button'}
              style={{ flex: 1, minHeight: '38px', fontSize: '13px' }}
              onClick={() => setViewMode('cards')}
            >
              Single cards
            </button>
            <button
              type="button"
              className={viewMode === 'families' ? 'primary-button' : 'secondary-button'}
              style={{
                flex: 1,
                minHeight: '38px',
                fontSize: '13px',
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
          <div className="families-picker" style={{ margin: '0 0 14px', padding: '12px', background: 'var(--indigo-tint)', borderRadius: 'var(--radius-card)' }}>
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '110px', overflowY: 'auto' }}>
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

        {/* 3-way toggle button group for focus mode */}
        <div className="mode-segmented-group" style={{ margin: '12px 0 16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: 'var(--ink-soft)', marginBottom: '6px' }}>
            Focus mode
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', background: 'var(--indigo-tint)', padding: '4px', borderRadius: '14px' }}>
            {modes.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`mode-toggle-btn${mode === value ? ' active' : ''}`}
                style={{
                  padding: '8px 4px',
                  borderRadius: '10px',
                  border: 'none',
                  background: mode === value ? 'var(--indigo)' : 'transparent',
                  color: mode === value ? '#ffffff' : 'var(--ink)',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: mode === value ? '0 2px 6px rgba(69, 71, 214, 0.3)' : 'none',
                  textAlign: 'center'
                }}
                onClick={() => setMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Session length (cards only) */}
        <div className="amount-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label htmlFor="session-amount" style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ink-soft)' }}>Session length</label>
          <strong style={{ fontSize: '15px', fontWeight: 800, color: 'var(--navy)' }}>{amount} cards</strong>
        </div>
        <input
          id="session-amount"
          className="amount-slider"
          type="range"
          min="1"
          max="100"
          value={amount}
          onChange={(event) => setAmount(Number(event.target.value))}
          style={{ width: '100%', marginBottom: '16px' }}
        />

        {/* Starred only and Include new cards in the same row */}
        <div className="session-options-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
          <label className="checkbox-row" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={includeNew}
              onChange={(event) => setIncludeNew(event.target.checked)}
            />
            <span>Include new cards</span>
          </label>

          <label className="checkbox-row" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={starredOnly}
              onChange={(event) => setStarredOnly(event.target.checked)}
            />
            <span>⭐ Starred only</span>
          </label>
        </div>

        {error && <p className="error-message" role="alert">{error}</p>}

        <button
          className="primary-button session-start-button"
          onClick={() =>
            onStart({
              scopeNodeId,
              mode,
              amount,
              unit: 'cards',
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
