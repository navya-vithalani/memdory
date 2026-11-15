import { useCallback, useEffect, useState } from 'react';
import {
  createNode,
  deleteNodeTree,
  getNodeTreeCounts,
  listNodes,
  moveNode,
  renameNode,
  reorderNode
} from '../data/repositories/treeRepository';
import { flattenTree, isValidParent } from '../core/tree/tree';
import type { TreeNode } from '../types';

export { flattenTree };

export function isValidTreeParent(nodes: TreeNode[], nodeId: string, parentId: string | null): boolean {
  return isValidParent(nodes, nodeId, parentId);
}

export type TreeActions = {
  create: (name: string, parentId: string | null) => Promise<void>;
  rename: (nodeId: string, name: string) => Promise<void>;
  move: (nodeId: string, parentId: string | null) => Promise<void>;
  reorder: (nodeId: string, direction: -1 | 1) => Promise<void>;
  counts: (nodeId: string) => Promise<{ nodes: number; notes: number; cards: number }>;
  remove: (nodeId: string) => Promise<void>;
};

export function useTree() {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const items = await listNodes();
    setNodes(items);
    setError('');
    setReady(true);
    return items;
  }, []);

  useEffect(() => {
    let active = true;
    void listNodes().then((items) => {
      if (active) {
        setNodes(items);
        setReady(true);
      }
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load the study tree.');
    });
    return () => {
      active = false;
    };
  }, []);

  const create = useCallback(async (name: string, parentId: string | null) => {
    await createNode(name, parentId);
    await refresh();
  }, [refresh]);

  const rename = useCallback(async (nodeId: string, name: string) => {
    await renameNode(nodeId, name);
    await refresh();
  }, [refresh]);

  const move = useCallback(async (nodeId: string, parentId: string | null) => {
    await moveNode(nodeId, parentId);
    await refresh();
  }, [refresh]);

  const reorder = useCallback(async (nodeId: string, direction: -1 | 1) => {
    await reorderNode(nodeId, direction);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (nodeId: string) => {
    await deleteNodeTree(nodeId);
    await refresh();
  }, [refresh]);

  const counts = useCallback(getNodeTreeCounts, []);
  const actions: TreeActions = { create, rename, move, reorder, counts, remove };
  return { nodes, error, ready, refresh, actions };
}
