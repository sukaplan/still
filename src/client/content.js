import {
  DISCOVERY_COUNT,
  DISCOVERY_KINDS,
  isExcludedDiscovery,
  discoveryID as contentID,
} from '../discoveries.mjs';
import { hydrateDiscovery, loadDiscovery, selectDiscovery } from './discovery-cards.js';
/** Daily content loading, saved discoveries, and completion controls. */
import { dailyPuzzle } from '../word-garden.mjs';
import { MOMENTS, normalizeDay, puzzleStatus } from '../state.mjs';
import { session } from './context.js';
import {
  formatDate,
  getTodayProgress,
  safeImage,
  updatePersonalState,
  validURL,
} from './storage.js';
import {
  $,
  closeModal,
  escapeHTML,
  modalTitle,
  openModal,
  renderButton,
  renderIcon,
  toast,
  html,
} from './ui.js';
import { refreshCards, render } from './views.js';
export function readDiscoveryButton(kind) {
  const verb = isDiscoveryComplete(kind) ? 'Review' : 'Read';
  const label =
    {
      astronomy: 'astronomy',
      science: 'science news',
      tech: 'technology',
      german: 'German word',
      art: 'artwork',
    }[kind] || kind;
  return renderButton(
    'read-' + kind,
    verb + ' ' + renderIcon('arrow'),
    'text-link discovery-read',
    `aria-label="${verb} ${label}"`,
  );
}

