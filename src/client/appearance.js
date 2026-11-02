/** Keep the document and the Settings switch in sync with the saved appearance. */
import { session } from './context.js';
export function applyAppearance() {
  const dark = session.state?.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#161e2b' : '#f7f7f3');
  const toggle = document.querySelector('#dark-appearance');
  if (toggle) toggle.checked = dark;
}
