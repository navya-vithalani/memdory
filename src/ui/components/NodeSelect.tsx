import { flattenTree } from '../../hooks/useTree';
import type { TreeNode } from '../../types';

type NodeSelectProps = {
  nodes: TreeNode[];
  value: string;
  onChange: (nodeId: string) => void;
  label: string;
};

export function NodeSelect({ nodes, value, onChange, label }: NodeSelectProps) {
  const flattened = flattenTree(nodes);
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {flattened.map(({ node, depth }) => (
          <option key={node.id} value={node.id}>
            {'　'.repeat(depth)}{node.name}
          </option>
        ))}
      </select>
    </label>
  );
}
