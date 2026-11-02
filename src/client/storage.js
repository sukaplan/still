import { normalizeReadings } from '../discoveries.mjs';
import { completedSudokuLevels, mergeSudokuProgress } from '../sudoku.mjs';
import { openSudoku } from './sudoku.js';
/** Browser-local personal data, legacy migrations, backup/import, and cross-tab sync. */
import { crosswordStatus, dailyCrossword } from '../crosswords.mjs';
import { dailyPuzzle } from '../word-garden.mjs';
import { validMoonLocation } from '../moon.mjs';
import { goalStatus, normalizeDay, puzzleStatus } from '../state.mjs';
import { loadDaily, updateCompletionButton } from './content.js';
import { session } from './context.js';
import { openCrossword } from './crossword.js';
import { openMoon } from './moon-ui.js';
import { $, closeModal, toast } from './ui.js';
import { render } from './views.js';
import { openWordGarden } from './word-garden.js';
export const STORAGE = 'still.personal.v1';
export const SAMPLE_GOALS = [
  {
    id: 'sample-german',
    title: 'Learn German',
    category: 'Things to learn',
    note: '',
    steps: [
      {
        id: 'german-course',
        text: 'Finish a beginner course',
        done: false,
      },
      {
        id: 'german-conversation',
        text: 'Have a ten-minute conversation',
        done: false,
      },
      {
        id: 'german-story',
        text: 'Read a short story in German',
        done: false,
      },
    ],
    progress: 0,
    image: '/assets/room.jpg',
    sample: true,
  },
  {
    id: 'sample-water',
    title: 'Travel',
    category: 'Places to go',
    note: '',
    steps: [
      {
        id: 'travel-place',
        text: 'Choose a destination',
        done: false,
      },
      {
        id: 'travel-plan',
        text: 'Set a budget and dates',
        done: false,
      },
      {
        id: 'travel-book',
        text: 'Book the trip',
        done: false,
      },
    ],
    progress: 0,
    image: '/assets/lake.jpg',
    sample: true,
  },
  {
    id: 'sample-morning',
    title: 'Daily focus',
    category: 'Life to build',
    note: '',
    steps: [
      {
        id: 'focus-time',
        text: 'Choose a daily time',
        done: false,
      },
      {
        id: 'focus-place',
        text: 'Prepare a quiet space',
        done: false,
      },
      {
        id: 'focus-week',
        text: 'Keep the routine for a week',
        done: false,
      },
    ],
    progress: 0,
    image: '/assets/mountain.jpg',
    sample: true,
  },
];
export const GOAL_CATEGORIES = [
  'Things to learn',
  'Places to go',
  'Life to build',
  'How I want to feel',
];
export const createInitialState = () => ({
  version: 1,
  timezone: 'Europe/Istanbul',
  theme: 'light',
  location: null,
  goals: structuredClone(SAMPLE_GOALS),
  saved: [],
  days: {},
  reflections: {},
});
export const safeImage = (s) =>
  typeof s === 'string' &&
  (/^(\/assets\/(lake|room|mountain|forest|earth|monet)\.jpg)$/.test(s) ||
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s) ||
    validURL(s))
    ? s
    : '/assets/lake.jpg';
