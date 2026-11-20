import { createEmptyCard, State } from 'ts-fsrs';
import { db } from '../db';
import { normalizeKey, parseImportFile, type ImportParseResult } from '../../core/importers/importParser';
import type { CardRecord, ImportRecord, NoteRecord, ReviewItemRecord, TagRecord, TreeNode } from '../../types';

export type ImportPreview = {
  fileName: string;
  counts: {
    nodes: number;
    cards: number;
    notes: number;
    tags: number;
    updated: number;
    skipped: number;
  };
  errors: Array<{ line: number; message: string }>;
  warnings: string[];
  parsed: ImportParseResult;
};

export async function previewImportFile(
  content: string,
  fileName: string,
  mode: 'paths' | 'into-node',
  selectedNodeId?: string,
  updateExistingWithId = true
): Promise<ImportPreview> {
  let selectedNodeName = '';
  if (selectedNodeId) {
    const node = await db.nodes.get(selectedNodeId);
    if (node) selectedNodeName = node.name;
  }

  const parsed = parseImportFile(content, mode, selectedNodeName);

  const existingNodes = await db.nodes.toArray();
  const existingCards = await db.cards.toArray();
  const existingNotes = await db.notes.toArray();
  const existingTags = await db.tags.toArray();

  const existingCardSourceKeys = new Set(existingCards.map((c) => c.sourceKey).filter(Boolean));
  const existingNoteSourceKeys = new Set(existingNotes.map((n) => n.sourceKey).filter(Boolean));
  const existingTagKeys = new Set(existingTags.map((t) => t.name));

  let updated = 0;
  let skipped = 0;
  let newCards = 0;
  let newNotes = 0;

  for (const card of parsed.cards) {
    if (card.sourceKey && existingCardSourceKeys.has(card.sourceKey)) {
      if (updateExistingWithId) updated += 1;
      else skipped += 1;
    } else {
      newCards += 1;
    }
  }

  for (const note of parsed.notes) {
    if (note.sourceKey && existingNoteSourceKeys.has(note.sourceKey)) {
      if (updateExistingWithId) updated += 1;
      else skipped += 1;
    } else {
      newNotes += 1;
    }
  }

  // Count new nodes that don't match existing path
  const existingPathKeys = new Set<string>();
  const parentMap = new Map(existingNodes.map((n) => [n.id, n]));
  for (const node of existingNodes) {
    const segments: string[] = [];
    let cur: TreeNode | undefined = node;
    while (cur) {
      segments.unshift(normalizeKey(cur.name));
      cur = cur.parentId ? parentMap.get(cur.parentId) : undefined;
    }
    existingPathKeys.add(segments.join(' > '));
  }

  const newPathPrefixes = new Set<string>();
  for (const path of parsed.nodesToCreate) {
    let prefix = '';
    for (const seg of path) {
      prefix = prefix ? `${prefix} > ${normalizeKey(seg)}` : normalizeKey(seg);
      if (!existingPathKeys.has(prefix)) {
        newPathPrefixes.add(prefix);
      }
    }
  }
  const newNodes = newPathPrefixes.size;

  let newTags = 0;
  for (const tag of parsed.tags) {
    if (!existingTagKeys.has(tag.key)) newTags += 1;
  }

  return {
    fileName,
    counts: {
      nodes: newNodes,
      cards: newCards,
      notes: newNotes,
      tags: newTags,
      updated,
      skipped
    },
    errors: parsed.errors,
    warnings: parsed.warnings,
    parsed
  };
}

