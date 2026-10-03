const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

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

app.get('/health', (_req, res) => {
  if (shuttingDown) return res.status(503).json({ status: 'shutting_down' });
  res.json({ status: 'ok' });
});

// The app icon lives in brand/ (read by the platform at deploy time);
// public/favicon.svg + public/favicon.png are its browser-facing copies.
// Serve the PNG at /favicon.ico so probes from older browsers and direct
// visits get the real icon instead of falling through to the auth-gated
// catch-all and surfacing a 401 in the console on every fresh load.
app.get('/favicon.ico', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'favicon.png')));

// ---------------------------------------------------------------------------
// Weather data. Every value the app shows comes from these live, keyless
// sources; nothing is estimated or filled in here. A missing upstream value
// stays null and the UI says it is unavailable.
//   Open-Meteo geocoding  https://open-meteo.com/en/docs/geocoding-api
//   Open-Meteo forecast   https://open-meteo.com/en/docs
//   Open-Meteo air quality https://open-meteo.com/en/docs/air-quality-api
//   NWS alerts (US only)  https://www.weather.gov/documentation/services-web-api
// ---------------------------------------------------------------------------
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const NWS_ALERTS_URL = 'https://api.weather.gov/alerts/active';
// NWS covers the US and its territories; its API refuses points elsewhere.
const NWS_COUNTRIES = new Set(['US', 'PR', 'GU', 'VI', 'AS', 'MP']);
const UPSTREAM_TIMEOUT_MS = 10_000;

// Small in-memory cache so repeated views of one place do not hammer the
// upstreams. Weather is kept 10 minutes (Open-Meteo updates every 15), place
// names a day.
const cache = new Map();
const CACHE_MAX = 500;
function cached(key, ttlMs, load) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = load().catch((err) => { cache.delete(key); throw err; });
  cache.set(key, { value, expires: Date.now() + ttlMs });
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return value;
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return res.json();
}

function langParam(raw) {
  return raw === 'en' ? 'en' : 'id';
}

function toPlace(r) {
  return {
    id: r.id,
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    elevation: r.elevation ?? null,
    featureCode: r.feature_code || null,
    countryCode: r.country_code || null,
    country: r.country || null,
    // Broadest to narrowest, skipping levels GeoNames does not have.
    admin: [r.admin1, r.admin2, r.admin3, r.admin4].filter(Boolean),
    timezone: r.timezone || null,
    population: r.population ?? null,
  };
}

// One place by its GeoNames id, so a saved or shared location can be
// reopened with its full name and region.
async function placeById(id, lang) {
  const url = `${GEOCODE_URL.replace(/search$/, 'get')}?id=${id}&language=${lang}`;
  const r = await cached(`place:${lang}:${id}`, 86_400_000, () => fetchJson(url));
  return r && r.id ? toPlace(r) : null;
}

