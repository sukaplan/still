import test from 'node:test';
import assert from 'node:assert/strict';
import { session } from '../src/client/context.js';
import { hydrateDiscovery, loadDiscovery, selectDiscovery } from '../src/client/discovery-cards.js';
import { createInitialState, getTodayProgress } from '../src/client/storage.js';
import { isDiscoveryComplete } from '../src/client/content.js';

function setup() {
  session.state = createInitialState();
  session.today = '2026-11-02';
  session.route = 'collection';
  session.daily = {};
  session.discoveryDecks = {};
  session.loading = {};
  const cache = new Map();
  globalThis.localStorage = {
    getItem: (key) => cache.get(key) || null,
    setItem: (key, value) => cache.set(key, value),
  };
  return cache;
}
const item = (slot) => ({
  kind: 'science',
  date: '2026-11-02',
  title: `Discovery ${slot}`,
  url: `https://example.org/${slot}`,
  available: 3,
  slot,
});

test('additional items fetch only on demand, then remain cached when revisiting and reloading', async () => {
  const oldFetch = globalThis.fetch,
    oldStorage = globalThis.localStorage;
  setup();
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    assert.equal(new URL(url, 'https://still.test').searchParams.get('v'), '3');
    return Response.json(item(Number(new URL(url, 'https://still.test').searchParams.get('slot'))));
  };
  try {
    await hydrateDiscovery('science');
    assert.equal(calls, 1);
    await selectDiscovery('science', 1);
    assert.equal(calls, 2);
    assert.equal(session.daily.science.title, 'Discovery 1');
    await selectDiscovery('science', 0);
    assert.equal(calls, 2);
    await selectDiscovery('science', 1);
    assert.equal(calls, 2);
    session.discoveryDecks = {};
    session.daily = {};
    await hydrateDiscovery('science');
    assert.equal(calls, 2);
    assert.equal(session.daily.science.title, 'Discovery 1');
  } finally {
    globalThis.fetch = oldFetch;
    globalThis.localStorage = oldStorage;
  }
});

test('a slow or failing Next request preserves the visible item and clears its loading state', async () => {
  const oldFetch = globalThis.fetch,
    oldStorage = globalThis.localStorage;
  setup();
  globalThis.fetch = async () => Response.json(item(0));
  await hydrateDiscovery('science');
  let finish;
  globalThis.fetch = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  try {
    const pending = selectDiscovery('science', 1);
    assert.equal(session.daily.science.title, 'Discovery 0');
    assert.equal(session.loading.science, true);
    finish(Response.json({ error: 'Source unavailable' }, { status: 503 }));
    await pending;
    assert.equal(session.daily.science.title, 'Discovery 0');
    assert.equal(session.discoveryDecks.science.position, 0);
    assert.equal(session.discoveryDecks.science.error, 'Source unavailable');
    assert.equal(session.loading.science, false);
  } finally {
    globalThis.fetch = oldFetch;
    globalThis.localStorage = oldStorage;
  }
});

test('legacy daily completion migrates to the first item without completing the next one', async () => {
  const oldFetch = globalThis.fetch,
    oldStorage = globalThis.localStorage;
  setup();
  session.state.days[session.today] = { done: ['science'] };
  globalThis.fetch = async (url) =>
    Response.json(item(Number(new URL(url, 'https://still.test').searchParams.get('slot'))));
  try {
    await hydrateDiscovery('science');
    assert.equal(isDiscoveryComplete('science'), true);
    await selectDiscovery('science', 1);
    assert.equal(isDiscoveryComplete('science'), false);
    assert.equal(getTodayProgress().done.includes('science'), true);
  } finally {
    globalThis.fetch = oldFetch;
    globalThis.localStorage = oldStorage;
  }
});

test('blocked cached items are discarded and cannot appear in a fresh card', async () => {
  const previousFetch = globalThis.fetch,
    previousStorage = globalThis.localStorage;
  const cache = setup();
  cache.set(
    'still.daily.2026-11-02.Europe/Istanbul.science.r7',
    JSON.stringify({
      date: '2026-11-02',
      position: 0,
      items: [{ ...item(0), title: 'Cancer treatment study' }],
    }),
  );
  globalThis.fetch = async () => Response.json({ ...item(0), title: 'An astronomy discovery' });
  try {
    await hydrateDiscovery('science');
    assert.equal(session.daily.science.title, 'An astronomy discovery');
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.localStorage = previousStorage;
  }
});
