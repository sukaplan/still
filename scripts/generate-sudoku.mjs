/** Regenerate the versioned local bank; no network or runtime generation is needed. */
import { writeFile } from 'node:fs/promises';
import { seededRandom, shuffled, solveSudoku, solveSudokuSingles } from '../src/sudoku.mjs';

const bank = { easy: [], medium: [], hard: [] };
const targets = { easy: 42, medium: 34, hard: 27 };
for (const level of Object.keys(bank)) {
  for (let attempt = 0; bank[level].length < 8 && attempt < 2000; attempt++) {
    const random = seededRandom(123456 + attempt * 193 + Object.keys(bank).indexOf(level) * 7919);
    const groups = () =>
      shuffled([0, 1, 2], random).flatMap((group) =>
        shuffled([0, 1, 2], random).map((i) => group * 3 + i),
      );
    const rows = groups(),
      columns = groups(),
      digits = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
    const solution = rows
      .flatMap((row) => columns.map((col) => digits[(row * 3 + Math.floor(row / 3) + col) % 9]))
      .join('');
    const givens = [...solution];
    let count = 81;
    for (const index of shuffled(
      Array.from({ length: 81 }, (_, i) => i),
      random,
    )) {
      if (count <= targets[level]) break;
      const previous = givens[index];
      givens[index] = '0';
      if (solveSudoku(givens).count === 1) count--;
      else givens[index] = previous;
    }
    if (count !== targets[level]) continue;
    const naked = solveSudokuSingles(givens, false),
      hidden = solveSudokuSingles(givens, true);
    if (level === 'easy' && !naked.complete) continue;
    if (level === 'medium' && (naked.complete || !hidden.complete)) continue;
    if (level === 'hard' && hidden.complete) continue;
    bank[level].push({ givens: givens.join(''), solution });
  }
  if (bank[level].length !== 8) throw Error(`Could not generate enough ${level} puzzles`);
  console.log(`${level}: ${bank[level].length} unique puzzles, ${targets[level]} givens`);
}
await writeFile(
  new URL('../src/data/sudoku.json', import.meta.url),
  JSON.stringify(bank, null, 2) + '\n',
);