function norm(s) {
  return String(s || '').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Open-Meteo matches the place name only, so "Ubud, Bali" finds nothing.
// Search the first part and keep results whose region or country mention
// every remaining part.
async function geocode(query, lang) {
  const [name, ...qualifiers] = query.split(',').map((p) => p.trim()).filter(Boolean);
  if (!name) return [];
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(name)}&count=20&language=${lang}&format=json`;
  const data = await cached(`geo:${lang}:${norm(name)}`, 86_400_000, () => fetchJson(url));
  let results = Array.isArray(data.results) ? data.results : [];
  if (qualifiers.length) {
    results = results.filter((r) => {
      const hay = norm([r.admin1, r.admin2, r.admin3, r.admin4, r.country, r.country_code].join(' '));
      return qualifiers.every((q) => hay.includes(norm(q)));
    });
  }
  return results.slice(0, 10).map(toPlace);
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

const CURRENT_VARS = [
  'temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'is_day',
  'precipitation', 'weather_code', 'pressure_msl', 'wind_speed_10m',
  'wind_direction_10m', 'wind_gusts_10m', 'visibility', 'uv_index',
].join(',');
const HOURLY_VARS = 'temperature_2m,precipitation_probability,precipitation,weather_code,is_day';
const DAILY_VARS = [
  'weather_code', 'temperature_2m_max', 'temperature_2m_min',
  'precipitation_probability_max', 'precipitation_sum', 'sunrise', 'sunset', 'uv_index_max',
].join(',');

async function loadForecast(lat, lon) {
  const url = `${FORECAST_URL}?latitude=${lat}&longitude=${lon}`
    + `&current=${CURRENT_VARS}&hourly=${HOURLY_VARS}&daily=${DAILY_VARS}`
    + '&timezone=auto&forecast_days=7&forecast_hours=24&wind_speed_unit=kmh';
  return fetchJson(url);
}

async function loadAir(lat, lon) {
  const url = `${AIR_URL}?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10&timezone=auto`;
  return fetchJson(url);
}

async function loadNwsAlerts(lat, lon) {
  const url = `${NWS_ALERTS_URL}?point=${lat.toFixed(4)},${lon.toFixed(4)}`;
  // NWS asks every client to identify itself with a User-Agent.
  const data = await fetchJson(url, {
    'User-Agent': 'World Weather (Homeroom app)',
    Accept: 'application/geo+json',
  });
  return (data.features || []).map((f) => f.properties || {}).map((p) => ({
    event: p.event || null,
    headline: p.headline || null,
    severity: p.severity || null,
    issuer: p.senderName || null,
    onset: p.onset || p.effective || null,
    ends: p.ends || p.expires || null,
    area: p.areaDesc || null,
    instruction: p.instruction || null,
  }));
}

async function weatherFor(lat, lon, countryCode) {
  // Rounded to ~1 km so nearby lookups share a cache entry.
  const key = `wx:${lat.toFixed(2)},${lon.toFixed(2)}:${countryCode || ''}`;
  return cached(key, 600_000, async () => {
    const wantAlerts = NWS_COUNTRIES.has(countryCode);
    const [forecast, air, alerts] = await Promise.allSettled([
      loadForecast(lat, lon),
      loadAir(lat, lon),
      wantAlerts ? loadNwsAlerts(lat, lon) : Promise.resolve(null),
    ]);
    if (forecast.status !== 'fulfilled') throw forecast.reason;
    const f = forecast.value;
    if (air.status !== 'fulfilled') console.warn('air quality failed: ' + air.reason.message);
    if (alerts.status !== 'fulfilled') console.warn('NWS alerts failed: ' + alerts.reason.message);
    const a = air.status === 'fulfilled' ? air.value : null;
    return {
      fetchedAt: new Date().toISOString(),
      timezone: f.timezone,
      timezoneAbbreviation: f.timezone_abbreviation,
      utcOffsetSeconds: f.utc_offset_seconds,
      // Open-Meteo answers for the model grid cell nearest the request, which
      // can sit some way from a small village. Report how far.
      grid: {
        latitude: f.latitude,
        longitude: f.longitude,
        elevation: f.elevation ?? null,
        distanceKm: Math.round(distanceKm(lat, lon, f.latitude, f.longitude) * 10) / 10,
      },
      current: f.current || null,
      hourly: f.hourly || null,
      daily: f.daily || null,
      air: a && a.current ? {
        time: a.current.time,
        usAqi: a.current.us_aqi ?? null,
        pm25: a.current.pm2_5 ?? null,
        pm10: a.current.pm10 ?? null,
        distanceKm: Math.round(distanceKm(lat, lon, a.latitude, a.longitude) * 10) / 10,
      } : null,
      alerts: {
        // supported=false means no official alert feed is wired for this
        // country, which is different from "the feed says nothing is active".
        supported: wantAlerts && alerts.status === 'fulfilled',
        source: wantAlerts ? 'NWS' : null,
        items: alerts.status === 'fulfilled' && alerts.value ? alerts.value : [],
      },
    };
  });
}

app.get('/api/geocode', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 120);
  if (q.length < 2) return res.status(400).json({ error: 'query_too_short' });
  try {
    res.json({ results: await geocode(q, langParam(req.query.lang)) });
  } catch (err) {
    console.warn('geocode failed: ' + err.message);
    res.status(502).json({ error: 'upstream_failed' });
  }
});

app.get('/api/place', async (req, res) => {
  const id = Number(req.query.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid_id' });
  try {
    const place = await placeById(id, langParam(req.query.lang));
    if (!place) return res.status(404).json({ error: 'not_found' });
    res.json({ place });
  } catch (err) {
    console.warn('place lookup failed: ' + err.message);
    res.status(/ 404$/.test(err.message) ? 404 : 502).json({ error: 'upstream_failed' });
  }
});

app.get('/api/weather', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return res.status(400).json({ error: 'invalid_coordinates' });
  }
  const countryCode = /^[A-Za-z]{2}$/.test(req.query.cc || '') ? req.query.cc.toUpperCase() : null;
  try {
    res.json(await weatherFor(lat, lon, countryCode));
  } catch (err) {
    console.warn('weather failed: ' + err.message);
    res.status(502).json({ error: 'upstream_failed' });
  }
});

// ---------------------------------------------------------------------------
// Favorite places, saved per Homeroom user. Only the GeoNames id and a
// snapshot of the place (name, region, country) are stored, so the list can
// be drawn without a lookup per row; opening one still fetches it live.
// Marked staging:private: the places someone saves can point at where they
// live, so staging previews get the table empty.
// ---------------------------------------------------------------------------
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const FAVORITES_MAX = 50;

const dbReady = (async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS favorites (
    user_id TEXT NOT NULL,
    place_id INTEGER NOT NULL,
    place JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, place_id)
  )`);
  await pool.query(`COMMENT ON TABLE favorites IS 'staging:private'`);
})();
dbReady.catch((err) => console.error('favorites migration failed: ' + err.message));

