const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// The platform signs user-identity tokens with an RSA private key it never
// shares. Containers get only the PUBLIC half, so this app can verify who a
// user is but cannot mint an identity — and neither can any other app.
const JWT_PUBLIC_KEY = (process.env.USERNODE_JWT_PUBLIC_KEY || '')
  .replace(/\\n/g, '\n');

// Tokens are minted for one app: the audience is this app's numeric id, so a
// token issued for a different app is rejected below rather than accepted as
// a valid user.
const APP_AUDIENCE = process.env.USERNODE_APP_ID
  ? 'usernode:app:' + process.env.USERNODE_APP_ID
  : null;

// Paths that stay open without authentication. Add a path here (and add it
// with `app.get`/`app.post` below) if you deliberately want it public.
// Everything else requires a valid platform-issued JWT.
const PUBLIC_API_PATHS = new Set(['/health']);

app.use(express.json());

// The platform's three centrally hosted files — the bridge, the native UI
// kit and the Tailwind runtime — are reachable at these paths on this app's
// OWN origin, so index.html can load them with a RELATIVE path and never
// name the platform's hostname. A hostname baked into an app is what breaks
// every app at once when the platform's domain moves.
//
// In production and on a staging preview the platform's edge answers these
// before the request ever reaches this process (a per-app Ingress rule on
// Kubernetes, the wildcard site's matcher on the docker runtime). This
// handler is what makes the same relative paths work under a plain
// `node server.js`, where there is no edge in front of the app at all.
//
// Registered BEFORE the auth middleware because these three files are
// public: the platform serves them anonymously from any app origin, and a
// login redirect arriving where a <script> was expected is exactly the
// failure a relative path is meant to avoid.
// The platform's origin, at RUNTIME, and ONLY from the variable the platform
// injects. No hostname is written into this file: a baked-in one is what left
// the whole fleet pointing at a domain the platform had moved away from.
// Unset only outside the platform (a plain local `node server.js`) — set
// USERNODE_PLATFORM_ORIGIN there too if you want the hosted assets locally.
const PLATFORM_ORIGIN = (process.env.USERNODE_PLATFORM_ORIGIN || '')
  .replace(/\/+$/, '');

app.get(/^\/usernode-(?:bridge|native|tailwind)\//, async (req, res) => {
  try {
    if (!PLATFORM_ORIGIN) return res.sendStatus(503);
    const upstream = await fetch(PLATFORM_ORIGIN + req.path);
    if (!upstream.ok) return res.sendStatus(upstream.status);
    const type = upstream.headers.get('content-type');
    if (type) res.type(type);
    // max-age=0 with revalidation, never a long TTL: the whole point of
    // central hosting is that a platform-side fix lands on the next load.
    res.set('Cache-Control', 'public, max-age=0, must-revalidate');
    return res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    console.warn('hosted asset fetch failed: ' + err.message);
    return res.sendStatus(502);
  }
});

