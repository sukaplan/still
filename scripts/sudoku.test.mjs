import test from 'node:test';
import assert from 'node:assert/strict';
import BANK from '../src/data/sudoku.json' with { type: 'json' };
import {
  completedSudokuLevels,
  dailySudoku,
  mergeSudokuProgress,
  normalizeSudokuGame,
  normalizeSudokuState,
  SUDOKU_LEVELS,
  solveSudoku,
  solveSudokuSingles,
  sudokuCandidates,
  sudokuConflicts,
  sudokuStatus,
} from '../src/sudoku.mjs';
import { normalizeDay } from '../src/state.mjs';
import {
  createInitialState,
  mergeDayProgress,
  normalizePersonalState,
} from '../src/client/storage.js';

const date = '2026-11-02';
const solvedGame = (puzzle) => ({ values: [...puzzle.solution] });

test('every bank puzzle has exactly one valid solution and meets its difficulty floor', () => {
  for (const level of SUDOKU_LEVELS) {
    assert.equal(BANK[level].length, 8);
    for (const puzzle of BANK[level]) {
      assert.match(puzzle.givens, /^[0-9]{81}$/);
      assert.match(puzzle.solution, /^[1-9]{81}$/);
      const result = solveSudoku(puzzle.givens);
      assert.equal(result.count, 1);
      assert.equal(result.solution, puzzle.solution);
      assert.equal(sudokuConflicts([...puzzle.solution]).size, 0);
      const naked = solveSudokuSingles(puzzle.givens, false);
      const hidden = solveSudokuSingles(puzzle.givens, true);
      if (level === 'easy') assert.ok(naked.complete);
      if (level === 'medium') {
        assert.ok(!naked.complete);
        assert.ok(hidden.complete);
      }
      if (level === 'hard') assert.ok(!hidden.complete);
    }
  }
});

test('daily transformations remain unique, stable, and different on successive days', () => {
  for (const level of SUDOKU_LEVELS) {
    const previous = new Set();
    for (let day = 1; day <= 30; day++) {
      const date = `2026-11-${String(day).padStart(2, '0')}`;
      const puzzle = dailySudoku(date, level);
      assert.deepEqual(dailySudoku(date, level), puzzle);
      assert.ok(!previous.has(puzzle.givens));
      previous.add(puzzle.givens);
      const result = solveSudoku(puzzle.givens);
      assert.equal(result.count, 1);
      assert.equal(result.solution, puzzle.solution);
      for (let i = 0; i < 81; i++)
        if (puzzle.givens[i] !== '0') assert.equal(puzzle.givens[i], puzzle.solution[i]);
    }
  }
});

test('progress normalization preserves independent levels and removes malformed values and notes', () => {
  const state = normalizeSudokuState({
    difficulty: 'medium',
    games: {
      easy: { values: ['2', 'x', 9, '<'], notes: [['1', '1', '3', '0', 5], null], hints: -5 },
      hard: { values: ['8'] },
    },
  });
  assert.equal(state.difficulty, 'medium');
  assert.deepEqual(state.games.easy.values.slice(0, 4), ['2', '', '', '']);
  assert.deepEqual(state.games.easy.notes[0], ['1', '3']);
  assert.deepEqual(state.games.easy.notes[1], []);
  assert.equal(state.games.easy.hints, 0);
  assert.equal(state.games.medium.values.length, 81);
  assert.equal(state.games.hard.values[0], '8');
  assert.equal(normalizeSudokuState(null).difficulty, 'easy');
  assert.equal(normalizeDay({ guesses: ['PLANT'] }).sudoku.games.easy.values.length, 81);
});

test('row, column, and box conflicts are detected without treating notes as entries', () => {
  for (const [left, right] of [
    [0, 8],
    [0, 72],
    [0, 10],
  ]) {
    const board = Array(81).fill('');
    board[left] = board[right] = '3';
    assert.deepEqual(
      [...sudokuConflicts(board)].sort((a, b) => a - b),
      [left, right],
    );
  }
  const board = Array(81).fill('');
  board[0] = board[40] = '3';
  assert.equal(sudokuConflicts(board).size, 0);
  assert.ok(!sudokuCandidates(board, 1).includes('3'));
  assert.equal(solveSudoku('11' + '0'.repeat(79)).count, 0);
});

test('only an exactly solved grid completes a level and fixed clues cannot be overridden by saved data', () => {
  const puzzle = dailySudoku(date, 'easy');
  assert.ok(!sudokuStatus({}, puzzle).complete);
  const game = solvedGame(puzzle);
  assert.ok(sudokuStatus(game, puzzle).complete);
  const empty = puzzle.givens.indexOf('0');
  game.values[empty] = puzzle.solution[empty] === '1' ? '2' : '1';
  const status = sudokuStatus(game, puzzle);
  assert.equal(status.filled, status.total);
  assert.ok(!status.complete);
  const fixed = [...puzzle.givens].findIndex((value) => value !== '0');
  game.values[fixed] = '9';
  assert.equal(sudokuStatus(game, puzzle).values[fixed], puzzle.givens[fixed]);
  assert.ok(
    !sudokuStatus({ notes: Array.from({ length: 81 }, () => ['1', '2']) }, puzzle).complete,
  );
});

test('backup merges keep solved levels, other difficulty progress, and a single daily completion', () => {
  const current = normalizeSudokuState(),
    incoming = normalizeSudokuState();
  current.games.easy = normalizeSudokuGame(solvedGame(dailySudoku(date, 'easy')));
  incoming.games.medium = normalizeSudokuGame(solvedGame(dailySudoku(date, 'medium')));
  const hard = dailySudoku(date, 'hard'),
    cell = hard.givens.indexOf('0');
  current.games.hard.values[cell] = hard.solution[cell];
  const merged = mergeSudokuProgress(current, incoming, date);
  assert.deepEqual(completedSudokuLevels(merged, date), ['easy', 'medium']);
  assert.equal(merged.games.hard.values[cell], hard.solution[cell]);
  const day = mergeDayProgress(
    { sudoku: current, done: ['art', 'sudoku'] },
    { sudoku: incoming, done: ['sudoku'] },
    date,
  );
  assert.deepEqual(day.done, ['art', 'sudoku']);
  const backup = createInitialState();
  backup.days[date] = day;
  const restored = normalizePersonalState(JSON.parse(JSON.stringify(backup)));
  assert.deepEqual(completedSudokuLevels(restored.days[date].sudoku, date), ['easy', 'medium']);
  backup.days[date] = { done: ['sudoku'] };
  assert.ok(!normalizePersonalState(backup).days[date].done.includes('sudoku'));
});

test('a notes-only backup is recovered when that day already exists for other activities', () => {
  const incoming = normalizeSudokuState();
  incoming.games.medium.notes[0] = ['2', '5'];
  const day = mergeDayProgress({ done: ['german'] }, { sudoku: incoming }, date);
  assert.deepEqual(day.sudoku.games.medium.notes[0], ['2', '5']);
  assert.deepEqual(day.done, ['german']);
});
