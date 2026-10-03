# World Weather

Real-time weather information for any location worldwide, from countries
to villages. Built on Homeroom.

The app has one screen with one job: pick a place anywhere in the world
and see its weather.

- **Search** — type a place name (desa, kota, kecamatan, or negara) and
  get up to 10 matches with their administrative chain, e.g.
  "Sukamaju, Kecamatan X, Kabupaten Y, Jawa Barat, Indonesia". Common
  village names are resolved by picking the right match from the list.
  When a village name has no exact match, the nearest matching
  settlements are offered instead, with the distance shown.
- **Weather view** — current conditions (condition, temperature and
  feels-like, humidity, wind with an Indonesian compass direction,
  pressure, visibility, UV index, precipitation), a 24-hour strip and a
  7-day list (min/max, rain chance), sunrise/sunset in the location's
  own time zone, the air quality (US AQI with a category) where
  available, and one short advice line. Units are metric.

All copy is Indonesian. The screen follows the viewer's Homeroom light
or dark theme.

## Data source

All data comes from [Open-Meteo](https://open-meteo.com) (geocoding,
forecast and air-quality endpoints), fetched server-side by the app with
a 10-minute cache to respect the free API's rate limits. The source and
the data's update time are shown at the bottom of the weather view.

**Warnings are derived, not official.** The early-warning section is
computed automatically from the forecast with fixed thresholds (heavy
rain, thunderstorm, strong wind, extreme heat, fog, unhealthy air). It
is never a release from a meteorological institution; the app always
points to BMKG (bmkg.go.id) or the local authority for official alerts
and for emergencies such as flooding, earthquakes or tsunami.

## API

Two authenticated routes (behind the platform JWT, like everything under
`/api/`):

- `GET /api/geocode?q=<name>` — place-name search, returns matches with
  their administrative chain and coordinates.
- `GET /api/weather?lat=..&lon=..&name=..` — shaped weather response:
  current block, 24-hour and 7-day series, derived warnings, air
  quality, advice line, and the forecast update time.

No database tables are used by the app screen (the scaffold's `presses`
table and its boot-time creation remain but nothing writes to it).
