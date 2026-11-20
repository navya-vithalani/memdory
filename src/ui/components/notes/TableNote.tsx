import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

type TableNoteProps = {
  title?: string | null;
  body: string;
};

export function TableNote({ title, body }: TableNoteProps) {
  const [collapsedCols, setCollapsedCols] = useState<Set<number>>(new Set());
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);

  function toggleCol(colIndex: number) {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(colIndex)) next.delete(colIndex);
      else next.add(colIndex);
      return next;
    });
  }

  return (
    <div className="note-table-block">
      {title && <h4 className="note-card-title" style={{ marginBottom: '8px' }}>{title}</h4>}
      <div className="note-table-container">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            table: ({ children }) => <table>{children}</table>,
            tr: ({ children, ...props }) => {
              // Extract row index if available
              const key = props.node?.position?.start.line ?? 0;
              const isHighlighted = highlightedRow === key;
              return (
                <tr
                  onClick={() => setHighlightedRow(isHighlighted ? null : key)}
                  style={{
                    background: isHighlighted ? 'var(--indigo-tint)' : undefined,
                    cursor: 'pointer'
                  }}
                >
                  {children}
                </tr>
              );
            },
            th: ({ children, ...props }) => {
              const colIdx = props.node?.position?.start.column ?? 0;
              const isCollapsed = collapsedCols.has(colIdx);
              return (
                <th onClick={() => toggleCol(colIdx)} title="Tap to collapse/expand">
                  {isCollapsed ? '•••' : children}
                </th>
              );
            },
            td: ({ children, ...props }) => {
              const colIdx = props.node?.position?.start.column ?? 0;
              if (collapsedCols.has(colIdx)) {
                return <td>•</td>;
              }
              return <td>{children}</td>;
            }
          }}
        >
          {body}
        </ReactMarkdown>
      </div>
    </div>
  );
}
