import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseDiscovery,
  discoveryID,
  normalizeReadings,
  validateDiscoveryRequest,
} from '../src/discoveries.mjs';
import { apiResponse, chooseFeedItem } from '../src/daily.mjs';
import { astronomyResponse, parseAPODFeed } from '../src/astronomy.mjs';
import { normalizeDay } from '../src/state.mjs';
import { mergeDayProgress } from '../src/client/storage.js';

const date = '2026-11-02';
const stories = Array.from({ length: 5 }, (_, i) => ({
  title: `Discovery ${i}`,
  description: 'A sourced discovery.',
  url: `https://example.org/${i}`,
  publishedAt: i < 2 ? 'Mon, 02 Nov 2026 08:00:00 GMT' : 'Sun, 01 Nov 2026 08:00:00 GMT',
}));
const feed =
  '<rss>' +
  stories
    .map(
      (item) =>
        `<item><title>${item.title}</title><description>${item.description}</description><link>${item.url}</link><pubDate>${item.publishedAt}</pubDate></item>`,
    )
    .join('') +
  '</rss>';
const apod =
  '<rss>' +
  [date, '2026-11-01', '2026-10-31']
    .map(
      (date, i) =>
        `<item><title>Cosmos ${i}</title><link>https://science.nasa.gov/image-article/feature-${i}/</link><pubDate>${date}T05:00:00Z</pubDate><apod:hdurl>https://images.nasa.gov/${i}.jpg?x=1&#038;y=2</apod:hdurl><apod:explanation><![CDATA[<strong>Explanation:</strong> The <a>universe</a> in detail.]]></apod:explanation><apod:credit><![CDATA[<a>Image creator ${i}</a>]]></apod:credit></item>`,
    )
    .join('') +
  '</rss>';

test('three story slots are distinct, prefer today, and fill remaining places with recent stories', () => {
  const items = [
    ...stories,
    { ...stories[0], title: 'Discovery 0!' },
    { ...stories[0], url: 'https://other.org/syndicated' },
  ];
  const selected = [0, 1, 2].map((slot) =>
    chooseFeedItem(items, date, 'science', 'UTC', 'ScienceDaily', slot),
  );
  assert.equal(new Set(selected.map((item) => item.url)).size, 3);
  assert.equal(new Set(selected.map((item) => item.title)).size, 3);
  assert.ok(selected[0].isToday && selected[1].isToday);
  assert.equal(selected[2].isToday, false);
  assert.ok(selected.every((item) => item.available === 3));
  const shifted = chooseDiscovery(stories, 1, [stories[1].url]);
  assert.notEqual(shifted.url, stories[1].url);
  assert.throws(() => chooseDiscovery(stories.slice(0, 1), 1), RangeError);
});

test('pagination validates boundaries and never accepts unsafe or unbounded exclusions', () => {
  for (const query of [
    'slot=-1',
    'slot=3',
    'slot=1.5',
    'slot=x',
    'exclude=javascript:alert(1)',
    'exclude=http://example.org',
    'exclude=https://a.org&exclude=https://b.org&exclude=https://c.org',
  ])
    assert.throws(
      () => validateDiscoveryRequest(new URL('https://still.test?' + query)),
      TypeError,
    );
  assert.deepEqual(
    validateDiscoveryRequest(new URL('https://still.test?slot=2&exclude=https://a.org')),
    { slot: 2, excluded: ['https://a.org'] },
  );
});

test('NASA RSS parsing preserves explanations, permanent source links, credit, and real dates', () => {
  const items = parseAPODFeed(apod, date);
  assert.equal(items.length, 3);
  assert.equal(items[0].description, 'The universe in detail.');
  assert.equal(items[1].credit, 'Image creator 1');
  assert.equal(items[0].image, 'https://images.nasa.gov/0.jpg?x=1&y=2');
  assert.equal(items[2].sourceDate, '2026-10-31');
  assert.ok(items.every((item) => item.url.includes('/image-article/')));
  assert.equal(parseAPODFeed(apod, '2026-11-01').length, 2);
});

test('news and astronomy APIs return the requested slot and keep cache keys separate', async () => {
  const oldFetch = globalThis.fetch,
    oldCache = globalThis.caches;
  const cache = new Map();
  globalThis.caches = {
    default: {
      match: async (key) => cache.get(key.url)?.clone(),
      put: async (key, value) => cache.set(key.url, value.clone()),
    },
  };
  globalThis.fetch = async (url) => new Response(String(url).includes('apod') ? apod : feed);
  try {
    const news = [],
      astro = [];
    for (let slot = 0; slot < 3; slot++) {
      const response = await apiResponse(
        new Request(`https://still.test/api/science?date=${date}&slot=${slot}`),
      );
      assert.equal(response.status, 200);
      news.push(await response.json());
      const nasa = await astronomyResponse(
        new Request(`https://still.test/api/astronomy?date=${date}&slot=${slot}`),
      );
      assert.equal(nasa.status, 200);
      astro.push(await nasa.json());
    }
    assert.equal(new Set(news.map((item) => item.url)).size, 3);
    assert.equal(new Set(astro.map((item) => item.url)).size, 3);
    assert.equal(cache.size, 3);
    assert.equal(
      (await apiResponse(new Request(`https://still.test/api/tech?date=${date}&slot=3`))).status,
      400,
    );
    assert.equal(
      (await astronomyResponse(new Request(`https://still.test/api/astronomy?date=${date}&slot=3`)))
        .status,
      400,
    );
  } finally {
    globalThis.fetch = oldFetch;
    globalThis.caches = oldCache;
  }
});

test('read items remain separate and survive daily normalization and backup merging', () => {
  const first = discoveryID('science', stories[0]),
    second = discoveryID('science', stories[1]);
  const a = normalizeDay({ readings: { science: [first, first, 'invalid'] } });
  assert.deepEqual(a.readings.science, [first]);
  assert.deepEqual(a.done, ['science']);
  assert.deepEqual(a.readings.tech, []);
  assert.equal(normalizeReadings({ astronomy: ['tech:wrong'] }).astronomy.length, 0);
  const merged = mergeDayProgress(a, { readings: { science: [second], tech: ['tech:new'] } }, date);
  assert.deepEqual(merged.readings.science, [first, second]);
  assert.ok(merged.done.includes('science') && merged.done.includes('tech'));
  assert.equal(merged.done.filter((kind) => kind === 'science').length, 1);
});

test('cancer-related titles, summaries, and topic tags are excluded before selecting any slot', async () => {
  const { isExcludedDiscovery } = await import('../src/discoveries.mjs');
  for (const item of [
    { title: 'Study links alcohol to cancer' },
    { title: 'A new discovery', description: 'A breakthrough in oncology and tumour treatment.' },
    { title: 'New research', topics: ['Leukaemia'] },
    { title: 'Chemotherapy research' },
    { title: 'New insights into metastatic disease' },
  ])
    assert.ok(isExcludedDiscovery(item));
  assert.ok(!isExcludedDiscovery({ title: 'Quantum cancellation and metastable states' }));
  const feed = [
    { ...stories[0], title: 'Cancer research' },
    ...stories.slice(1),
    { ...stories[0], url: 'https://example.org/extra', title: 'A new galaxy' },
  ];
  const selected = [0, 1, 2].map((slot) =>
    chooseFeedItem(feed, date, 'science', 'UTC', 'ScienceDaily', slot),
  );
  assert.equal(selected.length, 3);
  assert.ok(selected.every((item) => !isExcludedDiscovery(item)));
  assert.equal(new Set(selected.map((item) => item.url)).size, 3);
});
