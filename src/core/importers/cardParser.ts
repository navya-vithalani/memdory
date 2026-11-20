export type ParsedCard = {
  front: string;
  back: string;
};

export type CardParseSummary = {
  cards: ParsedCard[];
  invalid: number;
  skipped: number;
};

/** Trims each line and collapses runs of spaces, but keeps line breaks so multi-line answers survive. */
function tidy(lines: string[]): string {
  return lines
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .trim();
}

type Draft = { front: string[]; back: string[]; hasAnswer: boolean };

/**
 * Line-based parser. A `Q:` line starts a card, an `A:` line starts its answer, and any other
 * line continues whichever side is open. A blank line (or the next `Q:`) ends the card.
 * Lines containing a tab are `front<TAB>back` cards.
 */
export function parseCards(input: string): CardParseSummary {
  const cards: ParsedCard[] = [];
  let invalid = 0;
  let skipped = 0;
  let draft: Draft | null = null;
  let strayRun = false;

  const closeDraft = () => {
    if (!draft) return;
    const front = tidy(draft.front);
    const back = tidy(draft.back);
    if (!front && !back) skipped += 1;
    else if (!front || !back) invalid += 1;
    else cards.push({ front, back });
    draft = null;
  };

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) {
      closeDraft();
      strayRun = false;
      continue;
    }

    const question = line.match(/^Q:\s*(.*)$/i);
    if (question) {
      closeDraft();
      strayRun = false;
      draft = { front: [question[1]], back: [], hasAnswer: false };
      continue;
    }

    const answer = line.match(/^A:\s*(.*)$/i);
    if (answer && draft && !draft.hasAnswer) {
      draft.hasAnswer = true;
      draft.back.push(answer[1]);
      continue;
    }

    if (draft) {
      (draft.hasAnswer ? draft.back : draft.front).push(line);
      continue;
    }

    if (line.includes('\t')) {
      const [front, ...tail] = line.split('\t');
      const back = tail.join('\t').trim();
      if (!front.trim() || !back) invalid += 1;
      else cards.push({ front: tidy([front]), back: tidy([back]) });
      continue;
    }

    // Text that belongs to no card: count each unbroken run once.
    if (!strayRun) invalid += 1;
    strayRun = true;
  }

  closeDraft();
  return { cards, invalid, skipped };
}
