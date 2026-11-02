import { chooseDiscovery, validateDiscoveryRequest } from './discoveries.mjs';
import { stripMarkup, safeURL, ordinal } from './daily.mjs';

export function parseAPOD(html, date) {
  const descriptionMatch = html.match(
    /<p\b[^>]*class="[^"]*media-detail-hero__description[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
  );
  if (!descriptionMatch) throw Error('NASA feature unavailable');
  const before = html.slice(0, descriptionMatch.index),
    headings = [...before.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)],
    title = stripMarkup(headings.at(-1)?.[1] || '');
  const description = stripMarkup(descriptionMatch[1].split(/<strong>Tomorrow/i)[0]).replace(
    /^Explanation:\s*/i,
    '',
  );
  if (!title || !description) throw Error('NASA feature unavailable');
  const images = [...before.matchAll(/<img\b[^>]*\ssrc="([^"]+)"[^>]*>/gi)];
  const image = safeURL(stripMarkup(images.at(-1)?.[1] || ''));
  const dateText = stripMarkup(
    html.match(/<th\b[^>]*>\s*Date:\s*<\/th>\s*<td\b[^>]*>([\s\S]*?)<\/td>/i)?.[1] || '',
  );
  const parsed = Date.parse(dateText + ' 12:00:00 UTC'),
    sourceDate = Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : '';
  const credit = stripMarkup(
    html.match(
      /<th\b[^>]*>\s*Credit\s*&amp;\s*Copyright:\s*<\/th>\s*<td\b[^>]*>([\s\S]*?)<\/td>/i,
    )?.[1] || 'NASA APOD',
  );
  return {
    kind: 'astronomy',
    date,
    id: 'apod-' + (sourceDate || title),
    title,
    description: description.slice(0, 1050) + (description.length > 1050 ? '…' : ''),
    image,
    source: 'NASA · Astronomy Picture of the Day',
    sourceDate,
    credit,
    url: 'https://science.nasa.gov/apod/',
    fetchedAt: new Date().toISOString(),
    expiresAt: Date.now() + (sourceDate === date ? 86400000 : 900000),
  };
}

export function parseAPODFeed(xml, date) {
  const tag = (item, name) =>
    stripMarkup(
      item.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i'))?.[1] ||
        '',
    );
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)]
    .map(([, item]) => {
      const published = Date.parse(tag(item, 'pubDate'));
      const sourceDate = Number.isFinite(published)
        ? new Date(published).toISOString().slice(0, 10)
        : '';
      const explanation = tag(item, 'apod:explanation').replace(/^Explanation:\s*/i, '');
      return {
        kind: 'astronomy',
        date,
        id: 'apod-' + sourceDate,
        title: tag(item, 'title'),
        description: explanation.slice(0, 1050) + (explanation.length > 1050 ? '…' : ''),
        image: safeURL(tag(item, 'apod:hdurl')),
        imageAlt: tag(item, 'apod:alt'),
        source: 'NASA · Astronomy Picture of the Day',
        sourceDate,
        credit: tag(item, 'apod:credit') || tag(item, 'apod:copyright') || 'NASA APOD',
        url: safeURL(tag(item, 'link')),
        fetchedAt: new Date().toISOString(),
        expiresAt: Date.now() + (sourceDate === date ? 86400000 : 900000),
      };
    })
    .filter(
      (item) =>
        item.title && item.description && item.url && item.sourceDate && item.sourceDate <= date,
    );
}

export async function astronomyResponse(request) {
  const u = new URL(request.url),
    date = u.searchParams.get('date') || new Date(Date.now() + 10800000).toISOString().slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(ordinal(date)) ||
    new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date
  )
    return Response.json({ error: 'Invalid date' }, { status: 400 });
  let selection;
  try {
    selection = validateDiscoveryRequest(u);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  const { slot, excluded } = selection;
  try {
    const r = await fetch('https://science.nasa.gov/feed/apod-basic/', {
      headers: {
        'User-Agent': 'Still/1.0 (personal astronomy reader)',
        Accept: 'application/rss+xml',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw Error('NASA unavailable');
    const data = chooseDiscovery(parseAPODFeed(await r.text(), date), slot, excluded);
    // Archive explanations remain useful even though they are from earlier dates.
    if (slot > 0) data.expiresAt = Date.now() + 86400000;
    return Response.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=' + (data.sourceDate === date || slot > 0 ? 3600 : 900),
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof RangeError
            ? error.message
            : 'NASA’s astronomy feature is unavailable right now. Please try again.',
      },
      { status: error instanceof RangeError ? 404 : 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
