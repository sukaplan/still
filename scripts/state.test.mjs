import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDay,
  puzzleStatus,
  goalStatus,
  goalSteps,
  stepsFromText,
  setGoalStep,
  MOMENTS,
} from '../src/state.mjs';
import { CROSSWORDS, dailyCrossword, crosswordStatus } from '../src/crosswords.mjs';
import { normalizeImageResults, imageSearchResponse } from '../src/images.mjs';

test('finished Word Garden always offers the result, for wins and six failed attempts', () => {
  assert.equal(puzzleStatus({ guesses: ['GREEN'] }, 'GREEN').label, 'View result');
  assert.equal(puzzleStatus({ guesses: ['GREEN'] }, 'GREEN').badge, 'Solved');
  const lost = puzzleStatus(
    { guesses: ['APPLE', 'BLOOM', 'PLANT', 'PAINT', 'PEACE', 'LIGHT'] },
    'GREEN',
  );
  assert.equal(lost.complete, true);
  assert.equal(lost.label, 'View result');
  assert.equal(puzzleStatus({ guesses: ['APPLE'] }, 'GREEN').label, 'Continue');
  assert.equal(puzzleStatus({}, 'GREEN').label, 'Play');
});
test('completion is deduplicated and crossword progress survives normalization', () => {
  const d = normalizeDay({
    done: ['art', 'art', 'invalid', 'crossword'],
    guesses: [],
    crossword: { letters: ['A', 'b', '<', 'Z'] },
  });
  assert.deepEqual(d.done, ['art', 'crossword']);
  assert.deepEqual(d.crossword.letters.slice(0, 4), ['A', '', '', 'Z']);
  assert.equal(MOMENTS.length, 8);
});
test('old next steps migrate without inventing progress from a slider', () => {
  assert.deepEqual(goalSteps({ next: 'Book a ticket', progress: 75 }), [
    { id: 'first-step', text: 'Book a ticket', done: false },
  ]);
  assert.equal(goalStatus({ next: 'Book a ticket', progress: 75 }).progress, 0);
  assert.equal(goalStatus({ next: 'Book a ticket', progress: 100 }).achieved, true);
});
test('progress follows checked steps and can be undone', () => {
  const goal = {
    steps: [
      { id: 'a', text: 'Choose a place', done: false },
      { id: 'b', text: 'Book a ticket', done: false },
    ],
  };
  const first = setGoalStep(goal, 'a', true);
  assert.equal(goalStatus(first).progress, 50);
  assert.equal(goalStatus(first).achieved, false);
  const second = setGoalStep(first, 'b', true);
  assert.equal(goalStatus(second).achieved, true);
  assert.equal(goalStatus(second).done, 2);
  assert.equal(goalStatus(setGoalStep(second, 'a', false)).progress, 50);
});
test('editing a checklist keeps completed steps and removes empty duplicates', () => {
  const steps = stepsFromText('Book a ticket\n\nBook a ticket\nPack a bag', [
    { id: 'book', text: 'Book a ticket', done: true },
  ]);
  assert.equal(steps.length, 2);
  assert.equal(steps[0].id, 'book');
  assert.equal(steps[0].done, true);
  assert.equal(steps[1].done, false);
  assert.equal(goalStatus({ steps: [], achieved: true }).achieved, true);
});
test('every daily crossword has consistent crossings, numbering, and clues', () => {
  assert.ok(CROSSWORDS.length >= 20);
  for (const puzzle of CROSSWORDS) {
    assert.equal(puzzle.rows.length, 5);
    assert.ok(puzzle.rows.every((r) => r.length === 5));
    const cells = puzzle.rows.join(''),
      coverage = Array(25).fill(0);
    for (const entry of puzzle.entries) {
      assert.ok(entry.clue);
      assert.ok(entry.answer.length >= 3);
      assert.equal(entry.cells.map((i) => cells[i]).join(''), entry.answer);
      for (const i of entry.cells) coverage[i]++;
    }
    for (let i = 0; i < 25; i++) if (cells[i] !== '#') assert.equal(coverage[i], 2);
  }
  assert.notDeepEqual(dailyCrossword('2026-11-01').rows, dailyCrossword('2026-11-02').rows);
});
test('crossword only completes when all playable letters are correct', () => {
  const puzzle = dailyCrossword('2026-11-01'),
    letters = puzzle.rows
      .join('')
      .split('')
      .map((c) => (c === '#' ? '' : c));
  assert.equal(crosswordStatus({}, puzzle).complete, false);
  assert.equal(crosswordStatus({ letters }, puzzle).complete, true);
  const i = letters.findIndex(Boolean);
  letters[i] = letters[i] === 'A' ? 'B' : 'A';
  assert.equal(crosswordStatus({ letters }, puzzle).complete, false);
});
test('image search returns safe raster photos with readable attribution', () => {
  const result = normalizeImageResults({
    query: {
      pages: {
        1: {
          pageid: 1,
          index: 1,
          title: 'File:Japan garden.jpg',
          imageinfo: [
            {
              mime: 'image/jpeg',
              thumburl: 'https://images.example/garden.jpg',
              descriptionurl: 'https://commons.wikimedia.org/wiki/File:Garden.jpg',
              extmetadata: {
                Artist: { value: '<a href="https://example.org">A photographer</a>' },
                LicenseShortName: { value: 'CC BY-SA 4.0' },
                LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' },
              },
            },
          ],
        },
        2: {
          pageid: 2,
          title: 'File:Script.svg',
          imageinfo: [{ mime: 'image/svg+xml', thumburl: 'javascript:bad' }],
        },
      },
    },
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].creator, 'A photographer');
  assert.equal(result[0].license, 'CC BY-SA 4.0');
  assert.ok(result[0].licenseUrl.startsWith('https://'));
});
test('image search validates queries and reports failures without pretending there are results', async () => {
  assert.equal(
    (await imageSearchResponse(new Request('https://still.example/api/images?q=a'))).status,
    400,
  );
  const old = globalThis.fetch;
  globalThis.fetch = async () => {
    throw Error('Offline');
  };
  try {
    assert.equal(
      (await imageSearchResponse(new Request('https://still.example/api/images?q=japan'))).status,
      503,
    );
  } finally {
    globalThis.fetch = old;
  }
});
