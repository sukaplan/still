/** Publisher thumbnails and a neutral illustration when no story image exists. */
import { escapeHTML, html } from './ui.js';
import { validURL } from './storage.js';

export function newsFallback(kind, identity = '') {
  const hash = [...identity].reduce(
    (value, letter) => (Math.imul(value, 31) + letter.charCodeAt(0)) >>> 0,
    17,
  );
  const palettes = [
    ['#e4e9df', '#71846f', '#ae5b45'],
    ['#ede6dc', '#9a8572', '#b55543'],
    ['#e0e7e8', '#71898a', '#b66b51'],
    ['#e9e6df', '#88816f', '#9e5244'],
  ];
  const [background, ink, accent] = palettes[hash % palettes.length];
  const x = 45 + (hash % 65),
    y = 45 + ((hash >>> 8) % 65);
  return html`<svg
    viewBox="0 0 160 160"
    role="img"
    aria-label="${kind === 'science'
      ? 'Science'
      : 'Technology'} illustration; publisher image unavailable"
  >
    <rect width="160" height="160" fill="${background}" />
    <g fill="none" stroke="${ink}" stroke-width="1" opacity=".6">
      <circle cx="${x}" cy="${y}" r="25" />
      <circle cx="${x}" cy="${y}" r="45" />
      <circle cx="${x}" cy="${y}" r="65" />
      <path d="M0 120H160M40 0V160" />
    </g>
    <circle cx="${160 - x}" cy="${160 - y}" r="7" fill="${accent}" />
  </svg>`;
}
export function renderNewsVisual(kind, content) {
  const image = validURL(content?.image);
  return html`<div
    class="card-image news-visual"
    data-news-kind="${kind}"
    data-news-identity="${escapeHTML(content?.url || content?.title || kind)}"
  >
    ${image
      ? html`<img
          class="news-story-image"
          src="${escapeHTML(image)}"
          alt="${escapeHTML(content.imageAlt || content.title)}"
          loading="lazy"
          referrerpolicy="no-referrer"
        />`
      : newsFallback(kind, content?.url || content?.title || kind)}
  </div>`;
}
