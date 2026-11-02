/** Pure Sudoku rules, daily selection, and browser-safe progress normalization. */
import PUZZLES from './data/sudoku.json' with { type: 'json' };
import { ordinal } from './date-utils.mjs';

export const SUDOKU_LEVELS = ['easy', 'medium', 'hard'];
export const SUDOKU_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const DIGITS = '123456789';
export const SUDOKU_UNITS = [
  ...Array.from({ length: 9 }, (_, row) => Array.from({ length: 9 }, (_, col) => row * 9 + col)),
  ...Array.from({ length: 9 }, (_, col) => Array.from({ length: 9 }, (_, row) => row * 9 + col)),
  ...Array.from({ length: 9 }, (_, box) =>
    Array.from(
      { length: 9 },
      (_, i) => Math.floor(box / 3) * 27 + (box % 3) * 3 + Math.floor(i / 3) * 9 + (i % 3),
    ),
  ),
];
const PEERS = Array.from({ length: 81 }, (_, i) =>
  [...new Set(SUDOKU_UNITS.filter((unit) => unit.includes(i)).flat())].filter((peer) => peer !== i),
);
const digit = (value) => (typeof value === 'string' && /^[1-9]$/.test(value) ? value : '');

export function sudokuCandidates(board, index) {
  if (board[index] && board[index] !== '0') return [];
  const used = new Set(PEERS[index].map((peer) => board[peer]));
  return [...DIGITS].filter((value) => !used.has(value));
}

/** Count up to two solutions: enough to prove a generated puzzle is unique. */
export function solveSudoku(givens, limit = 2) {
  const board = Array.from({ length: 81 }, (_, i) => digit(givens[i]));
  if (sudokuConflicts(board).size) return { count: 0, solution: null };
  let count = 0,
    solution = null;
  function visit() {
    let cell = -1,
      choices = null;
    for (let i = 0; i < 81; i++) {
      if (board[i]) continue;
      const candidates = sudokuCandidates(board, i);
      if (!candidates.length) return;
      if (!choices || candidates.length < choices.length) {
        cell = i;
        choices = candidates;
        if (choices.length === 1) break;
      }
    }
    if (cell === -1) {
      count++;
      solution ||= board.join('');
      return;
    }
    for (const value of choices) {
      board[cell] = value;
      visit();
      if (count >= limit) break;
    }
    board[cell] = '';
  }
  visit();
  return { count, solution };
}

