export function parseNoteTitle(fileName: string, source: string): string {
  const headingMatch = source.match(/^#\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  const stem = fileName.split(/[\\/]/).pop() ?? fileName;
  return stem.replace(/\.[^.]+$/, '').trim() || 'Untitled note';
}

export function parseNoteBody(source: string): string {
  return source.trim();
}