function placeIdParam(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 && id < 2 ** 31 ? id : null;
}

async function listFavorites(userId) {
  const { rows } = await pool.query(
    'SELECT place FROM favorites WHERE user_id = $1 ORDER BY created_at DESC, place_id',
    [userId],
  );
  return rows.map((r) => r.place);
}

app.get('/api/favorites', async (req, res) => {
  try {
    await dbReady;
    res.json({ favorites: await listFavorites(String(req.user.id)) });
  } catch (err) {
    console.error('favorites list failed: ' + err.message);
    res.status(500).json({ error: 'favorites_failed' });
  }
});

app.put('/api/favorites/:id', async (req, res) => {
  const id = placeIdParam(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  const userId = String(req.user.id);
  try {
    await dbReady;
    const { rows } = await pool.query(
      'SELECT count(*)::int AS n, bool_or(place_id = $2) AS saved FROM favorites WHERE user_id = $1',
      [userId, id],
    );
    if (!rows[0].saved && rows[0].n >= FAVORITES_MAX) {
      return res.status(409).json({ error: 'too_many_favorites', max: FAVORITES_MAX });
    }
    // The snapshot comes from the geocoder, not the request, so a saved row
    // always names a real place.
    let place;
    try {
      place = await placeById(id, langParam(req.body && req.body.lang));
    } catch (err) {
      console.warn('favorite place lookup failed: ' + err.message);
      return res.status(/ 404$/.test(err.message) ? 404 : 502).json({ error: 'upstream_failed' });
    }
    if (!place) return res.status(404).json({ error: 'not_found' });
    await pool.query(
      `INSERT INTO favorites (user_id, place_id, place) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, place_id) DO UPDATE SET place = EXCLUDED.place`,
      [userId, id, place],
    );
    res.json({ favorites: await listFavorites(userId) });
  } catch (err) {
    console.error('favorite save failed: ' + err.message);
    res.status(500).json({ error: 'favorites_failed' });
  }
});

app.delete('/api/favorites/:id', async (req, res) => {
  const id = placeIdParam(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  const userId = String(req.user.id);
  try {
    await dbReady;
    await pool.query('DELETE FROM favorites WHERE user_id = $1 AND place_id = $2', [userId, id]);
    res.json({ favorites: await listFavorites(userId) });
  } catch (err) {
    console.error('favorite remove failed: ' + err.message);
    res.status(500).json({ error: 'favorites_failed' });
  }
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

const DRAIN_MS = 3000;
let shuttingDown = false;

const server = app.listen(port, () => console.log(`Listening on :${port}`));
// Let Envoy retire idle upstream connections at 60s, with a 15s margin.
server.keepAliveTimeout = 75_000;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received, draining`);
  server.close(() => {});
  server.closeIdleConnections?.();
  const t = setTimeout(() => server.closeAllConnections?.(), DRAIN_MS);
  t.unref?.();
  try {
    await pool.end();
  } catch (err) {
    console.error('[shutdown] pool.end failed', err.message);
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
