/** Shared DOM helpers, HTML templates, buttons, and dialogs. */
import { session } from './context.js';
export function html(strings, ...values) {
  return strings.reduce(
    (output, part, index) => output + part + (index < values.length ? values[index] : ''),
    '',
  );
}
export const $ = (s) => document.querySelector(s);
export const escapeHTML = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c],
  );
export const ICON_PATHS = {
  home: 'M3 10 12 3l9 7M5 9v11h5v-6h4v6h5V9',
  bookmark: 'M6 3h12v18l-6-4-6 4V3Z',
  vision: 'M4 5h16v15H4V5Zm4-3v6m8-6v6M4 10h16m-11 5 2 2 4-4',
  settings:
    'm9 3 6 0 1 3 3 1 2 5-2 4-3 1-1 4H9l-1-3-3-1-2-5 2-4 3-1 1-4ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  close: 'm6 6 12 12M6 18 18 6',
  sun: 'M4 17h16M6 14a6 6 0 0 1 12 0M12 2v3M3 6l2 2m14-2-2 2M1 12h3m16 0h3',
  leaf: 'M20 3C9 2 3 8 5 15c2 7 14 5 15-12ZM5 20l10-11',
  puzzle: 'M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z',
  science: 'M9 3h6m-5 0v6l-6 10v2h16v-2L14 9V3M7 15h10',
  tech: 'M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 11a1 1 0 1 0 1 1M15 9l6-6m-5 0h5v5',
  art: 'M3 5h18v15H3V5Zm2 13 5-6 4 4 2-2 4 4M16 9h.01',
  language: 'M3 4h12M9 2v3m-4 3c2 5 5 7 9 9M13 4C12 10 8 15 3 17m11 4 4-11 4 11m-6-4h5',
  sound: 'm4 9 5 0 5-5v16l-5-5H4V9Zm13-2a8 8 0 0 1 0 10m2-13a12 12 0 0 1 0 16',
  plus: 'M12 4v16M4 12h16',
  check: 'm5 12 4 4L19 6',
  edit: 'm4 16-1 5 5-1L20 8l-4-4L4 16Zm10-10 4 4',
  external: 'M14 3h7v7m0-7L10 14m0-10H4v16h16v-6',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
  refresh: 'M20 7v5h-5M4 17v-5h5M19 8a8 8 0 0 0-13-2L4 9m1 7a8 8 0 0 0 13 2l2-3',
  heart: 'M12 21 3 12C-3 4 7-1 12 6c5-7 15-2 9 6l-9 9Z',
};
export const renderIcon = (name, cls = '') =>
  html`<svg
    class="${cls}"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.3"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="${ICON_PATHS[name] || ICON_PATHS.leaf}" />
  </svg>`;
export function creditHTML(credit) {
  return credit?.url
    ? html`<span class="photo-attribution"
        >Photo:
        <a href="${escapeHTML(credit.url)}" target="_blank" rel="noopener noreferrer"
          >${escapeHTML(credit.creator || 'Wikimedia Commons')}</a
        >
        ·
        <a
          href="${escapeHTML(credit.licenseUrl || credit.url)}"
          target="_blank"
          rel="noopener noreferrer"
          >${escapeHTML(credit.license)}</a
        ></span
      >`
    : '';
}
export function toast(text) {
  $('#toast').textContent = text;
  $('#toast').classList.add('visible');
  clearTimeout(session.toastTimer);
  session.toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4000);
}
export const renderButton = (action, text, classes = 'text-link', extra = '') =>
  html`<button type="button" class="${classes}" data-action="${action}" ${extra}>${text}</button>`;
export const renderArrowButton = (action, label, extra = '') =>
  renderButton(
    action,
    renderIcon('arrow'),
    'circle-arrow',
    'aria-label="' + escapeHTML(label) + '" ' + extra,
  );
export function renderCardLabel(kind, text) {
  return html`<span class="card-label">${renderIcon(kind)}${escapeHTML(text)}</span>`;
}
export function renderPageHeading(title) {
  return html`<section class="intro"><h1>${title}</h1></section>`;
}
export function openModal(content, kind) {
  session.modalKind = kind;
  $('#modal-body').innerHTML = html`<div class="modal-content">${content}</div>`;
  if (!$('#modal').open) $('#modal').showModal();
}
export function modalTitle(text, eyebrow) {
  return (
    (eyebrow ? html`<div class="eyebrow">${escapeHTML(eyebrow)}</div>` : '') +
    '<h2 id="modal-title">' +
    escapeHTML(text) +
    '</h2>'
  );
}
export function closeModal() {
  $('#modal').close();
  session.modalKind = '';
  session.editingId = null;
  session.imageController?.abort();
  session.imageRequest++;
}
