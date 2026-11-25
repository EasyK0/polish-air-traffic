// Buduje z publicznej bazy OurAirports (domena publiczna) dwa pliki:
//   data/airports_coords.json   współrzędne, nazwa, miasto i kraj lotnisk (do rysowania tras)
//   data/airports_tracked.json  lotniska, o które pyta eksport: Polska i kraje z nią graniczące
// Plik źródłowy: https://davidmegginson.github.io/ourairports-data/airports.csv
//
// Użycie: node tools/build_airports.mjs <ścieżka do airports.csv>
//
// Reguły wyboru lotnisk i lista krajów: lib/airports.mjs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readAirports, buildCoords, buildTracked, trackedList } from "../lib/airports.mjs";

const src = process.argv[2];
if (!src) { console.error("Podaj ścieżkę do airports.csv"); process.exit(1); }

const airports = readAirports(fs.readFileSync(src, "utf8"));
const data = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");

const coords = buildCoords(airports);
const coordsFile = path.join(data, "airports_coords.json");
fs.writeFileSync(coordsFile, JSON.stringify(coords));
console.log(`Zapisano ${Object.keys(coords).length} lotnisk do ${coordsFile} (${Math.round(fs.statSync(coordsFile).size / 1024)} KB)`);

const tracked = buildTracked(airports);
const trackedFile = path.join(data, "airports_tracked.json");
fs.writeFileSync(trackedFile, JSON.stringify(tracked, null, 2) + "\n");
console.log(`Zapisano ${trackedList(tracked).length} śledzonych lotnisk do ${trackedFile}`);
for (const [code, list] of Object.entries(tracked)) console.log(`  ${code}: ${list.length} ${list.join(" ")}`);
