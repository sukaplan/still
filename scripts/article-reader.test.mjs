import test from 'node:test';
import assert from 'node:assert/strict';
import { session } from '../src/client/context.js';
import { openDiscovery, nextOpenDiscovery, isDiscoveryComplete } from '../src/client/content.js';
import { createInitialState, getTodayProgress } from '../src/client/storage.js';

const item = (slot) => ({
  kind: 'science',
  title: `Article ${slot + 1}`,
  description: 'A sourced discovery.',
  source: 'ScienceDaily',
  url: `https://example.org/${slot}`,
  date: '2026-11-02',
  slot,
  available: 3,
});
function setup() {
  const previous = {
    document: globalThis.document,
    storage: globalThis.localStorage,
    fetch: globalThis.fetch,
  };
  const nodes = new Map();
  for (const key of [
    '#modal',
    '#modal-body',
    '#modal-title',
    '#modal [data-action="next-open-discovery"]',
    '#article-next-message',
  ])
    nodes.set(key, {
      open: true,
      innerHTML: '',
      textContent: '',
      disabled: false,
      scrollTop: 140,
      setAttribute() {},
      focus() {},
      close() {
        this.open = false;
      },
    });
  globalThis.document = { querySelector: (selector) => nodes.get(selector) };
  const cache = new Map();
  globalThis.localStorage = {
    getItem: (key) => cache.get(key) || null,
    setItem: (key, value) => cache.set(key, value),
  };
  session.state = createInitialState();
  session.today = '2026-11-02';
  session.route = 'collection';
  session.modalKind = 'science';
  session.loading = {};
  session.discoveryDecks = { science: { position: 0, items: [item(0), null, null], error: '' } };
  session.daily = { science: item(0) };
  globalThis.fetch = async (url) =>
    Response.json(item(Number(new URL(url, 'https://still.test').searchParams.get('slot'))));
  const restore = () => {
    globalThis.document = previous.document;
    globalThis.localStorage = previous.storage;
    globalThis.fetch = previous.fetch;
  };
  return { nodes, restore };
}

test('Next replaces the article inside the same reader and Done closes the third item', async () => {
  const { nodes, restore } = setup();
  try {
    openDiscovery('science');
    assert.ok(nodes.get('#modal-body').innerHTML.includes('article-reading-actions'));
    assert.ok(nodes.get('#modal-body').innerHTML.includes('Mark complete'));
    assert.ok(nodes.get('#modal-body').innerHTML.includes('Read next article'));
    await nextOpenDiscovery('science');
    assert.equal(session.currentReading.content.title, 'Article 2');
    assert.equal(session.currentReading.position, 1);
    assert.equal(nodes.get('#modal').open, true);
    assert.equal(nodes.get('#modal').scrollTop, 0);
    assert.equal(isDiscoveryComplete('science'), false);
    await nextOpenDiscovery('science');
    assert.ok(nodes.get('#modal-body').innerHTML.includes('Close article and return to Today'));
    assert.equal(session.currentReading.content.title, 'Article 3');
    await nextOpenDiscovery('science');
    assert.equal(nodes.get('#modal').open, false);
    assert.equal(session.modalKind, '');
  } finally {
    restore();
  }
});

test('a failed Next fetch keeps the current article open and offers a retry', async () => {
  const { nodes, restore } = setup();
  try {
    openDiscovery('science');
    const original = nodes.get('#modal-body').innerHTML;
    globalThis.fetch = async () => Response.json({ error: 'Source unavailable' }, { status: 503 });
    await nextOpenDiscovery('science');
    assert.equal(session.currentReading.content.title, 'Article 1');
    assert.equal(nodes.get('#modal-body').innerHTML, original);
    assert.equal(nodes.get('#article-next-message').textContent, 'Source unavailable');
    assert.equal(nodes.get('#modal [data-action="next-open-discovery"]').disabled, false);
  } finally {
    restore();
  }
});

test('a late Next response cannot reopen a reader the user closed', async () => {
  const { nodes, restore } = setup();
  try {
    openDiscovery('science');
    let finish;
    globalThis.fetch = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const pending = nextOpenDiscovery('science');
    session.modalKind = '';
    nodes.get('#modal').open = false;
    finish(Response.json(item(1)));
    await pending;
    assert.equal(nodes.get('#modal').open, false);
    assert.equal(session.currentReading.content.title, 'Article 1');
  } finally {
    restore();
  }
});

test('moving on from a completed article does not complete the next one or lose daily progress', async () => {
  const { restore } = setup();
  try {
    session.state.days[session.today] = {
      readings: { science: ['science:https://example.org/0'] },
    };
    openDiscovery('science');
    assert.equal(isDiscoveryComplete('science'), true);
    await nextOpenDiscovery('science');
    assert.equal(isDiscoveryComplete('science'), false);
    assert.ok(getTodayProgress().done.includes('science'));
  } finally {
    restore();
  }
});
