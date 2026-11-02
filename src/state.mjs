import { DISCOVERY_KINDS, normalizeReadings } from './discoveries.mjs';
import { normalizeSudokuState } from './sudoku.mjs';

export const MOMENTS = [
  'puzzle',
  'crossword',
  'sudoku',
  'science',
  'astronomy',
  'tech',
  'german',
  'art',
];

export function normalizeDay(value = {}) {
  const readings = normalizeReadings(value.readings);
  return {
    readings,
    done: [
      ...new Set([
        ...(Array.isArray(value.done) ? value.done : []).filter((x) => MOMENTS.includes(x)),
        ...DISCOVERY_KINDS.filter((kind) => readings[kind].length),
      ]),
    ],
    guesses: [
      ...new Set(
        (Array.isArray(value.guesses) ? value.guesses : []).filter(
          (x) => typeof x === 'string' && /^[A-Z]{5}$/.test(x),
        ),
      ),
    ].slice(0, 6),
    sudoku: normalizeSudokuState(value.sudoku),
    crossword: {
      letters: Array.from({ length: 25 }, (_, i) =>
        typeof value.crossword?.letters?.[i] === 'string' &&
        /^[A-Z]$/.test(value.crossword.letters[i])
          ? value.crossword.letters[i]
          : '',
      ),
    },
  };
}

export function puzzleStatus(value, answer) {
  const { guesses } = normalizeDay(value),
    won = guesses.includes(answer),
    complete = won || guesses.length === 6;
  return {
    won,
    complete,
    label: complete ? 'View result' : guesses.length ? 'Continue' : 'Play',
    badge: won ? 'Solved' : complete ? 'Completed' : '',
  };
}

export function goalSteps(goal) {
  if (Array.isArray(goal.steps))
    return goal.steps
      .slice(0, 20)
      .filter((s) => s && typeof s.text === 'string' && s.text.trim())
      .map((s, i) => ({
        id: String(s.id || 'step-' + i).slice(0, 100),
        text: s.text.trim().slice(0, 200),
        done: !!s.done,
      }));
  return typeof goal.next === 'string' && goal.next.trim()
    ? [{ id: 'first-step', text: goal.next.trim().slice(0, 200), done: goal.progress === 100 }]
    : [];
}

export function goalStatus(goal) {
  const steps = goalSteps(goal),
    done = steps.filter((s) => s.done).length,
    total = steps.length;
  const achieved = total ? done === total : goal.achieved === true || goal.progress === 100;
  return {
    steps,
    done,
    total,
    achieved,
    progress: total ? Math.round((done / total) * 100) : achieved ? 100 : 0,
  };
}

export function stepsFromText(text, previous = []) {
  const seen = new Set();
  return String(text)
    .split(/\r?\n/)
    .map((s) => s.trim().slice(0, 200))
    .filter((s) => {
      const key = s.toLowerCase();
      if (!s || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20)
    .map((text) => {
      const old = previous.find((s) => s.text.toLowerCase() === text.toLowerCase());
      return { id: old?.id || crypto.randomUUID(), text, done: old?.done || false };
    });
}

export function setGoalStep(goal, id, checked) {
  const steps = goalSteps(goal).map((s) => (s.id === id ? { ...s, done: checked } : s));
  const status = goalStatus({ ...goal, steps });
  return { ...goal, steps, progress: status.progress, achieved: status.achieved };
}
