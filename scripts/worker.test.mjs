import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from '../src/worker.mjs';

const worker = createWorker(
  {
    '/': { type: 'text/html; charset=utf-8', body: '<main>Still</main>' },
    '/app.js': { type: 'application/javascript', body: 'export {};' },
  },
  { '/assets/test.png': { type: 'image/png', data: btoa('image bytes') } },
);
const request = (path, method = 'GET') =>
  worker.fetch(new Request(`https://still.test${path}`, { method }));

test('Worker serves the shell and versioned assets with the intended cache and security headers', async () => {
  const page = await request('/');
  assert.equal(await page.text(), '<main>Still</main>');
  assert.equal(page.headers.get('Cache-Control'), 'no-cache');
  assert.equal(page.headers.get('X-Content-Type-Options'), 'nosniff');
  const script = await request('/app.js?v=123');
  assert.equal(await script.text(), 'export {};');
  assert.match(script.headers.get('Cache-Control'), /max-age=3600/);
  const head = await request('/', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('Worker decodes bundled image bytes and keeps missing resources and invalid methods explicit', async () => {
  const image = await request('/assets/test.png');
  assert.equal(image.headers.get('Content-Type'), 'image/png');
  assert.equal(await image.text(), 'image bytes');
  assert.equal((await request('/missing')).status, 404);
  assert.equal((await request('/api/unknown')).status, 404);
  assert.equal((await request('/', 'POST')).status, 405);
});
