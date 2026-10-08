// World Weather frontend. Every number on screen comes from /api/weather,
// which relays live Open-Meteo (and, in the US, NWS) data. When a value is
// missing upstream it is shown as unavailable, never estimated.
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var token = params.get('token') || '';
  var authHeaders = token ? { 'x-usernode-token': token } : {};

  // ---------------------------------------------------------------- strings
  var STRINGS = {
    id: {
      searchLabel: 'Cari lokasi',
      searchPlaceholder: 'Negara, kota, atau desa',
      searchButton: 'Cari',
      emptyTitle: 'Cari lokasi untuk melihat cuacanya',
      emptyBody: 'Ketik nama negara, kota, kecamatan, atau desa. Tambahkan wilayah setelah koma agar lebih tepat, misalnya "Ubud, Bali".',
      searching: 'Mencari lokasi…',
      loading: 'Memuat cuaca…',
      noResults: 'Lokasi "{q}" tidak ditemukan. Periksa ejaan atau coba nama tempat yang lebih besar di dekatnya.',
      tooShort: 'Ketik setidaknya 2 huruf.',
      searchError: 'Pencarian lokasi gagal. Periksa koneksi lalu coba lagi.',
      weatherError: 'Data cuaca tidak dapat diambil saat ini. Coba lagi sebentar lagi.',
      placeError: 'Lokasi yang disimpan tidak dapat dibuka. Cari lokasi lagi.',
      retry: 'Coba lagi',
      favorites: 'Favorit',
      favSave: 'Simpan',
      favSaved: 'Tersimpan',
      favSaveLabel: 'Simpan {name} ke favorit',
      favSavedLabel: '{name} ada di favorit. Ketuk untuk menghapus.',
      favAdded: '{name} ditambahkan ke favorit.',
      favRemoved: '{name} dihapus dari favorit.',
      favRemove: 'Hapus {name} dari favorit',
      favLoading: 'Memuat favorit…',
      favEmpty: 'Belum ada favorit. Buka cuaca suatu tempat, lalu ketuk Simpan.',
      favSearch: 'Cari tempat',
      favLoadError: 'Favorit tidak dapat dimuat. Coba lagi.',
      favSaveError: 'Favorit tidak dapat diperbarui. Coba lagi.',
      favTooMany: 'Favorit sudah penuh ({max} tempat). Hapus satu dulu.',
      browse: 'Jelajahi',
      browseTitle: 'Jelajahi wilayah',
      allCountries: 'Semua negara',
      filterCountries: 'Saring negara',
      filterRegions: 'Saring provinsi atau negara bagian',
      filterDistricts: 'Saring kabupaten atau kota',
      viewWeather: 'Lihat cuaca {name}',
      listLoading: 'Memuat daftar…',
      listError: 'Daftar tidak dapat dimuat. Coba lagi.',
      noRegions: 'Tidak ada pembagian wilayah yang tercatat untuk {name}.',
      noMatch: 'Tidak ada yang cocok dengan "{q}".',
      districtCount: '{n} kabupaten/kota',
      regionsSource: 'Daftar wilayah: {src}',
      browseHint: 'atau pilih negara → provinsi → kabupaten/kota',
      changeArea: 'Ganti wilayah',
      close: 'Tutup',
      pickTitle: 'Ada beberapa tempat yang cocok dengan "{q}". Pilih yang Anda maksud:',
      current: 'Cuaca saat ini',
      forecast: 'Prakiraan',
      alerts: 'Peringatan dini',
      extra: 'Info tambahan',
      feelsLike: 'Terasa seperti {t}',
      humidity: 'Kelembapan',
      wind: 'Angin',
      windFrom: '{s} {u} dari {d}',
      gusts: 'hembusan hingga {g} {u}',
      speedUnit: 'km/j',
      unitLabel: 'Satuan suhu dan angin',
      pressure: 'Tekanan udara',
      visibility: 'Jarak pandang',
      uv: 'Indeks UV',
      precip: 'Curah hujan',
      precipNow: '{v} mm (15 menit terakhir)',
      unavailable: 'Tidak tersedia',
      next24: '24 jam ke depan',
      next7: '7 hari ke depan',
      today: 'Hari ini',
      lessCertain: 'Kurang pasti',
      lessCertainNote: 'Prakiraan lebih dari 3 hari ke depan kurang pasti dan bisa berubah.',
      rainChance: 'Peluang hujan',
      noAlertsNws: 'Tidak ada peringatan aktif dari {src} untuk lokasi ini saat ini.',
      noAlertFeed: 'Peringatan resmi untuk lokasi ini tidak tersedia di aplikasi ini.',
      checkAgency: 'Periksa peringatan terbaru di {agency}.',
      issuer: 'Penerbit',
      severity: 'Tingkat',
      until: 'Berlaku sampai {t}',
      sunrise: 'Matahari terbit',
      sunset: 'Matahari terbenam',
      aqi: 'Kualitas udara (AQI AS)',
      advice: 'Saran',
      gridNote: 'Data cuaca berasal dari titik model terdekat, sekitar {d} km dari lokasi ini.',
      areaNote: 'Ini wilayah yang luas. Cuaca ditampilkan untuk satu titik di tengahnya; cari kota atau desa untuk hasil yang lebih tepat.',
      source: 'Sumber: {src}',
      srcOpenMeteo: 'Open-Meteo (prakiraan, pencarian lokasi, kualitas udara)',
      srcNws: 'National Weather Service (peringatan)',
      updated: 'Data cuaca untuk {t} ({tz}) · diambil {f}',
      coords: '{lat}, {lon} · ketinggian {e} m',
      kind: { country: 'Negara', region: 'Wilayah', city: 'Kota', place: 'Tempat' },
      sev: { Extreme: 'Ekstrem', Severe: 'Parah', Moderate: 'Sedang', Minor: 'Ringan', Unknown: 'Tidak diketahui' },
      aqiCat: ['Baik', 'Sedang', 'Tidak sehat bagi kelompok sensitif', 'Tidak sehat', 'Sangat tidak sehat', 'Berbahaya'],
      uvCat: ['Rendah', 'Sedang', 'Tinggi', 'Sangat tinggi', 'Ekstrem'],
      dirs: ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'],
      tips: {
        storm: 'Ada potensi badai petir. Hindari tempat terbuka dan pohon tinggi.',
        rain: 'Peluang hujan tinggi dalam 12 jam ke depan. Bawa payung atau jas hujan.',
        uvHigh: 'UV hari ini {u}. Gunakan tabir surya dan hindari matahari langsung pukul 10.00 sampai 16.00.',
        uvMid: 'UV hari ini {u}. Gunakan tabir surya bila lama di luar ruangan.',
        hot: 'Terasa sangat panas. Minum air yang cukup dan istirahat di tempat teduh.',
        cold: 'Terasa dingin. Kenakan pakaian hangat.',
        wind: 'Angin kencang. Hati-hati dengan benda yang mudah terbang dan saat berkendara.',
        airBad: 'Kualitas udara tidak sehat. Kurangi aktivitas berat di luar ruangan dan pertimbangkan masker.',
        airSensitive: 'Kualitas udara kurang baik untuk kelompok sensitif. Batasi aktivitas berat di luar ruangan.',
        fog: 'Jarak pandang rendah. Berkendara lebih pelan dan nyalakan lampu.',
        fine: 'Cuaca cukup bersahabat untuk aktivitas di luar ruangan.',
      },
      wmo: {
        0: 'Cerah', 1: 'Cerah berawan', 2: 'Berawan sebagian', 3: 'Berawan tebal',
        45: 'Berkabut', 48: 'Kabut beku', 51: 'Gerimis ringan', 53: 'Gerimis', 55: 'Gerimis lebat',
        56: 'Gerimis beku ringan', 57: 'Gerimis beku lebat', 61: 'Hujan ringan', 63: 'Hujan sedang',
        65: 'Hujan lebat', 66: 'Hujan beku ringan', 67: 'Hujan beku lebat', 71: 'Salju ringan',
        73: 'Salju sedang', 75: 'Salju lebat', 77: 'Butiran salju', 80: 'Hujan lokal ringan',
        81: 'Hujan lokal sedang', 82: 'Hujan lokal sangat lebat', 85: 'Hujan salju ringan',
        86: 'Hujan salju lebat', 95: 'Badai petir', 96: 'Badai petir dengan hujan es ringan',
        99: 'Badai petir dengan hujan es lebat',
      },
      locale: 'id-ID',
    },
    en: {
      searchLabel: 'Search for a place',
      searchPlaceholder: 'Country, city or village',
      searchButton: 'Search',
      emptyTitle: 'Search for a place to see its weather',
      emptyBody: 'Type a country, city, district or village. Add a region after a comma to narrow it down, for example "Ubud, Bali".',
      searching: 'Searching…',
      loading: 'Loading weather…',
      noResults: 'No place called "{q}" was found. Check the spelling or try a larger place nearby.',
      tooShort: 'Type at least 2 letters.',
      searchError: 'The place search failed. Check your connection and try again.',
      weatherError: 'Weather data could not be loaded right now. Try again in a moment.',
      placeError: 'The saved place could not be opened. Search for it again.',
      retry: 'Try again',
      favorites: 'Favorites',
      favSave: 'Save',
      favSaved: 'Saved',
      favSaveLabel: 'Save {name} to favorites',
      favSavedLabel: '{name} is in your favorites. Tap to remove it.',
      favAdded: '{name} added to favorites.',
      favRemoved: '{name} removed from favorites.',
      favRemove: 'Remove {name} from favorites',
      favLoading: 'Loading favorites…',
      favEmpty: 'No favorites yet. Open a place\'s weather, then tap Save.',
      favSearch: 'Search for a place',
      favLoadError: 'Favorites could not be loaded. Try again.',
      favSaveError: 'Favorites could not be updated. Try again.',
      favTooMany: 'Your favorites are full ({max} places). Remove one first.',
      browse: 'Browse',
      browseTitle: 'Browse places',
      allCountries: 'All countries',
      filterCountries: 'Filter countries',
      filterRegions: 'Filter provinces or states',
      filterDistricts: 'Filter districts or cities',
      viewWeather: 'See weather for {name}',
      listLoading: 'Loading list…',
      listError: 'The list could not be loaded. Try again.',
      noRegions: 'No subdivisions are listed for {name}.',
      noMatch: 'Nothing matches "{q}".',
      districtCount: '{n} districts',
      regionsSource: 'Place lists: {src}',
      browseHint: 'or pick country → province → district',
      changeArea: 'Change area',
      close: 'Close',
      pickTitle: 'Several places match "{q}". Choose the one you mean:',
      current: 'Current weather',
      forecast: 'Forecast',
      alerts: 'Weather warnings',
      extra: 'More info',
      feelsLike: 'Feels like {t}',
      humidity: 'Humidity',
      wind: 'Wind',
      windFrom: '{s} {u} from the {d}',
      gusts: 'gusts up to {g} {u}',
      speedUnit: 'km/h',
      unitLabel: 'Temperature and wind units',
      pressure: 'Pressure',
      visibility: 'Visibility',
      uv: 'UV index',
      precip: 'Precipitation',
      precipNow: '{v} mm (last 15 minutes)',
      unavailable: 'Not available',
      next24: 'Next 24 hours',
      next7: 'Next 7 days',
      today: 'Today',
      lessCertain: 'Less certain',
      lessCertainNote: 'Forecasts more than 3 days ahead are less certain and may change.',
      rainChance: 'Chance of rain',
      noAlertsNws: 'No active warnings from {src} for this place right now.',
      noAlertFeed: 'Official warnings for this place are not available in this app.',
      checkAgency: 'Check {agency} for the latest warnings.',
      issuer: 'Issued by',
      severity: 'Severity',
      until: 'In effect until {t}',
      sunrise: 'Sunrise',
      sunset: 'Sunset',
      aqi: 'Air quality (US AQI)',
      advice: 'Advice',
      gridNote: 'Weather data comes from the nearest model point, about {d} km from this place.',
      areaNote: 'This is a large area. Weather is shown for one point near its centre; search for a city or village for a closer match.',
      source: 'Source: {src}',
      srcOpenMeteo: 'Open-Meteo (forecast, place search, air quality)',
      srcNws: 'National Weather Service (warnings)',
      updated: 'Weather data for {t} ({tz}) · fetched {f}',
      coords: '{lat}, {lon} · elevation {e} m',
      kind: { country: 'Country', region: 'Region', city: 'City', place: 'Place' },
      sev: { Extreme: 'Extreme', Severe: 'Severe', Moderate: 'Moderate', Minor: 'Minor', Unknown: 'Unknown' },
      aqiCat: ['Good', 'Moderate', 'Unhealthy for sensitive groups', 'Unhealthy', 'Very unhealthy', 'Hazardous'],
      uvCat: ['Low', 'Moderate', 'High', 'Very high', 'Extreme'],
      dirs: ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'],
      tips: {
        storm: 'Thunderstorms are possible. Stay away from open ground and tall trees.',
        rain: 'Rain is likely in the next 12 hours. Take an umbrella or raincoat.',
        uvHigh: 'UV today is {u}. Wear sunscreen and avoid direct sun from 10:00 to 16:00.',
        uvMid: 'UV today is {u}. Wear sunscreen if you are outside for long.',
        hot: 'It feels very hot. Drink plenty of water and rest in the shade.',
        cold: 'It feels cold. Dress warmly.',
        wind: 'Strong wind. Watch for loose objects and take care when driving.',
        airBad: 'Air quality is unhealthy. Cut down on hard outdoor exercise and consider a mask.',
        airSensitive: 'Air quality is poor for sensitive groups. Limit hard outdoor exercise.',
        fog: 'Visibility is low. Drive slowly and use your lights.',
        fine: 'Good conditions for being outdoors.',
      },
      wmo: {
        0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
        45: 'Fog', 48: 'Freezing fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
        56: 'Light freezing drizzle', 57: 'Heavy freezing drizzle', 61: 'Light rain', 63: 'Moderate rain',
        65: 'Heavy rain', 66: 'Light freezing rain', 67: 'Heavy freezing rain', 71: 'Light snow',
        73: 'Moderate snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Light showers',
        81: 'Moderate showers', 82: 'Violent showers', 85: 'Light snow showers',
        86: 'Heavy snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm with light hail',
        99: 'Thunderstorm with heavy hail',
      },
      locale: 'en-GB',
    },
  };

  // Official national weather services, for the "check your agency" link
  // when the app has no alert feed for a country. Unlisted countries go to
  // the WMO's directory of member services.
  var AGENCIES = {
    ID: ['BMKG', 'https://www.bmkg.go.id/'],
    US: ['NWS', 'https://www.weather.gov/'],
    PR: ['NWS', 'https://www.weather.gov/sju/'],
    GU: ['NWS', 'https://www.weather.gov/gum/'],
    GB: ['Met Office', 'https://www.metoffice.gov.uk/'],
    JP: ['JMA', 'https://www.jma.go.jp/'],
    MY: ['MetMalaysia', 'https://www.met.gov.my/'],
    SG: ['Meteorological Service Singapore', 'https://www.weather.gov.sg/'],
    BN: ['Brunei Darussalam Meteorological Department', 'https://www.met.gov.bn/'],
    PH: ['PAGASA', 'https://www.pagasa.dost.gov.ph/'],
    TH: ['Thai Meteorological Department', 'https://www.tmd.go.th/'],
    VN: ['NCHMF', 'https://nchmf.gov.vn/'],
    TL: ['DNMG Timor-Leste', 'https://www.meteo.gov.tl/'],
    AU: ['Bureau of Meteorology', 'https://www.bom.gov.au/'],
    NZ: ['MetService', 'https://www.metservice.com/'],
    IN: ['IMD', 'https://mausam.imd.gov.in/'],
    CN: ['CMA', 'https://www.cma.gov.cn/'],
    KR: ['KMA', 'https://www.weather.go.kr/'],
    CA: ['Environment Canada', 'https://weather.gc.ca/'],
    IE: ['Met Éireann', 'https://www.met.ie/'],
    DE: ['DWD', 'https://www.dwd.de/'],
    FR: ['Météo-France', 'https://meteofrance.com/'],
    NL: ['KNMI', 'https://www.knmi.nl/'],
    ES: ['AEMET', 'https://www.aemet.es/'],
    BR: ['INMET', 'https://portal.inmet.gov.br/'],
    SA: ['NCM', 'https://ncm.gov.sa/'],
  };
  // European countries without a listed agency: MeteoAlarm gathers their
  // national services' warnings in one place.
  var METEOALARM = ['AT', 'BE', 'BG', 'CH', 'CY', 'CZ', 'DK', 'EE', 'FI', 'GR', 'HR', 'HU', 'IS', 'IT',
    'LT', 'LU', 'LV', 'MT', 'NO', 'PL', 'PT', 'RO', 'RS', 'SE', 'SI', 'SK', 'UA', 'MD', 'ME', 'MK', 'BA', 'IL'];

  function agencyFor(cc) {
    if (AGENCIES[cc]) return AGENCIES[cc];
    if (METEOALARM.indexOf(cc) >= 0) return ['MeteoAlarm', 'https://www.meteoalarm.org/'];
    return ['WMO Severe Weather Information Centre', 'https://severeweather.wmo.int/'];
  }

  // ---------------------------------------------------------------- state
  var state = {
    lang: storedLang() || guessLang(navigator.language),
    unit: localStorage.getItem('ww.unit') === 'f' ? 'f' : 'c',
    place: null,
    weather: null,
    // Re-run on "Try again" and on a language change.
    lastAction: null,
    // Bumped by every search or place load; a response for an older one is
    // dropped so a slow request can never overwrite a newer screen.
    seq: 0,
    // Saved places, newest first: null until loaded, 'error' if loading failed.
    favorites: null,
    favOpen: false,
    // Place ids with a save or remove in flight.
    favBusy: {},
    // Region browser: the levels opened so far ([] = all countries, then the
    // country, then the province), loaded lists by URL (null while loading,
    // 'error' if it failed) and the filter text.
    browseOpen: false,
    browsePath: [],
    // The browse levels the open report was picked from (null when it was
    // opened any other way), so "Change area" can go back to its siblings.
    reportBrowsePath: null,
    lists: {},
    filter: '',
  };

  function storedLang() {
    var v = localStorage.getItem('ww.lang');
    return v === 'id' || v === 'en' ? v : null;
  }

  // Indonesian and Malay readers get Indonesian; other known languages get
  // English. No preference at all keeps the app's default, Indonesian.
  function guessLang(tag) {
    if (!tag) return 'id';
    var base = String(tag).toLowerCase().split('-')[0];
    return base === 'id' || base === 'ms' ? 'id' : 'en';
  }

  function t(key, vars) {
    var s = STRINGS[state.lang][key];
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }

  // ---------------------------------------------------------------- helpers
  var $ = function (id) { return document.getElementById(id); };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function has(v) { return v !== null && v !== undefined && !Number.isNaN(v); }

  function num(v, digits) {
    return Number(v).toLocaleString(STRINGS[state.lang].locale, {
      minimumFractionDigits: digits || 0, maximumFractionDigits: digits || 0,
    });
  }

  function temp(c) {
    if (!has(c)) return t('unavailable');
    return state.unit === 'f' ? num(c * 9 / 5 + 32) + '°F' : num(c) + '°C';
  }

  // Wind speed in km/h from the API, shown in the unit's own speed: mph for
  // °F, km/h (km/j in Indonesian) for °C. Callers check has() first.
  function speed(kmh) {
    return state.unit === 'f'
      ? { v: num(kmh / 1.609344), u: 'mph' }
      : { v: num(kmh), u: t('speedUnit') };
  }

  // Open-Meteo answers in the place's own local time as "YYYY-MM-DDTHH:MM"
  // (timezone=auto), so read the parts as written instead of letting the
  // viewer's browser shift them.
  function hhmm(iso) { return iso ? iso.slice(11, 16) : ''; }
  function localDate(iso) {
    var p = iso.slice(0, 10).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function dayName(iso, opts) {
    return localDate(iso).toLocaleDateString(STRINGS[state.lang].locale, opts || { weekday: 'long' });
  }

  function compass(deg) {
    return STRINGS[state.lang].dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
  }

  function uvCategory(u) {
    var i = u < 3 ? 0 : u < 6 ? 1 : u < 8 ? 2 : u < 11 ? 3 : 4;
    return STRINGS[state.lang].uvCat[i];
  }

  function aqiCategory(a) {
    var i = a <= 50 ? 0 : a <= 100 ? 1 : a <= 150 ? 2 : a <= 200 ? 3 : a <= 300 ? 4 : 5;
    return { label: STRINGS[state.lang].aqiCat[i], level: i };
  }

  function condition(code) {
    var w = STRINGS[state.lang].wmo;
    return has(code) && w[code] ? w[code] : t('unavailable');
  }

  function placeKind(fc) {
    var k = STRINGS[state.lang].kind;
    if (!fc) return k.place;
    if (/^PCL/.test(fc)) return k.country;
    if (/^ADM/.test(fc)) return k.region;
    if (/^PPL(C|A|A2)?$/.test(fc) && fc !== 'PPL') return k.city;
    return k.place;
  }
  function isArea(fc) { return !!fc && (/^PCL/.test(fc) || /^ADM[12]/.test(fc)); }

  function hierarchy(p) {
    // Narrowest first, the way addresses are read: village, district, province, country.
    return p.admin.slice().reverse().concat(p.country ? [p.country] : [])
      .filter(function (v) { return v && v !== p.name; }).join(', ');
  }

  // Lucide icons (ISC licence), stroked in currentColor.
  var ICONS = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    cloudSun: '<path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    fog: '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 17H7"/><path d="M17 21H9"/>',
    drizzle: '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M8 19v1"/><path d="M8 14v1"/><path d="M16 19v1"/><path d="M16 14v1"/><path d="M12 21v1"/><path d="M12 16v1"/>',
    rain: '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>',
    snow: '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M8 15h.01"/><path d="M8 19h.01"/><path d="M12 17h.01"/><path d="M12 21h.01"/><path d="M16 15h.01"/><path d="M16 19h.01"/>',
    storm: '<path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="m13 12-3 5h4l-3 5"/>',
    star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  };
  function iconFor(code, isDay) {
    if (!has(code)) return 'cloud';
    if (code === 0 || code === 1) return isDay === 0 ? 'moon' : 'sun';
    if (code === 2) return isDay === 0 ? 'cloud' : 'cloudSun';
    if (code === 3) return 'cloud';
    if (code === 45 || code === 48) return 'fog';
    if (code >= 51 && code <= 57) return 'drizzle';
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code >= 95) return 'storm';
    return 'cloud';
  }
  function icon(name, cls) {
    return '<svg class="' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  async function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({}, authHeaders);
    if (opts.body) headers['content-type'] = 'application/json';
    var res = await fetch(path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    var body = null;
    try { body = await res.json(); } catch (_) {}
    if (!res.ok) {
      var err = new Error((body && body.error) || ('HTTP ' + res.status));
      err.status = res.status;
      throw err;
    }
    return body;
  }

  // ---------------------------------------------------------------- rendering
  function show(id, on) { $(id).classList.toggle('hidden', !on); }

  function renderStatic() {
    document.documentElement.lang = state.lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) { el.placeholder = t(el.dataset.i18nPlaceholder); });
    $('lang-toggle').setAttribute('aria-label', state.lang === 'id' ? 'Bahasa' : 'Language');
    $('unit-toggle').setAttribute('aria-label', t('unitLabel'));
    $('unit-toggle').setAttribute('title', t('unitLabel'));
    segment('lang-toggle', 'lang', state.lang);
    segment('unit-toggle', 'unit', state.unit);
    renderFavoritesButton();
    renderBrowseButton();
  }

  var SEG_ON = ['bg-sky-600', 'text-white'];
  var SEG_OFF = ['text-zinc-600', 'dark:text-zinc-300'];
  function segment(groupId, key, value) {
    $(groupId).querySelectorAll('button').forEach(function (b) {
      var on = b.dataset[key] === value;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      SEG_ON.forEach(function (c) { b.classList.toggle(c, on); });
      SEG_OFF.forEach(function (c) { b.classList.toggle(c, !on); });
    });
  }

  function setStatus(kind, text) {
    var el = $('status');
    if (kind === 'none') { el.innerHTML = ''; return; }
    if (kind === 'empty') {
      el.innerHTML = '<div class="py-10 text-center flex flex-col items-center gap-2">'
        + icon('cloudSun', 'w-10 h-10 text-sky-600 dark:text-sky-400')
        + '<h2 class="text-lg font-semibold">' + esc(t('emptyTitle')) + '</h2>'
        + '<p class="text-sm text-zinc-600 dark:text-zinc-400 max-w-sm">' + esc(t('emptyBody')) + '</p>'
        + '<button type="button" id="empty-browse" aria-controls="browse" class="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">'
        + icon('map', 'w-4 h-4 text-sky-600 dark:text-sky-400') + '<span>' + esc(t('browseTitle')) + '</span></button>'
        + '<p class="text-xs text-zinc-500 dark:text-zinc-400">' + esc(t('browseHint')) + '</p></div>';
      $('empty-browse').addEventListener('click', function () { setBrowseOpen(true); });
      return;
    }
    if (kind === 'loading') {
      el.innerHTML = '<p class="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400" role="status">' + esc(text) + '</p>';
      return;
    }
    // error / info
    el.innerHTML = '<div class="rounded-xl border px-4 py-3 text-sm flex flex-col gap-3 items-start '
      + (kind === 'error'
        ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200'
        : 'border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300')
      + '" role="' + (kind === 'error' ? 'alert' : 'status') + '"><p>' + esc(text) + '</p>'
      + (kind === 'error' && state.lastAction
        ? '<button type="button" id="retry-btn" class="rounded-lg border border-current px-3 py-1.5 font-medium">' + esc(t('retry')) + '</button>'
        : '')
      + '</div>';
    var retry = $('retry-btn');
    if (retry) retry.addEventListener('click', function () { state.lastAction(); });
  }

  function renderResults(q, results) {
    var el = $('results');
    el.innerHTML = '<h2 class="text-sm text-zinc-600 dark:text-zinc-400 mb-2 px-1">' + esc(t('pickTitle', { n: results.length, q: q })) + '</h2>'
      + '<ul class="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-200 overflow-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:divide-zinc-800">'
      + results.map(function (p, i) {
        return '<li><button type="button" data-i="' + i + '" class="un-pressable w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 focus:outline-none focus-visible:bg-zinc-100 dark:focus-visible:bg-zinc-800">'
          + '<span class="min-w-0"><span class="block font-semibold truncate">' + esc(p.name) + '</span>'
          + '<span class="block text-sm text-zinc-600 dark:text-zinc-400">' + esc(hierarchy(p) || '') + '</span></span>'
          + '<span class="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">' + esc(placeKind(p.featureCode)) + '</span>'
          + '</button></li>';
      }).join('') + '</ul>';
    el.querySelectorAll('button[data-i]').forEach(function (b) {
      b.addEventListener('click', function () { choosePlace(results[Number(b.dataset.i)]); });
    });
    show('results', true);
  }

  function sectionHeader(title) {
    return '<h2 class="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2 px-1">' + esc(title) + '</h2>';
  }
  var CARD = 'rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900';
  function row(label, value, sub) {
    return '<div class="flex items-start justify-between gap-4 px-4 py-3">'
      + '<dt class="text-sm text-zinc-600 dark:text-zinc-400">' + esc(label) + '</dt>'
      + '<dd class="text-sm text-right font-medium">' + esc(value)
      + (sub ? '<span class="block text-xs font-normal text-zinc-500 dark:text-zinc-400">' + esc(sub) + '</span>' : '')
      + '</dd></div>';
  }

  function renderReport() {
    var p = state.place, w = state.weather;
    if (!p || !w) { show('report', false); return; }
    var c = w.current || {};
    var html = '';

    // Location
    var notes = [];
    if (isArea(p.featureCode)) notes.push(t('areaNote'));
    if (w.grid && w.grid.distanceKm >= 1) notes.push(t('gridNote', { d: num(w.grid.distanceKm, w.grid.distanceKm < 10 ? 1 : 0) }));
    html += '<section id="location">'
      + '<div class="flex items-start justify-between gap-3"><div class="min-w-0">'
      + '<div class="flex items-baseline gap-2 flex-wrap"><h2 class="text-xl font-bold" id="place-name">' + esc(p.name) + '</h2>'
      + '<span class="text-xs text-zinc-500 dark:text-zinc-400">' + esc(placeKind(p.featureCode)) + '</span></div>'
      + (hierarchy(p) ? '<p class="text-sm text-zinc-600 dark:text-zinc-400">' + esc(hierarchy(p)) + '</p>' : '')
      + (state.reportBrowsePath && state.reportBrowsePath.length
        ? '<button type="button" id="change-area" aria-controls="browse" class="text-sm text-sky-700 dark:text-sky-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded">' + esc(t('changeArea')) + '</button>'
        : '')
      + '<p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">' + esc(t('coords', {
        lat: num(p.latitude, 4), lon: num(p.longitude, 4), e: has(p.elevation) ? num(p.elevation) : '-',
      })) + '</p></div>'
      + '<button type="button" id="fav-toggle" class="shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"></button>'
      + '</div>'
      + notes.map(function (n) { return '<p class="mt-2 text-sm text-amber-800 dark:text-amber-200">' + esc(n) + '</p>'; }).join('')
      + '</section>';

    // Current
    var windSpd = speed(c.wind_speed_10m);
    var gustSpd = has(c.wind_gusts_10m) ? speed(c.wind_gusts_10m) : null;
    var windText = has(c.wind_speed_10m)
      ? t('windFrom', { s: windSpd.v, u: windSpd.u, d: compass(c.wind_direction_10m) }) + ' (' + num(c.wind_direction_10m) + '°)'
      : t('unavailable');
    html += '<section id="current" data-state="loaded">' + sectionHeader(t('current'))
      + '<div class="' + CARD + '">'
      + '<div class="flex items-center gap-4 px-4 py-4">'
      + icon(iconFor(c.weather_code, c.is_day), 'w-14 h-14 shrink-0 text-sky-600 dark:text-sky-400')
      + '<div><p class="text-5xl font-bold leading-none" id="current-temp">' + esc(temp(c.temperature_2m)) + '</p>'
      + '<p class="mt-1 font-medium">' + esc(condition(c.weather_code)) + '</p>'
      + '<p class="text-sm text-zinc-600 dark:text-zinc-400">' + esc(t('feelsLike', { t: temp(c.apparent_temperature) })) + '</p></div></div>'
      + '<dl class="border-t border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800">'
      + row(t('humidity'), has(c.relative_humidity_2m) ? num(c.relative_humidity_2m) + '%' : t('unavailable'))
      + row(t('wind'), windText, gustSpd ? t('gusts', { g: gustSpd.v, u: gustSpd.u }) : '')
      + row(t('pressure'), has(c.pressure_msl) ? num(c.pressure_msl) + ' hPa' : t('unavailable'))
      + row(t('visibility'), has(c.visibility) ? (c.visibility >= 1000 ? num(c.visibility / 1000, c.visibility < 10000 ? 1 : 0) + ' km' : num(c.visibility) + ' m') : t('unavailable'))
      + row(t('uv'), has(c.uv_index) ? num(c.uv_index, 1) + ' · ' + uvCategory(c.uv_index) : t('unavailable'))
      + row(t('precip'), has(c.precipitation) ? t('precipNow', { v: num(c.precipitation, 1) }) : t('unavailable'))
      + '</dl></div></section>';

    // Forecast
    var h = w.hourly || { time: [] };
    var d = w.daily || { time: [] };
    html += '<section id="forecast">' + sectionHeader(t('forecast'))
      + '<div class="' + CARD + '">'
      + '<h3 class="px-4 pt-3 text-sm font-medium">' + esc(t('next24')) + '</h3>'
      + '<ol class="flex overflow-x-auto gap-1 px-2 pb-3 pt-2" aria-label="' + esc(t('next24')) + '">'
      + h.time.map(function (time, i) {
        var pp = h.precipitation_probability ? h.precipitation_probability[i] : null;
        return '<li class="shrink-0 w-14 flex flex-col items-center gap-1 py-1 text-center">'
          + '<span class="text-xs text-zinc-500 dark:text-zinc-400">' + esc(hhmm(time)) + '</span>'
          + icon(iconFor(h.weather_code[i], h.is_day ? h.is_day[i] : 1), 'w-6 h-6 text-sky-600 dark:text-sky-400')
          + '<span class="text-sm font-medium">' + esc(temp(h.temperature_2m[i])) + '</span>'
          + '<span class="text-xs text-sky-700 dark:text-sky-300" title="' + esc(t('rainChance')) + '">' + (has(pp) ? esc(num(pp) + '%') : '-') + '</span>'
          + '</li>';
      }).join('') + '</ol>'
      + '<h3 class="px-4 pt-3 border-t border-zinc-200 dark:border-zinc-800 text-sm font-medium">' + esc(t('next7')) + '</h3>'
      + '<ol class="divide-y divide-zinc-200 dark:divide-zinc-800" id="daily">'
      + d.time.map(function (day, i) {
        var unsure = i >= 3;
        var pp = d.precipitation_probability_max ? d.precipitation_probability_max[i] : null;
        return '<li class="flex items-center gap-3 px-4 py-2.5"' + (unsure ? ' data-less-certain' : '') + '>'
          + '<span class="flex-1 min-w-0"><span class="block text-sm font-medium' + (unsure ? ' text-zinc-500 dark:text-zinc-400' : '') + '">' + esc(i === 0 ? t('today') : dayName(day)) + '</span>'
          + '<span class="block text-xs text-zinc-500 dark:text-zinc-400">' + esc(condition(d.weather_code[i]))
          + (unsure ? ' · <span class="whitespace-nowrap text-amber-700 dark:text-amber-300">' + esc(t('lessCertain')) + '</span>' : '') + '</span></span>'
          + icon(iconFor(d.weather_code[i], 1), 'w-6 h-6 shrink-0 ' + (unsure ? 'text-sky-600/60 dark:text-sky-400/60' : 'text-sky-600 dark:text-sky-400'))
          + '<span class="w-10 shrink-0 text-right text-xs text-sky-700 dark:text-sky-300" title="' + esc(t('rainChance')) + '">' + (has(pp) ? esc(num(pp) + '%') : '-') + '</span>'
          + '<span class="w-24 shrink-0 text-right text-sm tabular-nums' + (unsure ? ' text-zinc-500 dark:text-zinc-400' : '') + '">' + esc(temp(d.temperature_2m_min[i])) + ' / <span class="font-semibold">' + esc(temp(d.temperature_2m_max[i])) + '</span></span>'
          + '</li>';
      }).join('') + '</ol>'
      + '<p class="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">' + esc(t('lessCertainNote')) + '</p>'
      + '</div></section>';

    // Alerts
    var al = w.alerts || { supported: false, items: [] };
    var agency = agencyFor(p.countryCode);
    var agencyLink = '<a class="font-medium text-sky-700 underline dark:text-sky-300" href="' + esc(agency[1]) + '" target="_blank" rel="noopener noreferrer">' + esc(agency[0]) + '</a>';
    var alertsHtml;
    if (al.items.length) {
      alertsHtml = '<ul class="divide-y divide-zinc-200 dark:divide-zinc-800">' + al.items.map(function (a) {
        var sev = STRINGS[state.lang].sev[a.severity] || a.severity || STRINGS[state.lang].sev.Unknown;
        var severe = a.severity === 'Extreme' || a.severity === 'Severe';
        return '<li class="px-4 py-3 flex gap-3">'
          + icon('alert', 'w-5 h-5 shrink-0 mt-0.5 ' + (severe ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'))
          + '<div class="min-w-0"><p class="font-semibold">' + esc(a.event) + '</p>'
          + '<p class="text-sm text-zinc-600 dark:text-zinc-400">' + esc(t('severity')) + ': ' + esc(sev) + ' · ' + esc(t('issuer')) + ': ' + esc(a.issuer || al.source) + '</p>'
          + (a.ends ? '<p class="text-sm text-zinc-600 dark:text-zinc-400">' + esc(t('until', { t: new Date(a.ends).toLocaleString(STRINGS[state.lang].locale, { dateStyle: 'medium', timeStyle: 'short' }) })) + '</p>' : '')
          + (a.headline ? '<p class="text-sm mt-1">' + esc(a.headline) + '</p>' : '')
          + '</div></li>';
      }).join('') + '</ul>'
        + '<p class="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 text-sm">' + t('checkAgency', { agency: agencyLink }) + '</p>';
    } else {
      alertsHtml = '<div class="px-4 py-3 text-sm flex flex-col gap-1">'
        + '<p>' + esc(al.supported ? t('noAlertsNws', { src: al.source }) : t('noAlertFeed')) + '</p>'
        + '<p>' + t('checkAgency', { agency: agencyLink }) + '</p></div>';
    }
    html += '<section id="alerts">' + sectionHeader(t('alerts')) + '<div class="' + CARD + '">' + alertsHtml + '</div></section>';

    // Extra
    var air = w.air;
    var aqiText = t('unavailable'), aqiSub = '';
    if (air && has(air.usAqi)) {
      var cat = aqiCategory(air.usAqi);
      aqiText = num(air.usAqi) + ' · ' + cat.label;
      aqiSub = [has(air.pm25) ? 'PM2.5 ' + num(air.pm25, 1) + ' µg/m³' : '', has(air.pm10) ? 'PM10 ' + num(air.pm10, 1) + ' µg/m³' : ''].filter(Boolean).join(' · ');
    }
    html += '<section id="extra">' + sectionHeader(t('extra'))
      + '<div class="' + CARD + '"><dl class="divide-y divide-zinc-200 dark:divide-zinc-800">'
      + row(t('sunrise'), d.sunrise && d.sunrise[0] ? hhmm(d.sunrise[0]) : t('unavailable'))
      + row(t('sunset'), d.sunset && d.sunset[0] ? hhmm(d.sunset[0]) : t('unavailable'))
      + row(t('aqi'), aqiText, aqiSub)
      + '</dl>'
      + '<div class="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3"><h3 class="text-sm font-medium mb-1">' + esc(t('advice')) + '</h3>'
      + '<ul class="list-disc pl-5 text-sm flex flex-col gap-1 text-zinc-700 dark:text-zinc-300">'
      + advice(w).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>'
      + '</div></section>';

    // Source and freshness
    var sources = [t('srcOpenMeteo')];
    if (al.supported) sources.push(t('srcNws'));
    html += '<footer class="text-xs text-zinc-500 dark:text-zinc-400 px-1 flex flex-col gap-1" id="source">'
      + '<p>' + t('source', { src: '<a class="underline" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">' + esc(sources[0]) + '</a>'
        + (sources[1] ? ', <a class="underline" href="https://www.weather.gov/" target="_blank" rel="noopener noreferrer">' + esc(sources[1]) + '</a>' : '') }) + '</p>'
      + '<p>' + esc(t('updated', {
        t: c.time ? dayName(c.time, { day: 'numeric', month: 'short' }) + ' ' + hhmm(c.time) : '-',
        tz: w.timezoneAbbreviation || w.timezone || '',
        f: fetchedTime(w),
      })) + '</p></footer>';

    $('report').innerHTML = html;
    $('fav-toggle').addEventListener('click', function () { toggleFavorite(p); });
    if ($('change-area')) $('change-area').addEventListener('click', function () {
      state.browseOpen = true;
      if (state.favOpen) { state.favOpen = false; renderFavorites(); }
      browseTo(state.reportBrowsePath.slice());
    });
    renderFavToggle();
    show('report', true);
  }

  // ---------------------------------------------------------------- favorites
  function favList() { return Array.isArray(state.favorites) ? state.favorites : []; }
  function isFavorite(id) { return favList().some(function (f) { return f.id === id; }); }

  function starIcon(filled, cls) {
    return '<svg class="' + cls + '" viewBox="0 0 24 24" fill="' + (filled ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS.star + '</svg>';
  }

  var FAV_ON = ['border-sky-600', 'bg-sky-50', 'text-sky-700', 'dark:border-sky-500', 'dark:bg-sky-950/40', 'dark:text-sky-300'];
  var FAV_OFF = ['border-zinc-300', 'bg-white', 'text-zinc-700', 'dark:border-zinc-700', 'dark:bg-zinc-900', 'dark:text-zinc-200'];
  function renderFavToggle() {
    var b = $('fav-toggle'), p = state.place;
    if (!b || !p) return;
    var on = isFavorite(p.id);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', t(on ? 'favSavedLabel' : 'favSaveLabel', { name: p.name }));
    b.disabled = !!state.favBusy[p.id] || state.favorites === null;
    b.classList.toggle('opacity-60', b.disabled);
    FAV_ON.forEach(function (c) { b.classList.toggle(c, on); });
    FAV_OFF.forEach(function (c) { b.classList.toggle(c, !on); });
    b.innerHTML = starIcon(on, 'w-4 h-4 text-sky-600 dark:text-sky-400') + '<span>' + esc(t(on ? 'favSaved' : 'favSave')) + '</span>';
  }

  function renderFavoritesButton() {
    var b = $('favorites-btn');
    b.setAttribute('aria-expanded', state.favOpen ? 'true' : 'false');
    b.innerHTML = starIcon(state.favOpen, 'w-4 h-4 text-sky-600 dark:text-sky-400')
      + '<span>' + esc(t('favorites')) + '</span>'
      + (favList().length ? '<span class="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">' + favList().length + '</span>' : '');
  }

  function renderFavorites() {
    renderFavoritesButton();
    var el = $('favorites');
    if (!state.favOpen) { el.innerHTML = ''; show('favorites', false); return; }
    var head = '<div class="flex items-center justify-between mb-2 px-1">'
      + '<h2 class="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">' + esc(t('favorites')) + '</h2>'
      + '<button type="button" id="fav-close" class="un-touch-target rounded-md p-1 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500" aria-label="' + esc(t('close')) + '">'
      + icon('x', 'w-4 h-4') + '</button></div>';
    var body;
    if (state.favorites === null) {
      body = '<p class="' + CARD + ' px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400" role="status">' + esc(t('favLoading')) + '</p>';
    } else if (state.favorites === 'error') {
      body = '<div class="rounded-xl border border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200 px-4 py-3 text-sm flex flex-col gap-3 items-start" role="alert">'
        + '<p>' + esc(t('favLoadError')) + '</p>'
        + '<button type="button" id="fav-retry" class="rounded-lg border border-current px-3 py-1.5 font-medium">' + esc(t('retry')) + '</button></div>';
    } else if (!state.favorites.length) {
      body = '<div class="' + CARD + ' px-4 py-4 text-sm flex flex-col gap-3 items-start" id="fav-empty">'
        + '<p class="text-zinc-600 dark:text-zinc-400">' + esc(t('favEmpty')) + '</p>'
        + '<button type="button" id="fav-search" class="rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950">' + esc(t('favSearch')) + '</button></div>';
    } else {
      body = '<ul id="fav-list" class="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-200 overflow-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:divide-zinc-800">'
        + state.favorites.map(function (f) {
          var current = state.place && state.place.id === f.id;
          return '<li class="flex items-stretch" data-fav-id="' + f.id + '">'
            + '<button type="button" data-open="' + f.id + '" class="un-pressable flex-1 min-w-0 text-left px-4 py-3 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 focus:outline-none focus-visible:bg-zinc-100 dark:focus-visible:bg-zinc-800"' + (current ? ' aria-current="true"' : '') + '>'
            + starIcon(true, 'w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400')
            + '<span class="min-w-0"><span class="block font-semibold truncate">' + esc(f.name) + '</span>'
            + '<span class="block text-sm text-zinc-600 dark:text-zinc-400 truncate">' + esc(hierarchy(f) || '') + '</span></span></button>'
            + '<button type="button" data-remove="' + f.id + '" class="shrink-0 px-4 text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 focus:outline-none focus-visible:bg-zinc-100 dark:focus-visible:bg-zinc-800"'
            + (state.favBusy[f.id] ? ' disabled' : '') + ' aria-label="' + esc(t('favRemove', { name: f.name })) + '">'
            + icon('trash', 'w-5 h-5') + '</button></li>';
        }).join('') + '</ul>';
    }
    el.innerHTML = head + body;
    show('favorites', true);
    $('fav-close').addEventListener('click', function () { setFavOpen(false); });
    if ($('fav-retry')) $('fav-retry').addEventListener('click', loadFavorites);
    if ($('fav-search')) $('fav-search').addEventListener('click', function () {
      setFavOpen(false);
      $('search-input').focus();
    });
    el.querySelectorAll('button[data-open]').forEach(function (b) {
      b.addEventListener('click', function () {
        setFavOpen(false);
        openPlaceId(Number(b.dataset.open));
      });
    });
    el.querySelectorAll('button[data-remove]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = Number(b.dataset.remove);
        var f = favList().filter(function (x) { return x.id === id; })[0];
        if (f) setFavorite(f, false);
      });
    });
  }

  function setFavOpen(open) {
    state.favOpen = open;
    if (open && state.favorites === 'error') loadFavorites();
    if (open && state.browseOpen) { state.browseOpen = false; renderBrowse(); }
    renderFavorites();
  }

  function favoritesChanged() {
    renderFavorites();
    renderFavToggle();
  }

  async function loadFavorites() {
    state.favorites = null;
    favoritesChanged();
    try {
      state.favorites = (await api('/api/favorites')).favorites || [];
    } catch (_) {
      state.favorites = 'error';
    }
    favoritesChanged();
  }

  function notify(text) {
    if (window.unNative && typeof window.unNative.toast === 'function') window.unNative.toast(text);
  }

  function toggleFavorite(place) {
    setFavorite(place, !isFavorite(place.id));
  }

  async function setFavorite(place, save) {
    if (state.favBusy[place.id] || !Array.isArray(state.favorites)) return;
    state.favBusy[place.id] = true;
    favoritesChanged();
    try {
      var data = await api('/api/favorites/' + place.id, save
        ? { method: 'PUT', body: { lang: state.lang } }
        : { method: 'DELETE' });
      state.favorites = data.favorites || [];
      notify(t(save ? 'favAdded' : 'favRemoved', { name: place.name }));
    } catch (err) {
      var msg = err.message === 'too_many_favorites' ? t('favTooMany', { max: 50 }) : t('favSaveError');
      if (window.unNative && typeof window.unNative.toast === 'function') notify(msg);
      else window.alert(msg);
    }
    delete state.favBusy[place.id];
    favoritesChanged();
  }

  // ---------------------------------------------------------------- browse
  // Countries, then provinces/states, then districts/regencies. Each list is
  // fetched only when its level is opened; picking a place opens the same
  // weather report as a search result.
  function countryName(c) {
    try {
      var n = new Intl.DisplayNames([STRINGS[state.lang].locale], { type: 'region' }).of(c.code);
      if (n && n !== c.code) return n;
    } catch (_) {}
    return c.name;
  }

  function browseUrl() {
    var p = state.browsePath;
    if (!p.length) return '/api/regions';
    return '/api/regions/' + encodeURIComponent(p[0].code)
      + (p[1] ? '/' + encodeURIComponent(p[1].code) : '?lang=' + state.lang);
  }

  // The rows for the open level, in one shape: { id, code, name, children }.
  // children is null for countries (not counted) and 0 for a leaf.
  function browseItems(data) {
    if (data.countries) {
      var list = data.countries.map(function (c) {
        return { id: c.id, code: c.code, name: countryName(c), children: null };
      }).sort(function (a, b) { return a.name.localeCompare(b.name, STRINGS[state.lang].locale); });
      // In Indonesian, Indonesia leads the list (once, not again under I).
      if (state.lang === 'id') {
        var at = list.findIndex(function (c) { return c.code === 'ID'; });
        if (at >= 0) list.unshift(Object.assign(list.splice(at, 1)[0], { pinned: true }));
      }
      return list;
    }
    return data.regions;
  }

  function foldText(s) {
    return String(s || '').toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function renderBrowseButton() {
    var b = $('browse-btn');
    b.setAttribute('aria-expanded', state.browseOpen ? 'true' : 'false');
    b.innerHTML = icon('map', 'w-4 h-4 text-sky-600 dark:text-sky-400') + '<span>' + esc(t('browse')) + '</span>';
  }

  function renderBrowse() {
    renderBrowseButton();
    var el = $('browse');
    if (!state.browseOpen) { el.innerHTML = ''; show('browse', false); return; }
    var p = state.browsePath, here = p[p.length - 1];
    var crumbs = [{ name: t('allCountries') }].concat(p);
    var html = '<div class="flex items-center justify-between mb-2 px-1">'
      + '<h2 class="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">' + esc(t('browseTitle')) + '</h2>'
      + '<button type="button" id="browse-close" class="un-touch-target rounded-md p-1 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500" aria-label="' + esc(t('close')) + '">'
      + icon('x', 'w-4 h-4') + '</button></div>'
      + '<div class="' + CARD + ' overflow-hidden">'
      + '<nav class="px-4 pt-3 text-sm flex flex-wrap items-center gap-x-1 gap-y-1" aria-label="' + esc(t('browseTitle')) + '" id="browse-crumbs">'
      + crumbs.map(function (c, i) {
        var last = i === crumbs.length - 1;
        return (i ? icon('chevron', 'w-3.5 h-3.5 shrink-0 text-zinc-400') : '')
          + (last
            ? '<span class="font-semibold" aria-current="location">' + esc(c.name) + '</span>'
            : '<button type="button" data-crumb="' + i + '" class="text-sky-700 dark:text-sky-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded">' + esc(c.name) + '</button>');
      }).join('') + '</nav>'
      + '<div class="px-4 pt-3 pb-3 flex flex-col gap-3">'
      + (here ? '<button type="button" id="browse-weather" data-id="' + here.id + '" class="self-start inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900">'
        + icon('cloudSun', 'w-4 h-4') + '<span>' + esc(t('viewWeather', { name: here.name })) + '</span></button>' : '')
      + '<label for="browse-filter" class="sr-only">' + esc(t(['filterCountries', 'filterRegions', 'filterDistricts'][p.length])) + '</label>'
      + '<input id="browse-filter" type="search" enterkeyhint="search" maxlength="80" autocomplete="off" value="' + esc(state.filter) + '"'
      + ' placeholder="' + esc(t(['filterCountries', 'filterRegions', 'filterDistricts'][p.length])) + '"'
      + ' class="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500">'
      + '</div>'
      + '<div id="browse-list" class="border-t border-zinc-200 dark:border-zinc-800"></div>'
      + '</div>'
      + '<p class="mt-2 px-1 text-xs text-zinc-500 dark:text-zinc-400">' + t('regionsSource', { src: '<a class="underline" href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a>' }) + '</p>';
    el.innerHTML = html;
    show('browse', true);
    $('browse-close').addEventListener('click', function () { setBrowseOpen(false); });
    el.querySelectorAll('button[data-crumb]').forEach(function (b) {
      b.addEventListener('click', function () { browseTo(state.browsePath.slice(0, Number(b.dataset.crumb))); });
    });
    if ($('browse-weather')) $('browse-weather').addEventListener('click', function () { openFromBrowse(here.id); });
    $('browse-filter').addEventListener('input', function (e) {
      state.filter = e.target.value;
      renderBrowseList();
    });
    renderBrowseList();
  }

  function renderBrowseList() {
    var el = $('browse-list');
    if (!el) return;
    var url = browseUrl(), data = state.lists[url];
    var here = state.browsePath[state.browsePath.length - 1];
    var note = function (text, role) {
      return '<p class="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400" role="' + (role || 'status') + '">' + esc(text) + '</p>';
    };
    if (data === undefined || data === null) { el.innerHTML = note(t('listLoading')); return; }
    if (data === 'error') {
      el.innerHTML = '<div class="px-4 py-3 text-sm flex flex-col gap-3 items-start text-red-800 dark:text-red-200" role="alert">'
        + '<p>' + esc(t('listError')) + '</p>'
        + '<button type="button" id="browse-retry" class="rounded-lg border border-current px-3 py-1.5 font-medium">' + esc(t('retry')) + '</button></div>';
      $('browse-retry').addEventListener('click', function () { loadList(url); });
      return;
    }
    var items = browseItems(data);
    if (!items.length) { el.innerHTML = note(t('noRegions', { name: here ? here.name : '' })); return; }
    var q = foldText(state.filter.trim());
    var shown = q ? items.filter(function (it) {
      return foldText(it.name).indexOf(q) >= 0 || (it.alt && foldText(it.alt).indexOf(q) >= 0);
    }) : items;
    if (!shown.length) { el.innerHTML = note(t('noMatch', { q: state.filter.trim() })); return; }
    el.innerHTML = '<ul class="divide-y divide-zinc-200 dark:divide-zinc-800" data-level="' + state.browsePath.length + '">'
      + shown.map(function (it, i) {
        var drill = it.children !== 0;
        return '<li' + (it.pinned && shown.length > 1 ? ' class="border-b-4 border-zinc-200 dark:border-zinc-800" data-pinned="true"' : '') + '><button type="button" data-row="' + i + '" class="un-pressable w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 focus:outline-none focus-visible:bg-zinc-100 dark:focus-visible:bg-zinc-800">'
          + '<span class="min-w-0"><span class="block font-medium truncate">' + esc(it.name) + '</span>'
          + (it.children || it.alt ? '<span class="block text-xs text-zinc-500 dark:text-zinc-400">'
            + esc([it.alt, it.children ? t('districtCount', { n: num(it.children) }) : ''].filter(Boolean).join(' · ')) + '</span>' : '')
          + '</span>'
          + (drill ? icon('chevron', 'w-4 h-4 shrink-0 text-zinc-400') : icon('cloudSun', 'w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400'))
          + '</button></li>';
      }).join('') + '</ul>';
    el.querySelectorAll('button[data-row]').forEach(function (b) {
      b.addEventListener('click', function () {
        var it = shown[Number(b.dataset.row)];
        if (it.children === 0) openFromBrowse(it.id);
        else browseTo(state.browsePath.concat([{ id: it.id, code: it.code, name: it.name }]));
      });
    });
  }

  async function loadList(url) {
    state.lists[url] = null;
    renderBrowseList();
    try {
      state.lists[url] = await api(url);
    } catch (_) {
      state.lists[url] = 'error';
    }
    if (state.browseOpen && browseUrl() === url) renderBrowseList();
  }

  function browseTo(path) {
    state.browsePath = path;
    state.filter = '';
    renderBrowse();
    var url = browseUrl();
    var loading = state.lists[url] === undefined || state.lists[url] === 'error' ? loadList(url) : null;
    $('browse').scrollIntoView({ block: 'nearest' });
    return loading;
  }

  function setBrowseOpen(open) {
    state.browseOpen = open;
    if (open && state.favOpen) { state.favOpen = false; renderFavorites(); }
    if (open) { browseTo(state.browsePath); return; }
    renderBrowse();
    // A ?browse link has done its job once the browser is closed; a reload
    // should show the report, not the browser again.
    if (params.has('browse')) {
      var u = new URL(window.location.href);
      u.searchParams.delete('browse');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    }
  }

  function openFromBrowse(id) {
    // A leaf row does not push itself, so this is the list it was picked
    // from; a "Lihat cuaca" button opens the level that is showing.
    var from = state.browsePath.slice();
    setBrowseOpen(false);
    openPlaceId(id, from);
  }

  // When this app fetched the data, in the place's own time zone so it reads
  // against the "data for" time beside it.
  function fetchedTime(w) {
    var opts = { hour: '2-digit', minute: '2-digit', hour12: false };
    try {
      // en-GB only for the HH:MM shape, matching the other times on screen.
      return new Date(w.fetchedAt).toLocaleTimeString('en-GB', Object.assign({ timeZone: w.timezone }, opts));
    } catch (_) {
      return new Date(w.fetchedAt).toLocaleTimeString('en-GB', opts);
    }
  }

  // Short advice derived only from the fetched values.
  function advice(w) {
    var c = w.current || {}, d = w.daily || {}, h = w.hourly || {}, tips = STRINGS[state.lang].tips, out = [];
    var codes = (h.weather_code || []).slice(0, 12).concat(has(c.weather_code) ? [c.weather_code] : []);
    var maxRain = Math.max.apply(null, (h.precipitation_probability || []).slice(0, 12).filter(has).concat([0]));
    var uv = d.uv_index_max && has(d.uv_index_max[0]) ? d.uv_index_max[0] : null;
    if (codes.some(function (x) { return x >= 95; })) out.push(tips.storm);
    if (maxRain >= 60) out.push(tips.rain);
    if (has(uv) && uv >= 8) out.push(tips.uvHigh.replace('{u}', num(uv, 1)));
    else if (has(uv) && uv >= 3) out.push(tips.uvMid.replace('{u}', num(uv, 1)));
    if (has(c.apparent_temperature) && c.apparent_temperature >= 35) out.push(tips.hot);
    if (has(c.apparent_temperature) && c.apparent_temperature <= 5) out.push(tips.cold);
    if (has(c.wind_gusts_10m) && c.wind_gusts_10m >= 50) out.push(tips.wind);
    if (has(c.visibility) && c.visibility < 1000) out.push(tips.fog);
    if (w.air && has(w.air.usAqi)) {
      if (w.air.usAqi > 150) out.push(tips.airBad);
      else if (w.air.usAqi > 100) out.push(tips.airSensitive);
    }
    if (!out.length) out.push(tips.fine);
    return out;
  }

  // ---------------------------------------------------------------- actions
  async function search(q) {
    q = q.trim();
    var seq = ++state.seq;
    state.lastAction = function () { search(q); };
    show('results', false);
    if (q.length < 2) { setStatus('info', t('tooShort')); return; }
    setStatus('loading', t('searching'));
    try {
      var data = await api('/api/geocode?q=' + encodeURIComponent(q) + '&lang=' + state.lang);
      if (seq !== state.seq) return;
      var results = data.results || [];
      if (!results.length) { setStatus('info', t('noResults', { q: q })); return; }
      if (results.length === 1) { choosePlace(results[0]); return; }
      setStatus('none');
      show('report', false);
      renderResults(q, results);
    } catch (_) {
      if (seq !== state.seq) return;
      setStatus('error', t('searchError'));
    }
  }

  async function choosePlace(place, fromBrowse) {
    var seq = ++state.seq;
    state.place = place;
    state.weather = null;
    state.reportBrowsePath = fromBrowse || null;
    state.lastAction = function () { choosePlace(place, fromBrowse); };
    show('results', false);
    show('report', false);
    setStatus('loading', t('loading'));
    rememberPlace(place);
    try {
      var w = await api('/api/weather?lat=' + place.latitude + '&lon=' + place.longitude + '&cc=' + encodeURIComponent(place.countryCode || ''));
      if (seq !== state.seq) return;
      state.weather = w;
      setStatus('none');
      renderReport();
    } catch (_) {
      if (seq !== state.seq) return;
      setStatus('error', t('weatherError'));
    }
  }

  async function openPlaceId(id, fromBrowse) {
    var seq = ++state.seq;
    state.lastAction = function () { openPlaceId(id, fromBrowse); };
    show('results', false);
    setStatus('loading', t('loading'));
    try {
      var data = await api('/api/place?id=' + id + '&lang=' + state.lang);
      if (seq !== state.seq) return;
      choosePlace(data.place, fromBrowse);
    } catch (err) {
      if (seq !== state.seq) return;
      setStatus(err.status === 404 ? 'info' : 'error', err.status === 404 ? t('placeError') : t('weatherError'));
    }
  }

  // The chosen place goes into the address (?place=<GeoNames id>) so a
  // reload or a shared link reopens it, and into localStorage so the next
  // visit starts there.
  function rememberPlace(place) {
    try { localStorage.setItem('ww.place', String(place.id)); } catch (_) {}
    var u = new URL(window.location.href);
    u.searchParams.set('place', String(place.id));
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }

  // ---------------------------------------------------------------- wiring
  $('search-form').addEventListener('submit', function (e) {
    e.preventDefault();
    $('search-input').blur();
    search($('search-input').value);
  });
  $('favorites-btn').addEventListener('click', function () { setFavOpen(!state.favOpen); });
  $('browse-btn').addEventListener('click', function () { setBrowseOpen(!state.browseOpen); });
  $('lang-toggle').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-lang]');
    if (!b) return;
    setLang(b.dataset.lang, true);
  });
  $('unit-toggle').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-unit]');
    if (!b) return;
    state.unit = b.dataset.unit;
    localStorage.setItem('ww.unit', state.unit);
    segment('unit-toggle', 'unit', state.unit);
    renderReport();
  });

  function setLang(lang, persist) {
    if (lang !== 'id' && lang !== 'en') return;
    if (persist) localStorage.setItem('ww.lang', lang);
    var changed = state.lang !== lang;
    state.lang = lang;
    renderStatic();
    renderFavorites();
    renderBrowse();
    if (!changed) return;
    // Place names come back in the chosen language too, so reload whatever
    // is on screen (or still loading) rather than only relabelling it.
    if (state.place) openPlaceId(state.place.id, state.reportBrowsePath);
    else if (state.lastAction) state.lastAction();
    else setStatus('empty');
  }

  renderStatic();
  loadFavorites();

  // The viewer's Homeroom language, when set, outranks the device guess
  // (an explicit choice in this app outranks both).
  if (!storedLang() && window.usernode && typeof window.usernode.getUserLocale === 'function') {
    window.usernode.getUserLocale().then(function (r) {
      if (r && r.locale && !storedLang()) setLang(guessLang(r.locale), false);
    }).catch(function () {});
  }

  // ?browse opens the region browser; ?browse=<country code> opens it at
  // that country's provinces and ?browse=<country code>.<province code>
  // (e.g. ID.30) at that province's districts, falling back to the country
  // when the province is not found.
  if (params.has('browse')) {
    var startM = /^([A-Za-z]{2})(?:\.([A-Za-z0-9]+))?$/.exec(params.get('browse') || '');
    setBrowseOpen(true);
    if (startM) {
      var startCc = startM[1].toUpperCase(), startA1 = startM[2];
      api('/api/regions').then(function (data) {
        state.lists['/api/regions'] = data;
        var c = (data.countries || []).filter(function (x) { return x.code === startCc; })[0];
        if (!c || !state.browseOpen || state.browsePath.length) { renderBrowseList(); return; }
        var countryPath = [{ id: c.id, code: c.code, name: countryName(c) }];
        var loading = browseTo(countryPath), url = browseUrl();
        if (!startA1) return;
        Promise.resolve(loading).then(function () {
          var regions = state.lists[url];
          var a1 = regions && regions.regions && regions.regions.filter(function (r) { return r.code === startA1; })[0];
          var stillThere = state.browseOpen && state.browsePath.length === 1 && state.browsePath[0].code === c.code;
          if (a1 && stillThere) browseTo(countryPath.concat([{ id: a1.id, code: a1.code, name: a1.name }]));
        });
      }).catch(function () {});
    }
  }

  var startId = Number(params.get('place') || localStorage.getItem('ww.place'));
  if (Number.isInteger(startId) && startId > 0) openPlaceId(startId);
  else setStatus('empty');
})();
