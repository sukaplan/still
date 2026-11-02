/** Daily Sudoku UI: three independent levels, notes, undo, hints, and checks. */
import {
  completedSudokuLevels,
  dailySudoku,
  normalizeSudokuGame,
  SUDOKU_LABELS,
  SUDOKU_LEVELS,
  SUDOKU_UNITS,
  sudokuStatus,
} from '../sudoku.mjs';
import { normalizeDay } from '../state.mjs';
import { session } from './context.js';
import { getTodayProgress, updatePersonalState } from './storage.js';
import {
  $,
  escapeHTML,
  html,
  modalTitle,
  openModal,
  renderButton,
  renderCardLabel,
  renderIcon,
} from './ui.js';
import { render } from './views.js';

function currentGame() {
  const state = getTodayProgress().sudoku;
  const level = state.difficulty;
  const puzzle = dailySudoku(session.today, level);
  return {
    level,
    puzzle,
    progress: state.games[level],
    status: sudokuStatus(state.games[level], puzzle),
  };
}
function historyFor(puzzle) {
  return (session.sudokuHistory[puzzle.id] ||= []);
}
export function renderSudokuCard() {
  const { level, puzzle, status } = currentGame();
  const solved = completedSudokuLevels(getTodayProgress().sudoku, session.today).length;
  return html`<article class="card sudoku-card${solved ? ' is-complete' : ''}">
    <div class="card-inner">
      <div class="card-topline">
        ${renderCardLabel('puzzle', 'Daily puzzle')}${solved
          ? html`<span class="completion-badge">${renderIcon('check')} Solved</span>`
          : ''}
      </div>
      <h2>Sudoku</h2>
      <div class="sudoku-preview" aria-hidden="true">
        ${[...puzzle.givens]
          .map(
            (value, index) =>
              html`<span
                class="${index % 9 === 2 || index % 9 === 5 ? 'box-right' : ''} ${Math.floor(
                  index / 9,
                ) === 2 || Math.floor(index / 9) === 5
                  ? 'box-bottom'
                  : ''}"
                >${value === '0' ? status.values[index] : value}</span
              >`,
          )
          .join('')}
      </div>
      <div class="card-bottom">
        ${renderButton(
          'sudoku',
          (status.complete
            ? 'View result'
            : status.filled || status.notes.some((notes) => notes.length)
              ? 'Continue'
              : 'Play') +
            ' ' +
            renderIcon('arrow'),
        )}<span class="source-meta"
          >${SUDOKU_LABELS[level]}${solved ? ` · ${solved}/3 solved` : ''}</span
        >
      </div>
    </div>
  </article>`;
}
export function openSudoku(message = '', focus = false) {
  const { level, puzzle, status } = currentGame();
  if (!Number.isInteger(session.sudokuCell) || session.sudokuCell < 0 || session.sudokuCell >= 81)
    session.sudokuCell = [...puzzle.givens].findIndex((value) => value === '0');
  const selected = session.sudokuCell;
  const selectedValue = status.values[selected];
  const peers = new Set(SUDOKU_UNITS.filter((unit) => unit.includes(selected)).flat());
  const editable = puzzle.givens[selected] === '0' && !status.complete;
  openModal(
    html`${modalTitle('Sudoku', '')}
      <div class="sudoku-levels" role="group" aria-label="Sudoku difficulty">
        ${SUDOKU_LEVELS.map((difficulty) =>
          renderButton(
            'sudoku-level',
            SUDOKU_LABELS[difficulty] +
              (sudokuStatus(
                getTodayProgress().sudoku.games[difficulty],
                dailySudoku(session.today, difficulty),
              ).complete
                ? ' ' + renderIcon('check')
                : ''),
            'sudoku-level' + (level === difficulty ? ' active' : ''),
            `data-level="${difficulty}" aria-pressed="${level === difficulty}"`,
          ),
        ).join('')}
      </div>
      <div class="sudoku-meta">
        <span>${status.complete ? 'Completed' : `${status.filled} / ${status.total} filled`}</span
        ><span
          >${status.hints
            ? `${status.hints} hint${status.hints === 1 ? '' : 's'}`
            : 'No rush.'}</span
        >
      </div>
      <p class="sudoku-instructions">Each row, column, and 3 × 3 box needs 1–9.</p>
      <div
        class="sudoku-grid"
        role="grid"
        aria-label="${SUDOKU_LABELS[level]} Sudoku"
        aria-rowcount="9"
        aria-colcount="9"
      >
        ${Array.from(
          { length: 9 },
          (_, row) =>
            html`<div class="sudoku-row" role="row">
              ${Array.from({ length: 9 }, (_, col) => {
                const index = row * 9 + col;
                const given = puzzle.givens[index] !== '0';
                const value = status.values[index];
                const notes = value ? [] : status.notes[index];
                const incorrect =
                  status.conflicts.has(index) ||
                  (session.sudokuChecked && value && value !== puzzle.solution[index]);
                const classes = [
                  'sudoku-cell',
                  given ? 'given' : 'entered',
                  peers.has(index) ? 'peer' : '',
                  selectedValue && value === selectedValue ? 'matching' : '',
                  selected === index ? 'selected' : '',
                  incorrect ? 'incorrect' : '',
                  col === 2 || col === 5 ? 'box-right' : '',
                  row === 2 || row === 5 ? 'box-bottom' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return html`<div
                  role="gridcell"
                  aria-selected="${selected === index}"
                  aria-rowindex="${row + 1}"
                  aria-colindex="${col + 1}"
                >
                  <button
                    type="button"
                    class="${classes}"
                    data-action="sudoku-cell"
                    data-sudoku-cell="${index}"
                    tabindex="${selected === index ? '0' : '-1'}"
                    aria-label="Row ${row + 1}, column ${col + 1}: ${given
                      ? 'given '
                      : ''}${value || (notes.length ? 'notes ' + notes.join(', ') : 'empty')}"
                    ${incorrect ? 'aria-invalid="true"' : ''}
                  >
                    ${value ||
                    html`<span class="sudoku-notes" aria-hidden="true"
                      >${[...'123456789']
                        .map((number) => html`<i>${notes.includes(number) ? number : ''}</i>`)
                        .join('')}</span
                    >`}
                  </button>
                </div>`;
              }).join('')}
            </div>`,
        ).join('')}
      </div>
      <div class="sudoku-message" role="status" aria-live="polite">
        ${escapeHTML(
          message ||
            (status.complete
              ? `${SUDOKU_LABELS[level]} solved. Well done.`
              : session.sudokuNotes
                ? 'Pencil notes on'
                : ''),
        )}
      </div>
      <div class="sudoku-number-pad" role="group" aria-label="Enter a number">
        ${[...'123456789']
          .map((number) =>
            renderButton(
              'sudoku-number',
              number,
              'sudoku-number',
              `data-number="${number}" aria-label="Enter ${number}"${editable ? '' : ' disabled'}`,
            ),
          )
          .join('')}
      </div>
      <div class="sudoku-tools">
        ${renderButton(
          'sudoku-notes',
          renderIcon('edit') + ' Notes',
          'secondary-button' + (session.sudokuNotes ? ' active' : ''),
          `aria-pressed="${session.sudokuNotes}"${status.complete ? ' disabled' : ''}`,
        )}${renderButton(
          'sudoku-erase',
          'Erase',
          'secondary-button',
          editable ? '' : 'disabled',
        )}${renderButton(
          'sudoku-undo',
          'Undo',
          'secondary-button',
          historyFor(puzzle).length ? '' : 'disabled',
        )}${renderButton(
          'sudoku-hint',
          'Hint',
          'secondary-button',
          status.complete ? 'disabled' : '',
        )}${renderButton(
          'sudoku-check',
          'Check',
          'secondary-button',
          status.complete ? 'disabled' : '',
        )}
      </div>
      <div class="sudoku-footer">
        <span>New puzzles daily · Progress saved</span>${renderButton(
          'sudoku-reset',
          'Reset level',
          'text-link',
        )}
      </div>`,
    'sudoku',
  );
  if (focus) $('[data-sudoku-cell="' + selected + '"]')?.focus({ preventScroll: true });
}
export function selectSudokuCell(index, focus = false) {
  if (!Number.isInteger(index) || index < 0 || index >= 81) return;
  session.sudokuCell = index;
  session.sudokuResetPending = false;
  openSudoku('', focus);
}
export function changeSudokuLevel(level) {
  if (!SUDOKU_LEVELS.includes(level)) return;
  if (
    !updatePersonalState((state) => {
      state.days[session.today] = normalizeDay(state.days[session.today]);
      state.days[session.today].sudoku.difficulty = level;
    })
  )
    return;
  session.sudokuCell = null;
  session.sudokuChecked = false;
  session.sudokuResetPending = false;
  render();
  openSudoku();
}
function commitGame(next, message = '', remember = true) {
  const { level, puzzle, progress } = currentGame();
  if (
    !updatePersonalState((state) => {
      const day = (state.days[session.today] = normalizeDay(state.days[session.today]));
      day.sudoku.games[level] = normalizeSudokuGame(next);
      day.done = day.done.filter((kind) => kind !== 'sudoku');
      if (completedSudokuLevels(day.sudoku, session.today).length) day.done.push('sudoku');
    })
  )
    return false;
  if (remember) {
    const history = historyFor(puzzle);
    history.push(normalizeSudokuGame(progress));
    if (history.length > 100) history.shift();
  }
  session.sudokuChecked = false;
  session.sudokuResetPending = false;
  render();
  openSudoku(message, true);
  return true;
}
export function enterSudokuNumber(number) {
  const { puzzle, progress, status } = currentGame();
  const index = session.sudokuCell;
  if (!/^[1-9]$/.test(number) || puzzle.givens[index] !== '0' || status.complete) return;
  const next = normalizeSudokuGame(progress);
  if (session.sudokuNotes) {
    if (status.values[index]) return;
    next.notes[index] = next.notes[index].includes(number)
      ? next.notes[index].filter((value) => value !== number)
      : [...next.notes[index], number].sort();
  } else {
    if (next.values[index] === number) return;
    next.values[index] = number;
    next.notes[index] = [];
    for (const unit of SUDOKU_UNITS.filter((unit) => unit.includes(index)))
      for (const peer of unit)
        next.notes[peer] = next.notes[peer].filter((value) => value !== number);
  }
  commitGame(next);
}
export function eraseSudokuCell() {
  const { puzzle, progress, status } = currentGame();
  const index = session.sudokuCell;
  if (puzzle.givens[index] !== '0' || status.complete) return;
  const next = normalizeSudokuGame(progress);
  if (!next.values[index] && !next.notes[index].length) return;
  next.values[index] = '';
  next.notes[index] = [];
  commitGame(next);
}
export function handleSudokuAction(action, button) {
  if (action !== 'sudoku-reset') session.sudokuResetPending = false;
  if (action === 'sudoku') {
    session.sudokuCell = null;
    session.sudokuResetPending = false;
    openSudoku();
  } else if (action === 'sudoku-cell') selectSudokuCell(Number(button.dataset.sudokuCell), true);
  else if (action === 'sudoku-level') changeSudokuLevel(button.dataset.level);
  else if (action === 'sudoku-number') enterSudokuNumber(button.dataset.number);
  else if (action === 'sudoku-erase') eraseSudokuCell();
  else if (action === 'sudoku-notes') {
    session.sudokuNotes = !session.sudokuNotes;
    openSudoku('', true);
  } else if (action === 'sudoku-check') {
    const { puzzle, status } = currentGame();
    session.sudokuChecked = true;
    const wrong = status.values.filter((value, i) => value && value !== puzzle.solution[i]).length;
    openSudoku(
      wrong
        ? `${wrong} number${wrong === 1 ? ' needs' : 's need'} another look.`
        : 'So far, so good.',
      true,
    );
  } else if (action === 'sudoku-undo') {
    const history = historyFor(currentGame().puzzle);
    const previous = history.at(-1);
    if (previous && commitGame(previous, 'Last move undone.', false)) history.pop();
    openSudoku('Last move undone.', true);
  } else if (action === 'sudoku-hint') {
    const { puzzle, progress, status } = currentGame();
    if (status.complete) return;
    let index = session.sudokuCell;
    if (puzzle.givens[index] !== '0' || status.values[index] === puzzle.solution[index])
      index = status.values.findIndex((value, i) => value !== puzzle.solution[i]);
    const next = normalizeSudokuGame(progress);
    next.values[index] = puzzle.solution[index];
    next.notes[index] = [];
    next.hints++;
    session.sudokuCell = index;
    commitGame(next, 'One number revealed.');
  } else if (action === 'sudoku-reset') {
    if (!session.sudokuResetPending) {
      session.sudokuResetPending = true;
      button.textContent = 'Reset this level? Tap again';
    } else commitGame(normalizeSudokuGame(), 'Level reset.');
  }
}
export function handleSudokuKey(event) {
  if (!event.target.closest('[data-sudoku-cell]') || event.ctrlKey || event.metaKey || event.altKey)
    return false;
  const index = Number(event.target.closest('[data-sudoku-cell]').dataset.sudokuCell);
  const row = Math.floor(index / 9),
    col = index % 9;
  let next;
  if (event.key === 'ArrowRight') next = row * 9 + ((col + 1) % 9);
  if (event.key === 'ArrowLeft') next = row * 9 + ((col + 8) % 9);
  if (event.key === 'ArrowDown') next = ((row + 1) % 9) * 9 + col;
  if (event.key === 'ArrowUp') next = ((row + 8) % 9) * 9 + col;
  if (next !== undefined) selectSudokuCell(next, true);
  else if (/^[1-9]$/.test(event.key)) enterSudokuNumber(event.key);
  else if (['Backspace', 'Delete', '0'].includes(event.key)) eraseSudokuCell();
  else if (event.key.toLowerCase() === 'n') {
    session.sudokuNotes = !session.sudokuNotes;
    openSudoku('', true);
  } else return false;
  event.preventDefault();
  return true;
}
