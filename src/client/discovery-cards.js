/** On-demand three-item card navigation, daily caching, and legacy read migration. */
import {
  DISCOVERY_COUNT,
  DISCOVERY_KINDS,
  DISCOVERY_LABELS,
  discoveryID,
  isExcludedDiscovery,
} from '../discoveries.mjs';
import { normalizeDay } from '../state.mjs';
import { session } from './context.js';
import { getTodayProgress, updatePersonalState, validURL } from './storage.js';
import { $, escapeHTML, html, renderButton } from './ui.js';
import { refreshCards } from './views.js';

const cacheKey = (kind) => `still.daily.${session.today}.${session.state.timezone}.${kind}.r7`;
function deckFor(kind) {
  return (session.discoveryDecks[kind] ||= {
    position: 0,
    items: Array(DISCOVERY_COUNT).fill(null),
    error: '',
  });
}
function storeDeck(kind) {
  try {
    localStorage.setItem(cacheKey(kind), JSON.stringify({ date: session.today, ...deckFor(kind) }));
  } catch {}
}
function migrateReading(kind, item) {
  const day = getTodayProgress();
  if (!item || !day.done.includes(kind) || day.readings[kind].length) return;
  updatePersonalState((state) => {
    state.days[session.today] = normalizeDay(state.days[session.today]);
    state.days[session.today].readings[kind] = [discoveryID(kind, item, session.today)];
  });
}
export function hydrateDiscovery(kind) {
  const deck = deckFor(kind);
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey(kind)) || 'null');
    if (cached?.date === session.today && Array.isArray(cached.items)) {
      deck.items = Array.from({ length: DISCOVERY_COUNT }, (_, index) => {
        const item = cached.items[index];
        return item?.date === session.today &&
          item.kind === kind &&
          !isExcludedDiscovery(item) &&
          item.title &&
          validURL(item.url) &&
          (!item.expiresAt || item.expiresAt > Date.now())
          ? item
          : null;
      });
      deck.position =
        Number.isInteger(cached.position) && deck.items[cached.position] ? cached.position : 0;
    }
  } catch {}
  session.daily[kind] = deck.items[deck.position];
  session.loading[kind] = false;
  migrateReading(kind, deck.items[0]);
  if (!deck.items[0]) return loadDiscovery(kind, 0, deck.position === 0);
}
export async function loadDiscovery(kind, slot = 0, activate = true) {
  if (
    !DISCOVERY_KINDS.includes(kind) ||
    !Number.isInteger(slot) ||
    slot < 0 ||
    slot >= DISCOVERY_COUNT
  )
    return;
  const date = session.today,
    zone = session.state.timezone,
    deck = deckFor(kind);
  if (session.loading[kind]) return;
  session.loading[kind] = true;
  deck.error = '';
  refreshCards();
  try {
    const params = new URLSearchParams({ date, timezone: zone, slot: String(slot), v: '3' });
    deck.items.forEach((item, index) => {
      if (item?.url && index !== slot) params.append('exclude', item.url);
    });
    const response = await fetch('/api/' + kind + '?' + params, {
      signal: AbortSignal.timeout(35000),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'This item is unavailable. Try again.');
    if (isExcludedDiscovery(data)) throw Error('That topic is filtered. Please try another item.');
    if (
      date !== session.today ||
      zone !== session.state.timezone ||
      session.discoveryDecks[kind] !== deck
    )
      return;
    if (
      deck.items.some(
        (item, index) =>
          index !== slot &&
          item &&
          (item.url === data.url || discoveryID(kind, item) === discoveryID(kind, data)),
      )
    )
      throw Error('No different item is available yet. Try again shortly.');
    deck.items[slot] = data;
    if (activate) deck.position = slot;
    session.daily[kind] = deck.items[deck.position];
    if (slot === 0) migrateReading(kind, data);
    storeDeck(kind);
  } catch (error) {
    if (
      date === session.today &&
      zone === session.state.timezone &&
      session.discoveryDecks[kind] === deck
    )
      deck.error =
        error.name === 'TimeoutError'
          ? 'Taking a little longer. Try again.'
          : error.message || 'Could not load another item. Try again.';
  } finally {
    if (
      date === session.today &&
      zone === session.state.timezone &&
      session.discoveryDecks[kind] === deck
    ) {
      session.loading[kind] = false;
      refreshCards();
    }
  }
}
export async function selectDiscovery(kind, position, { focus = true } = {}) {
  if (
    !DISCOVERY_KINDS.includes(kind) ||
    !Number.isInteger(position) ||
    position < 0 ||
    position >= DISCOVERY_COUNT ||
    session.loading[kind]
  )
    return;
  const deck = deckFor(kind);
  if (deck.items[position]) {
    deck.position = position;
    deck.error = '';
    session.daily[kind] = deck.items[position];
    storeDeck(kind);
    refreshCards();
  } else await loadDiscovery(kind, position);
  if (focus && session.route === 'home')
    $(`.discovery-pager[data-kind="${kind}"] [data-position="${deck.position}"]`)?.focus({
      preventScroll: true,
    });
}
export function renderDiscoveryPager(kind) {
  const deck = deckFor(kind),
    label = DISCOVERY_LABELS[kind];
  const available = deck.items.find(Boolean)?.available ?? DISCOVERY_COUNT;
  const pending = session.loading[kind];
  return html`<div class="discovery-navigation">
    <div class="discovery-pager" data-kind="${kind}" role="group" aria-label="${label} items">
      <div class="discovery-dots">
        ${Array.from({ length: DISCOVERY_COUNT }, (_, position) => {
          const read =
            deck.items[position] &&
            getTodayProgress().readings[kind].includes(
              discoveryID(kind, deck.items[position], session.today),
            );
          return renderButton(
            'discovery-page',
            '',
            'discovery-dot' +
              (deck.position === position ? ' current' : '') +
              (read ? ' read' : ''),
            `data-kind="${kind}" data-position="${position}" aria-label="${label}, item ${position + 1} of ${DISCOVERY_COUNT}${read ? ', completed' : ''}" ${deck.position === position ? 'aria-current="true"' : ''}${pending || position >= available ? ' disabled' : ''}`,
          );
        }).join('')}
      </div>
    </div>
    ${deck.error
      ? html`<p class="discovery-error" role="status">${escapeHTML(deck.error)}</p>`
      : ''}
    <span class="sr-only" role="status" aria-live="polite"
      >${label}, item ${deck.position + 1} of ${DISCOVERY_COUNT}${pending ? ', loading' : ''}</span
    >
  </div>`;
}
