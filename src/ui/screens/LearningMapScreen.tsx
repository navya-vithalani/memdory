import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTree } from '../../hooks/useTree';
import { db } from '../../data/db';
import { getRecallProbability } from '../../core/scheduler/reviewCard';
import { getDescendantIds } from '../../core/tree/tree';
import type { CardRecord, NoteRecord, TreeNode } from '../../types';
import { StatCard } from '../components/StatCard';

type TopicStats = {
  directCards: number;
  totalCards: number;
  directNotes: number;
  totalNotes: number;
  masteryPct: number;
  dueCards: number;
  fadingCards: number;
};

export function LearningMapScreen() {
  const navigate = useNavigate();
  const { nodes, error: treeError } = useTree();
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  const now = Date.now();

  useEffect(() => {
    let active = true;
    void Promise.all([db.cards.toArray(), db.notes.toArray()]).then(([allCards, allNotes]) => {
      if (!active) return;
      setCards(allCards);
      setNotes(allNotes);
    });
    return () => {
      active = false;
    };
  }, []);

  // Compute stats for each topic node (including direct and descendant stats)
  const nodeStatsMap = useMemo(() => {
    const map = new Map<string, TopicStats>();

    const cardsByNode = new Map<string, CardRecord[]>();
    for (const c of cards) {
      const list = cardsByNode.get(c.nodeId) ?? [];
      list.push(c);
      cardsByNode.set(c.nodeId, list);
    }

    const notesByNode = new Map<string, NoteRecord[]>();
    for (const n of notes) {
      const list = notesByNode.get(n.nodeId) ?? [];
      list.push(n);
      notesByNode.set(n.nodeId, list);
    }

    for (const node of nodes) {
      const descendantIds = new Set(getDescendantIds(nodes, node.id));
      const inScopeCards = cards.filter((c) => descendantIds.has(c.nodeId));
      const inScopeNotes = notes.filter((n) => descendantIds.has(n.nodeId));
      const directCards = cardsByNode.get(node.id)?.length ?? 0;
      const directNotes = notesByNode.get(node.id)?.length ?? 0;

      let due = 0;
      let fading = 0;
      let recallSum = 0;
      let reviewedCount = 0;

      for (const c of inScopeCards) {
        if (c.lastReview != null) {
          reviewedCount++;
          const rec = getRecallProbability(c, now);
          recallSum += rec;
          if ((c.due ?? 0) <= now) due++;
          if (rec < 0.8) fading++;
        }
      }

      const masteryPct = reviewedCount > 0 ? Math.round((recallSum / reviewedCount) * 100) : 0;

      map.set(node.id, {
        directCards,
        totalCards: inScopeCards.length,
        directNotes,
        totalNotes: inScopeNotes.length,
        masteryPct,
        dueCards: due,
        fadingCards: fading
      });
    }

    return map;
  }, [nodes, cards, notes, now]);

  // Overall totals
  const overallStats = useMemo(() => {
    const totalTopics = nodes.length;
    const totalCards = cards.length;
    const totalNotes = notes.length;
    let reviewedCount = 0;
    let recallSum = 0;
    for (const c of cards) {
      if (c.lastReview != null) {
        reviewedCount++;
        recallSum += getRecallProbability(c, now);
      }
    }
    const avgRecall = reviewedCount > 0 ? Math.round((recallSum / reviewedCount) * 100) : 0;
    return { totalTopics, totalCards, totalNotes, avgRecall };
  }, [nodes, cards, notes, now]);

  // Group child nodes by parentId
  const childrenMap = useMemo(() => {
    const map = new Map<string | null, TreeNode[]>();
    for (const node of nodes) {
      const list = map.get(node.parentId) ?? [];
      list.push(node);
      map.set(node.parentId, list);
    }
    // Sort children by order
    for (const list of map.values()) {
      list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    }
    return map;
  }, [nodes]);

  const rootNodes = useMemo(() => childrenMap.get(null) ?? [], [childrenMap]);

  function toggleCollapse(nodeId: string) {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  // Render a node and recursively its subtopic branches (mindmap tree)
  const renderTopicBranch = (node: TreeNode, depth = 0) => {
    const stats = nodeStatsMap.get(node.id) ?? {
      directCards: 0,
      totalCards: 0,
      directNotes: 0,
      totalNotes: 0,
      masteryPct: 0,
      dueCards: 0,
      fadingCards: 0
    };

    const children = childrenMap.get(node.id) ?? [];
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedNodes.has(node.id);

    // If searching, check if node or any descendant matches
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const descendantIds = new Set(getDescendantIds(nodes, node.id));
      const anyMatch = nodes.some((n) => descendantIds.has(n.id) && n.name.toLowerCase().includes(q));
      if (!anyMatch) return null;
    }

    const recallColor =
      stats.masteryPct >= 85 ? 'var(--easy)' : stats.masteryPct >= 60 ? 'var(--indigo)' : stats.totalCards > 0 ? 'var(--orange)' : 'var(--ink-soft)';

    return (
      <div
        key={node.id}
        className="mindmap-node-wrapper"
        style={{
          position: 'relative',
          paddingLeft: depth > 0 ? '24px' : '0',
          marginTop: depth > 0 ? '10px' : '16px'
        }}
      >
        {/* Mindmap connection line */}
        {depth > 0 && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '8px',
              top: '-10px',
              bottom: hasChildren && !isCollapsed ? '0' : '50%',
              width: '16px',
              borderLeft: '2px solid var(--line)',
              borderBottom: '2px solid var(--line)',
              borderBottomLeftRadius: '10px',
              pointerEvents: 'none'
            }}
          />
        )}

        <div
          className="mindmap-card"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            padding: '14px 16px',
            boxShadow: '0 4px 16px var(--shadow-soft)',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
        >
          {/* Header Row: Title, Collapse button, and Mastery Badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              {hasChildren ? (
                <button
                  type="button"
                  className="text-button"
                  style={{
                    fontSize: '14px',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '6px',
                    background: 'var(--indigo-tint)',
                    color: 'var(--indigo)'
                  }}
                  onClick={() => toggleCollapse(node.id)}
                  aria-label={isCollapsed ? 'Expand subtopics' : 'Collapse subtopics'}
                >
                  {isCollapsed ? '▸' : '▾'}
                </button>
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--indigo)', opacity: 0.7 }}>◆</span>
              )}
              <h3 style={{ margin: 0, fontSize: depth === 0 ? '16px' : '14px', fontWeight: 800, color: 'var(--navy)' }}>
                {node.name}
              </h3>
            </div>

            {/* Recall Percent Badge */}
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '999px',
                background: stats.totalCards > 0 ? `${recallColor}18` : 'var(--line)',
                color: recallColor,
                flexShrink: 0
              }}
            >
              {stats.totalCards > 0 ? `${stats.masteryPct}% recall` : 'No cards'}
            </span>
          </div>

          {/* Counts and Metrics Row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>
              🗂️ {stats.totalCards} {stats.totalCards === 1 ? 'card' : 'cards'}
              {stats.dueCards > 0 && <small style={{ color: 'var(--orange)', marginLeft: '4px' }}>({stats.dueCards} due)</small>}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>
              📝 {stats.totalNotes} {stats.totalNotes === 1 ? 'note' : 'notes'}
            </span>
            {hasChildren && (
              <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
                🌱 {children.length} {children.length === 1 ? 'subtopic' : 'subtopics'}
              </span>
            )}
          </div>

          {/* Mastery Progress Bar */}
          <div style={{ width: '100%', height: '6px', borderRadius: '999px', background: 'var(--line)', overflow: 'hidden', marginBottom: '10px' }}>
            <div
              style={{
                width: `${stats.masteryPct}%`,
                height: '100%',
                background: recallColor,
                borderRadius: 'inherit',
                transition: 'width 0.3s ease'
              }}
            />
          </div>

          {/* Actions: Browse Cards / View Notes */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button
              type="button"
              className="secondary-button"
              style={{ fontSize: '12px', padding: '4px 10px', minHeight: '30px' }}
              onClick={() => navigate(`/cards/browse?topic=${encodeURIComponent(node.id)}`)}
            >
              Cards →
            </button>
            <button
              type="button"
              className="secondary-button"
              style={{ fontSize: '12px', padding: '4px 10px', minHeight: '30px' }}
              onClick={() => navigate(`/notes?topic=${encodeURIComponent(node.id)}`)}
            >
              Notes →
            </button>
          </div>
        </div>

        {/* Render child subtopic branches */}
        {hasChildren && !isCollapsed && (
          <div className="mindmap-children" style={{ position: 'relative' }}>
            {children.map((child) => renderTopicBranch(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="screen learning-map-screen" style={{ padding: '16px' }}>
      {/* Top Stat Strip */}
      <section className="stats-grid" style={{ marginBottom: '16px' }}>
        <StatCard label="Topics" value={`${overallStats.totalTopics}`} tone="indigo" />
        <StatCard label="Cards" value={`${overallStats.totalCards}`} tone="orange" />
        <StatCard label="Notes" value={`${overallStats.totalNotes}`} tone="mint" />
        <StatCard label="Avg Recall" value={`${overallStats.avgRecall}%`} tone="indigo" />
      </section>

      {/* Search Input */}
      <div style={{ marginBottom: '14px' }}>
        <input
          type="search"
          placeholder="Search topics and subtopics…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '12px',
            border: '1px solid var(--line)',
            background: 'var(--surface)',
            color: 'var(--ink)',
            fontSize: '14px',
            boxShadow: '0 2px 8px var(--shadow-soft)'
          }}
        />
      </div>

      {/* Mindmap Hierarchy Tree */}
      <section className="stacked-panel" style={{ padding: '16px', borderRadius: 'var(--radius-large)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--navy)' }}>
              Knowledge Map
            </h2>
            <small style={{ color: 'var(--ink-soft)' }}>Hierarchical map of all study topics, notes, and retention</small>
          </div>
          <button
            type="button"
            className="text-button"
            style={{ fontSize: '12px', fontWeight: 800, color: 'var(--indigo)' }}
            onClick={() => {
              if (collapsedNodes.size > 0) setCollapsedNodes(new Set());
              else setCollapsedNodes(new Set(nodes.map((n) => n.id)));
            }}
          >
            {collapsedNodes.size > 0 ? 'Expand all' : 'Collapse all'}
          </button>
        </div>

        {nodes.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: '30px 0' }}>
            No topics created yet. Add topics on the Home screen or import study files to see your learning map.
          </p>
        ) : (
          <div className="mindmap-root-container">
            {rootNodes.map((root) => renderTopicBranch(root, 0))}
          </div>
        )}
      </section>
    </main>
  );
}
