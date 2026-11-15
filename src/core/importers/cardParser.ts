export type ParsedCard = {
  front: string;
  back: string;
};

export type CardParseSummary = {
  cards: ParsedCard[];
  invalid: number;
  skipped: number;
};

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function parseCards(input: string): CardParseSummary {
  const blocks = input
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const cards: ParsedCard[] = [];
  let invalid = 0;
  let skipped = 0;

  for (const block of blocks) {
    if (block.split('\n').every((line) => line.includes('\t'))) {
      for (const line of block.split('\n')) {
        const [front, ...tail] = line.split('\t');
        const back = tail.join('\t').trim();
        if (!front.trim() || !back) {
          invalid += 1;
          continue;
        }
        cards.push({ front: normalize(front), back: normalize(back) });
      }
      continue;
    }

    const questionMatch = block.match(/Q:\s*(.*?)(?:\n\s*A:\s*(.*)|$)/s);
    if (!questionMatch) {
      invalid += 1;
      continue;
    }

    const front = normalize(questionMatch[1] ?? '');
    const back = normalize(questionMatch[2] ?? '');

    if (!front && !back) {
      skipped += 1;
      continue;
    }

    if (!front || !back) {
      invalid += 1;
      continue;
    }

    cards.push({ front, back });
  }

  return { cards, invalid, skipped };
}
