import { useEffect, useMemo, useState } from 'react';
import { flattenTree } from '../../hooks/useTree';
import { getDescendantIds } from '../../core/tree/tree';
import type { TreeNode } from '../../types';
import type { TreeActions } from '../../hooks/useTree';

type TreeManagerProps = {
  nodes: TreeNode[];
  actions: TreeActions;
  areaMastery?: Record<string, number>;
};

export function TreeManager({ nodes, actions, areaMastery = {} }: TreeManagerProps) {
  const [activeNodeId, setActiveNodeId] = useState('');
  const [createType, setCreateType] = useState<'area' | 'topic' | null>(null);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');
  const flattened = useMemo(() => flattenTree(nodes), [nodes]);
  const roots = nodes.filter((node) => node.parentId === null);
  const activeNode = nodes.find((node) => node.id === activeNodeId);
  const activeChildren = nodes
    .filter((node) => node.parentId === activeNodeId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  useEffect(() => {
    if (!nodes.some((node) => node.id === activeNodeId)) setActiveNodeId(roots[0]?.id ?? '');
  }, [activeNodeId, nodes, roots]);

  async function create() {
    const parentId = createType === 'topic' ? activeNodeId || null : null;
    try {
      await actions.create(name, parentId);
      setName('');
      setCreateType(null);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create this study area.');
    }
  }

  function startRename(node: TreeNode) {
    setEditingId(node.id);
    setEditName(node.name);
  }

  async function commitRename(nodeId: string) {
    try {
      await actions.rename(nodeId, editName);
      setEditingId('');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not rename this topic.');
    }
  }

  async function remove(node: TreeNode) {
    try {
      const counts = await actions.counts(node.id);
      const confirmed = window.confirm(
        `Remove "${node.name}" and everything inside it?\n\nThis permanently removes ${counts.nodes} area/topic(s), ${counts.notes} notes, ${counts.cards} cards, and their review history.`
      );
      if (!confirmed) return;
      await actions.remove(node.id);
      if (node.id === activeNodeId || flattened.some(({ node: descendant }) => descendant.parentId === node.id && descendant.id === activeNodeId)) {
        setActiveNodeId(node.parentId ?? roots.find((root) => root.id !== node.id)?.id ?? '');
      }
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not remove this topic.');
    }
  }

  function openCreate(type: 'area' | 'topic') {
    setCreateType(type);
    setName('');
  }

  return (
    <section className="stacked-panel tree-manager">
      <div className="tree-section-heading">
        <div><p className="eyebrow">Your learning map</p><h2>Study areas</h2></div>
        <button className="secondary-button add-area-button" onClick={() => openCreate('area')}><span aria-hidden="true">＋</span> New area</button>
      </div>
      {createType === 'area' && (
        <form className="inline-create-form" onSubmit={(event) => { event.preventDefault(); void create(); }}>
          <label className="field"><span>Give your new area a name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Biology" /></label>
          <button className="primary-button" disabled={!name.trim()}>Create</button>
          <button type="button" className="text-button" onClick={() => setCreateType(null)}>Cancel</button>
        </form>
      )}
      {roots.length ? (
        <>
          <div className="area-switcher" aria-label="Choose a study area">
            {roots.map((root, index) => {
              const childCount = nodes.filter((node) => node.parentId === root.id).length;
              return (
                <button key={root.id} className={`area-switcher-card${activeNodeId === root.id ? ' active' : ''}`} onClick={() => setActiveNodeId(root.id)}>
                  <span className={`area-emoji tone-${index % 4}`} aria-hidden="true">{['✿', '◈', '◆', '◎'][index % 4]}</span>
                  <strong>{root.name}</strong>
                  <small>{childCount} {childCount === 1 ? 'topic' : 'topics'}</small>
                  <span className="mini-ring area-switcher-mastery" style={{ ['--value' as string]: areaMastery[root.id] ?? 0 }} aria-label={`${areaMastery[root.id] ?? 0}% mastery`}>
                    <span>{areaMastery[root.id] ?? 0}%</span>
                  </span>
                  <span className="area-card-arrow" aria-hidden="true">→</span>
                </button>
              );
            })}
          </div>
          {activeNode && (
            <section className="topic-explorer" aria-label={`Topics in ${activeNode.name}`}>
              <div className="topic-explorer-heading">
                <div>
                  {activeNode.parentId && <button className="back-to-parent" onClick={() => setActiveNodeId(activeNode.parentId!)}>← {nodes.find((node) => node.id === activeNode.parentId)?.name}</button>}
                  <p className="eyebrow">{activeNode.parentId ? 'Inside this topic' : 'Pick a topic to explore'}</p>
                  {editingId === activeNode.id ? (
                    <div className="inline-rename">
                      <input aria-label="Rename area" value={editName} onChange={(event) => setEditName(event.target.value)} />
                      <button className="text-button" onClick={() => void commitRename(activeNode.id)}>Save</button>
                      <button className="text-button" onClick={() => setEditingId('')}>Cancel</button>
                    </div>
                  ) : <h3>{activeNode.name}</h3>}
                </div>
                <div className="topic-header-actions">
                  <button className="icon-button" aria-label={`Rename ${activeNode.name}`} onClick={() => startRename(activeNode)}>✎</button>
                  <button className="icon-button danger-button" aria-label={`Delete ${activeNode.name} and its contents`} onClick={() => void remove(activeNode)}>⌫</button>
                  <button className="primary-button add-topic-button" onClick={() => openCreate('topic')}><span aria-hidden="true">＋</span> Add topic</button>
                </div>
              </div>
              {createType === 'topic' && (
                <form className="inline-create-form topic-create-form" onSubmit={(event) => { event.preventDefault(); void create(); }}>
                  <label className="field"><span>New topic in {activeNode.name}</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Cell structure" /></label>
                  <button className="primary-button" disabled={!name.trim()}>Create</button>
                  <button type="button" className="text-button" onClick={() => setCreateType(null)}>Cancel</button>
                </form>
              )}
              {activeChildren.length ? (
                <div className="topic-list">
                  {activeChildren.map((topic, index) => {
                    const descendantCount = getDescendantIds(nodes, topic.id).length - 1;
                    return (
                      <article key={topic.id} className="topic-item">
                        {editingId === topic.id ? (
                          <div className="inline-rename topic-edit-inline">
                            <input aria-label={`Rename ${topic.name}`} value={editName} onChange={(event) => setEditName(event.target.value)} />
                            <button className="text-button" onClick={() => void commitRename(topic.id)}>Save</button>
                            <button className="text-button" onClick={() => setEditingId('')}>Cancel</button>
                          </div>
                        ) : (
                          <button className="topic-open" onClick={() => setActiveNodeId(topic.id)}>
                            <span className={`topic-bullet bullet-${index % 4}`} aria-hidden="true">{['✳', '◇', '◆', '○'][index % 4]}</span>
                            <span className="topic-title"><strong>{topic.name}</strong><small>{descendantCount} subtopics <span aria-hidden="true">·</span> open topic</small></span>
                            <span className="topic-arrow" aria-hidden="true">→</span>
                          </button>
                        )}
                        <div className="topic-item-actions">
                          <button className="icon-button" aria-label={`Rename ${topic.name}`} onClick={() => startRename(topic)}>✎</button>
                          <button className="icon-button danger-button" aria-label={`Delete ${topic.name} and its contents`} onClick={() => void remove(topic)}>⌫</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : <div className="topics-empty"><span aria-hidden="true">◆</span><p>No topics yet. Add one to start organizing notes and cards.</p><button className="secondary-button" onClick={() => openCreate('topic')}>Create first topic</button></div>}
            </section>
          )}
        </>
      ) : (
        <div className="topics-empty">
          <span aria-hidden="true">◆</span>
          <p>Every great plan starts somewhere. Create your first area and give your ideas a home.</p>
          <button className="primary-button" onClick={() => openCreate('area')}>Create a learning area</button>
        </div>
      )}
      {error && <p className="error-message" role="alert">{error}</p>}
    </section>
  );
}
