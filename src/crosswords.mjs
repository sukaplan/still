import puzzles from './data/crosswords.json' with { type: 'json' };

export const CROSSWORDS = puzzles;

export function dailyCrossword(date) {
  const index =
    Math.abs(Math.floor(Date.parse(date + 'T12:00:00Z') / 86400000)) % CROSSWORDS.length;
  return CROSSWORDS[index];
}

export function crosswordStatus(value, puzzle) {
  const letters = Array.from({ length: 25 }, (_, i) =>
    String(value?.letters?.[i] || '')
      .slice(0, 1)
      .toUpperCase(),
  );
  const cells = puzzle.rows.join('');
  let filled = 0,
    correct = 0,
    total = 0;
  for (let i = 0; i < 25; i++) {
    if (cells[i] === '#') continue;
    total++;
    if (letters[i]) filled++;
    if (letters[i] === cells[i]) correct++;
  }
  return { letters, filled, correct, total, complete: correct === total };
}
