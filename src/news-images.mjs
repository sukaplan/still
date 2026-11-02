/** Read publisher-provided story thumbnails without making imagery a dependency for news. */
const ARTICLE_HOSTS = new Set([
  'sciencedaily.com',
  'www.sciencedaily.com',
  'techcrunch.com',
  'arstechnica.com',
  'www.arstechnica.com',
]);
function decode(value) {
  return String(value).replace(/&(?:amp|quot|apos|#\d+|#x[\da-f]+);/gi, (entity) => {
    entity = entity.toLowerCase();
    if (entity === '&amp;') return '&';
    if (entity === '&quot;') return '"';
    if (entity === '&apos;') return "'";
    const code = entity.toLowerCase().startsWith('&#x')
      ? parseInt(entity.slice(3, -1), 16)
      : Number(entity.slice(2, -1));
    return Number.isInteger(code) && code >= 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : '';
  });
}
function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map((match) => [
      match[1].toLowerCase(),
      decode(match[2] ?? match[3] ?? match[4]),
    ]),
  );
}
function imageURL(value, base) {
  try {
    const url = new URL(value, base);
    if (
      !value ||
      url.protocol !== 'https:' ||
      /(?:placeholder|default[-_]social|(?:^|[-_/])logo(?:[-_.\/]|$))/i.test(url.pathname)
    )
      return '';
    return url.href;
  } catch {
    return '';
  }
}
export function parseFeedImage(item, articleURL) {
  for (const [tag] of item.matchAll(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*>/gi)) {
    const data = attributes(tag);
    if (tag.toLowerCase().startsWith('<enclosure') && !data.type?.startsWith('image/')) continue;
    if (data.medium && data.medium !== 'image') continue;
    if (data.type && !data.type.startsWith('image/')) continue;
    const image = imageURL(data.url, articleURL);
    if (image) return image;
  }
  for (const [tag] of item.matchAll(/<img\b[^>]*>/gi)) {
    const data = attributes(tag);
    const image = imageURL(data.src, articleURL);
    if (image) return image;
  }
  return '';
}
export function parseStoryImage(html, articleURL) {
  const metadata = {};
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const data = attributes(tag);
    const key = (data.property || data.name || '').toLowerCase();
    if (key && data.content && !metadata[key]) metadata[key] = data.content;
  }
  return {
    image:
      ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']
        .map((key) => imageURL(metadata[key], articleURL))
        .find(Boolean) || '',
    imageAlt: metadata['og:image:alt'] || metadata['twitter:image:alt'] || '',
  };
}
export async function enrichStoryImage(story) {
  const result = { ...story, image: story.image || '', imageAttribution: '' };
  if (!result.image) {
    try {
      if (!ARTICLE_HOSTS.has(new URL(story.url).hostname)) return result;
      const response = await fetch(story.url, {
        headers: { Accept: 'text/html', 'User-Agent': 'Still/1.0 (daily news reader)' },
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok)
        Object.assign(
          result,
          parseStoryImage((await response.text()).slice(0, 1500000), story.url),
        );
    } catch {
      /* Keep the sourced story readable if its thumbnail cannot be retrieved. */
    }
  }
  if (result.image) result.imageAttribution = 'Image via ' + story.source;
  return result;
}
