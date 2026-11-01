/** Live Moon indicator, local sky details, and location selection. */
import { moonSnapshot, moonSVG, validMoonLocation } from '../moon.mjs';
import { session } from './context.js';
import { updatePersonalState } from './storage.js';
import { $, escapeHTML, html, modalTitle, openModal, renderButton, toast } from './ui.js';
export const MOON_CITIES = [
  {
    label: 'Istanbul',
    latitude: 41.0082,
    longitude: 28.9784,
    timezone: 'Europe/Istanbul',
  },
  {
    label: 'Berlin',
    latitude: 52.52,
    longitude: 13.405,
    timezone: 'Europe/Berlin',
  },
  {
    label: 'London',
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: 'Europe/London',
  },
  {
    label: 'New York',
    latitude: 40.7128,
    longitude: -74.006,
    timezone: 'America/New_York',
  },
  {
    label: 'Tokyo',
    latitude: 35.6762,
    longitude: 139.6503,
    timezone: 'Asia/Tokyo',
  },
  {
    label: 'Sydney',
    latitude: -33.8688,
    longitude: 151.2093,
    timezone: 'Australia/Sydney',
  },
];
export function updateMoonBadge() {
  const badge = $('#moon-badge');
  if (!badge) return;
  try {
    const moon = moonSnapshot(window.Astronomy, new Date(), session.state.location);
    badge.innerHTML =
      moonSVG(moon.illumination, moon.angle) +
      '<span><strong>' +
      escapeHTML(moon.name) +
      '</strong><small>' +
      (moon.illumination * 100).toFixed(1) +
      '% illuminated</small></span>';
    badge.title = moon.location
      ? moon.location.label + ' · ' + (moon.altitude >= 0 ? 'Above' : 'Below') + ' the horizon'
      : 'Set your location for local moonrise and moonset';
    badge.setAttribute(
      'aria-label',
      moon.name +
        ', ' +
        (moon.illumination * 100).toFixed(1) +
        ' percent illuminated. Open Moon details.',
    );
  } catch {
    badge.textContent = 'Moon phase';
  }
}
export function openMoon() {
  if (!window.Astronomy) {
    toast('The astronomy calculator is unavailable. Refresh to try again.');
    return;
  }
  const moon = moonSnapshot(window.Astronomy, new Date(), session.state.location, true),
    zone = moon.location?.timezone || session.state.timezone;
  const time = (d) =>
    d
      ? new Intl.DateTimeFormat('en-GB', {
          timeZone: zone,
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }).format(d)
      : 'Not in the next 48 hours';
  openModal(
    html`${modalTitle(moon.name, 'THE MOON, RIGHT NOW')}
      <div class="moon-hero">
        ${moonSVG(moon.illumination, moon.angle, 100)}
        <div>
          <strong>${(moon.illumination * 100).toFixed(2)}%</strong><span>illuminated</span
          ><small
            >${Math.round(moon.distanceKm).toLocaleString('en-GB')} km from Earth’s centre</small
          >
        </div>
      </div>
      <div class="moon-stats">
        <div><span>Phase longitude</span><strong>${moon.angle.toFixed(2)}°</strong></div>
        <div><span>Next full moon</span><strong>${escapeHTML(time(moon.nextFull))}</strong></div>
        <div><span>Next new moon</span><strong>${escapeHTML(time(moon.nextNew))}</strong></div>
      </div>
      ${moon.location
        ? html`<div class="moon-local">
            <h3>${escapeHTML(moon.location.label)}</h3>
            <p>${moon.location.latitude.toFixed(3)}°, ${moon.location.longitude.toFixed(3)}°</p>
            <div class="moon-stats">
              <div>
                <span>Right now</span
                ><strong>${moon.altitude >= 0 ? 'Above' : 'Below'} the horizon</strong>
              </div>
              <div><span>Altitude</span><strong>${moon.altitude.toFixed(1)}°</strong></div>
              <div><span>Next moonrise</span><strong>${escapeHTML(time(moon.rise))}</strong></div>
              <div><span>Next moonset</span><strong>${escapeHTML(time(moon.set))}</strong></div>
            </div>
          </div>`
        : '<p class="moon-location-note">Set a location for local moonrise, moonset, and visibility.</p>'}
      <div class="moon-location-picker">
        ${renderButton(
          'use-location',
          'Use my location',
          'primary-button',
          'id="use-location-button"',
        )}<select id="moon-city" aria-label="Choose a city">
          <option value="">Choose a city</option>
          ${MOON_CITIES.map((c) => html`<option>${escapeHTML(c.label)}</option>`).join('')}
        </select>
      </div>
      <details class="moon-coordinates">
        <summary>Enter coordinates</summary>
        <form id="moon-location-form">
          <div class="form-two">
            <div class="form-row">
              <label for="moon-latitude">Latitude</label
              ><input
                id="moon-latitude"
                name="latitude"
                type="number"
                min="-90"
                max="90"
                step="any"
                required
                value="${escapeHTML(session.state.location?.latitude ?? '')}"
              />
            </div>
            <div class="form-row">
              <label for="moon-longitude">Longitude</label
              ><input
                id="moon-longitude"
                name="longitude"
                type="number"
                min="-180"
                max="180"
                step="any"
                required
                value="${escapeHTML(session.state.location?.longitude ?? '')}"
              />
            </div>
          </div>
          <button class="secondary-button" type="submit">Set location</button>
        </form>
      </details>
      <p id="moon-location-error" class="form-error" role="alert"></p>
      <p class="picture-credit">
        Times: ${escapeHTML(zone.replaceAll('_', ' '))}. Phase is shared globally; location changes
        visibility and rise/set times. Coordinates stay in this browser.
      </p>
      <p class="picture-credit">
        Calculated with
        <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noopener noreferrer"
          >Astronomy Engine</a
        >. Phase diagram is north-up. Updated
        ${new Intl.DateTimeFormat('en-GB', {
          timeZone: zone,
          hour: '2-digit',
          minute: '2-digit',
        }).format(moon.date)}.
      </p>`,
    'moon',
  );
}
export function setMoonLocation(value) {
  const location = validMoonLocation(value);
  if (!location) {
    if ($('#moon-location-error'))
      $('#moon-location-error').textContent = 'Enter valid coordinates.';
    return;
  }
  if (
    updatePersonalState((s) => {
      s.location = location;
    })
  ) {
    updateMoonBadge();
    openMoon();
  }
}
export function useCurrentLocation() {
  if (!navigator.geolocation) {
    $('#moon-location-error').textContent =
      'Location is unavailable in this browser. Choose a city or enter coordinates.';
    return;
  }
  const button = $('#use-location-button');
  button.disabled = true;
  button.textContent = 'Locating…';
  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (session.modalKind !== 'moon') return;
      setMoonLocation({
        latitude: Number(position.coords.latitude.toFixed(5)),
        longitude: Number(position.coords.longitude.toFixed(5)),
        label: 'Current location',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    },
    (error) => {
      if (session.modalKind !== 'moon') return;
      $('#use-location-button').disabled = false;
      $('#use-location-button').textContent = 'Use my location';
      $('#moon-location-error').textContent =
        error.code === 1
          ? 'Location access was denied. Choose a city or enter coordinates.'
          : 'Location could not be found. Choose a city or enter coordinates.';
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 900000,
    },
  );
}
