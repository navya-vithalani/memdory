import { db } from '../db';
import { getDescendantIds, isValidParent } from '../../core/tree/tree';
import type { TreeNode } from '../../types';

export async function listNodes(): Promise<TreeNode[]> {
  const nodes = await db.nodes.toArray();
  return nodes.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export async function createNode(name: string, parentId: string | null): Promise<TreeNode> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Node name cannot be empty.');
  const nodes = await db.nodes.toArray();
  if (parentId !== null && !nodes.some((node) => node.id === parentId)) {
    throw new Error('The selected parent node no longer exists.');
  }
  const siblings = nodes.filter((node) => node.parentId === parentId);
  const node: TreeNode = {
    id: crypto.randomUUID(),
    parentId,
    name: cleanName,
    order: siblings.length,
    createdAt: Date.now()
  };
  await db.nodes.add(node);
  return node;
}

export async function renameNode(nodeId: string, name: string): Promise<void> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Node name cannot be empty.');
  const node = await db.nodes.get(nodeId);
  if (!node) throw new Error('Node not found.');
  await db.nodes.put({ ...node, name: cleanName });
}

export async function moveNode(nodeId: string, parentId: string | null): Promise<void> {
  const nodes = await db.nodes.toArray();
  const node = nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new Error('Node not found.');
  if (!isValidParent(nodes, nodeId, parentId)) throw new Error('A node cannot be moved inside itself or one of its descendants.');
  const siblings = nodes
    .filter((candidate) => candidate.parentId === parentId && candidate.id !== nodeId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  await db.transaction('rw', db.nodes, async () => {
    await db.nodes.put({ ...node, parentId, order: siblings.length });
    await db.nodes.bulkPut(siblings.map((sibling, index) => ({ ...sibling, order: index })));
  });
}

export async function reorderNode(nodeId: string, direction: -1 | 1): Promise<void> {
  const nodes = await db.nodes.toArray();
  const node = nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new Error('Node not found.');
  const siblings = nodes
    .filter((candidate) => candidate.parentId === node.parentId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const index = siblings.findIndex((candidate) => candidate.id === nodeId);
  const target = siblings[index + direction];
  if (!target) return;
  await db.transaction('rw', db.nodes, async () => {
    await db.nodes.put({ ...node, order: target.order });
    await db.nodes.put({ ...target, order: node.order });
  });
}

export async function getNodeTreeCounts(nodeId: string): Promise<{ nodes: number; notes: number; cards: number }> {
  const nodes = await db.nodes.toArray();
  if (!nodes.some((node) => node.id === nodeId)) throw new Error('Node not found.');
  const nodeIds = getDescendantIds(nodes, nodeId);
  const [notes, cards] = await Promise.all([
    db.notes.where('nodeId').anyOf(nodeIds).count(),
    db.cards.where('nodeId').anyOf(nodeIds).count()
  ]);
  return { nodes: nodeIds.length, notes, cards };
}

export async function deleteNodeTree(nodeId: string): Promise<{ nodes: number; notes: number; cards: number }> {
  const nodes = await db.nodes.toArray();
  if (!nodes.some((node) => node.id === nodeId)) throw new Error('Node not found.');
  const nodeIds = getDescendantIds(nodes, nodeId);
  return db.transaction('rw', db.nodes, db.notes, db.cards, db.reviews, async () => {
    const [notes, cards] = await Promise.all([
      db.notes.where('nodeId').anyOf(nodeIds).count(),
      db.cards.where('nodeId').anyOf(nodeIds).toArray()
    ]);
    const cardIds = cards.map((card) => card.id);
    if (cardIds.length) await db.reviews.where('cardId').anyOf(cardIds).delete();
    await db.notes.where('nodeId').anyOf(nodeIds).delete();
    await db.cards.where('nodeId').anyOf(nodeIds).delete();
    await db.nodes.bulkDelete(nodeIds);
    const parentId = nodes.find((node) => node.id === nodeId)?.parentId ?? null;
    const siblings = (await db.nodes.toArray()).filter((node) => node.parentId === parentId);
    await db.nodes.bulkPut(
      siblings
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
        .map((sibling, index) => ({ ...sibling, order: index }))
    );
    return { nodes: nodeIds.length, notes, cards: cards.length };
  });
}
