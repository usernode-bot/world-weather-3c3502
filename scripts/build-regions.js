// Rebuilds data/regions/ from the GeoNames dumps (CC BY 4.0,
// https://download.geonames.org/export/dump/). Run by hand when the region
// lists should be refreshed: `node scripts/build-regions.js`.
//
// Output, read by /api/regions in server.js:
//   data/regions/countries.json  [[code, GeoNames id, English name], ...]
//   data/regions/<CC>.json       { admin1: [[code, id, name], ...],
//                                  admin2: { <admin1 code>: [[id, name], ...] } }
// Every id is a GeoNames id that /api/place can open, so the browser only
// ever lists places the weather report can show.
const fs = require('fs');
const path = require('path');

const BASE = 'https://download.geonames.org/export/dump/';
const OUT = path.join(__dirname, '..', 'data', 'regions');

async function rows(file) {
  const res = await fetch(BASE + file);
  if (!res.ok) throw new Error(file + ' answered ' + res.status);
  return (await res.text()).split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('\t'));
}

const byName = (a, b) => a[a.length - 1].localeCompare(b[b.length - 1]);

(async () => {
  const [countryRows, admin1Rows, admin2Rows] = await Promise.all([
    rows('countryInfo.txt'), rows('admin1CodesASCII.txt'), rows('admin2Codes.txt'),
  ]);
  const countries = countryRows
    .filter((r) => /^[A-Z]{2}$/.test(r[0]) && Number(r[16]) > 0)
    .map((r) => [r[0], Number(r[16]), r[4]])
    .sort(byName);
  const data = {};
  for (const [cc] of countries) data[cc] = { admin1: [], admin2: {} };
  for (const [key, name, , id] of admin1Rows) {
    const [cc, a1] = key.split('.');
    if (data[cc] && Number(id) > 0) data[cc].admin1.push([a1, Number(id), name]);
  }
  for (const [key, name, , id] of admin2Rows) {
    const [cc, a1] = key.split('.');
    if (!data[cc] || !(Number(id) > 0)) continue;
    (data[cc].admin2[a1] = data[cc].admin2[a1] || []).push([Number(id), name]);
  }
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'countries.json'), JSON.stringify(countries));
  for (const [cc, d] of Object.entries(data)) {
    d.admin1.sort(byName);
    for (const list of Object.values(d.admin2)) list.sort(byName);
    fs.writeFileSync(path.join(OUT, cc + '.json'), JSON.stringify(d));
  }
  console.log(countries.length + ' countries written to ' + OUT);
})().catch((err) => { console.error(err); process.exit(1); });
