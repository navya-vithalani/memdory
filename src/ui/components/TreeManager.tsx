import { useState } from 'react';
import { flattenTree, isValidParent } from '../../core/tree/tree';
import type { TreeNode } from '../../types';
import {
  createNode,
  deleteNodeTree,
  getNodeTreeCounts,
  listNodes,
  moveNode,
  renameNode,
  reorderNode
} from '../../data/repositories/treeRepository';

type TreeManagerProps = {
  nodes: TreeNode[];
  onChange: (nodes: TreeNode[]) => void;
};

export function TreeManager({ nodes, onChange }: TreeManagerProps) {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    onChange(await listNodes());
  }

  async function create() {
    try {
      await createNode(name, parentId || null);
      setName('');
      setError('');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the tree node.');
    }
  }

  async function rename(node: TreeNode) {
    const nextName = window.prompt('Rename node', node.name);
    if (nextName === null) return;
    try {
      await renameNode(node.id, nextName);
      setError('');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not rename the tree node.');
    }
  }

  async function move(node: TreeNode, nextParentId: string) {
    try {
      await moveNode(node.id, nextParentId || null);
      setError('');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not move the tree node.');
    }
  }

  async function remove(node: TreeNode) {
    try {
      const counts = await getNodeTreeCounts(node.id);
      const confirmed = window.confirm(
        `Delete "${node.name}" and its ${counts.nodes - 1} descendant node(s)? This will also delete ${counts.notes} notes and ${counts.cards} cards.`
      );
      if (!confirmed) return;
      await deleteNodeTree(node.id);
      setError('');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete the tree node.');
    }
  }

  async function reorder(nodeId: string, direction: -1 | 1) {
    try {
      await reorderNode(nodeId, direction);
      setError('');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not reorder the tree node.');
    }
  }

  const flattened = flattenTree(nodes);
  return (
    <section className="stacked-panel tree-manager">
      <h2>Study tree</h2>
      <p className="muted">{nodes.length === 0 ? 'Create your first area to start organizing notes and cards.' : 'Organize your subjects and decks.'}</p>
      <div className="form-row">
        <label className="field">
          <span>New node name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Chemistry" />
        </label>
        <label className="field">
          <span>Parent</span>
          <select value={parentId} onChange={(event) => setParentId(event.target.value)}>
            <option value="">Root area</option>
            {flattened.map(({ node, depth }) => (
              <option key={node.id} value={node.id}>{'　'.repeat(depth)}{node.name}</option>
            ))}
          </select>
        </label>
        <button className="primary-button" onClick={() => void create()} disabled={!name.trim()}>Add</button>
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      {flattened.length === 0 ? (
        <p className="empty-message">Your tree starts empty. Add a root area above.</p>
      ) : (
        <ul className="tree-list">
          {flattened.map(({ node, depth }, index) => {
            const possibleParents = nodes.filter((candidate) => isValidParent(nodes, node.id, candidate.id));
            const siblings = flattened.filter((item) => item.node.parentId === node.parentId);
            const siblingIndex = siblings.findIndex((item) => item.node.id === node.id);
            return (
              <li className="tree-row" key={node.id} style={{ ['--depth' as string]: depth }}>
                <strong>{node.name}</strong>
                <div className="tree-actions">
                  <label className="visually-hidden" htmlFor={`move-${node.id}`}>Move {node.name}</label>
                  <select id={`move-${node.id}`} value={node.parentId ?? ''} onChange={(event) => void move(node, event.target.value)}>
                    <option value="">Root area</option>
                    {possibleParents.map((parent) => <option key={parent.id} value={parent.id}>{parent.name}</option>)}
                  </select>
                  <button className="icon-button" aria-label={`Move ${node.name} up`} disabled={siblingIndex === 0} onClick={() => void reorder(node.id, -1)}>↑</button>
                  <button className="icon-button" aria-label={`Move ${node.name} down`} disabled={siblingIndex === siblings.length - 1} onClick={() => void reorder(node.id, 1)}>↓</button>
                  <button className="text-button" onClick={() => void rename(node)}>Rename</button>
                  <button className="text-button danger-button" onClick={() => void remove(node)}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