// Verify platform-issued JWT if one was passed, then enforce auth on
// anything not explicitly marked public. The iframe adds `?token=…`
// on load; the frontend script forwards the token via `x-usernode-token`
// on subsequent fetches.
app.use((req, res, next) => {
  const token = req.query.token || req.headers['x-usernode-token'];
  if (token && JWT_PUBLIC_KEY && APP_AUDIENCE) {
    try {
      // Pin the algorithm, issuer and audience. Without `algorithms` a
      // caller could hand us an HS256 token signed with the public PEM
      // (which every app knows) and forge any user.
      const claims = jwt.verify(token, JWT_PUBLIC_KEY, {
        algorithms: ['RS256'],
        issuer: 'usernode',
        audience: APP_AUDIENCE,
      });
      // `pur` names what the token is for. Only user-identity tokens
      // authenticate a person here.
      if (claims && claims.pur === 'iframe') req.user = claims;
    } catch {}
  }

  // Static assets (CSS/JS/images) are always served; the API and the HTML
  // shell are gated so direct hits to the staging/prod subdomain don't
  // leak app data to the public internet.
  if (req.method !== 'GET' || req.path.startsWith('/api/')) {
    if (PUBLIC_API_PATHS.has(req.path)) return next();
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// The template ships no favicon file; index.html carries an inline SVG
// icon instead. Answer 204 here so anything that still probes
// /favicon.ico (older browsers, direct visits) doesn't fall through to
// the auth-gated catch-all and surface a 401 in the console on every
// fresh load.
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// World Weather talks to Open-Meteo (free, keyless, and named as an
// acceptable source in the app's request). Both routes below wrap it: the
// server shapes one response the frontend renders as-is, so no weather
// logic lives in the browser and the free API's rate limits are the
// server's problem, not the viewer's.
const UPSTREAM_TIMEOUT_MS = 10_000;
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

// The data-service error the frontend shows verbatim; any upstream failure
// (non-200, empty body, timeout) maps to it.
const UPSTREAM_ERROR = 'Data cuaca tidak dapat diambil saat ini. Coba lagi nanti.';

async function fetchUpstreamJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// GET /api/geocode?q=<name> — turn a place name into up to 10 matches with
// their administrative chain (country > admin1 > … > admin4), so an
// ambiguous village name can be resolved by the viewer instead of guessed.
// No language parameter is passed: Open-Meteo then returns place names in
// their local form, which is what an Indonesian village search wants.
app.get('/api/geocode', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Nama lokasi yang dicari masih kosong.' });

  const geocodeUrl = new URL(GEOCODE_URL);
  geocodeUrl.searchParams.set('name', q);
  geocodeUrl.searchParams.set('count', '10');
  geocodeUrl.searchParams.set('format', 'json');

  const data = await fetchUpstreamJson(geocodeUrl);
  if (data === null) {
    return res.status(502).json({ error: 'Pencarian lokasi gagal. Coba lagi nanti.' });
  }
  const results = (Array.isArray(data.results) ? data.results : []).map((r) => ({
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
    country: r.country,
    countryCode: r.country_code,
    admin1: r.admin1,
    admin2: r.admin2,
    admin3: r.admin3,
    admin4: r.admin4,
    // Passed through only when Open-Meteo supplies it (it reports how far
    // the match sits from the queried name's best guess).
    ...(r.distance != null ? { distance: r.distance } : {}),
  }));
  return res.json({ query: q, results });
});

// A small in-memory cache so back-to-back views of the same place don't
// hammer the free API. Keyed by coordinates rounded to 2 decimals
// (roughly 1 km), 10-minute TTL, capped at 50 entries. Server-side only:
// the place name is echoed from the request on every response (see
// buildLocation below), so a cache hit never shows another place's name.
const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;
const WEATHER_CACHE_MAX = 50;
const weatherCache = new Map();

function cacheGetWeather(key) {
  const hit = weatherCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > WEATHER_CACHE_TTL_MS) {
    weatherCache.delete(key);
    return null;
  }
  return hit.payload;
}

function cacheSetWeather(key, payload) {
  weatherCache.set(key, { at: Date.now(), payload });
  if (weatherCache.size > WEATHER_CACHE_MAX) {
    const oldest = weatherCache.keys().next().value;
    weatherCache.delete(oldest);
  }
}

// Echo back who the viewer asked about. The admin chain comes from the
// geocode match the viewer picked (passed as query params); the time zone
// comes from the forecast response itself.
function buildLocation(req, timezone) {
  const pick = (key) => {
    const value = String(req.query[key] || '').trim();
    return value || undefined;
  };
  return {
    name: pick('name'),
    admin1: pick('admin1'),
    admin2: pick('admin2'),
    admin3: pick('admin3'),
    admin4: pick('admin4'),
    country: pick('country'),
    countryCode: pick('countryCode'),
    timezone,
  };
}

// True when the upstream value exists at all (a legitimate `null` in the
// forecast means "no data", and must not turn into a number).
const has = (v) => v != null;

function aqiCategory(aqi) {
  if (aqi <= 50) return 'Baik';
  if (aqi <= 100) return 'Sedang';
  if (aqi <= 150) return 'Tidak Sehat';
  if (aqi <= 200) return 'Sangat Tidak Sehat';
  return 'Berbahaya';
}

// Warnings derived from forecast data with fixed thresholds (the heavy-rain
// one is BMKG's 24-hour figure). Every entry is labeled non-official by the
// standing line the frontend renders under the list; the app fetches no
// institution's alert feed, so it must never look like one.
function buildWarnings(current, today, air) {
  const warnings = [];
  const inRange = (code, lo, hi) => has(code) && code >= lo && code <= hi;

  if (inRange(current.weather_code, 95, 99) || inRange(today.code, 95, 99)) {
    warnings.push({ level: 'Awas', kind: 'badai petir', text: 'Badai petir diprakirakan terjadi hari ini.' });
  }
  if (has(today.precipSum) && today.precipSum >= 50) {
    warnings.push({ level: 'Waspada', kind: 'hujan lebat', text: 'Potensi hujan lebat, akumulasi curah hujan sekitar ' + Math.round(today.precipSum) + ' mm dalam 24 jam.' });
  }
  const windNow = has(current.wind_speed) ? current.wind_speed : 0;
  const windToday = has(today.windMax) ? today.windMax : 0;
  const windMax = Math.max(windNow, windToday);
  if (windMax >= 60) {
    warnings.push({ level: 'Awas', kind: 'angin kencang', text: 'Angin kencang hingga sekitar ' + Math.round(windMax) + ' km/jam.' });
  } else if (windMax >= 40) {
    warnings.push({ level: 'Waspada', kind: 'angin kencang', text: 'Angin cukup kencang hingga sekitar ' + Math.round(windMax) + ' km/jam.' });
  }
  const heatNow = has(current.apparent_temperature) ? current.apparent_temperature : -Infinity;
  const heatToday = has(today.apparentMax) ? today.apparentMax : -Infinity;
  const heatMax = Math.max(heatNow, heatToday);
  if (heatMax >= 40) {
    warnings.push({ level: 'Waspada', kind: 'panas ekstrem', text: 'Suhu terasa hingga sekitar ' + Math.round(heatMax) + ' °C, berpotensi panas ekstrem.' });
  }
  if (current.weather_code === 45 || current.weather_code === 48 || today.code === 45 || today.code === 48) {
    warnings.push({ level: 'Waspada', kind: 'kabut', text: 'Kabut diprakirakan menurunkan jarak pandang.' });
  }
  if (air && has(air.aqi) && air.aqi > 150) {
    warnings.push({ level: 'Waspada', kind: 'udara tidak sehat', text: 'Kualitas udara tidak sehat (US AQI ' + air.aqi + ', ' + air.category + ').' });
  }
  return warnings;
}

// One short advice line from today's data.
function buildSaran(current, today) {
  const rainLikely = (has(today.precipProbability) && today.precipProbability >= 50)
    || (has(current.precipitation) && current.precipitation > 0)
    || (has(today.precipSum) && today.precipSum > 0);
  if (rainLikely) return 'Bawa payung.';
  if (has(today.uvIndexMax) && today.uvIndexMax >= 6) return 'Gunakan tabir surya.';
  if (has(current.apparent_temperature) && current.apparent_temperature <= 10) return 'Gunakan jaket.';
  return 'Cuaca nyaman untuk aktivitas luar.';
}

// GET /api/weather?lat=..&lon=..&name=..[&admin1..admin4&country&countryCode]
app.get('/api/weather', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)
    || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: 'Koordinat lokasi tidak valid.' });
  }

  const cacheKey = lat.toFixed(2) + ',' + lon.toFixed(2);
  const cached = cacheGetWeather(cacheKey);
  if (cached) {
    return res.json({ ...cached, location: buildLocation(req, cached.timezone) });
  }

  // Metric defaults apply upstream: °C, km/h, mm. Timezone auto resolves to
  // the location's own zone, per the request. The air-quality call runs
  // alongside the forecast but its failure never blocks the forecast:
  // remote places can come back without an AQI, and that is fine.
  const forecastUrl = new URL(FORECAST_URL);
  forecastUrl.searchParams.set('latitude', lat);
  forecastUrl.searchParams.set('longitude', lon);
  forecastUrl.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m');
  forecastUrl.searchParams.set('hourly', 'temperature_2m,precipitation_probability,weather_code,visibility');
  forecastUrl.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,uv_index_max,sunrise,sunset');
  forecastUrl.searchParams.set('timezone', 'auto');
  forecastUrl.searchParams.set('forecast_days', '7');

  const airUrl = new URL(AIR_QUALITY_URL);
  airUrl.searchParams.set('latitude', lat);
  airUrl.searchParams.set('longitude', lon);
  airUrl.searchParams.set('current', 'us_aqi,pm2_5,pm10');
  airUrl.searchParams.set('timezone', 'auto');

  const [forecastSettled, airSettled] = await Promise.allSettled([
    fetchUpstreamJson(forecastUrl),
    fetchUpstreamJson(airUrl),
  ]);

  const forecast = forecastSettled.status === 'fulfilled' ? forecastSettled.value : null;
  if (!forecast || !forecast.current || !Array.isArray(forecast.daily?.time) || !forecast.daily.time.length) {
    return res.status(502).json({ error: UPSTREAM_ERROR });
  }
  const airBody = airSettled.status === 'fulfilled' ? airSettled.value : null;
  const airAqi = airBody && airBody.current && airBody.current.us_aqi != null
    ? airBody.current.us_aqi : null;
  const air = airAqi != null ? { aqi: Math.round(airAqi), category: aqiCategory(airAqi) } : undefined;

  const cur = forecast.current;
  const hourly = forecast.hourly || {};
  const daily = forecast.daily;
  const timezone = forecast.timezone;

  // The current block carries no visibility; take it from the hourly slice
  // covering now (meters to km, one decimal).
  const hourTimes = Array.isArray(hourly.time) ? hourly.time : [];
  const nowHour = (cur.time || '').slice(0, 13) + ':00';
  let hourIdx = hourTimes.indexOf(nowHour);
  if (hourIdx < 0) hourIdx = hourTimes.findIndex((t) => t >= (cur.time || ''));
  if (hourIdx < 0) hourIdx = 0;

  const visMeters = hourly.visibility && hourly.visibility[hourIdx];
  const visibilityKm = visMeters != null ? Math.round(visMeters / 100) / 10 : undefined;

  const currentOut = {
    temperature: cur.temperature_2m,
    apparentTemperature: cur.apparent_temperature,
    humidity: cur.relative_humidity_2m,
    precipitation: cur.precipitation,
    weatherCode: cur.weather_code,
    pressure: cur.pressure_msl,
    windSpeed: cur.wind_speed_10m,
    windDirection: cur.wind_direction_10m,
    visibilityKm,
    uvIndex: Array.isArray(daily.uv_index_max) ? daily.uv_index_max[0] : undefined,
  };

  const hourly24 = hourTimes.slice(hourIdx, hourIdx + 24).map((time, i) => ({
    time,
    temperature: hourly.temperature_2m ? hourly.temperature_2m[hourIdx + i] : null,
    precipProbability: hourly.precipitation_probability ? hourly.precipitation_probability[hourIdx + i] : null,
    weatherCode: hourly.weather_code ? hourly.weather_code[hourIdx + i] : null,
  }));

  const daily7 = daily.time.slice(0, 7).map((date, i) => ({
    date,
    code: daily.weather_code ? daily.weather_code[i] : null,
    tempMin: daily.temperature_2m_min ? daily.temperature_2m_min[i] : null,
    tempMax: daily.temperature_2m_max ? daily.temperature_2m_max[i] : null,
    precipProbability: daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : null,
    precipSum: daily.precipitation_sum ? daily.precipitation_sum[i] : null,
    windMax: daily.wind_speed_10m_max ? daily.wind_speed_10m_max[i] : null,
    uvIndexMax: daily.uv_index_max ? daily.uv_index_max[i] : null,
    apparentMax: daily.apparent_temperature_max ? daily.apparent_temperature_max[i] : null,
    // The INFO TAMBAHAN section shows today's sunrise/sunset in the
    // location's own time zone; the upstream values are already local.
    sunrise: daily.sunrise ? daily.sunrise[i] : null,
    sunset: daily.sunset ? daily.sunset[i] : null,
  }));

  const today = daily7[0];
  const warnings = buildWarnings(cur, today, air);
  const saran = buildSaran(cur, today);

  // Everything except `location`: the payload is what the cache holds, and
  // the requester's name/chain is attached fresh on every response so a
  // cache hit can never show a different place's name than requested.
  const payload = {
    current: currentOut,
    hourly24,
    daily7,
    warnings,
    air,
    saran,
    fetchedAt: cur.time,
    timezone,
    source: 'Open-Meteo',
  };
  cacheSetWeather(cacheKey, payload);
  return res.json({ ...payload, location: buildLocation(req, timezone) });
});

