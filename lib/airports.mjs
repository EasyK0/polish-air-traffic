// Lotniska z bazy OurAirports: współrzędne dla tras oraz lista lotnisk śledzonych przez eksport
// (Polska i kraje z nią graniczące). Same funkcje, bez czytania plików, żeby dało się je testować.

// Kraje na mapie, w kolejności eksportu: najpierw Polska, potem sąsiedzi.
// Każde zapytanie o lotnisko kosztuje kredyty OpenSky (2 zapytania na lotnisko na dzień), więc
// u sąsiadów bierzemy tylko duże lotniska z ruchem rozkładowym, plus kilka wskazanych ręcznie.
//   medium: true  także średnie lotniska z ruchem rozkładowym (Polska: wszystkie 15)
//   region        tylko ten region kraju (Rosja: sam obwód kaliningradzki)
//   extra         lotniska dodane mimo reguły (blisko polskiej granicy)
export const COUNTRIES = [
  { code: "PL", medium: true },
  { code: "DE" },
  { code: "CZ", extra: ["LKTB"] },
  { code: "SK", extra: ["LZKZ", "LZTT"] },
  { code: "UA" }, // przestrzeń zamknięta dla lotów cywilnych od 2022: lista wychodzi pusta
  { code: "BY" },
  { code: "LT" },
  { code: "RU", region: "RU-KGD" },
];

export function parseCsv(text) {
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const RANK = { large_airport: 3, medium_airport: 2, small_airport: 1 };

// Wiersze airports.csv -> lotniska z kodem ICAO (przy duplikatach kodu wygrywa większe lotnisko).
export function readAirports(csvText) {
  const [header, ...rows] = parseCsv(csvText);
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  const byIcao = new Map();
  for (const r of rows) {
    const icao = (r[col.icao_code] || r[col.gps_code] || "").toUpperCase();
    if (!/^[A-Z]{4}$/.test(icao)) continue;
    const type = r[col.type];
    if (type === "closed" || type === "heliport") continue;
    const lat = Math.round(+r[col.latitude_deg] * 1e4) / 1e4, lon = Math.round(+r[col.longitude_deg] * 1e4) / 1e4;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const rank = RANK[type] ?? 0;
    if (byIcao.has(icao) && byIcao.get(icao).rank >= rank) continue;
    byIcao.set(icao, {
      icao, rank, type, lat, lon,
      iata: r[col.iata_code] || "", name: r[col.name], city: r[col.municipality] || "",
      country: r[col.iso_country] || "", region: r[col.iso_region] || "",
      scheduled: r[col.scheduled_service] === "yes",
    });
  }
  return [...byIcao.values()].sort((a, b) => a.icao.localeCompare(b.icao));
}

// Współrzędne do rysowania tras: lotniska duże/średnie albo z ruchem rozkładowym, plus wszystkie polskie.
// Format: { "EPWA": [lat, lon, "WAW", "nazwa", "miasto", "PL"] }.
export function buildCoords(airports) {
  const out = {};
  for (const a of airports) {
    if (!(a.icao.startsWith("EP") || a.rank >= 2 || a.scheduled)) continue;
    out[a.icao] = [a.lat, a.lon, a.iata, a.name, a.city, a.country];
  }
  return out;
}

// Lotniska śledzone przez eksport: { "PL": ["EPWA", ...], "DE": [...], ... } w kolejności COUNTRIES,
// w kraju najpierw duże lotniska, potem alfabetycznie.
export function buildTracked(airports, countries = COUNTRIES) {
  const out = {};
  for (const c of countries) {
    const extra = new Set(c.extra ?? []);
    out[c.code] = airports
      .filter((a) => a.country === c.code && (!c.region || a.region === c.region))
      .filter((a) => extra.has(a.icao) || (a.scheduled && (a.rank === 3 || (c.medium && a.rank === 2))))
      .sort((a, b) => b.rank - a.rank || a.icao.localeCompare(b.icao))
      .map((a) => a.icao);
  }
  return out;
}

// Wszystkie śledzone lotniska w kolejności eksportu.
export const trackedList = (tracked) => Object.values(tracked).flat();

// Kraje, z których jest na liście choć jedno lotnisko (trafia do meta.json dnia).
export function countriesOf(airports, tracked) {
  const set = new Set(airports);
  return Object.keys(tracked).filter((code) => tracked[code].some((icao) => set.has(icao)));
}