export function completionBadge(kind) {
  const complete = isDiscoveryComplete(kind);
  const text =
    kind === 'puzzle'
      ? puzzleStatus(getTodayProgress(), dailyPuzzle(session.today).answer).badge
      : 'Completed';
  return complete
    ? html`<span class="completion-badge"
        >${renderIcon('check')}${escapeHTML(text || 'Completed')}</span
      >`
    : '';
}
export function completionClass(kind) {
  return isDiscoveryComplete(kind) ? ' is-complete' : '';
}
export function bookmark(kind, data) {
  const id = discoveryID(kind, data);
  const saved = session.state.saved.some((x) => x.id === id);
  return renderButton(
    'save',
    renderIcon('bookmark'),
    'icon-button' + (saved ? ' saved' : ''),
    'data-kind="' +
      kind +
      '" aria-label="' +
      (saved ? 'Remove saved discovery' : 'Save discovery') +
      '" aria-pressed="' +
      saved +
      '"',
  );
}
export function discoveryID(kind, data) {
  return contentID(kind, data, session.today);
}
export function completionTarget(kind) {
  const reading = session.currentReading;
  return reading?.kind === kind && session.modalKind === kind && reading.date === session.today
    ? reading.content
    : getDailyContent(kind);
}
export function isDiscoveryComplete(kind, content = getDailyContent(kind)) {
  const day = getTodayProgress();
  if (!DISCOVERY_KINDS.includes(kind)) return day.done.includes(kind);
  return !!content && day.readings[kind].includes(discoveryID(kind, content));
}
export function getDailyContent(kind) {
  if (session.daily[kind])
    return isExcludedDiscovery(session.daily[kind]) ? null : session.daily[kind];
  if (session.loading[kind]) return null;
  if (kind === 'art')
    return {
      kind: 'art',
      title: 'Water Lilies (Agapanthus)',
      artist: 'Claude Monet (French, 1840–1926)',
      year: 'c. 1915–26',
      image: '/assets/monet.jpg',
      description:
        'Monet spent decades returning to his garden at Giverny. Here the pond fills the canvas, with no horizon to interrupt the water and reflections.',
      source: 'The Cleveland Museum of Art',
      url: 'https://www.clevelandart.org/art/1960.81',
      license: 'CC0 / Public domain',
      offline: true,
    };
  if (kind === 'german') return null;
  return null;
}
export function sourceLine(d) {
  if (!d) return '<span class="skeleton short"></span>';
  return html`<span class="source-meta"
    >${escapeHTML(d.offline ? 'Offline selection · ' + d.source : d.source)}
    ${d.publishedAt
      ? '· ' +
        escapeHTML(
          new Intl.DateTimeFormat('en-GB', {
            day: 'numeric',
            month: 'short',
            timeZone: session.state.timezone,
          }).format(new Date(d.publishedAt)),
        )
      : ''}</span
  >`;
}
export function updateCompletionButton() {
  const b = $('#modal [data-action="complete"]');
  if (!b) return;
  const done = isDiscoveryComplete(b.dataset.kind, completionTarget(b.dataset.kind));
  b.innerHTML = renderIcon('check') + ' ' + (done ? 'Completed' : 'Mark complete');
  b.setAttribute('aria-pressed', String(done));
  b.setAttribute('aria-label', done ? 'Mark as not complete' : 'Mark complete');
  b.classList.toggle('completed', done);
}
export function setMomentComplete(kind, complete = true) {
  const content = completionTarget(kind);
  if (DISCOVERY_KINDS.includes(kind) && !content) return false;
  if (!MOMENTS.includes(kind) || (kind === 'puzzle' && !complete)) return false;
  const changed = updatePersonalState((s) => {
    s.days[session.today] = normalizeDay(s.days[session.today]);
    if (DISCOVERY_KINDS.includes(kind)) {
      const day = s.days[session.today];
      const id = discoveryID(kind, content);
      day.readings[kind] = complete
        ? [...new Set([...day.readings[kind], id])]
        : day.readings[kind].filter((value) => value !== id);
      day.done = day.done.filter((value) => value !== kind);
      if (day.readings[kind].length) day.done.push(kind);
      return;
    }
    s.days[session.today].done = complete
      ? [...new Set([...s.days[session.today].done, kind])]
      : s.days[session.today].done.filter((x) => x !== kind);
  });
  if (changed) {
    render();
    updateCompletionButton();
    toast(complete ? 'Completed' : 'Marked not complete');
  }
  return changed;
}
export function markDone(kind) {
  if (!getTodayProgress().done.includes(kind)) setMomentComplete(kind, true);
}
export function openDiscovery(kind, item) {
  const content = item || getDailyContent(kind);
  if (isExcludedDiscovery(content)) {
    toast('This article is hidden by your topic filter.');
    return;
  }
  if (!content) {
    if (session.loading[kind]) toast('Loading…');
    else loadKind(kind);
    return;
  }
  const isSaved = !!item;
  const paged = !isSaved && DISCOVERY_KINDS.includes(kind);
  const position = paged ? session.discoveryDecks[kind]?.position || 0 : 0;
  const available = Math.min(DISCOVERY_COUNT, content.available || DISCOVERY_COUNT);
  const counter = paged ? ` · ${position + 1} / ${available}` : '';
  session.currentReading = !isSaved
    ? { kind, content, date: session.today, position, available }
    : null;
  let modalMarkup = '';
  if (kind === 'astronomy')
    modalMarkup =
      modalTitle(content.title, 'ASTRONOMY · NASA' + counter) +
      (content.image
        ? html`<img
            class="art-modal-image astronomy-modal-image"
            src="${escapeHTML(safeImage(content.image))}"
            alt="${escapeHTML(content.title)}"
          />`
        : '') +
      '<div class="modal-prose">' +
      escapeHTML(content.description) +
      '</div>' +
      (content.credit
        ? html`<p class="picture-credit">Image credit: ${escapeHTML(content.credit)}</p>`
        : '') +
      (content.sourceDate
        ? html`<p class="picture-credit">
            NASA feature · ${escapeHTML(formatDate(content.sourceDate))}
          </p>`
        : '');
  else if (kind === 'concept')
    modalMarkup = html`${modalTitle(content.title, 'SCIENCE · DAILY CONCEPT')}
      <div class="modal-prose">${escapeHTML(content.explanation)}</div>
      <section class="concept-modal-section">
        <h3>Fact</h3>
        <p>${escapeHTML(content.fact)}</p>
      </section>
      <section class="concept-modal-section">
        <h3>Everyday example</h3>
        <p>${escapeHTML(content.example)}</p>
      </section>`;
  else if (kind === 'german')
    modalMarkup = html`${modalTitle(content.article + ' ' + content.word, 'German')}
      <div class="modal-prose">${escapeHTML(content.meaning)}</div>
      ${renderButton(
        'speak',
        renderIcon('sound') + ' Hear it spoken',
        'secondary-button',
      )}${content.pronunciation ? html`<p>${escapeHTML(content.pronunciation)}</p>` : ''}
      <div class="german-example">“${escapeHTML(content.example)}”</div>
      <div class="german-example-translation">${escapeHTML(content.translation)}</div>
      ${content.dictionaryMeaning
        ? html`<div class="settings-block">
            <p>Dictionary note</p>
            <div class="modal-prose">${escapeHTML(content.dictionaryMeaning)}</div>
          </div>`
        : ''}
      <p class="source-badge">
        ${content.verifiedLive
          ? 'Dictionary checked live today'
          : 'From the Still vocabulary library · dictionary temporarily unavailable'}
      </p>`;
  else {
    modalMarkup = modalTitle(
      content.title,
      (kind === 'art' ? 'Art' : kind === 'science' ? 'Science news' : 'Technology') + counter,
    );
    if (['science', 'tech'].includes(kind) && validURL(content.image))
      modalMarkup += html`<img
          class="news-modal-image"
          src="${escapeHTML(content.image)}"
          alt="${escapeHTML(content.imageAlt || content.title)}"
          referrerpolicy="no-referrer"
        />
        <p class="picture-credit">
          ${escapeHTML(content.imageAttribution || 'Image via ' + content.source)}
        </p>`;
    if (kind === 'art')
      modalMarkup += html`<img
          class="art-modal-image"
          src="${escapeHTML(safeImage(content.image))}"
          alt="${escapeHTML(content.title)}"
        />
        <p>${escapeHTML(content.artist)} · ${escapeHTML(content.year || '')}</p>`;
    modalMarkup += html`<div class="modal-prose">
      ${escapeHTML(content.description || 'Follow the source to explore this discovery.')}
    </div>`;
    if (kind === 'art')
      modalMarkup += html`<p>
        ${escapeHTML(content.medium || '')} · ${escapeHTML(content.license || 'Public domain')}
      </p>`;
    if (content.publishedAt)
      modalMarkup += html`<p>
        Published
        ${escapeHTML(
          new Date(content.publishedAt).toLocaleString('en-GB', {
            timeZone: session.state.timezone,
          }),
        )}${content.isToday ? '' : ' · Recent story'}
      </p>`;
    if (content.offline)
      modalMarkup +=
        '<p class="gentle-error">The live source is unavailable. This is an offline selection.</p>';
  }
  const sourceLink = validURL(content.url)
    ? html`<a
        href="${escapeHTML(validURL(content.url))}"
        target="_blank"
        rel="noopener noreferrer"
        class="${paged ? 'article-source-link' : 'secondary-button'}"
        >${escapeHTML(
          kind === 'art'
            ? 'Visit the museum'
            : kind === 'german'
              ? 'Open Wiktionary'
              : kind === 'concept'
                ? 'Read more'
                : kind === 'astronomy'
                  ? 'Read on NASA'
                  : 'Read the full story',
        )}
        ${renderIcon('external')}</a
      >`
    : '';
  const completion = !isSaved
    ? renderButton(
        'complete',
        renderIcon('check') +
          ' ' +
          (isDiscoveryComplete(kind, content) ? 'Completed' : 'Mark complete'),
        (paged ? 'secondary-button' : 'primary-button') +
          ' completion-toggle' +
          (isDiscoveryComplete(kind, content) ? ' completed' : ''),
        `data-kind="${kind}" aria-pressed="${isDiscoveryComplete(kind, content)}"`,
      )
    : '';
  const last = position + 1 >= available;
  modalMarkup += html`<div class="modal-actions ${paged ? 'article-reading-actions' : ''}">
      ${paged ? '' : sourceLink}${completion}
      ${paged
        ? renderButton(
            'next-open-discovery',
            (last ? 'Done' : 'Next') + ' ' + renderIcon(last ? 'check' : 'arrow'),
            'primary-button article-next',
            `data-kind="${kind}" aria-label="${last ? 'Close article and return to Today' : 'Read next article'}"`,
          )
        : ''}
    </div>
    ${paged
      ? '<p id="article-next-message" class="article-next-message" role="status" aria-live="polite"></p>'
      : ''}
    <p class="picture-credit">
      ${kind === 'concept' ? 'Reference: ' : 'Source: '}${escapeHTML(
        content.source || '',
      )}${kind === 'german' ? ' · Wiktionary text: CC BY-SA' : ''}${paged
        ? html` · ${sourceLink}`
        : ''}
    </p>`;
  openModal(modalMarkup, kind);
}
/** Advance the open reader without marking an unread article complete. */
export async function nextOpenDiscovery(kind) {
  const reading = session.currentReading;
  if (
    !reading ||
    reading.kind !== kind ||
    session.modalKind !== kind ||
    reading.date !== session.today ||
    !DISCOVERY_KINDS.includes(kind)
  )
    return;
  if (reading.position + 1 >= reading.available) {
    closeModal();
    return;
  }
  if (session.loading[kind]) return;
  const button = $('#modal [data-action="next-open-discovery"]');
  const message = $('#article-next-message');
  if (button) {
    button.disabled = true;
    button.textContent = 'Loading…';
  }
  if (message) message.textContent = '';
  await selectDiscovery(kind, reading.position + 1, { focus: false });
  // Closing the reader or opening another article while loading must stay respected.
  if (
    session.currentReading !== reading ||
    session.modalKind !== kind ||
    reading.date !== session.today
  )
    return;
  const deck = session.discoveryDecks[kind];
  if (deck?.position === reading.position + 1 && deck.items[deck.position]) {
    openDiscovery(kind);
    $('#modal').scrollTop = 0;
    const heading = $('#modal-title');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: true });
  } else {
    if (message) message.textContent = deck?.error || 'Could not load the next article. Try again.';
    if (button) {
      button.disabled = false;
      button.innerHTML = 'Next ' + renderIcon('arrow');
    }
  }
}