/** A simple, reproducible difficulty floor, rather than clue count alone. */
export function solveSudokuSingles(givens, hiddenSingles = true) {
  const board = Array.from({ length: 81 }, (_, i) => digit(givens[i]));
  let hiddenSteps = 0;
  while (board.some((value) => !value)) {
    const candidates = board.map((value, i) => (value ? [] : sudokuCandidates(board, i)));
    let placement = candidates.findIndex((values) => values.length === 1);
    let value = candidates[placement]?.[0];
    if (placement < 0 && hiddenSingles) {
      for (const unit of SUDOKU_UNITS) {
        for (const number of DIGITS) {
          const cells = unit.filter((i) => candidates[i].includes(number));
          if (cells.length === 1) {
            placement = cells[0];
            value = number;
            hiddenSteps++;
            break;
          }
        }
        if (placement >= 0) break;
      }
    }
    if (placement < 0) break;
    board[placement] = value;
  }
  return { complete: board.every(Boolean), hiddenSteps };
}

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffled(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const dailyCache = new Map();
export function dailySudoku(date, difficulty = 'easy') {
  if (!SUDOKU_LEVELS.includes(difficulty)) difficulty = 'easy';
  const key = `${date}:${difficulty}`;
  if (dailyCache.has(key)) return dailyCache.get(key);
  const day = Math.abs(ordinal(date));
  const random = seededRandom(day * 101 + SUDOKU_LEVELS.indexOf(difficulty) * 7919);
  const source = PUZZLES[difficulty][day % PUZZLES[difficulty].length];
  const order = () =>
    shuffled([0, 1, 2], random).flatMap((group) =>
      shuffled([0, 1, 2], random).map((index) => group * 3 + index),
    );
  const rows = order(),
    columns = order();
  const digits = shuffled([...DIGITS], random);
  const transpose = random() < 0.5;
  const transform = (grid) =>
    Array.from({ length: 81 }, (_, i) => {
      const row = rows[Math.floor(i / 9)],
        col = columns[i % 9];
      const value = grid[transpose ? col * 9 + row : row * 9 + col];
      return value === '0' ? '0' : digits[Number(value) - 1];
    }).join('');
  const puzzle = Object.freeze({
    id: key,
    difficulty,
    givens: transform(source.givens),
    solution: transform(source.solution),
  });
  if (dailyCache.size >= 30) dailyCache.delete(dailyCache.keys().next().value);
  dailyCache.set(key, puzzle);
  return puzzle;
}

export function normalizeSudokuGame(value = {}) {
  return {
    values: Array.from({ length: 81 }, (_, i) => digit(value?.values?.[i])),
    notes: Array.from({ length: 81 }, (_, i) =>
      Array.isArray(value?.notes?.[i])
        ? [...new Set(value.notes[i].map(digit).filter(Boolean))].sort()
        : [],
    ),
    hints: Number.isInteger(value?.hints) ? Math.max(0, Math.min(81, value.hints)) : 0,
  };
}
export function normalizeSudokuState(value = {}) {
  return {
    difficulty: SUDOKU_LEVELS.includes(value?.difficulty) ? value.difficulty : 'easy',
    games: Object.fromEntries(
      SUDOKU_LEVELS.map((level) => [level, normalizeSudokuGame(value?.games?.[level])]),
    ),
  };
}
export function sudokuConflicts(values) {
  const conflicts = new Set();
  for (const unit of SUDOKU_UNITS) {
    const seen = new Map();
    for (const index of unit) {
      const value = digit(values[index]);
      if (!value) continue;
      if (seen.has(value)) {
        conflicts.add(index);
        conflicts.add(seen.get(value));
      } else seen.set(value, index);
    }
  }
  return conflicts;
}
export function sudokuStatus(progress, puzzle) {
  const game = normalizeSudokuGame(progress);
  const values = [...puzzle.givens].map((value, i) => (value === '0' ? game.values[i] : value));
  const editable = [...puzzle.givens].flatMap((value, i) => (value === '0' ? [i] : []));
  return {
    ...game,
    values,
    filled: editable.filter((i) => values[i]).length,
    total: editable.length,
    correct: editable.filter((i) => values[i] === puzzle.solution[i]).length,
    complete: values.every((value, i) => value === puzzle.solution[i]),
    conflicts: sudokuConflicts(values),
  };
}
export function completedSudokuLevels(value, date) {
  const state = normalizeSudokuState(value);
  return SUDOKU_LEVELS.filter(
    (level) => sudokuStatus(state.games[level], dailySudoku(date, level)).complete,
  );
}

/** Keep each difficulty independent when merging a backup into local progress. */
export function mergeSudokuProgress(current, incoming, date) {
  const a = normalizeSudokuState(current),
    b = normalizeSudokuState(incoming);
  return {
    difficulty: a.difficulty,
    games: Object.fromEntries(
      SUDOKU_LEVELS.map((level) => {
        const puzzle = dailySudoku(date, level);
        const left = sudokuStatus(a.games[level], puzzle),
          right = sudokuStatus(b.games[level], puzzle);
        const noteCount = (game) => game.notes.reduce((total, notes) => total + notes.length, 0);
        const preferIncoming =
          !left.complete &&
          (right.complete ||
            right.correct > left.correct ||
            (right.correct === left.correct &&
              (right.filled > left.filled ||
                (right.filled === left.filled &&
                  noteCount(b.games[level]) > noteCount(a.games[level])))));
        return [level, preferIncoming ? b.games[level] : a.games[level]];
      }),
    ),
  };
}
