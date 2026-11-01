import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { parseAPOD, astronomyResponse } from '../src/astronomy.mjs';
import { moonSnapshot, moonPhaseName, validMoonLocation, moonSVG } from '../src/moon.mjs';
const context = { Date, Math };
vm.runInNewContext(
  await readFile(new URL('../vendor/astronomy.browser.min.js', import.meta.url), 'utf8'),
  context,
);
const engine = context.Astronomy;

test('NASA daily feature parser keeps attribution and the real source date', () => {
  const html =
    '<img src="https://assets.science.nasa.gov/moon.jpg?width=960&amp;fit=clip"><h2 class="display-48">A cosmic discovery</h2><p class="p-md media-detail-hero__description"><strong>Explanation:</strong> A new <a href="https://nasa.gov">astronomy</a> feature.<br><strong>Tomorrow\'s picture: </strong>another image</p><th>Date:</th><td>November 1, 2026</td><th>Credit &amp; Copyright:</th><td><a>Image creator</a></td>';
  const d = parseAPOD(html, '2026-11-02');
  assert.equal(d.title, 'A cosmic discovery');
  assert.equal(d.description, 'A new astronomy feature.');
  assert.equal(d.sourceDate, '2026-11-01');
  assert.equal(d.credit, 'Image creator');
  assert.equal(d.image, 'https://assets.science.nasa.gov/moon.jpg?width=960&fit=clip');
  assert.ok(d.expiresAt - Date.now() < 901000);
});
test('NASA source failures and invalid dates are explicit', async () => {
  assert.throws(() => parseAPOD('<html>Unavailable</html>', '2026-11-02'));
  assert.equal(
    (await astronomyResponse(new Request('https://still.example/api/astronomy?date=bad'))).status,
    400,
  );
  const old = globalThis.fetch;
  globalThis.fetch = async () => {
    throw Error('Unavailable');
  };
  try {
    assert.equal(
      (await astronomyResponse(new Request('https://still.example/api/astronomy?date=2026-11-02')))
        .status,
      503,
    );
  } finally {
    globalThis.fetch = old;
  }
});
test('Moon calculation correctly identifies a documented new and full Moon', () => {
  const eclipse = moonSnapshot(engine, new Date('2024-04-08T18:21:00Z'));
  assert.ok(eclipse.illumination < 0.001);
  assert.equal(eclipse.name, 'New moon');
  const full = moonSnapshot(engine, new Date('2024-03-25T07:00:00Z'));
  assert.ok(full.illumination > 0.999);
  assert.equal(full.name, 'Full moon');
});
test('location changes local sky position without changing the geocentric lunar phase', () => {
  const date = new Date('2026-11-02T00:00:00Z'),
    a = moonSnapshot(
      engine,
      date,
      { latitude: 41.0082, longitude: 28.9784, label: 'Istanbul', timezone: 'Europe/Istanbul' },
      true,
    ),
    b = moonSnapshot(
      engine,
      date,
      { latitude: -33.8688, longitude: 151.2093, label: 'Sydney', timezone: 'Australia/Sydney' },
      true,
    );
  assert.equal(a.angle, b.angle);
  assert.equal(a.illumination, b.illumination);
  assert.notEqual(a.altitude, b.altitude);
  assert.ok(a.nextFull > date);
  assert.ok(a.nextNew > date);
  assert.ok(a.rise > date);
  assert.ok(a.set > date);
  assert.ok(a.distanceKm > 350000 && a.distanceKm < 410000);
});
test('lunar location validates coordinates and phase graphics contain no invalid values', () => {
  assert.equal(validMoonLocation({ latitude: 91, longitude: 10 }), null);
  assert.equal(validMoonLocation({ latitude: 10, longitude: 181 }), null);
  assert.equal(validMoonLocation(null), null);
  assert.equal(
    validMoonLocation({ latitude: 0, longitude: 0, timezone: 'Bad/zone' }).timezone,
    'UTC',
  );
  for (const angle of [0, 45, 90, 135, 180, 225, 270, 315]) {
    assert.ok(moonPhaseName(angle));
    assert.ok(!moonSVG((1 - Math.cos((angle * Math.PI) / 180)) / 2, angle).includes('NaN'));
  }
});
