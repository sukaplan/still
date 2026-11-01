import { ordinal, dateInZone } from './date-utils.mjs';
import { GERMAN } from './data/vocabulary.mjs';

export { ordinal, dateInZone } from './date-utils.mjs';
export { WORDS, dailyPuzzle, scoreGuess } from './word-garden.mjs';
export { GERMAN } from './data/vocabulary.mjs';

export function stripMarkup(s = '') {
  let t = String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  return t
    .replace(/&#(\d+);/g, (_, n) => {
      const c = Number(n);
      return c >= 0 && c <= 0x10ffff ? String.fromCodePoint(c) : '';
    })
    .replace(/\s+/g, ' ')
    .trim();
}
export function safeURL(s) {
  try {
    const u = new URL(s);
    return u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}
export function parseRSS(xml) {
  const tag = (s, t) => {
    const m = s.match(new RegExp('<' + t + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + t + '>', 'i'));
    return m ? stripMarkup(m[1]) : '';
  };
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)]
    .map((m) => ({
      title: tag(m[1], 'title'),
      description: tag(m[1], 'description').slice(0, 900),
      url: safeURL(tag(m[1], 'link')),
      publishedAt: tag(m[1], 'pubDate'),
    }))
    .filter((x) => x.title && x.url);
}
async function upstream(url, json = true) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'StillPersonalReader/1.0 (personal educational daily digest)',
      Accept: json ? 'application/json' : 'application/rss+xml, application/xml, text/xml',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error('Source unavailable');
  return json ? r.json() : r.text();
}

