import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyPuzzle,
  scoreGuess,
  dateInZone,
  parseRSS,
  chooseFeed,
  apiResponse,
  WORDS,
  GERMAN,
} from '../src/daily.mjs';

test('daily puzzle is stable on return and changes on the next day', () => {
  assert.deepEqual(dailyPuzzle('2026-11-01'), dailyPuzzle('2026-11-01'));
  assert.notEqual(dailyPuzzle('2026-11-01').answer, dailyPuzzle('2026-11-02').answer);
  assert.equal(new Set(WORDS.map((x) => x[0])).size, WORDS.length);
  assert.ok(WORDS.every(([word, hint]) => /^[A-Z]{5}$/.test(word) && hint.length > 5));
  assert.equal(new Set(GERMAN.map((x) => x[0])).size, GERMAN.length);
});
test('duplicate-letter scoring never awards more letters than the answer contains', () => {
  assert.deepEqual(scoreGuess('ALLEY', 'APPLE'), [
    'correct',
    'present',
    'absent',
    'present',
    'absent',
  ]);
  assert.deepEqual(scoreGuess('EERIE', 'GREEN'), [
    'present',
    'present',
    'present',
    'absent',
    'absent',
  ]);
  assert.deepEqual(scoreGuess('GREEN', 'GREEN'), Array(5).fill('correct'));
});
test('daily date respects local midnight, including different time zones', () => {
  assert.equal(dateInZone('2026-11-01T21:01:00Z', 'Europe/Istanbul'), '2026-11-02');
  assert.equal(dateInZone('2026-11-01T21:01:00Z', 'America/New_York'), '2026-11-01');
});
test('RSS treats source content as text and rejects non-HTTPS links', () => {
  const items = parseRSS(
    '<rss><item><title><![CDATA[New &amp; useful]]></title><link>https://example.org/story</link><description><![CDATA[<b>Something</b> interesting]]></description><pubDate>Sun, 01 Nov 2026 08:00:00 GMT</pubDate></item><item><title>Bad link</title><link>javascript:alert(1)</link></item></rss>',
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'New & useful');
  assert.equal(items[0].description, 'Something interesting');
});
test('feed selection prefers the chosen local day and labels older content', () => {
  const old = {
    title: 'Old story',
    url: 'https://example.org/old',
    publishedAt: 'Fri, 30 Oct 2026 10:00:00 GMT',
  };
  const fresh = {
    title: 'New story',
    url: 'https://example.org/new',
    publishedAt: 'Sun, 01 Nov 2026 22:00:00 GMT',
  };
  assert.equal(
    chooseFeed([old, fresh], '2026-11-02', 'tech', 'Europe/Istanbul').title,
    'New story',
  );
  assert.equal(chooseFeed([old], '2026-11-02', 'tech').isToday, false);
});
test('API rejects invalid dates, nonexistent dates, time zones, and source kinds', async () => {
  for (const query of ['date=not-a-date', 'date=2026-02-30', 'timezone=Bad/Zone'])
    assert.equal(
      (await apiResponse(new Request('https://still.example/api/art?' + query))).status,
      400,
    );
  assert.equal((await apiResponse(new Request('https://still.example/api/nope'))).status, 404);
});
test('daily cache keeps the selection fixed without refetching upstream', async () => {
  const oldCache = globalThis.caches,
    oldFetch = globalThis.fetch;
  let calls = 0;
  const data = new Map();
  globalThis.caches = {
    default: {
      async match(r) {
        return data.get(r.url)?.clone();
      },
      async put(r, v) {
        data.set(r.url, v.clone());
      },
    },
  };
  globalThis.fetch = async () => {
    calls++;
    return new Response(
      '<rss><item><title>A story</title><link>https://example.org/story</link><description>A small discovery.</description><pubDate>Sun, 01 Nov 2026 10:00:00 GMT</pubDate></item></rss>',
    );
  };
  try {
    const request = new Request('https://still.example/api/science?date=2026-11-01');
    const first = await apiResponse(request),
      second = await apiResponse(request);
    assert.deepEqual(await first.json(), await second.json());
    assert.equal(calls, 1);
    await apiResponse(new Request('https://still.example/api/science?date=2026-11-02'));
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = oldFetch;
    globalThis.caches = oldCache;
  }
});
test('source outages return a retryable response instead of invented content', async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw Error('Offline');
  };
  try {
    const r = await apiResponse(new Request('https://still.example/api/science?date=2026-11-01'));
    assert.equal(r.status, 503);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.ok((await r.json()).error);
  } finally {
    globalThis.fetch = oldFetch;
  }
});
test('unavailable platform cache cannot take down a successful daily feed', async () => {
  const oldCache = globalThis.caches,
    oldFetch = globalThis.fetch;
  globalThis.caches = {
    default: {
      async match() {
        throw Error('Cache API unsupported');
      },
      async put() {
        throw Error('Cache API unsupported');
      },
    },
  };
  globalThis.fetch = async () =>
    new Response(
      '<rss><item><title>Live science</title><link>https://example.org/live</link><description>A discovery.</description><pubDate>Sun, 01 Nov 2026 10:00:00 GMT</pubDate></item></rss>',
    );
  try {
    const r = await apiResponse(new Request('https://still.example/api/science?date=2026-11-01'));
    assert.equal(r.status, 200);
    assert.equal((await r.json()).title, 'Live science');
  } finally {
    globalThis.fetch = oldFetch;
    globalThis.caches = oldCache;
  }
});
