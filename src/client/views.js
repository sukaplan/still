import { applyAppearance } from './appearance.js';
import { isExcludedDiscovery } from '../discoveries.mjs';
import { renderNewsVisual } from './news-visual.js';
import { renderDiscoveryPager } from './discovery-cards.js';
/** Today and Saved page rendering, navigation, and page refreshes. */
import { dailyPuzzle, scoreGuess } from '../word-garden.mjs';
import { goalStatus, MOMENTS, puzzleStatus } from '../state.mjs';
import {
  bookmark,
  completionBadge,
  completionClass,
  getDailyContent,
  readDiscoveryButton,
  sourceLine,
} from './content.js';
import { session } from './context.js';
import { renderCrosswordCard } from './crossword.js';
import { renderSudokuCard } from './sudoku.js';
import { updateMoonBadge } from './moon-ui.js';
import { formatDate, getTodayProgress, safeImage } from './storage.js';
import {
  $,
  escapeHTML,
  html,
  renderArrowButton,
  renderButton,
  renderCardLabel,
  renderIcon,
  renderPageHeading,
} from './ui.js';
import { renderVision } from './vision-board.js';
export function renderNewsCard(kind) {
  const content = getDailyContent(kind),
    isLoading = session.loading[kind];
  return html`<article
    class="card discovery-card ${kind}-card${completionClass(kind)}"
    data-discovery-kind="${kind}"
    aria-roledescription="carousel"
    aria-label="${kind === 'science' ? 'Science news' : 'Technology'}"
  >
    <div class="card-inner">
      <div class="card-topline">
        ${renderCardLabel(kind, kind === 'science' ? 'Science news' : 'Technology')}
        <div class="card-controls">
          ${completionBadge(kind)}${content ? bookmark(kind, content) : ''}
        </div>
      </div>
      ${renderNewsVisual(kind, content)}
      <h2>
        ${content
          ? escapeHTML(content.title)
          : isLoading
            ? '<span class="skeleton loading-h"></span>'
            : 'Source unavailable'}
      </h2>
      <div class="card-bottom">
        ${sourceLine(content)}${content
          ? readDiscoveryButton(kind)
          : renderButton(
              'retry',
              'Try again ' + renderIcon('refresh'),
              'text-link',
              'data-kind="' + kind + '"' + (isLoading ? ' disabled' : ''),
            )}
      </div>
      ${renderDiscoveryPager(kind)}
    </div>
  </article>`;
}
export function renderNavigation() {
  applyAppearance();
  const items = [
    ['home', 'home', 'Today'],
    ['collection', 'bookmark', 'Saved'],
    ['vision', 'vision', 'Vision board'],
  ];
  $('#nav').innerHTML = items
    .map(
      ([id, i, t]) =>
        html`<a
          href="#${id}"
          class="nav-link ${session.route === id ? 'active' : ''}"
          aria-label="${t}"
          ${session.route === id ? 'aria-current="page"' : ''}
          >${renderIcon(i)}<span>${t}</span></a
        >`,
    )
    .join('');
  $('#settings-button').innerHTML = renderIcon('settings') + '<span>Settings</span>';
  $('#settings-button').setAttribute('aria-label', 'Settings and data');
  $('#top-date').textContent = formatDate();
  updateMoonBadge();
}
export function renderAstronomyCard() {
  const content = getDailyContent('astronomy');
  return html`<article
    class="card discovery-card astronomy-card${completionClass('astronomy')}"
    data-discovery-kind="astronomy"
    aria-roledescription="carousel"
    aria-label="Astronomy"
  >
    <div class="card-inner">
      <div class="card-topline">
        ${renderCardLabel('tech', 'Astronomy')}
        <div class="card-controls">
          ${completionBadge('astronomy')}${content ? bookmark('astronomy', content) : ''}
        </div>
      </div>
      ${content?.image
        ? html`<img
            class="card-image astronomy-image"
            src="${escapeHTML(safeImage(content.image))}"
            alt="${escapeHTML(content.title)}"
          />`
        : html`<div class="astronomy-placeholder">${renderIcon('tech')}</div>`}
      <h2>
        ${content
          ? escapeHTML(content.title)
          : session.loading.astronomy
            ? '<span class="skeleton loading-h"></span>'
            : 'NASA feature unavailable'}
      </h2>
      <div class="card-bottom">
        ${content
          ? readDiscoveryButton('astronomy')
          : renderButton(
              'retry',
              'Try again',
              'text-link',
              'data-kind="astronomy"' + (session.loading.astronomy ? ' disabled' : ''),
            )}<span class="source-meta"
          >${content
            ? 'NASA' +
              (content.sourceDate
                ? ' · ' +
                  escapeHTML(
                    new Intl.DateTimeFormat('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      timeZone: 'UTC',
                    }).format(new Date(content.sourceDate + 'T12:00:00Z')),
                  )
                : '')
            : ''}</span
        >
      </div>
      ${renderDiscoveryPager('astronomy')}
    </div>
  </article>`;
}
export function renderToday() {
  const art = getDailyContent('art'),
    german = getDailyContent('german'),
    done = getTodayProgress().done,
    puzzle = puzzleStatus(getTodayProgress(), dailyPuzzle(session.today).answer),
    goals = session.state.goals.slice(0, 3),
    achieved = session.state.goals.filter((x) => goalStatus(x).achieved).length;
  return html`${renderPageHeading('Today')}
    <div class="ritual-line">
      <div class="daily-progress" aria-live="polite">
        <span>${done.length} / ${MOMENTS.length} completed</span
        ><span class="progress-dots" aria-hidden="true"
          >${MOMENTS.map((k) => html`<i class="${done.includes(k) ? 'done' : ''}"></i>`).join(
            '',
          )}</span
        >
      </div>
    </div>
    <div class="top-grid">
      <article class="card puzzle-card${completionClass('puzzle')}">
        <div class="card-inner">
          <div class="card-topline">
            ${renderCardLabel('puzzle', 'Daily puzzle')}${completionBadge('puzzle')}
          </div>
          <h2>Word garden</h2>
          <div
            class="mini-tiles ${getTodayProgress().guesses.length ? 'played' : 'preview'}"
            aria-hidden="true"
          >
            ${(getTodayProgress().guesses.at(-1) || '·····')
              .split('')
              .map(
                (l, i) =>
                  html`<span
                    class="${getTodayProgress().guesses.length
                      ? scoreGuess(
                          getTodayProgress().guesses.at(-1),
                          dailyPuzzle(session.today).answer,
                        )[i]
                      : ''}"
                    >${escapeHTML(l)}</span
                  >`,
              )
              .join('')}
          </div>
          <div class="card-bottom">
            ${renderButton('puzzle', puzzle.label + ' ' + renderIcon('arrow'))}<span
              class="source-meta"
              >${getTodayProgress().guesses.length} / 6</span
            >
          </div>
        </div>
      </article>
      ${renderCrosswordCard()}${renderSudokuCard()}${renderAstronomyCard()}
    </div>
    <div class="news-grid">${renderNewsCard('science')}${renderNewsCard('tech')}</div>
    <div class="bottom-grid">
      <article class="card art-card${completionClass('art')}">
        <div
          class="art-image-wrap"
          role="button"
          tabindex="0"
          data-action="read-art"
          aria-label="Look closer at today’s artwork"
        >
          <img
            src="${escapeHTML(art?.image || '/assets/monet.jpg')}"
            alt="${escapeHTML(
              art ? art.title + ' by ' + art.artist : 'Water Lilies, a painting by Claude Monet',
            )}"
          />
        </div>
        <div class="card-inner">
          <div class="card-topline">
            ${renderCardLabel('art', art?.offline ? 'Offline selection' : 'Art')}
            <div class="card-controls">
              ${completionBadge('art')}${art ? bookmark('art', art) : ''}
            </div>
          </div>
          <div class="art-title-row">
            <div>
              <h2>${art ? escapeHTML(art.title) : '<span class="skeleton loading-h"></span>'}</h2>
              <p class="artist-line">
                ${escapeHTML(art ? art.artist + ' · ' + art.year : 'Loading artwork…')}
              </p>
            </div>
            ${readDiscoveryButton('art')}
          </div>
        </div>
      </article>
      <div class="right-stack">
        <article class="card german-card${completionClass('german')}">
          <div class="card-inner">
            <div class="card-topline">
              ${renderCardLabel('language', 'German')}
              <div class="card-controls">
                ${completionBadge('german')}${german ? bookmark('german', german) : ''}
              </div>
            </div>
            <div class="german-title">
              <h2>
                ${german
                  ? html`<small>${escapeHTML(german.article)}</small> ${escapeHTML(german.word)}`
                  : '<span class="skeleton loading-h"></span>'}
              </h2>
              ${renderButton(
                'speak',
                renderIcon('sound'),
                'icon-button speak',
                'aria-label="Hear the German word"' + (!german ? ' disabled' : ''),
              )}
            </div>
            <div class="german-meaning">
              ${german
                ? escapeHTML(german.meaning)
                : session.loading.german
                  ? 'Loading word…'
                  : 'Dictionary unavailable.'}
            </div>
            <div class="card-bottom">
              ${german
                ? readDiscoveryButton('german')
                : renderButton(
                    'retry',
                    'Try again ' + renderIcon('refresh'),
                    'text-link',
                    'data-kind="german"' + (session.loading.german ? ' disabled' : ''),
                  )}
            </div>
          </div>
        </article>
        <article class="card vision-card">
          <div class="card-inner">
            <div class="card-topline">
              ${renderCardLabel('vision', 'Vision board')}${renderButton(
                'new-goal',
                renderIcon('plus'),
                'icon-button',
                'aria-label="Add a vision"',
              )}
            </div>
            <a class="vision-collage" href="#vision" aria-label="Open your vision board"
              >${(goals.length
                ? goals
                : [
                    {
                      image: '/assets/lake.jpg',
                    },
                    {
                      image: '/assets/room.jpg',
                    },
                    {
                      image: '/assets/mountain.jpg',
                    },
                  ]
              )
                .map(
                  (x) =>
                    html`<img
                      src="${escapeHTML(safeImage(x.image))}"
                      alt="${escapeHTML(x.title || 'Inspiration')}"
                    />`,
                )
                .join('')}</a
            >
            <div class="vision-progress">
              <span>${achieved} / ${session.state.goals.length} achieved</span>${renderButton(
                'open-board',
                renderIcon('arrow'),
                'icon-button',
                'aria-label="Open your vision board"',
              )}
            </div>
          </div>
        </article>
      </div>
    </div>`;
}
export function renderSaved() {
  const entries = session.state.saved
    .filter((item) => !isExcludedDiscovery(item))
    .filter(
      (x) =>
        session.filter === 'All' ||
        (session.filter === 'Science'
          ? ['science', 'concept'].includes(x.kind)
          : x.kind === session.filter.toLowerCase()),
    );
  return (
    renderPageHeading(
      'Saved',
      'The ideas, words, and works of art you want to return to.',
      'MY COLLECTION',
    ) +
    '<div class="filter-row">' +
    ['All', 'Astronomy', 'Science', 'Tech', 'German', 'Art']
      .map((c) =>
        renderButton(
          'collection-filter',
          escapeHTML(c),
          'filter ' + (c === session.filter ? 'active' : ''),
          'data-filter="' + c + '" aria-pressed="' + (c === session.filter) + '"',
        ),
      )
      .join('') +
    '</div><div class="collection-grid">' +
    (entries.length
      ? entries
          .map(
            (x) =>
              html`<article class="collection-item">
                ${x.image
                  ? html`<img
                      src="${escapeHTML(safeImage(x.image))}"
                      alt="${escapeHTML(x.title)}"
                    />`
                  : ''}
                <div class="card-inner">
                  <div class="card-topline">
                    ${renderCardLabel(
                      x.kind === 'german'
                        ? 'language'
                        : x.kind === 'concept'
                          ? 'science'
                          : x.kind === 'astronomy'
                            ? 'tech'
                            : x.kind,
                      x.kind,
                    )}${renderButton(
                      'remove-saved',
                      renderIcon('bookmark'),
                      'icon-button saved',
                      'data-id="' + escapeHTML(x.id) + '" aria-label="Remove saved discovery"',
                    )}
                  </div>
                  <h2>${escapeHTML(x.title)}</h2>
                  <p>
                    ${escapeHTML((x.description || '').slice(0, 150))}${x.description?.length > 150
                      ? '…'
                      : ''}
                  </p>
                  <div class="card-bottom">
                    ${renderButton(
                      'read-saved',
                      'Return to this ' + renderIcon('arrow'),
                      'text-link',
                      'data-id="' + escapeHTML(x.id) + '"',
                    )}<span class="saved-date">${escapeHTML(x.savedOn || '')}</span>
                  </div>
                </div>
              </article>`,
          )
          .join('')
      : html`<div class="empty-state">
          ${renderIcon('bookmark')}
          <h2>No saved items yet</h2>
          <p>Bookmark an item to keep it here.</p>
          <a href="#home" class="secondary-button">Explore today ${renderIcon('arrow')}</a>
        </div>`) +
    '</div>'
  );
}
export function render() {
  session.route = ['home', 'collection', 'vision'].includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : 'home';
  renderNavigation();
  $('#main').innerHTML =
    session.route === 'vision'
      ? renderVision()
      : session.route === 'collection'
        ? renderSaved()
        : renderToday();
}
export function refreshCards() {
  if (session.route === 'home' && !$('#reflection')?.matches(':focus')) render();
}
