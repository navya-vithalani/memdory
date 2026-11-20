import { db } from '../db';
import { APP_VERSION } from '../../constants';
import { normalizeKey } from '../../core/importers/importParser';
import { studyDayKey } from '../../core/streak/streak';
import type {
  CardRecord,
  NoteRecord,
  ReviewItemRecord,
  ReviewRecord,
  SessionRecord,
  SettingsRecord,
  TagRecord,
  TreeNode
} from '../../types';

export type BackupPayload = {
  app: string;
  appVersion: string;
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
};

export type BackupRestoreResult = {
  counts: Record<string, number>;
  settings?: SettingsRecord;
};

export async function createBackup(): Promise<BackupPayload> {
  const tables: Record<string, unknown[]> = {};
  for (const table of db.tables) {
    tables[table.name] = await table.toArray();
  }

  return {
    app: 'memdory',
    appVersion: APP_VERSION,
    schemaVersion: 4,
    exportedAt: new Date().toISOString(),
    tables
  };
}

export async function restoreBackup(
  source: string,
  mode: 'merge' | 'replace'
): Promise<BackupRestoreResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error('This file is not valid JSON.');
  }

  if (typeof parsed !== 'object' || parsed === null || !('tables' in parsed)) {
    throw new Error('Invalid backup structure.');
  }

  const payload = parsed as {
    schemaVersion?: number;
    tables: Record<string, Array<Record<string, unknown>>>;
  };

  const incomingTables = payload.tables;
  const version = payload.schemaVersion ?? 1;

  return await db.transaction('rw', db.tables, async () => {
    if (mode === 'replace') {
      for (const table of db.tables) {
        await table.clear();
      }
    }

    const counts: Record<string, number> = {};

    // If backup is older than v4, adapt records
    const nodes = (incomingTables.nodes ?? []) as TreeNode[];
    const cards = (incomingTables.cards ?? []) as Array<Record<string, unknown>>;
    const reviews = (incomingTables.reviews ?? []) as Array<Record<string, unknown>>;
    const sessions = (incomingTables.sessions ?? []) as Array<Record<string, unknown>>;
    const notes = (incomingTables.notes ?? []) as Array<Record<string, unknown>>;
    let reviewItems = (incomingTables.reviewItems ?? []) as ReviewItemRecord[];
    const tags = (incomingTables.tags ?? []) as TagRecord[];
    const settings = (incomingTables.settings ?? []) as SettingsRecord[];

    const cardToReviewItemId = new Map<string, string>();

    // Upgrade cards if < 4
    if (version < 4) {
      const upgradedCards: CardRecord[] = [];
      const generatedItems: ReviewItemRecord[] = [];

      for (const rawCard of cards) {
        const id = String(rawCard.id);
        const createdAt = typeof rawCard.createdAt === 'number' ? rawCard.createdAt : Date.now();
        const reviewItemId = crypto.randomUUID();
        cardToReviewItemId.set(id, reviewItemId);

        generatedItems.push({
          id: reviewItemId,
          cardId: id,
          direction: 'forward',
          due: typeof rawCard.due === 'number' ? rawCard.due : createdAt,
          stability: typeof rawCard.stability === 'number' ? rawCard.stability : 0,
          difficulty: typeof rawCard.difficulty === 'number' ? rawCard.difficulty : 0,
          state: typeof rawCard.state === 'number' ? rawCard.state : 0,
          reps: typeof rawCard.reps === 'number' ? rawCard.reps : 0,
          lapses: typeof rawCard.lapses === 'number' ? rawCard.lapses : 0,
          lastReview: typeof rawCard.lastReview === 'number' ? rawCard.lastReview : null,
          trap: Boolean(rawCard.trap),
          createdAt
        });

        upgradedCards.push({
          id,
          nodeId: String(rawCard.nodeId),
          front: String(rawCard.front ?? ''),
          back: String(rawCard.back ?? ''),
          explanation: null,
          tagIds: Array.isArray(rawCard.tagIds) ? (rawCard.tagIds as string[]) : [],
          kind: 'basic',
          direction: 'one-way',
          starred: Boolean(rawCard.starred),
          paused: Boolean(rawCard.paused),
          sourceKey: null,
          importId: null,
          createdAt,
          updatedAt: createdAt
        });
      }

      reviewItems = generatedItems;

      // Upgrade reviews
      for (const r of reviews) {
        const cid = String(r.cardId);
        r.reviewItemId = cardToReviewItemId.get(cid) ?? cid;
        r.studyMode = 'single';
        r.dayKey = studyDayKey(Number(r.timestamp) || Date.now(), 210);
      }

      // Upgrade sessions
      for (const s of sessions) {
        const ended = Number(s.endedAt) || Number(s.startedAt) || Date.now();
        s.dayKey = studyDayKey(ended, 210);
        s.tagFilter = [];
        s.viewMode = 'cards';
        const qCards = Array.isArray(s.queueCardIds) ? (s.queueCardIds as string[]) : [];
        s.queueItemIds = qCards.map((c) => cardToReviewItemId.get(c) ?? c);
      }

      // Upgrade notes
      for (let idx = 0; idx < notes.length; idx += 1) {
        const n = notes[idx];
        n.type = n.type || 'normal';
        n.order = typeof n.order === 'number' ? n.order : idx;
        n.tagIds = Array.isArray(n.tagIds) ? n.tagIds : [];
        n.starred = Boolean(n.starred);
      }

      if (nodes.length) await db.nodes.bulkPut(nodes);
      if (upgradedCards.length) await db.cards.bulkPut(upgradedCards);
      if (reviewItems.length) await db.reviewItems.bulkPut(reviewItems);
      if (reviews.length) await db.reviews.bulkPut(reviews as unknown as ReviewRecord[]);
      if (sessions.length) await db.sessions.bulkPut(sessions as unknown as SessionRecord[]);
      if (notes.length) await db.notes.bulkPut(notes as unknown as NoteRecord[]);
      if (tags.length) await db.tags.bulkPut(tags);
      if (settings.length) await db.settings.bulkPut(settings);

      counts.nodes = nodes.length;
      counts.cards = upgradedCards.length;
      counts.reviewItems = reviewItems.length;
      counts.notes = notes.length;
    } else {
      // Put directly for every table in payload
      for (const table of db.tables) {
        const items = incomingTables[table.name];
        if (Array.isArray(items) && items.length > 0) {
          await table.bulkPut(items);
          counts[table.name] = items.length;
        }
      }
    }

    const currentSettings = await db.settings.get('settings');
    return { counts, settings: currentSettings };
  });
}

