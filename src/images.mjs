import { stripMarkup, safeURL } from './daily.mjs';

export function normalizeImageResults(data) {
  return Object.values(data.query?.pages || {})
    .sort((a, b) => (a.index || 0) - (b.index || 0))
    .flatMap((p) => {
      const info = p.imageinfo?.[0],
        meta = info?.extmetadata || {};
      if (!info || !['image/jpeg', 'image/png', 'image/webp'].includes(info.mime)) return [];
      const license = stripMarkup(meta.LicenseShortName?.value || '');
      if (!/^(CC BY(?:-SA)?|CC0|Public domain|PDM)/i.test(license)) return [];
      const image = safeURL(info.thumburl || info.url),
        url = safeURL(info.descriptionurl);
      if (!image || !url) return [];
      return [
        {
          id: String(p.pageid),
          title: stripMarkup(p.title.replace(/^File:/, '')).slice(0, 160),
          image,
          url,
          creator: stripMarkup(
            meta.Artist?.value || meta.Credit?.value || 'Wikimedia Commons contributor',
          ).slice(0, 240),
          license,
          licenseUrl: safeURL((meta.LicenseUrl?.value || '').replace(/^http:/, 'https:')) || url,
        },
      ];
    })
    .slice(0, 12);
}

export async function imageSearchResponse(request) {
  const u = new URL(request.url),
    q = (u.searchParams.get('q') || '').trim(),
    page = Number(u.searchParams.get('page') || 1);
  if (q.length < 2 || q.length > 100 || !Number.isInteger(page) || page < 1 || page > 10)
    return Response.json(
      { error: 'Enter a search between 2 and 100 characters.' },
      { status: 400 },
    );
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: q + ' filetype:bitmap',
    gsrnamespace: '6',
    gsrlimit: '24',
    gsroffset: String((page - 1) * 24),
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime',
    iiurlwidth: '700',
    iiurlheight: '700',
    iiextmetadatafilter: 'Artist|Credit|LicenseShortName|LicenseUrl',
  });
  try {
    const response = await fetch('https://commons.wikimedia.org/w/api.php?' + params, {
      headers: {
        'User-Agent': 'Still/1.0 (personal vision board image search)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error('Image source unavailable');
    const data = await response.json();
    if (data.error) throw Error('Search unavailable');
    return Response.json(
      {
        query: q,
        page,
        results: normalizeImageResults(data),
        more: !!data.continue?.gsroffset,
        source: 'Wikimedia Commons',
      },
      { headers: { 'Cache-Control': 'public, max-age=300' } },
    );
  } catch {
    return Response.json(
      { error: 'Image search is unavailable right now. Please try again.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
