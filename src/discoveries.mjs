/** Shared rules for the three-item discovery cards. */
export const DISCOVERY_KINDS = ['astronomy', 'science', 'tech'];
export const DISCOVERY_COUNT = 3;
export const DISCOVERY_LABELS = {
  astronomy: 'Astronomy',
  science: 'Science news',
  tech: 'Technology',
};

// Topic preference for the daily reader; inspect article text, not unrelated page navigation.
const CANCER_TOPICS =
  /\b(?:cancer\w*|oncolog\w*|tumou?r\w*|leuk[ae]*m\w*|lymphom\w*|melanom\w*|carcinog\w*|carcinom\w*|malignan\w*|metastas\w*|metastat\w*|chemotherap\w*|radiotherap\w*|glioblastom\w*|sarcom\w*|myelom\w*|mesotheliom\w*)\b/i;
export function isExcludedDiscovery(item) {
  return CANCER_TOPICS.test(
    [item?.title, item?.description, ...(Array.isArray(item?.topics) ? item.topics : [])]
      .filter(Boolean)
      .join(' '),
  );
}

export function discoveryID(kind, data, date = '') {
  return kind + ':' + (data?.id || data?.url || date);
}
export function normalizeReadings(value) {
  return Object.fromEntries(
    DISCOVERY_KINDS.map((kind) => [
      kind,
      [
        ...new Set(
          (Array.isArray(value?.[kind]) ? value[kind] : []).filter(
            (id) => typeof id === 'string' && id.startsWith(kind + ':'),
          ),
        ),
      ]
        .slice(0, 12)
        .map((id) => id.slice(0, 1500)),
    ]),
  );
}
export function validateDiscoveryRequest(url) {
  const raw = url.searchParams.get('slot') || '0';
  if (!/^[0-2]$/.test(raw)) throw new TypeError('Invalid item');
  const excluded = url.searchParams.getAll('exclude');
  if (
    excluded.length > 2 ||
    excluded.some((value) => {
      try {
        return value.length > 1500 || new URL(value).protocol !== 'https:';
      } catch {
        return true;
      }
    })
  )
    throw new TypeError('Invalid exclusions');
  return { slot: Number(raw), excluded };
}
export function uniqueDiscoveries(items) {
  const seenURLs = new Set(),
    seenTitles = new Set();
  return items.filter((item) => {
    if (isExcludedDiscovery(item)) return false;
    const title = item.title?.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    if (!title || !item.url || seenURLs.has(item.url) || seenTitles.has(title)) return false;
    seenURLs.add(item.url);
    seenTitles.add(title);
    return true;
  });
}
export function chooseDiscovery(items, slot, excluded = []) {
  const unique = uniqueDiscoveries(items);
  const available = Math.min(DISCOVERY_COUNT, unique.length);
  if (slot >= available) throw new RangeError('No more recent items are available.');
  const preferred = unique[slot];
  const selected = excluded.includes(preferred.url)
    ? unique.find((item) => !excluded.includes(item.url))
    : preferred;
  if (!selected) throw new RangeError('No more recent items are available.');
  return { ...selected, slot, available };
}
