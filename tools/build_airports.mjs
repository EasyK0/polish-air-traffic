// Buduje data/airports_coords.json z publicznej bazy OurAirports (domena publiczna).
// Plik źródłowy: https://davidmegginson.github.io/ourairports-data/airports.csv
//
// Użycie: node tools/build_airports.mjs <ścieżka do airports.csv>
//
// Zostają lotniska z kodem ICAO, które są duże/średnie albo mają rozkładowe loty,
// plus wszystkie polskie (EP**). Format: { "EPWA": [lat, lon, "WAW", "nazwa", "miasto"] }.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = process.argv[2];
if (!src) { console.error("Podaj ścieżkę do airports.csv"); process.exit(1); }

function parseCsv(text) {
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

const [header, ...rows] = parseCsv(fs.readFileSync(src, "utf8"));
const col = Object.fromEntries(header.map((h, i) => [h, i]));
const out = {};
for (const r of rows) {
  const icao = (r[col.icao_code] || r[col.gps_code] || "").toUpperCase();
  if (!/^[A-Z]{4}$/.test(icao)) continue;
  const type = r[col.type];
  const keep = icao.startsWith("EP") || type === "large_airport" || type === "medium_airport" || r[col.scheduled_service] === "yes";
  if (!keep || type === "closed" || type === "heliport") continue;
  const lat = Math.round(+r[col.latitude_deg] * 1e4) / 1e4, lon = Math.round(+r[col.longitude_deg] * 1e4) / 1e4;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  // Przy duplikatach wygrywa większe lotnisko.
  const rank = { large_airport: 3, medium_airport: 2, small_airport: 1 }[type] ?? 0;
  if (out[icao] && out[icao].rank >= rank) continue;
  out[icao] = { rank, v: [lat, lon, r[col.iata_code] || "", r[col.name], r[col.municipality] || ""] };
}
const result = Object.fromEntries(Object.entries(out).sort().map(([k, x]) => [k, x.v]));
const dest = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "airports_coords.json");
fs.writeFileSync(dest, JSON.stringify(result));
console.log(`Zapisano ${Object.keys(result).length} lotnisk do ${dest} (${Math.round(fs.statSync(dest).size / 1024)} KB)`);
