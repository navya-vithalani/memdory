export type ParsedCardItem = {
  front: string;
  back: string;
  explanation: string | null;
  tags: string[]; // first tag is label
  direction: 'one-way' | 'both';
  starred: boolean;
  sourceKey: string | null;
  nodePath: string[]; // path segments e.g. ['JEE', 'Chemistry']
  line: number;
};

export type ParsedNoteItem = {
  title: string | null;
  type: string;
  body: string;
  data: Record<string, unknown> | null;
  color: string | null;
  starred: boolean;
  tags: string[];
  sourceKey: string | null;
  nodePath: string[];
  line: number;
};

export type ImportParseResult = {
  nodesToCreate: string[][]; // list of paths encountered
  cards: ParsedCardItem[];
  notes: ParsedNoteItem[];
  tags: Array<{ key: string; label: string }>;
  errors: Array<{ line: number; message: string }>;
  totalItems: number;
  warnings: string[];
};

export function normalizeKey(text: string): string {
  return text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function normalizeTagName(raw: string): { key: string; label: string } {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  return {
    key: trimmed.toLowerCase(),
    label: trimmed
  };
}

export function parseImportFile(
  content: string,
  mode: 'paths' | 'into-node',
  selectedNodeName?: string
): ImportParseResult {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const result: ImportParseResult = {
    nodesToCreate: [],
    cards: [],
    notes: [],
    tags: [],
    errors: [],
    totalItems: 0,
    warnings: []
  };

  if (content.length > 5 * 1024 * 1024) {
    result.warnings.push('File is larger than 5 MB; import may take a moment.');
  }

  const seenPaths = new Set<string>();
  const addPath = (path: string[]) => {
    if (path.length === 0) return;
    const key = path.map(normalizeKey).join(' > ');
    if (!seenPaths.has(key)) {
      seenPaths.add(key);
      result.nodesToCreate.push(path);
    }
  };

  const tagMap = new Map<string, string>();
  const registerTag = (rawTag: string) => {
    const { key, label } = normalizeTagName(rawTag);
    if (!key) return;
    if (!tagMap.has(key)) {
      tagMap.set(key, label);
      result.tags.push({ key, label });
    }
  };

  let currentPath: string[] = mode === 'into-node' && selectedNodeName ? [selectedNodeName] : [];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // 1. Path Line: @ Path > Subpath > Subpath
    if (trimmed.startsWith('@')) {
      const pathContent = trimmed.slice(1).trim();
      const segments = pathContent.split('>').map((s) => s.trim()).filter(Boolean);
      if (segments.length === 0) {
        result.errors.push({ line: i + 1, message: 'Empty path after @' });
      } else {
        if (mode === 'into-node') {
          currentPath = selectedNodeName ? [selectedNodeName, ...segments] : segments;
        } else {
          currentPath = segments;
        }
        addPath(currentPath);
      }
      i += 1;
      continue;
    }

    // 2. Card Block: Q:
    if (/^q\s*:/i.test(trimmed)) {
      const startLine = i + 1;
      let front = trimmed.replace(/^q\s*:/i, '').trim();
      let back = '';
      let explanation: string | null = null;
      const tags: string[] = [];
      let direction: 'one-way' | 'both' = 'one-way';
      let starred = false;
      let sourceKey: string | null = null;

      i += 1;
      // Read front continuation if any before A:
      while (i < lines.length && !/^[a-z]+(\s*-[a-z]+)?\s*:/i.test(lines[i].trim()) && !lines[i].trim().startsWith('@') && lines[i].trim() !== '') {
        front += '\n' + lines[i].trim();
        i += 1;
      }

      // Collect card fields
      let currentField: 'front' | 'back' | 'why' = 'front';
      while (i < lines.length) {
        const line = lines[i];
        const lineTrimmed = line.trim();

        if (lineTrimmed.startsWith('@') || /^q\s*:/i.test(lineTrimmed) || /^note\s*:/i.test(lineTrimmed)) {
          break; // Next block started
        }

        if (lineTrimmed === '') {
          // Empty line ends card block unless next line continues back
          i += 1;
          break;
        }

        if (/^a\s*:/i.test(lineTrimmed)) {
          currentField = 'back';
          back = lineTrimmed.replace(/^a\s*:/i, '').trim();
        } else if (/^why\s*:/i.test(lineTrimmed)) {
          currentField = 'why';
          explanation = lineTrimmed.replace(/^why\s*:/i, '').trim();
        } else if (/^tags\s*:/i.test(lineTrimmed)) {
          const list = lineTrimmed.replace(/^tags\s*:/i, '').split(',').map((t) => t.trim()).filter(Boolean);
          for (const t of list) {
            tags.push(t);
            registerTag(t);
          }
        } else if (/^two-way\s*:/i.test(lineTrimmed)) {
          const val = lineTrimmed.replace(/^two-way\s*:/i, '').trim().toLowerCase();
          direction = val === 'yes' || val === 'true' || val === '1' ? 'both' : 'one-way';
        } else if (/^star\s*:/i.test(lineTrimmed)) {
          const val = lineTrimmed.replace(/^star\s*:/i, '').trim().toLowerCase();
          starred = val === 'yes' || val === 'true' || val === '1';
        } else if (/^id\s*:/i.test(lineTrimmed)) {
          sourceKey = lineTrimmed.replace(/^id\s*:/i, '').trim() || null;
        } else {
          // Continuation line of back or explanation
          if (currentField === 'back') {
            back += '\n' + line;
          } else if (currentField === 'why') {
            explanation = (explanation ?? '') + '\n' + line;
          }
        }
        i += 1;
      }

      if (!front) {
        result.errors.push({ line: startLine, message: 'Card is missing question (Q:)' });
      } else if (!back) {
        result.errors.push({ line: startLine, message: 'Card is missing answer (A:)' });
      } else if (mode === 'paths' && currentPath.length === 0) {
        result.errors.push({ line: startLine, message: 'Card placed before any @ topic path was defined' });
      } else {
        result.cards.push({
          front,
          back,
          explanation: explanation ? explanation.trim() : null,
          tags,
          direction,
          starred,
          sourceKey,
          nodePath: [...currentPath],
          line: startLine
        });
        result.totalItems += 1;
      }
      continue;
    }

    // 3. Note Block: NOTE:
    if (/^note\s*:/i.test(trimmed)) {
      const startLine = i + 1;
      let title: string | null = trimmed.replace(/^note\s*:/i, '').trim() || null;
      let noteType = 'normal';
      let color: string | null = null;
      let starred = false;
      const tags: string[] = [];
      let sourceKey: string | null = null;
      let cue = '';
      let means = '';
      let story: string | null = null;
      let body = '';

      i += 1;
      let currentSection: 'body' | 'cue' | 'means' | 'story' | null = null;

      while (i < lines.length) {
        const line = lines[i];
        const lineTrimmed = line.trim();

        if (lineTrimmed === '---') {
          i += 1;
          break;
        }

        if (lineTrimmed.startsWith('@') || /^q\s*:/i.test(lineTrimmed) || /^note\s*:/i.test(lineTrimmed)) {
          break;
        }

        if (/^type\s*:/i.test(lineTrimmed)) {
          noteType = lineTrimmed.replace(/^type\s*:/i, '').trim().toLowerCase() || 'normal';
        } else if (/^color\s*:/i.test(lineTrimmed)) {
          color = lineTrimmed.replace(/^color\s*:/i, '').trim().toLowerCase() || null;
        } else if (/^star\s*:/i.test(lineTrimmed)) {
          const val = lineTrimmed.replace(/^star\s*:/i, '').trim().toLowerCase();
          starred = val === 'yes' || val === 'true' || val === '1';
        } else if (/^tags\s*:/i.test(lineTrimmed)) {
          const list = lineTrimmed.replace(/^tags\s*:/i, '').split(',').map((t) => t.trim()).filter(Boolean);
          for (const t of list) {
            tags.push(t);
            registerTag(t);
          }
        } else if (/^id\s*:/i.test(lineTrimmed)) {
          sourceKey = lineTrimmed.replace(/^id\s*:/i, '').trim() || null;
        } else if (/^cue\s*:/i.test(lineTrimmed)) {
          currentSection = 'cue';
          cue = lineTrimmed.replace(/^cue\s*:/i, '').trim();
        } else if (/^means\s*:/i.test(lineTrimmed)) {
          currentSection = 'means';
          means = lineTrimmed.replace(/^means\s*:/i, '').trim();
        } else if (/^story\s*:/i.test(lineTrimmed)) {
          currentSection = 'story';
          story = lineTrimmed.replace(/^story\s*:/i, '').trim();
        } else if (/^body\s*:/i.test(lineTrimmed)) {
          currentSection = 'body';
          body = lineTrimmed.replace(/^body\s*:/i, '').trim();
        } else {
          // Continuation line
          if (currentSection === 'body') {
            body += '\n' + line;
          } else if (currentSection === 'cue') {
            cue += '\n' + line;
          } else if (currentSection === 'means') {
            means += '\n' + line;
          } else if (currentSection === 'story') {
            story = (story ?? '') + '\n' + line;
          } else {
            body += '\n' + line;
          }
        }
        i += 1;
      }

      let data: Record<string, unknown> | null = null;
      if (noteType === 'mnemonic') {
        data = { cue: cue.trim(), meaning: means.trim(), story: story ? story.trim() : null };
        if (!body) body = cue.trim();
      }

      if (mode === 'paths' && currentPath.length === 0) {
        result.errors.push({ line: startLine, message: 'Note placed before any @ topic path was defined' });
      } else {
        result.notes.push({
          title: title ? title.trim() : null,
          type: noteType,
          body: body.trim(),
          data,
          color,
          starred,
          tags,
          sourceKey,
          nodePath: [...currentPath],
          line: startLine
        });
        result.totalItems += 1;
      }
      continue;
    }

    // 4. Legacy Tab-Separated line: front <TAB> back (allowed in mode 2 only)
    if (rawLine.includes('\t')) {
      const parts = rawLine.split('\t');
      const front = parts[0]?.trim();
      const back = parts.slice(1).join('\t').trim();

      if (front && back) {
        if (mode !== 'into-node') {
          result.errors.push({ line: i + 1, message: 'Tab-separated cards are only allowed in "Put into selected topic" mode' });
        } else {
          result.cards.push({
            front,
            back,
            explanation: null,
            tags: [],
            direction: 'one-way',
            starred: false,
            sourceKey: null,
            nodePath: [...currentPath],
            line: i + 1
          });
          result.totalItems += 1;
        }
      }
      i += 1;
      continue;
    }

    // Stray line
    result.errors.push({ line: i + 1, message: `Unrecognized line: "${trimmed.slice(0, 30)}..."` });
    i += 1;
  }

  if (result.totalItems > 5000) {
    result.warnings.push(`File contains ${result.totalItems} items. Imports above 5,000 items may take time.`);
  }

  return result;
}