export function chooseFeed(
  items,
  date,
  kind,
  zone = 'Europe/Istanbul',
  source = kind === 'tech' ? 'TechCrunch' : 'ScienceDaily',
) {
  const d = ordinal(date);
  const today = items.filter(
    (x) => Number.isFinite(Date.parse(x.publishedAt)) && dateInZone(x.publishedAt, zone) === date,
  );
  const pool = today.length ? today : items.slice(0, 15);
  if (!pool.length) throw new Error('No stories');
  const choice = pool[Math.abs(d * (kind === 'tech' ? 7 : 17)) % pool.length];
  return {
    ...choice,
    kind,
    source,
    isToday: today.length > 0,
    date,
    fetchedAt: new Date().toISOString(),
  };
}
export async function fetchStory(kind, date, zone) {
  if (kind === 'science')
    return chooseFeed(
      parseRSS(await upstream('https://www.sciencedaily.com/rss/all.xml', false)),
      date,
      kind,
      zone,
    );
  try {
    return chooseFeed(
      parseRSS(await upstream('https://techcrunch.com/feed/', false)),
      date,
      kind,
      zone,
      'TechCrunch',
    );
  } catch {
    return chooseFeed(
      parseRSS(await upstream('https://feeds.arstechnica.com/arstechnica/technology-lab', false)),
      date,
      kind,
      zone,
      'Ars Technica',
    );
  }
}
function cleanWiki(s) {
  for (let i = 0; i < 5; i++) s = s.replace(/\{\{[^{}]*\}\}/g, '');
  return s
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
export async function fetchGerman(date) {
  const entry = GERMAN[Math.abs(ordinal(date)) % GERMAN.length];
  const [word, article, meaning, example, translation] = entry;
  const result = {
    kind: 'german',
    date,
    word,
    article,
    meaning,
    example,
    translation,
    source: 'Still vocabulary · Wiktionary',
    url: 'https://en.wiktionary.org/wiki/' + encodeURIComponent(word) + '#German',
    verifiedLive: false,
  };
  try {
    const j = await upstream(
      'https://en.wiktionary.org/w/api.php?action=query&format=json&prop=revisions&rvprop=content&rvslots=main&titles=' +
        encodeURIComponent(word),
    );
    const p = Object.values(j.query?.pages || {})[0];
    const wiki = p?.revisions?.[0]?.slots?.main?.['*'] || '';
    const de =
      wiki.split(/\n==German==\s*\n/)[1]?.split(/\n==[^=]/)[0] ||
      wiki.split(/^==German==\s*\n/)[1]?.split(/\n==[^=]/)[0] ||
      '';
    const gloss = de.match(/^# (.+)$/m)?.[1];
    const plain = gloss ? cleanWiki(gloss) : '';
    if (plain.length > 5 && plain.length < 280) {
      result.dictionaryMeaning = plain;
      result.verifiedLive = true;
    }
    const ipa = de.match(/\{\{IPA\|de\|([^|}]+)/)?.[1];
    if (ipa) result.pronunciation = ipa;
  } catch {}
  return result;
}
const ARTISTS = [
  'Claude Monet',
  'Camille Pissarro',
  'Berthe Morisot',
  'Vincent van Gogh',
  'Pierre-Auguste Renoir',
  'Paul Cezanne',
  'Childe Hassam',
  'John Singer Sargent',
  'Alfred Sisley',
  'Mary Cassatt',
  'Gustave Caillebotte',
  'Winslow Homer',
  'Henri Rousseau',
];
export async function fetchArt(date) {
  const day = Math.abs(ordinal(date)),
    artist = ARTISTS[day % ARTISTS.length];
  const base =
    'https://openaccess-api.clevelandart.org/api/artworks/?q=' +
    encodeURIComponent(artist) +
    '&type=Painting&has_image=1&cc0=1&limit=1';
  let j = await upstream(base);
  const total = j.info?.total || 0;
  if (!total)
    j = await upstream(
      'https://openaccess-api.clevelandart.org/api/artworks/?type=Painting&has_image=1&cc0=1&limit=1&skip=' +
        (day % 200),
    );
  else {
    const skip = Math.floor(day / ARTISTS.length) % total;
    if (skip) j = await upstream(base + '&skip=' + skip);
  }
  const x = j.data?.[0];
  if (!x?.images?.web?.url) throw new Error('Artwork unavailable');
  const raw = stripMarkup(x.fun_fact || x.description || x.tombstone || '');
  return {
    kind: 'art',
    date,
    title: stripMarkup(x.title),
    artist: stripMarkup(x.creators?.[0]?.description || x.culture?.join(', ') || 'Artist unknown'),
    year: x.creation_date,
    medium: stripMarkup(x.technique),
    image: safeURL(x.images.web.url),
    description: raw.length > 800 ? raw.slice(0, 797) + '…' : raw,
    source: 'The Cleveland Museum of Art',
    url: safeURL(x.url),
    license: 'CC0 / Public domain',
    id: x.id,
    fetchedAt: new Date().toISOString(),
  };
}
export async function apiResponse(request, ctx) {
  const u = new URL(request.url),
    kind = u.pathname.split('/').at(-1);
  if (!['science', 'tech', 'german', 'art'].includes(kind))
    return Response.json({ error: 'Not found' }, { status: 404 });
  let zone = u.searchParams.get('timezone') || 'Europe/Istanbul';
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
  } catch {
    return Response.json({ error: 'Invalid time zone' }, { status: 400 });
  }
  const date =
    u.searchParams.get('date') || new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(ordinal(date)) ||
    new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date
  )
    return Response.json({ error: 'Invalid date' }, { status: 400 });
  const cacheKey = new Request(
    u.origin + '/_cache/v2/api/' + kind + '?date=' + date + '&timezone=' + encodeURIComponent(zone),
  );
  let cache;
  try {
    cache = globalThis.caches?.default;
    const hit = await cache?.match(cacheKey);
    if (hit) return hit;
  } catch {
    cache = undefined;
  }
  try {
    const data =
      kind === 'german'
        ? await fetchGerman(date)
        : kind === 'art'
          ? await fetchArt(date)
          : await fetchStory(kind, date, zone);
    const res = Response.json(data, {
      headers: { 'Cache-Control': 'public, max-age=86400', 'X-Still-Date': date },
    });
    if (cache && !(kind === 'german' && !data.verifiedLive)) {
      try {
        const pending = cache.put(cacheKey, res.clone()).catch(() => {});
        if (ctx?.waitUntil) ctx.waitUntil(pending);
        else await pending;
      } catch {}
    }
    return res;
  } catch {
    return Response.json(
      { error: 'This source is taking a quiet moment. Please try again.', kind, date },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
