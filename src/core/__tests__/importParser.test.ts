import { describe, expect, it } from 'vitest';
import { parseImportFile } from '../importers/importParser';

describe('unified import parser', () => {
  it('parses paths, cards with explanation, tags, and two-way flag', () => {
    const input = `
@ JEE > Chemistry > P-Block
Q: XeF4 geometry
A: sp3d2, square planar
Line 2 of answer
WHY: Two lone pairs sit opposite each other
TAGS: hybridisation, vsepr
TWO-WAY: yes
STAR: yes
ID: card-xef4-geom
`;
    const result = parseImportFile(input, 'paths');
    expect(result.errors).toHaveLength(0);
    expect(result.nodesToCreate).toEqual([['JEE', 'Chemistry', 'P-Block']]);
    expect(result.cards).toHaveLength(1);

    const card = result.cards[0];
    expect(card.front).toBe('XeF4 geometry');
    expect(card.back).toBe('sp3d2, square planar\nLine 2 of answer');
    expect(card.explanation).toBe('Two lone pairs sit opposite each other');
    expect(card.tags).toEqual(['hybridisation', 'vsepr']);
    expect(card.direction).toBe('both');
    expect(card.starred).toBe(true);
    expect(card.sourceKey).toBe('card-xef4-geom');
  });

  it('parses notes including mnemonic notes with cue, meaning and story', () => {
    const input = `
@ JEE > Chemistry > P-Block
NOTE: Group 15 hydrides basicity
TYPE: mnemonic
TAGS: mnemonics, group 15
COLOR: violet
STAR: yes
ID: note-g15-hydrides
CUE: NH3 is Nice, PH3 is Plain
MEANS: Basicity falls down the group from NH3 to BiH3
STORY: Nitrogen the friendly neighbour welcomes protons easily
`;
    const result = parseImportFile(input, 'paths');
    expect(result.errors).toHaveLength(0);
    expect(result.notes).toHaveLength(1);

    const note = result.notes[0];
    expect(note.title).toBe('Group 15 hydrides basicity');
    expect(note.type).toBe('mnemonic');
    expect(note.color).toBe('violet');
    expect(note.starred).toBe(true);
    expect(note.sourceKey).toBe('note-g15-hydrides');
    expect(note.tags).toEqual(['mnemonics', 'group 15']);
    expect(note.data).toEqual({
      cue: 'NH3 is Nice, PH3 is Plain',
      meaning: 'Basicity falls down the group from NH3 to BiH3',
      story: 'Nitrogen the friendly neighbour welcomes protons easily'
    });
  });

  it('supports mode 2 (into-node) treats paths as relative subpaths', () => {
    const input = `
@ Group 13 > Boron
Q: What is borax bead test?
A: Metaborate bead formation
`;
    const result = parseImportFile(input, 'into-node', 'Chemistry');
    expect(result.errors).toHaveLength(0);
    expect(result.nodesToCreate).toEqual([['Chemistry', 'Group 13', 'Boron']]);
    expect(result.cards[0].nodePath).toEqual(['Chemistry', 'Group 13', 'Boron']);
  });

  it('accepts tab-separated lines in mode 2', () => {
    const input = 'Question\tAnswer\nFront 2\tBack 2';
    const result = parseImportFile(input, 'into-node', 'General');
    expect(result.errors).toHaveLength(0);
    expect(result.cards).toHaveLength(2);
    expect(result.cards[0].front).toBe('Question');
    expect(result.cards[0].back).toBe('Answer');
  });

  it('reports errors for cards without answer and items before path in mode 1', () => {
    const input = 'Q: Lonely question without answer\n';
    const result = parseImportFile(input, 'paths');
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
