import { useEffect, useMemo, useState } from 'react';
import { useTree } from '../../hooks/useTree';
import { db } from '../../data/db';
import { getRecallProbability } from '../../core/scheduler/reviewCard';
import { getDescendantIds } from '../../core/tree/tree';
import { updateCardRecord, deleteCardRecord, createCard } from '../../data/repositories/cardRepository';
import type { CardRecord, TagRecord, TreeNode } from '../../types';
import { RichText } from '../components/RichText';
import { StatCard } from '../components/StatCard';

export function BrowseScreen() {
  const { nodes } = useTree();
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [tags, setTags] = useState<Map<string, TagRecord>>(new Map());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<CardRecord | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [activeTab, setActiveTab] = useState<'map' | 'cards'>('map');

  // Form states for Edit / Add
  const [formFront, setFormFront] = useState('');
  const [formBack, setFormBack] = useState('');
  const [formExplanation, setFormExplanation] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formDirection, setFormDirection] = useState<'one-way' | 'both'>('one-way');
  const [formStarred, setFormStarred] = useState(false);
  const [formPaused, setFormPaused] = useState(false);
  const [formNodeId, setFormNodeId] = useState('');

  const now = Date.now();

  const loadData = async () => {
    const [allCards, allTags] = await Promise.all([
      db.cards.toArray(),
      db.tags.toArray()
    ]);
    setCards(allCards);
    setTags(new Map(allTags.map((t) => [t.id, t])));
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Compute family map: front -> count
  const familyCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cards) {
      const trimmed = c.front.trim().toLowerCase();
      map.set(trimmed, (map.get(trimmed) ?? 0) + 1);
    }
    return map;
  }, [cards]);

  // Overall stats
  const stats = useMemo(() => {
    let due = 0;
    let fading = 0;
    let traps = 0;
    for (const c of cards) {
      if (c.lastReview != null && (c.due ?? 0) <= now) due++;
      if (c.lastReview != null && getRecallProbability(c, now) < 0.8) fading++;
      if (c.trap || ((c.lapses ?? 0) > 0 && (c.reps ?? 0) > 0)) traps++;
    }
    return { total: cards.length, due, fading, traps };
  }, [cards, now]);

  // Node stats and mastery calculation
  const nodeStats = useMemo(() => {
    const map = new Map<string, { total: number; due: number; fading: number; mastery: number }>();
    for (const node of nodes) {
      const scope = new Set(getDescendantIds(nodes, node.id));
      const inScope = cards.filter((c) => scope.has(c.nodeId));
      let due = 0;
      let fading = 0;
      let recallSum = 0;
      let reviewedCount = 0;
      for (const c of inScope) {
        if (c.lastReview != null) {
          reviewedCount++;
          const rec = getRecallProbability(c, now);
          recallSum += rec;
          if ((c.due ?? 0) <= now) due++;
          if (rec < 0.8) fading++;
        }
      }
      const mastery = reviewedCount > 0 ? Math.round((recallSum / reviewedCount) * 100) : 0;
      map.set(node.id, { total: inScope.length, due, fading, mastery });
    }
    return map;
  }, [nodes, cards, now]);

  // Filtered cards based on selected scope, tag, and search query
  const filteredCards = useMemo(() => {
    let res = cards;
    if (selectedNodeId) {
      const scope = new Set(getDescendantIds(nodes, selectedNodeId));
      res = res.filter((c) => scope.has(c.nodeId));
    }
    if (selectedTagId) {
      res = res.filter((c) => c.tagIds?.includes(selectedTagId));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      res = res.filter((c) => c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q));
    }
    return res;
  }, [cards, selectedNodeId, selectedTagId, searchQuery, nodes]);

  // Tag filter options for current scope
  const scopeTags = useMemo(() => {
    let resCards = cards;
    if (selectedNodeId) {
      const scope = new Set(getDescendantIds(nodes, selectedNodeId));
      resCards = resCards.filter((c) => scope.has(c.nodeId));
    }
    const counts = new Map<string, number>();
    for (const c of resCards) {
      for (const tid of c.tagIds ?? []) {
        counts.set(tid, (counts.get(tid) ?? 0) + 1);
      }
    }
    return [...counts.entries()].map(([tid, count]) => ({
      id: tid,
      label: tags.get(tid)?.label ?? tags.get(tid)?.name ?? tid,
      count
    }));
  }, [cards, selectedNodeId, tags, nodes]);

  function handleStartEdit(card: CardRecord) {
    setEditingCard(card);
    setFormFront(card.front);
    setFormBack(card.back);
    setFormExplanation(card.explanation || '');
    setFormTags((card.tagIds ?? []).map((id) => tags.get(id)?.label ?? '').filter(Boolean).join(', '));
    setFormDirection(card.direction === 'both' ? 'both' : 'one-way');
    setFormStarred(Boolean(card.starred));
    setFormPaused(Boolean(card.paused));
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCard) return;
    const tagList = formTags.split(',').map((t) => t.trim()).filter(Boolean);
    await updateCardRecord(editingCard.id, {
      front: formFront,
      back: formBack,
      explanation: formExplanation || null,
      tags: tagList,
      direction: formDirection,
      starred: formStarred,
      paused: formPaused
    });
    setEditingCard(null);
    await loadData();
  }

  async function handleDelete(cardId: string) {
    if (!confirm('Are you sure you want to delete this card?')) return;
    await deleteCardRecord(cardId);
    await loadData();
  }

  function handleStartAdd() {
    setFormFront('');
    setFormBack('');
    setFormExplanation('');
    setFormTags('');
    setFormDirection('one-way');
    setFormStarred(false);
    setFormNodeId(selectedNodeId || nodes[0]?.id || '');
    setShowAddModal(true);
  }

  async function handleSaveAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!formFront.trim() || !formBack.trim() || !formNodeId) return;
    const tagList = formTags.split(',').map((t) => t.trim()).filter(Boolean);
    await createCard(formNodeId, formFront, formBack, {
      explanation: formExplanation || null,
      tags: tagList,
      direction: formDirection,
      starred: formStarred
    });
    setShowAddModal(false);
    await loadData();
  }

  return (
    <main className="screen browse-screen" style={{ padding: '16px' }}>
      {/* 6.1 Top Stat Strip */}
      <section className="stats-grid">
        <StatCard label="Total" value={`${stats.total}`} tone="indigo" />
        <StatCard label="Due" value={`${stats.due}`} tone="orange" />
        <StatCard label="Fading" value={`${stats.fading}`} tone="mint" />
        <StatCard label="Traps" value={`${stats.traps}`} tone="orange" />
      </section>

      {/* Switch between Map View and Card List */}
      <div style={{ display: 'flex', gap: '8px', margin: '16px 0 14px' }}>
        <button
          type="button"
          className={activeTab === 'map' ? 'primary-button' : 'secondary-button'}
          style={{ flex: 1, minHeight: '38px', fontSize: '13px' }}
          onClick={() => setActiveTab('map')}
        >
          Learning Map
        </button>
        <button
          type="button"
          className={activeTab === 'cards' ? 'primary-button' : 'secondary-button'}
          style={{ flex: 1, minHeight: '38px', fontSize: '13px' }}
          onClick={() => setActiveTab('cards')}
        >
          All Cards ({filteredCards.length})
        </button>
      </div>

      {activeTab === 'map' ? (
        /* Learning Map / Tree explorer with mastery bars */
        <section className="stacked-panel" style={{ padding: '16px', borderRadius: 'var(--radius-large)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--navy)' }}>
              Study Map & Topic Mastery
            </h2>
            <button
              type="button"
              className="primary-button"
              style={{ fontSize: '12px', padding: '6px 12px', minHeight: '34px' }}
              onClick={handleStartAdd}
            >
              ＋ Add card
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {nodes.map((node) => {
              const ns = nodeStats.get(node.id) ?? { total: 0, due: 0, fading: 0, mastery: 0 };
              const isSelected = selectedNodeId === node.id;
              const indent = node.parentId ? 20 : 0;
              return (
                <div
                  key={node.id}
                  style={{
                    marginLeft: `${indent}px`,
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-card)',
                    border: '1px solid var(--line)',
                    background: isSelected ? 'var(--indigo-tint)' : 'var(--surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transition: 'border-color 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '15px', color: 'var(--ink)' }}>{node.name}</strong>
                      <span style={{ fontSize: '12px', color: 'var(--ink-soft)', marginLeft: '8px' }}>
                        {ns.total} {ns.total === 1 ? 'card' : 'cards'} · {ns.due} due · {ns.fading} fading
                      </span>
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      style={{ fontSize: '12px', fontWeight: 800, color: 'var(--indigo)', padding: '2px 8px' }}
                      onClick={() => {
                        setSelectedNodeId(node.id);
                        setActiveTab('cards');
                      }}
                    >
                      View cards →
                    </button>
                  </div>

                  {/* Mastery Progress Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, height: '8px', borderRadius: '999px', background: 'var(--line)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${ns.mastery}%`,
                          height: '100%',
                          background: ns.mastery >= 85 ? 'var(--easy)' : ns.mastery >= 60 ? 'var(--indigo)' : 'var(--orange)',
                          borderRadius: 'inherit',
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>
                    <strong style={{ fontSize: '12px', color: 'var(--navy)', width: '36px', textAlign: 'right' }}>
                      {ns.mastery}%
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        /* Card Browser list with search, tags, inline edit */
        <section className="stacked-panel" style={{ padding: '16px', borderRadius: 'var(--radius-large)' }}>
          {/* Top search & Add Button */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
            <input
              type="text"
              placeholder="Search cards…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', borderRadius: '12px', border: '1px solid var(--line)', fontSize: '14px' }}
            />
            <button
              type="button"
              className="primary-button"
              style={{ fontSize: '12px', padding: '0 14px', minHeight: '38px', whiteSpace: 'nowrap' }}
              onClick={handleStartAdd}
            >
              ＋ Add
            </button>
          </div>

          {/* Node Scope Filter Breadcrumb */}
          {selectedNodeId && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', padding: '6px 12px', borderRadius: '8px', background: 'var(--indigo-tint)', fontSize: '12px', fontWeight: 700, color: 'var(--indigo)' }}>
              <span>Filtered by: {nodes.find((n) => n.id === selectedNodeId)?.name}</span>
              <button type="button" className="text-button" style={{ fontSize: '12px', padding: '0 4px' }} onClick={() => setSelectedNodeId(null)}>
                Clear topic filter ✕
              </button>
            </div>
          )}

          {/* Tag Filter Chips */}
          {scopeTags.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '12px' }}>
              <button
                type="button"
                className={`tag-chip${selectedTagId === null ? ' active' : ''}`}
                style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  border: '1px solid var(--line)',
                  background: selectedTagId === null ? 'var(--indigo)' : 'var(--surface)',
                  color: selectedTagId === null ? '#fff' : 'var(--ink)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
                onClick={() => setSelectedTagId(null)}
              >
                All tags
              </button>
              {scopeTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    border: '1px solid var(--line)',
                    background: selectedTagId === tag.id ? 'var(--indigo)' : 'var(--surface)',
                    color: selectedTagId === tag.id ? '#fff' : 'var(--ink)',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                  onClick={() => setSelectedTagId(selectedTagId === tag.id ? null : tag.id)}
                >
                  #{tag.label} ({tag.count})
                </button>
              ))}
            </div>
          )}

          {/* Cards List */}
          {filteredCards.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>No flashcards found matching your filters.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredCards.slice(0, pageSize).map((card) => {
                const isExpanded = expandedCardId === card.id;
                const familyCount = familyCountMap.get(card.front.trim().toLowerCase()) ?? 1;
                const firstTag = card.tagIds?.[0] ? tags.get(card.tagIds[0]) : null;
                const extraTags = (card.tagIds ?? []).slice(1).map((id) => tags.get(id)).filter(Boolean) as TagRecord[];

                return (
                  <div
                    key={card.id}
                    style={{
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--radius-card)',
                      background: 'var(--surface)',
                      padding: '14px',
                      cursor: 'pointer',
                      boxShadow: 'var(--shadow-card)'
                    }}
                    onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
                  >
                    {/* Header line: label chip, badges */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {firstTag && (
                          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--indigo)', background: 'var(--indigo-tint)', padding: '2px 8px', borderRadius: '999px' }}>
                            {firstTag.label}
                          </span>
                        )}
                        {card.direction === 'both' && (
                          <span title="Two-way card" style={{ fontSize: '12px', fontWeight: 800, color: 'var(--medium)', background: '#eff6ff', padding: '1px 6px', borderRadius: '6px' }}>
                            ↔ 2-way
                          </span>
                        )}
                        {familyCount > 1 && (
                          <span title={`${familyCount} cards share this question`} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink-soft)' }}>
                            Family ({familyCount})
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {card.starred && <span title="Starred">⭐</span>}
                        {card.paused && <span style={{ fontSize: '11px', color: 'var(--wrong)', fontWeight: 700 }}>Paused</span>}
                      </div>
                    </div>

                    {/* Question (Front) */}
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>
                      <RichText text={card.front} />
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--line)' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ fontSize: '14px', color: 'var(--ink)', marginBottom: '8px' }}>
                          <strong style={{ display: 'block', fontSize: '11px', color: 'var(--ink-soft)', marginBottom: '2px' }}>ANSWER</strong>
                          <RichText text={card.back} />
                        </div>

                        {card.explanation && (
                          <div style={{ fontSize: '13px', color: 'var(--ink-soft)', marginBottom: '10px', fontStyle: 'italic' }}>
                            <strong style={{ display: 'block', fontSize: '11px', fontStyle: 'normal' }}>EXPLANATION</strong>
                            <RichText text={card.explanation} />
                          </div>
                        )}

                        {/* Luggage tags UI with thin string (Phase 7.3) */}
                        {extraTags.length > 0 && (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '8px 0 12px' }}>
                            {extraTags.map((t) => (
                              <span key={t.id} className="luggage-tag">
                                {t.label}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Inline Edit & Delete Actions */}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                          <button
                            type="button"
                            className="secondary-button"
                            style={{ flex: 1, minHeight: '34px', fontSize: '12px', fontWeight: 700 }}
                            onClick={() => handleStartEdit(card)}
                          >
                            ✎ Edit
                          </button>
                          <button
                            type="button"
                            className="text-button"
                            style={{ minHeight: '34px', color: 'var(--wrong)', fontWeight: 800, padding: '0 12px' }}
                            onClick={() => void handleDelete(card.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredCards.length > pageSize && (
                <button
                  type="button"
                  className="secondary-button"
                  style={{ marginTop: '10px', minHeight: '40px', fontWeight: 800 }}
                  onClick={() => setPageSize((s) => s + 50)}
                >
                  Load more cards ({filteredCards.length - pageSize} remaining)
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* Edit Modal */}
      {editingCard && (
        <div className="import-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditingCard(null); }}>
          <form className="import-modal-sheet" onSubmit={handleSaveEdit}>
            <div className="import-modal-header">
              <h3>Edit Flashcard</h3>
              <button type="button" className="modal-close" onClick={() => setEditingCard(null)}>✕</button>
            </div>
            <label className="field">
              <span>Question (Front)</span>
              <textarea value={formFront} onChange={(e) => setFormFront(e.target.value)} rows={2} required />
            </label>
            <label className="field">
              <span>Answer (Back)</span>
              <textarea value={formBack} onChange={(e) => setFormBack(e.target.value)} rows={2} required />
            </label>
            <label className="field">
              <span>Explanation (Optional)</span>
              <textarea value={formExplanation} onChange={(e) => setFormExplanation(e.target.value)} rows={2} />
            </label>
            <label className="field">
              <span>Tags (comma-separated, first is label)</span>
              <input type="text" value={formTags} onChange={(e) => setFormTags(e.target.value)} />
            </label>
            <div style={{ display: 'flex', gap: '16px', margin: '10px 0 16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formDirection === 'both'}
                  onChange={(e) => setFormDirection(e.target.checked ? 'both' : 'one-way')}
                />
                Two-way card
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                <input type="checkbox" checked={formStarred} onChange={(e) => setFormStarred(e.target.checked)} />
                ⭐ Starred
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                <input type="checkbox" checked={formPaused} onChange={(e) => setFormPaused(e.target.checked)} />
                Paused
              </label>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="secondary-button" style={{ flex: 1 }} onClick={() => setEditingCard(null)}>Cancel</button>
              <button type="submit" className="primary-button" style={{ flex: 1 }}>Save Changes</button>
            </div>
          </form>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="import-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <form className="import-modal-sheet" onSubmit={handleSaveAdd}>
            <div className="import-modal-header">
              <h3>Create Flashcard</h3>
              <button type="button" className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <label className="field">
              <span>Study Topic</span>
              <select value={formNodeId} onChange={(e) => setFormNodeId(e.target.value)}>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Question (Front)</span>
              <textarea value={formFront} onChange={(e) => setFormFront(e.target.value)} rows={2} required />
            </label>
            <label className="field">
              <span>Answer (Back)</span>
              <textarea value={formBack} onChange={(e) => setFormBack(e.target.value)} rows={2} required />
            </label>
            <label className="field">
              <span>Explanation (Optional)</span>
              <textarea value={formExplanation} onChange={(e) => setFormExplanation(e.target.value)} rows={2} />
            </label>
            <label className="field">
              <span>Tags (comma-separated, first is label)</span>
              <input type="text" value={formTags} onChange={(e) => setFormTags(e.target.value)} />
            </label>
            <div style={{ display: 'flex', gap: '16px', margin: '10px 0 16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formDirection === 'both'}
                  onChange={(e) => setFormDirection(e.target.checked ? 'both' : 'one-way')}
                />
                Two-way card
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                <input type="checkbox" checked={formStarred} onChange={(e) => setFormStarred(e.target.checked)} />
                ⭐ Starred
              </label>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="secondary-button" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>Cancel</button>
              <button type="submit" className="primary-button" style={{ flex: 1 }}>Create Card</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