app.use(express.static(path.join(__dirname, 'public')));

// HTML shell: serve the app if authenticated. Unauthenticated top-level
// visits (share links pasted into a browser — Sec-Fetch-Dest: document)
// are sent to the platform's chromeless view of this app, where the shell
// embeds it with a real token so the link just works. Every other
// tokenless case (iframe loads with an expired token, old browsers
// without Sec-Fetch-*) gets the "open in Homeroom" landing page instead
// of a redirect, so the platform shell is never loaded INSIDE its own
// app iframe and stray visits still don't reveal the app.
app.get('*', (req, res) => {
  if (!req.user) {
    // Deep-link pass-through (platform #743): carry the visited
    // path+query into the chromeless view so share links land on the
    // shared screen, not Home. The clean platform route stores `path`
    // as one encoded query value so an inner ?, &, or = survives. The
    // shell decodes and validates it as relative-only before use. The
    // character test keeps the
    // value attribute-safe for the landing anchor below — anything
    // unusual falls back to the bare link.
    const deepPath = /^\/[A-Za-z0-9\-._~!$&()*+,;=:@\/%?]*$/.test(req.originalUrl)
      ? '?path=' + encodeURIComponent(req.originalUrl) : '';
    if (PLATFORM_ORIGIN && req.get('sec-fetch-dest') === 'document') {
      return res.redirect(302, PLATFORM_ORIGIN + '/app/world-weather-3c3502/full' + deepPath);
    }
    return res.status(401).send(`<!doctype html><meta charset=utf-8><title>Open in Homeroom</title>
<body style="font-family:system-ui;background:#09090b;color:#e4e4e7;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
  <div style="max-width:24rem;padding:2rem;text-align:center">
    <h1 style="font-size:1.25rem;margin:0 0 0.5rem">Open this app inside Homeroom</h1>
    <p style="color:#a1a1aa;font-size:0.9rem;margin:0 0 1.25rem">This page is served via the platform; direct visits aren't authenticated.</p>
    <a href="${PLATFORM_ORIGIN}/app/world-weather-3c3502/full${deepPath}" style="display:inline-block;padding:0.5rem 1rem;background:#7c3aed;color:white;border-radius:0.5rem;text-decoration:none;font-size:0.9rem">Open in Homeroom</a>
  </div>
</body>`);
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function start() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS presses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      username VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  const server = app.listen(port, () => console.log(`Listening on :${port}`));
  // Let Envoy retire idle upstream connections at 60s, with a 15s margin.
  server.keepAliveTimeout = 75_000;
}

start().catch(err => { console.error(err); process.exit(1); });