export function validURL(s) {
  try {
    const u = new URL(s);
    return u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}
export function photoCredit(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    title: String(value.title || '').slice(0, 160),
    creator: String(value.creator || '').slice(0, 240),
    license: String(value.license || '').slice(0, 80),
    url: validURL(value.url),
    licenseUrl: validURL(value.licenseUrl),
  };
}
export function normalizePersonalState(value) {
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.goals) ||
    !Array.isArray(value.saved) ||
    typeof value.days !== 'object' ||
    !value.days
  )
    throw Error('Invalid backup');
  const normalized = createInitialState();
  normalized.theme = value.theme === 'dark' ? 'dark' : 'light';
  try {
    new Intl.DateTimeFormat('en', {
      timeZone: value.timezone,
    });
    normalized.timezone = value.timezone;
  } catch {}
  normalized.location = validMoonLocation(value.location);
  normalized.goals = value.goals.slice(0, 60).map((g) => {
    const preset =
      g.sample &&
      (!Array.isArray(g.steps) || (g.steps.length === 1 && g.steps[0].id === 'first-step'))
        ? SAMPLE_GOALS.find((x) => x.id === g.id)
        : null;
    if (preset)
      g = {
        ...g,
        steps: preset.steps.map((step) => ({
          ...step,
          done: g.progress === 100,
        })),
      };
    const status = goalStatus(g);
    return {
      id: String(g.id || crypto.randomUUID()).slice(0, 100),
      title: String(g.title || 'A new intention').slice(0, 90),
      category: GOAL_CATEGORIES.includes(g.category) ? g.category : GOAL_CATEGORIES[0],
      note: String(g.note || '').slice(0, 1000),
      next: status.steps.find((x) => !x.done)?.text || '',
      steps: status.steps,
      achieved: status.achieved,
      progress: status.progress,
      legacyProgress:
        g.legacyProgress ?? (!Array.isArray(g.steps) ? Number(g.progress) || 0 : undefined),
      date: /^\d{4}-\d{2}-\d{2}$/.test(g.date || '') ? g.date : '',
      image: safeImage(g.image),
      photoCredit: photoCredit(g.photoCredit),
      sample: !!g.sample,
    };
  });
  normalized.saved = value.saved
    .slice(0, 200)
    .filter(
      (x) => x && ['art', 'science', 'concept', 'astronomy', 'tech', 'german'].includes(x.kind),
    )
    .map((x) => ({
      ...x,
      id: String(x.id).slice(0, 200),
      title: String(x.title || 'A discovery').slice(0, 500),
      url: validURL(x.url),
      image: x.image ? safeImage(x.image) : '',
      description: String(x.description || '').slice(0, 1200),
    }));
  normalized.days = {};
  for (const [k, x] of Object.entries(value.days).slice(-365)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && x && typeof x === 'object') {
      const d = normalizeDay(x);
      if (crosswordStatus(d.crossword, dailyCrossword(k)).complete && !d.done.includes('crossword'))
        d.done.push('crossword');
      if (puzzleStatus(d, dailyPuzzle(k).answer).complete && !d.done.includes('puzzle'))
        d.done.push('puzzle');
      d.done = d.done.filter((kind) => kind !== 'sudoku');
      if (completedSudokuLevels(d.sudoku, k).length) d.done.push('sudoku');
      normalized.days[k] = d;
    }
  }
  normalized.reflections = {};
  for (const [k, x] of Object.entries(value.reflections || {}).slice(-365))
    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof x === 'string')
      normalized.reflections[k] = x.slice(0, 3000);
  return normalized;
}
export function localDateKey() {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: session.state.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  return ['year', 'month', 'day'].map((t) => p.find((x) => x.type === t).value).join('-');
}
export function formatDate(d = session.today) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(d + 'T12:00:00Z'));
}
export function getTodayProgress() {
  const d = normalizeDay(session.state.days[session.today]);
  if (
    crosswordStatus(d.crossword, dailyCrossword(session.today)).complete &&
    !d.done.includes('crossword')
  )
    d.done.push('crossword');
  if (puzzleStatus(d, dailyPuzzle(session.today).answer).complete && !d.done.includes('puzzle'))
    d.done.push('puzzle');
  d.done = d.done.filter((kind) => kind !== 'sudoku');
  if (completedSudokuLevels(d.sudoku, session.today).length) d.done.push('sudoku');
  return d;
}
export function updatePersonalState(change) {
  const before = structuredClone(session.state);
  try {
    const latest = localStorage.getItem(STORAGE);
    if (latest) session.state = normalizePersonalState(JSON.parse(latest));
  } catch {}
  change(session.state);
  try {
    localStorage.setItem(STORAGE, JSON.stringify(session.state));
    session.storageAvailable = true;
    return true;
  } catch {
    session.state = before;
    session.storageAvailable = false;
    toast('Your browser storage is full or unavailable. Export a backup in Settings.');
    return false;
  }
}
export function exportBackup() {
  const blob = new Blob([JSON.stringify(session.state, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'still-my-little-world-' + session.today + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Backup exported');
}
export function mergeDayProgress(current, backup, date) {
  const a = normalizeDay(current),
    b = normalizeDay(backup),
    answer = dailyPuzzle(date).answer;
  const guesses = puzzleStatus(a, answer).won
    ? a.guesses
    : puzzleStatus(b, answer).won
      ? b.guesses
      : a.guesses.length >= b.guesses.length
        ? a.guesses
        : b.guesses;
  const puzzle = dailyCrossword(date),
    ac = crosswordStatus(a.crossword, puzzle),
    bc = crosswordStatus(b.crossword, puzzle),
    crossword =
      bc.correct > ac.correct || (bc.correct === ac.correct && bc.filled > ac.filled)
        ? b.crossword
        : a.crossword;
  const done = [...new Set([...a.done, ...b.done])].filter(
    (k) => !['puzzle', 'crossword', 'sudoku'].includes(k),
  );
  if (
    puzzleStatus(
      {
        guesses,
      },
      answer,
    ).complete
  )
    done.push('puzzle');
  if (crosswordStatus(crossword, puzzle).complete) done.push('crossword');
  const sudoku = mergeSudokuProgress(a.sudoku, b.sudoku, date);
  if (completedSudokuLevels(sudoku, date).length) done.push('sudoku');
  const readings = normalizeReadings(
    Object.fromEntries(
      Object.keys(a.readings).map((kind) => [kind, [...a.readings[kind], ...b.readings[kind]]]),
    ),
  );
  return { done, guesses, crossword, sudoku, readings };
}
export async function importBackup(file) {
  try {
    if (file.size > 8 * 1024 * 1024) throw Error('Too large');
    const imported = normalizePersonalState(JSON.parse(await file.text()));
    if (
      updatePersonalState((s) => {
        for (const g of imported.goals) {
          const i = s.goals.findIndex((x) => x.id === g.id);
          if (i >= 0) s.goals[i] = g;
          else if (s.goals.length < 60) s.goals.push(g);
        }
        const ids = new Set(s.saved.map((x) => x.id));
        s.saved.push(...imported.saved.filter((x) => !ids.has(x.id)));
        s.saved = s.saved.slice(0, 200);
        for (const [d, x] of Object.entries(imported.days)) {
          const existing = s.days[d];
          s.days[d] = existing ? mergeDayProgress(existing, x, d) : x;
        }
        s.reflections = {
          ...s.reflections,
          ...imported.reflections,
        };
      })
    ) {
      closeModal();
      render();
      toast('Backup imported');
    }
  } catch {
    toast('This backup could not be read. Choose a Still JSON backup under 8 MB.');
  } finally {
    $('#import-file').value = '';
  }
}
export function syncPersonalData() {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return;
    const incoming = normalizePersonalState(JSON.parse(raw));
    if (JSON.stringify(incoming) === JSON.stringify(session.state)) return;
    const oldLocation = JSON.stringify(session.state.location),
      oldCrossword = JSON.stringify(getTodayProgress().crossword),
      oldGuesses = JSON.stringify(getTodayProgress().guesses),
      oldSudoku = JSON.stringify(getTodayProgress().sudoku),
      oldZone = session.state.timezone;
    session.state = incoming;
    session.today = localDateKey();
    if (oldZone !== session.state.timezone) loadDaily();
    else render();
    updateCompletionButton();
    if (session.modalKind === 'sudoku' && oldSudoku !== JSON.stringify(getTodayProgress().sudoku)) {
      session.sudokuHistory = {};
      openSudoku();
    }
    if (session.modalKind === 'moon' && oldLocation !== JSON.stringify(session.state.location))
      openMoon();
    if (
      session.modalKind === 'crossword' &&
      oldCrossword !== JSON.stringify(getTodayProgress().crossword)
    )
      openCrossword();
    if (
      session.modalKind === 'puzzle' &&
      oldGuesses !== JSON.stringify(getTodayProgress().guesses)
    ) {
      const draft = $('#guess-input')?.value || '';
      openWordGarden();
      if ($('#guess-input')) $('#guess-input').value = draft;
    }
  } catch {}
}
