import type { TreeNode } from '../../types';

export function getDescendantIds(nodes: TreeNode[], nodeId: string): string[] {
  const descendants = new Set<string>([nodeId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.parentId && descendants.has(node.parentId) && !descendants.has(node.id)) {
        descendants.add(node.id);
        changed = true;
      }
    }
  }

  return [...descendants];
}

export function isValidParent(nodes: TreeNode[], nodeId: string, parentId: string | null): boolean {
  if (parentId === null) return true;
  if (!nodes.some((node) => node.id === parentId)) return false;
  return !getDescendantIds(nodes, nodeId).includes(parentId);
}

export function flattenTree(nodes: TreeNode[]): Array<{ node: TreeNode; depth: number }> {
  const flattened: Array<{ node: TreeNode; depth: number }> = [];
  const appendChildren = (parentId: string | null, depth: number) => {
    const children = nodes
      .filter((node) => node.parentId === parentId)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    for (const node of children) {
      flattened.push({ node, depth });
      appendChildren(node.id, depth + 1);
    }
  };
  appendChildren(null, 0);
  return flattened;
}
