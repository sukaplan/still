/** Mini crossword rendering, clue selection, typing, and answer checks. */
import { crosswordStatus, dailyCrossword } from '../crosswords.mjs';
import { normalizeDay } from '../state.mjs';
import { completionBadge, completionClass, setMomentComplete } from './content.js';
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
export function renderCrosswordCard() {
  const puzzle = dailyCrossword(session.today),
    status = crosswordStatus(getTodayProgress().crossword, puzzle);
  return html`<article class="card crossword-card${completionClass('crossword')}">
    <div class="card-inner">
      <div class="card-topline">
        ${renderCardLabel('puzzle', 'Daily puzzle')}${completionBadge('crossword')}
      </div>
      <h2>Mini crossword</h2>
      <div class="crossword-preview" aria-hidden="true">
        ${puzzle.rows
          .join('')
          .split('')
          .map(
            (letter, i) =>
              html`<span class="${letter === '#' ? 'block' : ''}"
                >${letter === '#' ? '' : escapeHTML(status.letters[i])}</span
              >`,
          )
          .join('')}
      </div>
      <div class="card-bottom">
        ${renderButton(
          'crossword',
          (status.complete ? 'View result' : status.filled ? 'Continue' : 'Play') +
            ' ' +
            renderIcon('arrow'),
        )}<span class="source-meta">${status.filled} / ${status.total}</span>
      </div>
    </div>
  </article>`;
}
export function selectedCrosswordEntry() {
  const puzzle = dailyCrossword(session.today);
  return puzzle.entries.find((x) => x.id === session.crosswordEntryId) || puzzle.entries[0];
}
export function focusCrosswordCell(index, flip = false) {
  const puzzle = dailyCrossword(session.today),
    current = selectedCrosswordEntry(),
    matches = puzzle.entries.filter((x) => x.cells.includes(index));
  if (!matches.length) return;
  const chosen = flip
    ? matches.find((x) => x.direction !== current.direction) || matches[0]
    : current.cells.includes(index)
      ? current
      : matches.find((x) => x.direction === current.direction) || matches[0];
  session.crosswordEntryId = chosen.id;
  session.crosswordCell = index;
  document.querySelectorAll('.crossword-cell').forEach((el) => {
    const i = Number(el.dataset.cell);
    el.classList.toggle('in-word', chosen.cells.includes(i));
    el.classList.toggle('current-cell', i === index);
  });
  document
    .querySelectorAll('.crossword-clue')
    .forEach((el) => el.classList.toggle('selected', el.dataset.id === chosen.id));
  const clue = $('#crossword-current-clue');
  if (clue) clue.textContent = chosen.number + ' ' + chosen.direction + ' · ' + chosen.clue;
}
export function openCrossword(message = '') {
  const puzzle = dailyCrossword(session.today),
    status = crosswordStatus(getTodayProgress().crossword, puzzle);
  if (!puzzle.entries.some((x) => x.id === session.crosswordEntryId))
    session.crosswordEntryId = puzzle.entries[0].id;
  const numbers = {};
  for (const entry of puzzle.entries) numbers[entry.cells[0]] = entry.number;
  openModal(
    html`${modalTitle('Mini crossword', '')}
      <p id="crossword-current-clue" class="crossword-current-clue"></p>
      <div class="crossword-layout">
        <div>
          <div class="crossword-grid" role="group" aria-label="Daily five by five mini crossword">
            ${puzzle.rows
              .join('')
              .split('')
              .map((letter, i) =>
                letter === '#'
                  ? '<div class="crossword-block" aria-hidden="true"></div>'
                  : html`<div class="crossword-cell" data-cell="${i}">
                      ${numbers[i]
                        ? html`<span class="crossword-number">${numbers[i]}</span>`
                        : ''}<input
                        data-crossword-cell="${i}"
                        maxlength="1"
                        value="${escapeHTML(status.letters[i])}"
                        aria-label="Row ${Math.floor(i / 5) + 1}, column ${(i % 5) + 1}"
                        autocomplete="off"
                        autocapitalize="characters"
                        spellcheck="false"
                        inputmode="text"
                        ${status.complete ? 'readonly' : ''}
                      />
                    </div>`,
              )
              .join('')}
          </div>
          <div id="crossword-message" class="puzzle-message" role="status" aria-live="polite">
            ${escapeHTML(message || (status.complete ? 'Solved.' : ''))}
          </div>
          <div class="crossword-actions">
            ${status.complete
              ? renderButton('close-modal', renderIcon('check') + ' Done', 'primary-button')
              : renderButton('check-crossword', 'Check answers', 'secondary-button')}
          </div>
        </div>
        <div class="crossword-clues">
          ${['across', 'down']
            .map(
              (direction) =>
                html`<section>
                  <h3>${direction[0].toUpperCase()}${direction.slice(1)}</h3>
                  ${puzzle.entries
                    .filter((x) => x.direction === direction)
                    .map((entry) =>
                      renderButton(
                        'crossword-clue',
                        html`<strong>${entry.number}</strong
                          ><span>${escapeHTML(entry.clue)}</span>`,
                        'crossword-clue',
                        'data-id="' + entry.id + '"',
                      ),
                    )
                    .join('')}
                </section>`,
            )
            .join('')}
        </div>
      </div>`,
    'crossword',
  );
  const entry = selectedCrosswordEntry(),
    index = session.crosswordCell ?? entry.cells[0];
  focusCrosswordCell(index);
  if (session.crosswordChecked) checkCrossword(false);
}
export function updateCrosswordLetter(index, value) {
  if (crosswordStatus(getTodayProgress().crossword, dailyCrossword(session.today)).complete) return;
  const letter = String(value)
      .replace(/[^a-z]/gi, '')
      .toUpperCase()
      .slice(-1),
    input = $('[data-crossword-cell="' + index + '"]');
  if (input) input.value = letter;
  if (
    !updatePersonalState((s) => {
      s.days[session.today] = normalizeDay(s.days[session.today]);
      s.days[session.today].crossword.letters[index] = letter;
    })
  )
    return;
  input?.parentElement.classList.remove('incorrect');
  render();
  const status = crosswordStatus(getTodayProgress().crossword, dailyCrossword(session.today));
  if (status.complete) {
    setMomentComplete('crossword', true);
    openCrossword('Solved.');
    return;
  }
  const entry = selectedCrosswordEntry(),
    next = entry.cells[entry.cells.indexOf(index) + 1];
  if (letter && next !== undefined) {
    focusCrosswordCell(next);
    $('[data-crossword-cell="' + next + '"]')?.focus();
  }
}
export function checkCrossword(showMessage = true) {
  const puzzle = dailyCrossword(session.today),
    status = crosswordStatus(getTodayProgress().crossword, puzzle),
    answer = puzzle.rows.join('');
  session.crosswordChecked = true;
  let incorrect = 0;
  document.querySelectorAll('[data-crossword-cell]').forEach((input) => {
    const i = Number(input.dataset.crosswordCell),
      wrong = !!status.letters[i] && status.letters[i] !== answer[i];
    input.parentElement.classList.toggle('incorrect', wrong);
    if (wrong) incorrect++;
  });
  if (showMessage)
    $('#crossword-message').textContent = incorrect
      ? 'Some letters need another look.'
      : status.complete
        ? 'Solved.'
        : 'So far, so good.';
}
