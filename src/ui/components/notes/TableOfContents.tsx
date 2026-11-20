import type { NoteRecord, TagRecord } from '../../../types';

type TableOfContentsProps = {
  notes: NoteRecord[];
  allTags: TagRecord[];
  activeType: string | null;
  onTypeFilter: (type: string | null) => void;
  starredFilter: boolean;
  onStarredFilter: (val: boolean) => void;
  activeTagId: string | null;
  onTagFilter: (tagId: string | null) => void;
  onSelectNote: (noteId: string) => void;
};

const NOTE_TYPES = ['normal', 'concept', 'formula', 'mnemonic', 'trick', 'table'] as const;

export function TableOfContents({
  notes,
  allTags,
  activeType,
  onTypeFilter,
  starredFilter,
  onStarredFilter,
  activeTagId,
  onTagFilter,
  onSelectNote
}: TableOfContentsProps) {
  // Generate label for untitled notes
  const typeCounts: Record<string, number> = {};
  const noteLabels = notes.map((note) => {
    const type = note.type || 'normal';
    typeCounts[type] = (typeCounts[type] ?? 0) + 1;
    let label = note.title?.trim();
    if (!label) {
      const typeCap = type.charAt(0).toUpperCase() + type.slice(1);
      label = `${typeCap} ${typeCounts[type]}`;
    }
    return { id: note.id, label };
  });

  return (
    <div className="notes-toc-container">
      {/* 5.5 Top chip bar listing notes */}
      {notes.length > 0 && (
        <div className="notes-toc-bar" role="navigation" aria-label="Table of contents">
          {noteLabels.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className="notes-toc-chip"
              onClick={() => onSelectNote(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Filter strip: Type chips, Starred, Tag chips */}
      <div className="notes-filters-row">
        <button
          type="button"
          className={`notes-filter-pill${activeType === null && !starredFilter && activeTagId === null ? ' active' : ''}`}
          onClick={() => {
            onTypeFilter(null);
            onStarredFilter(false);
            onTagFilter(null);
          }}
        >
          All
        </button>

        <button
          type="button"
          className={`notes-filter-pill${starredFilter ? ' active' : ''}`}
          onClick={() => onStarredFilter(!starredFilter)}
        >
          ★ Starred
        </button>

        {NOTE_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className={`notes-filter-pill${activeType === type ? ' active' : ''}`}
            onClick={() => onTypeFilter(activeType === type ? null : type)}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}

        {allTags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className={`notes-filter-pill${activeTagId === tag.id ? ' active' : ''}`}
            onClick={() => onTagFilter(activeTagId === tag.id ? null : tag.id)}
          >
            #{tag.label || tag.name}
          </button>
        ))}
      </div>
    </div>
  );
}