export async function applyImport(
  preview: ImportPreview,
  mode: 'paths' | 'into-node',
  selectedNodeId?: string,
  updateExistingWithId = true
): Promise<ImportRecord> {
  const importId = crypto.randomUUID();
  const now = Date.now();
  const parsed = preview.parsed;

  return await db.transaction('rw', [db.nodes, db.cards, db.reviewItems, db.notes, db.tags, db.imports], async () => {
    // 1. Resolve or create tags
    const tagNameToId = new Map<string, string>();
    const existingTags = await db.tags.toArray();
    for (const t of existingTags) tagNameToId.set(t.name, t.id);

    const tagsToAdd: TagRecord[] = [];
    for (const tag of parsed.tags) {
      if (!tagNameToId.has(tag.key)) {
        const id = crypto.randomUUID();
        tagNameToId.set(tag.key, id);
        tagsToAdd.push({
          id,
          name: tag.key,
          label: tag.label,
          createdAt: now
        });
      }
    }
    if (tagsToAdd.length) await db.tags.bulkAdd(tagsToAdd);

    // 2. Resolve or create nodes hierarchy
    const allNodes = await db.nodes.toArray();
    const findChildNode = (parentId: string | null, name: string): TreeNode | undefined => {
      const norm = normalizeKey(name);
      return allNodes.find((n) => n.parentId === parentId && normalizeKey(n.name) === norm);
    };

    const pathToNodeId = new Map<string, string>();

    // If into-node mode without subpath, map empty path or root to selectedNodeId
    if (selectedNodeId) {
      const selected = await db.nodes.get(selectedNodeId);
      if (selected) {
        pathToNodeId.set('', selected.id);
        pathToNodeId.set(normalizeKey(selected.name), selected.id);
      }
    }

    const resolvePathToNode = async (segments: string[]): Promise<string> => {
      if (segments.length === 0) {
        if (selectedNodeId) return selectedNodeId;
        throw new Error('No target topic specified for import.');
      }

      let currentParentId: string | null = null;
      let pathPrefix = '';

      for (let s = 0; s < segments.length; s += 1) {
        const segName = segments[s].trim();
        pathPrefix = pathPrefix ? `${pathPrefix} > ${normalizeKey(segName)}` : normalizeKey(segName);

        if (pathToNodeId.has(pathPrefix)) {
          currentParentId = pathToNodeId.get(pathPrefix)!;
          continue;
        }

        let existing = findChildNode(currentParentId, segName);
        if (!existing) {
          const siblings = allNodes.filter((n) => n.parentId === currentParentId);
          const newNode: TreeNode = {
            id: crypto.randomUUID(),
            parentId: currentParentId,
            name: segName,
            order: siblings.length,
            createdAt: now,
            updatedAt: now
          };
          await db.nodes.add(newNode);
          allNodes.push(newNode);
          existing = newNode;
        }
        currentParentId = existing.id;
        pathToNodeId.set(pathPrefix, existing.id);
      }

      return currentParentId!;
    };

    for (const path of parsed.nodesToCreate) {
      await resolvePathToNode(path);
    }

    // 3. Process Cards
    const existingCards = await db.cards.toArray();
    const cardBySourceKey = new Map(existingCards.filter((c) => c.sourceKey).map((c) => [c.sourceKey!, c]));
    const cardDedupeSet = new Set(
      existingCards.map((c) => `${c.nodeId}|${normalizeKey(c.front)}|${c.tagIds?.[0] ? (existingTags.find((t) => t.id === c.tagIds?.[0])?.name ?? '') : ''}`)
    );

    const cardsToAdd: CardRecord[] = [];
    const reviewItemsToAdd: ReviewItemRecord[] = [];
    let cardsUpdated = 0;
    let cardsSkipped = 0;
    let cardsAdded = 0;

    for (const item of parsed.cards) {
      const targetNodeId = await resolvePathToNode(item.nodePath);
      const tagIds = item.tags.map((t) => tagNameToId.get(normalizeKey(t))).filter((id): id is string => Boolean(id));
      const firstTagKey = item.tags[0] ? normalizeKey(item.tags[0]) : '';
      const dedupeKey = `${targetNodeId}|${normalizeKey(item.front)}|${firstTagKey}`;

      if (item.sourceKey && cardBySourceKey.has(item.sourceKey)) {
        if (!updateExistingWithId) {
          cardsSkipped += 1;
          continue;
        }
        // Update existing card content
        const existing = cardBySourceKey.get(item.sourceKey)!;
        await db.cards.update(existing.id, {
          front: item.front,
          back: item.back,
          explanation: item.explanation,
          tagIds,
          direction: item.direction,
          starred: item.starred,
          updatedAt: now
        });

        // Ensure reviewItems match direction
        const existingItems = await db.reviewItems.where('cardId').equals(existing.id).toArray();
        const hasReverse = existingItems.some((r) => r.direction === 'reverse');
        if (item.direction === 'both' && !hasReverse) {
          const empty = createEmptyCard(new Date(now));
          await db.reviewItems.add({
            id: crypto.randomUUID(),
            cardId: existing.id,
            direction: 'reverse',
            due: now,
            stability: empty.stability,
            difficulty: empty.difficulty,
            state: State.New,
            reps: empty.reps,
            lapses: empty.lapses,
            lastReview: null,
            trap: false,
            createdAt: now
          });
        } else if (item.direction === 'one-way' && hasReverse) {
          const reverseItem = existingItems.find((r) => r.direction === 'reverse');
          if (reverseItem) await db.reviewItems.delete(reverseItem.id);
        }
        cardsUpdated += 1;
        continue;
      }

      if (cardDedupeSet.has(dedupeKey)) {
        cardsSkipped += 1;
        continue;
      }

      // Create new card
      const cardId = crypto.randomUUID();
      const empty = createEmptyCard(new Date(now));

      const newCard: CardRecord = {
        id: cardId,
        nodeId: targetNodeId,
        front: item.front,
        back: item.back,
        explanation: item.explanation,
        tagIds,
        kind: 'basic',
        direction: item.direction,
        starred: item.starred,
        paused: false,
        sourceKey: item.sourceKey,
        importId,
        createdAt: now,
        updatedAt: now
      };

      cardsToAdd.push(newCard);
      cardDedupeSet.add(dedupeKey);
      cardsAdded += 1;

      // Forward reviewItem
      reviewItemsToAdd.push({
        id: crypto.randomUUID(),
        cardId,
        direction: 'forward',
        due: now,
        stability: empty.stability,
        difficulty: empty.difficulty,
        state: State.New,
        reps: empty.reps,
        lapses: empty.lapses,
        lastReview: null,
        trap: false,
        createdAt: now
      });

      // Reverse reviewItem if two-way
      if (item.direction === 'both') {
        reviewItemsToAdd.push({
          id: crypto.randomUUID(),
          cardId,
          direction: 'reverse',
          due: now,
          stability: empty.stability,
          difficulty: empty.difficulty,
          state: State.New,
          reps: empty.reps,
          lapses: empty.lapses,
          lastReview: null,
          trap: false,
          createdAt: now
        });
      }
    }

    if (cardsToAdd.length) await db.cards.bulkAdd(cardsToAdd);
    if (reviewItemsToAdd.length) await db.reviewItems.bulkAdd(reviewItemsToAdd);

    // 4. Process Notes
    const existingNotes = await db.notes.toArray();
    const noteBySourceKey = new Map(existingNotes.filter((n) => n.sourceKey).map((n) => [n.sourceKey!, n]));
    const noteDedupeSet = new Set(
      existingNotes.map((n) => `${n.nodeId}|${normalizeKey(n.title || n.body.split('\n')[0] || '')}`)
    );

    const notesToAdd: NoteRecord[] = [];
    let notesUpdated = 0;
    let notesSkipped = 0;
    let notesAdded = 0;

    for (const item of parsed.notes) {
      const targetNodeId = await resolvePathToNode(item.nodePath);
      const tagIds = item.tags.map((t) => tagNameToId.get(normalizeKey(t))).filter((id): id is string => Boolean(id));
      const dedupeKey = `${targetNodeId}|${normalizeKey(item.title || item.body.split('\n')[0] || '')}`;

      if (item.sourceKey && noteBySourceKey.has(item.sourceKey)) {
        if (!updateExistingWithId) {
          notesSkipped += 1;
          continue;
        }
        const existing = noteBySourceKey.get(item.sourceKey)!;
        await db.notes.update(existing.id, {
          title: item.title,
          type: item.type,
          body: item.body,
          data: item.data,
          color: item.color,
          starred: item.starred,
          tagIds,
          updatedAt: now
        });
        notesUpdated += 1;
        continue;
      }

      if (noteDedupeSet.has(dedupeKey)) {
        notesSkipped += 1;
        continue;
      }

      const existingInNode = await db.notes.where('nodeId').equals(targetNodeId).count();
      const newNote: NoteRecord = {
        id: crypto.randomUUID(),
        nodeId: targetNodeId,
        type: item.type,
        title: item.title,
        body: item.body,
        data: item.data,
        tagIds,
        color: item.color,
        style: null,
        starred: item.starred,
        order: existingInNode + notesToAdd.filter((n) => n.nodeId === targetNodeId).length,
        sourceKey: item.sourceKey,
        importId,
        createdAt: now,
        updatedAt: now
      };
      notesToAdd.push(newNote);
      noteDedupeSet.add(dedupeKey);
      notesAdded += 1;
    }

    if (notesToAdd.length) await db.notes.bulkAdd(notesToAdd);

    // 5. Save Import Record
    const record: ImportRecord = {
      id: importId,
      fileName: preview.fileName,
      timestamp: now,
      mode,
      counts: {
        nodes: preview.counts.nodes,
        cards: cardsAdded,
        notes: notesAdded,
        tags: tagsToAdd.length,
        updated: cardsUpdated + notesUpdated,
        skipped: cardsSkipped + notesSkipped
      },
      status: 'applied'
    };

    await db.imports.add(record);
    return record;
  });
}

