# World Weather

Real-time weather for any place in the world, from whole countries down to
villages, shown in Indonesian or English.

- **Place search.** Uses Open-Meteo geocoding (GeoNames). Shows the
  administrative hierarchy and asks you to pick when a name is ambiguous.
  Add a region after a comma to narrow the search ("Ubud, Bali").
- **Current weather.** Condition, temperature and feels-like, humidity, wind
  speed and direction, pressure, visibility, UV and precipitation.
- **Forecast.** The next 24 hours by the hour, plus 7 days. Days beyond the
  third are marked as less certain.
- **Weather warnings.** Official NWS alerts for US locations. Elsewhere the
  app says that no feed is available and links to the national
  meteorological agency (BMKG, Met Office, JMA, …).
- **More info.** Sunrise and sunset, US AQI from Open-Meteo air quality, and
  short advice derived from those values.

All data is live and comes from keyless public APIs, relayed by the server
(`/api/geocode`, `/api/place`, `/api/weather`) with a short in-memory cache.
No value is estimated; anything missing upstream is shown as unavailable.
The source and the data time are printed at the bottom of every report.

Units are metric, with a °C/°F switch for temperature. The language follows
the viewer's Homeroom locale, then the device, and can be changed in the app.
The chosen place is kept in the address (`?place=<GeoNames id>`) and in
`localStorage`.

The app uses no database tables.
