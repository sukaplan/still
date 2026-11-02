import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/styles/appearance.css', import.meta.url), 'utf8');
const block = css.match(/:root\[data-theme='dark'\]\s*\{([^}]+)\}/)[1];
const colours = Object.fromEntries(
  [...block.matchAll(/(--[\w-]+):\s*(#[\da-f]{6})/gi)].map(([, name, value]) => [name, value]),
);
function luminance(hex) {
  return [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(a, b) {
  const [low, high] = [luminance(a), luminance(b)].sort((a, b) => a - b);
  return (high + 0.05) / (low + 0.05);
}
test('the blue dark palette meets AA contrast for normal text, muted labels, and links', () => {
  for (const foreground of ['--ink', '--muted', '--accent'])
    for (const background of ['--paper', '--card', '--accent-soft'])
      assert.ok(
        contrast(colours[foreground], colours[background]) >= 4.5,
        `${foreground} on ${background}`,
      );
  const button = css.match(/:root\[data-theme='dark'\] \.primary-button\s*\{([^}]+)\}/)[1];
  const text = button.match(/color:\s*(#[\da-f]{6})/i)[1];
  assert.ok(contrast(text, colours['--accent']) >= 4.5);
});