export async function listImports(): Promise<ImportRecord[]> {
  return await db.imports.orderBy('timestamp').reverse().toArray();
}

export async function undoImport(importId: string): Promise<void> {
  await db.transaction('rw', [db.nodes, db.cards, db.reviewItems, db.notes, db.tags, db.imports], async () => {
    const importRec = await db.imports.get(importId);
    if (!importRec) throw new Error('Import record not found.');

    // 1. Find cards created by this import
    const cards = await db.cards.where('importId').equals(importId).toArray();
    const cardIds = cards.map((c) => c.id);

    // 2. Delete reviewItems for these cards
    if (cardIds.length) {
      const items = await db.reviewItems.where('cardId').anyOf(cardIds).toArray();
      await db.reviewItems.bulkDelete(items.map((i) => i.id));
      await db.cards.bulkDelete(cardIds);
    }

    // 3. Delete notes created by this import
    const notes = await db.notes.where('importId').equals(importId).toArray();
    if (notes.length) {
      await db.notes.bulkDelete(notes.map((n) => n.id));
    }

    // 4. Clean up unused tags
    const allCards = await db.cards.toArray();
    const allNotes = await db.notes.toArray();
    const usedTagIds = new Set<string>();
    for (const c of allCards) for (const t of (c.tagIds ?? [])) usedTagIds.add(t);
    for (const n of allNotes) for (const t of (n.tagIds ?? [])) usedTagIds.add(t);

    const allTags = await db.tags.toArray();
    const unusedTags = allTags.filter((t) => !usedTagIds.has(t.id));
    if (unusedTags.length) {
      await db.tags.bulkDelete(unusedTags.map((t) => t.id));
    }

    // 5. Update import status to undone
    await db.imports.update(importId, { status: 'undone' });
  });
}
