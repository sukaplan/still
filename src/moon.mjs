export function moonPhaseName(angle) {
  if (angle < 0.5 || angle > 359.5) return 'New moon';
  if (Math.abs(angle - 90) < 0.5) return 'First quarter';
  if (Math.abs(angle - 180) < 0.5) return 'Full moon';
  if (Math.abs(angle - 270) < 0.5) return 'Last quarter';
  return angle < 90
    ? 'Waxing crescent'
    : angle < 180
      ? 'Waxing gibbous'
      : angle < 270
        ? 'Waning gibbous'
        : 'Waning crescent';
}

export function validMoonLocation(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    !Number.isFinite(value.latitude) ||
    !Number.isFinite(value.longitude) ||
    Math.abs(value.latitude) > 90 ||
    Math.abs(value.longitude) > 180
  )
    return null;
  let timezone = typeof value.timezone === 'string' ? value.timezone : 'UTC';
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
  } catch {
    timezone = 'UTC';
  }
  return {
    latitude: value.latitude,
    longitude: value.longitude,
    label: String(value.label || 'Selected location').slice(0, 80),
    timezone,
  };
}

export function moonSnapshot(engine, date, location = null, details = false) {
  const angle = engine.MoonPhase(date),
    light = engine.Illumination(engine.Body.Moon, date);
  const result = {
    angle,
    illumination: light.phase_fraction,
    name: moonPhaseName(angle),
    distanceKm: light.geo_dist * 149597870.7,
    date,
  };
  const place = validMoonLocation(location);
  if (details) {
    result.nextNew = engine.SearchMoonPhase(0, date, 40)?.date || null;
    result.nextFull = engine.SearchMoonPhase(180, date, 40)?.date || null;
  }
  if (place) {
    const observer = new engine.Observer(place.latitude, place.longitude, 0),
      equator = engine.Equator(engine.Body.Moon, date, observer, true, true),
      horizon = engine.Horizon(date, observer, equator.ra, equator.dec, 'normal');
    result.location = place;
    result.altitude = horizon.altitude;
    result.azimuth = horizon.azimuth;
    if (details) {
      result.rise = engine.SearchRiseSet(engine.Body.Moon, observer, 1, date, 2)?.date || null;
      result.set = engine.SearchRiseSet(engine.Body.Moon, observer, -1, date, 2)?.date || null;
    }
  }
  return result;
}

export function moonSVG(illumination, angle, size = 28) {
  const f = Math.max(0, Math.min(1, illumination)),
    r = 10,
    rx = Math.abs(1 - 2 * f) * r,
    waxing = angle < 180,
    outer = waxing ? 1 : 0,
    inner = waxing ? (f < 0.5 ? 0 : 1) : f < 0.5 ? 1 : 0;
  return (
    '<svg viewBox="0 0 24 24" width="' +
    size +
    '" height="' +
    size +
    '" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#303a34"/><path d="M12 2 A10 10 0 0 ' +
    outer +
    ' 12 22 A' +
    rx.toFixed(5) +
    ' 10 0 0 ' +
    inner +
    ' 12 2Z" fill="#d8c8ac"/><circle cx="12" cy="12" r="10" fill="none" stroke="#7b8271" stroke-width=".45"/></svg>'
  );
}