export async function loadKind(kind, slot = 0, activate = true) {
  if (DISCOVERY_KINDS.includes(kind)) return loadDiscovery(kind, slot, activate);
  const requestedDate = session.today,
    requestedZone = session.state.timezone;
  session.loading[kind] = true;
  refreshCards();
  try {
    const r = await fetch(
      '/api/' + kind + '?date=' + requestedDate + '&timezone=' + encodeURIComponent(requestedZone),
      {
        signal: AbortSignal.timeout(35000),
      },
    );
    if (!r.ok) throw Error('Feed unavailable');
    const d = await r.json();
    if (requestedDate !== session.today || requestedZone !== session.state.timezone) return;
    session.daily[kind] = d;
    try {
      localStorage.setItem(
        'still.daily.' + session.today + '.' + session.state.timezone + '.' + kind + '.r3',
        JSON.stringify(d),
      );
    } catch {}
  } catch {
    if (requestedDate === session.today && requestedZone === session.state.timezone)
      session.daily[kind] = null;
  } finally {
    if (requestedDate === session.today && requestedZone === session.state.timezone) {
      session.loading[kind] = false;
      refreshCards();
    }
  }
}
export function loadDaily() {
  session.daily = {};
  session.discoveryDecks = {};
  for (const kind of ['art', 'german', 'science', 'tech', 'astronomy']) {
    if (DISCOVERY_KINDS.includes(kind)) {
      hydrateDiscovery(kind);
      continue;
    }
    let cached;
    try {
      cached = JSON.parse(
        localStorage.getItem(
          'still.daily.' + session.today + '.' + session.state.timezone + '.' + kind + '.r3',
        ) || 'null',
      );
    } catch {}
    if (cached?.date === session.today && (!cached.expiresAt || cached.expiresAt > Date.now())) {
      session.daily[kind] = cached;
      session.loading[kind] = false;
    } else {
      session.loading[kind] = true;
      loadKind(kind);
    }
  }
  render();
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('still.daily.') && key.slice(12, 22) !== session.today)
        localStorage.removeItem(key);
    }
  } catch {}
}
export function toggleSave(kind) {
  const d = getDailyContent(kind);
  if (!d) return;
  const id = discoveryID(kind, d),
    exists = session.state.saved.some((x) => x.id === id);
  if (
    updatePersonalState((s) => {
      if (exists) s.saved = s.saved.filter((x) => x.id !== id);
      else
        s.saved.unshift({
          ...d,
          id,
          kind,
          title: kind === 'german' ? d.article + ' ' + d.word : d.title,
          description:
            kind === 'german' ? d.meaning : kind === 'concept' ? d.explanation : d.description,
          image: d.image || '',
          savedOn: session.today,
        });
    })
  ) {
    toast(exists ? 'Removed' : 'Saved');
    render();
  }
}
export function pronounceGermanWord() {
  const g =
    session.modalKind === 'saved-german' ? session.savedSpeakingItem : getDailyContent('german');
  if (!g) return;
  if (!('speechSynthesis' in window)) {
    toast('Speech playback is unavailable in this browser. You can hear it on Wiktionary.');
    return;
  }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(g.article + ' ' + g.word);
  utterance.lang = 'de-DE';
  utterance.rate = 0.8;
  const voices = speechSynthesis.getVoices(),
    v = voices.find((x) => x.lang.startsWith('de'));
  if (v) utterance.voice = v;
  utterance.onerror = () => toast('Audio is unavailable here. Open Wiktionary to hear this word.');
  speechSynthesis.speak(utterance);
  markDone('german');
}