export async function exportContentAsText(): Promise<string> {
  const [nodes, cards, notes, tags] = await Promise.all([
    db.nodes.toArray(),
    db.cards.toArray(),
    db.notes.toArray(),
    db.tags.toArray()
  ]);

  const tagMap = new Map(tags.map((t) => [t.id, t.label]));
  const parentMap = new Map(nodes.map((n) => [n.id, n]));

  const getNodePath = (nodeId: string): string => {
    const segments: string[] = [];
    let cur = parentMap.get(nodeId);
    while (cur) {
      segments.unshift(cur.name);
      cur = cur.parentId ? parentMap.get(cur.parentId) : undefined;
    }
    return segments.join(' > ');
  };

  // Group nodes by tree order
  const nodesByPath = new Map<string, { cards: CardRecord[]; notes: NoteRecord[] }>();
  for (const node of nodes) {
    nodesByPath.set(node.id, { cards: [], notes: [] });
  }

  for (const card of cards) {
    if (!card.sourceKey) {
      card.sourceKey = `card-${card.id.slice(0, 8)}`;
      void db.cards.update(card.id, { sourceKey: card.sourceKey });
    }
    nodesByPath.get(card.nodeId)?.cards.push(card);
  }

  for (const note of notes) {
    if (!note.sourceKey) {
      note.sourceKey = `note-${note.id.slice(0, 8)}`;
      void db.notes.update(note.id, { sourceKey: note.sourceKey });
    }
    nodesByPath.get(note.nodeId)?.notes.push(note);
  }

  const chunks: string[] = [];

  for (const node of nodes) {
    const group = nodesByPath.get(node.id);
    if (!group || (group.cards.length === 0 && group.notes.length === 0)) continue;

    const pathStr = getNodePath(node.id);
    chunks.push(`@ ${pathStr}\n`);

    // Output notes
    group.notes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (const note of group.notes) {
      chunks.push(`NOTE: ${note.title ?? ''}`);
      if (note.type && note.type !== 'normal') chunks.push(`TYPE: ${note.type}`);
      if (note.color) chunks.push(`COLOR: ${note.color}`);
      if (note.starred) chunks.push('STAR: yes');
      if (note.tagIds?.length) {
        const tagLabels = (note.tagIds ?? []).map((tId) => tagMap.get(tId)).filter(Boolean);
        if (tagLabels.length) chunks.push(`TAGS: ${tagLabels.join(', ')}`);
      }
      if (note.sourceKey) chunks.push(`ID: ${note.sourceKey}`);

      if (note.type === 'mnemonic' && note.data) {
        if (note.data.cue) chunks.push(`CUE: ${String(note.data.cue)}`);
        if (note.data.meaning) chunks.push(`MEANS: ${String(note.data.meaning)}`);
        if (note.data.story) chunks.push(`STORY: ${String(note.data.story)}`);
      } else {
        chunks.push(`BODY: ${note.body}`);
      }
      chunks.push('---\n');
    }

    // Output cards
    for (const card of group.cards) {
      chunks.push(`Q: ${card.front}`);
      chunks.push(`A: ${card.back}`);
      if (card.explanation) chunks.push(`WHY: ${card.explanation}`);
      if (card.tagIds?.length) {
        const tagLabels = (card.tagIds ?? []).map((tId) => tagMap.get(tId)).filter(Boolean);
        if (tagLabels.length) chunks.push(`TAGS: ${tagLabels.join(', ')}`);
      }
      if (card.direction === 'both') chunks.push('TWO-WAY: yes');
      if (card.starred) chunks.push('STAR: yes');
      if (card.sourceKey) chunks.push(`ID: ${card.sourceKey}`);
      chunks.push('\n');
    }
  }

  return chunks.join('\n');
}
