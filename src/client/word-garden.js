/** The daily word game and its six saved attempts. */
import { dailyPuzzle, scoreGuess } from '../word-garden.mjs';
import { setMomentComplete } from './content.js';
import { session } from './context.js';
import { getTodayProgress, updatePersonalState } from './storage.js';
import { $, escapeHTML, modalTitle, openModal, renderButton, renderIcon, html } from './ui.js';
import { render } from './views.js';
export function openWordGarden(message = '') {
  const { answer, hint } = dailyPuzzle(session.today),
    guesses = getTodayProgress().guesses,
    won = guesses.includes(answer),
    ended = won || guesses.length >= 6;
  const keyScores = {};
  for (const guess of guesses) {
    scoreGuess(guess, answer).forEach((s, i) => {
      const rank = {
        absent: 1,
        present: 2,
        correct: 3,
      };
      if (!keyScores[guess[i]] || rank[s] > rank[keyScores[guess[i]]]) keyScores[guess[i]] = s;
    });
  }
  let modalMarkup = html`${modalTitle('Word garden', 'DAILY PUZZLE')}
    <p>Guess the five-letter word in six tries. Any five-letter guess is accepted.</p>
    <div
      class="puzzle-board"
      role="img"
      aria-label="${escapeHTML(
        guesses.length +
          ' guesses made out of six. ' +
          guesses
            .map(
              (g) =>
                g +
                ': ' +
                scoreGuess(g, answer)
                  .map((v, i) => g[i] + ' ' + v)
                  .join(', '),
            )
            .join('. '),
      )}"
    >
      ${Array.from(
        {
          length: 6,
        },
        (_, i) =>
          html`<div class="puzzle-row">
            ${Array.from(
              {
                length: 5,
              },
              (_, j) =>
                html`<span class="tile ${guesses[i] ? scoreGuess(guesses[i], answer)[j] : ''}"
                  >${escapeHTML(guesses[i]?.[j] || '')}</span
                >`,
            ).join('')}
          </div>`,
      ).join('')}
    </div>
    <div class="puzzle-message" role="status" aria-live="polite">
      ${escapeHTML(
        message ||
          (won ? 'Solved.' : ended ? 'The word was ' + answer + '. New puzzle tomorrow.' : ''),
      )}
    </div>
    ${ended
      ? ''
      : html`<form id="puzzle-form">
          <div class="puzzle-input-row">
            <input
              id="guess-input"
              aria-label="Five-letter guess"
              maxlength="5"
              minlength="5"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck="false"
              pattern="[a-zA-Z]{5}"
              required
            /><button class="primary-button" type="submit">Guess ${renderIcon('arrow')}</button>
          </div>
        </form>`}
    <div class="legend">
      <span><i></i>Right place</span><span><i></i>Other place</span
      ><span><i></i>Not in the word</span>
    </div>
    <div class="keyboard">
      ${['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']
        .map(
          (row) =>
            html`<div class="key-row">
              ${row
                .split('')
                .map((l) =>
                  renderButton(
                    'key',
                    l,
                    'key ' + (keyScores[l] || ''),
                    'data-key="' + l + '"' + (ended ? ' disabled' : ''),
                  ),
                )
                .join('')}${row === 'ZXCVBNM'
                ? renderButton(
                    'key',
                    '⌫',
                    'key',
                    'data-key="Backspace" aria-label="Delete a letter"' +
                      (ended ? ' disabled' : ''),
                  )
                : ''}
            </div>`,
        )
        .join('')}
    </div>
    <div class="modal-actions">
      ${renderButton(
        'hint',
        session.puzzleHint ? escapeHTML(hint) : 'Hint',
        'secondary-button',
      )}${ended ? renderButton('close-modal', 'Done ' + renderIcon('arrow'), 'primary-button') : ''}
    </div>
    <p class="hint">
      Resets at midnight · ${escapeHTML(session.state.timezone.replaceAll('_', ' '))}
    </p>`;
  openModal(modalMarkup, 'puzzle');
  if (!ended) setTimeout(() => $('#guess-input')?.focus(), 40);
}
export function submitWordGuess() {
  const input = $('#guess-input');
  if (!input) return;
  const guess = input.value.toUpperCase();
  if (!/^[A-Z]{5}$/.test(guess)) {
    openWordGarden('Five letters will do.');
    return;
  }
  if (getTodayProgress().guesses.length >= 6) return;
  const { answer } = dailyPuzzle(session.today);
  if (getTodayProgress().guesses.includes(guess)) {
    openWordGarden('Already tried. Choose another word.');
    return;
  }
  if (
    !updatePersonalState((s) => {
      s.days[session.today] ??= {
        done: [],
        guesses: [],
      };
      s.days[session.today].guesses.push(guess);
    })
  )
    return;
  if (guess === answer || getTodayProgress().guesses.length === 6)
    setMomentComplete('puzzle', true);
  else render();
  openWordGarden();
}
