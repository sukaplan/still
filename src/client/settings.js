/** Settings dialog, source references, and backup controls. */
import { CROSSWORDS } from '../crosswords.mjs';
import { WORDS } from '../word-garden.mjs';
import { GERMAN } from '../data/vocabulary.mjs';
import { session } from './context.js';
import { escapeHTML, html, modalTitle, openModal, renderButton, renderIcon } from './ui.js';
export function openSettings() {
  openModal(
    html`${modalTitle('Settings', '')}
      <div class="settings-block">
        <label class="theme-setting" for="dark-appearance"
          ><span>Dark appearance</span
          ><span class="appearance-control"
            ><input
              id="dark-appearance"
              type="checkbox"
              role="switch"
              ${session.state.theme === 'dark' ? 'checked' : ''} /><span
              class="appearance-track"
              aria-hidden="true"
            ></span></span
        ></label>
      </div>
      <div class="settings-block">
        <div class="form-row">
          <label for="timezone">Daily reset time zone</label
          ><select id="timezone">
            ${[
              ...new Set([
                session.state.timezone,
                'Europe/Istanbul',
                Intl.DateTimeFormat().resolvedOptions().timeZone,
                'Europe/Berlin',
                'Europe/London',
                'America/New_York',
                'America/Los_Angeles',
                'Asia/Tokyo',
                'Australia/Sydney',
                'UTC',
              ]),
            ]
              .map(
                (z) =>
                  html`<option
                    value="${escapeHTML(z)}"
                    ${z === session.state.timezone ? 'selected' : ''}
                  >
                    ${escapeHTML(z.replaceAll('_', ' '))}
                  </option>`,
              )
              .join('')}
          </select>
        </div>
      </div>
      <div class="settings-block">
        <h3>Daily sources</h3>
        <ul class="source-list">
          <li>
            <strong>Science news</strong
            ><a href="https://www.sciencedaily.com/rss/" target="_blank" rel="noopener"
              >ScienceDaily</a
            >
            · three recent discoveries.
          </li>
          <li>
            <strong>Astronomy</strong>Three recent
            <a href="https://science.nasa.gov/apod/" target="_blank" rel="noopener"
              >NASA astronomy explanations</a
            >. The source date is shown when the next feature has not yet been published.
          </li>
          <li>
            <strong>Technology</strong
            ><a href="https://techcrunch.com/feed/" target="_blank" rel="noopener">TechCrunch</a> ·
            Ars Technica fallback. Three recent stories, with publication dates.
          </li>
          <li>
            <strong>German</strong>${GERMAN.length} rotating words, with live
            <a href="https://en.wiktionary.org/" target="_blank" rel="noopener">Wiktionary</a>
            definitions.
          </li>
          <li>
            <strong>Art</strong
            ><a href="https://www.clevelandart.org/open-access-api" target="_blank" rel="noopener"
              >Cleveland Museum of Art</a
            >
            · a different open-access painting.
          </li>
          <li>
            <strong>Puzzles</strong>${WORDS.length} word games and ${CROSSWORDS.length} mini
            crosswords, plus daily Sudoku in Easy, Medium, and Hard.
          </li>
        </ul>
        <p>
          Selections refresh daily and stay fixed for that day. Unavailable sources are labeled.
        </p>
      </div>
      <div class="settings-block">
        <h3>Your data</h3>
        <p>
          Saved in this browser only. Export a backup to move devices or protect against cleared
          browser data.
        </p>
        <div class="modal-actions">
          ${renderButton(
            'export',
            renderIcon('download') + ' Export backup',
            'primary-button',
          )}${renderButton('import', renderIcon('upload') + ' Import backup', 'secondary-button')}
        </div>
        <p>Import merges your board and saved items.</p>
        ${!session.storageAvailable
          ? '<p class="gentle-error">Storage unavailable. Export before leaving.</p>'
          : ''}
      </div>
      <p class="picture-credit">
        Photos: Unsplash · Art: Cleveland Museum of Art, CC0 · Dictionary: Wiktionary, CC BY-SA.
      </p>`,
    'settings',
  );
}
