/** Date-based selections use UTC noon to avoid daylight-saving boundaries. */
export function ordinal(date) {
  return Math.floor(Date.parse(date + 'T12:00:00Z') / 86400000);
}

export function dateInZone(timestamp, zone = 'Europe/Istanbul') {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));
  return ['year', 'month', 'day'].map((t) => p.find((x) => x.type === t).value).join('-');
}
