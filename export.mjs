// Eksport lotów z polskich lotnisk za jeden dzień do data/flights_YYYY-MM-DD.csv
// i odświeżenie data/index.json (lista dni dla mapy).
//
// Użycie:
//   node export.mjs                          wczoraj, źródło wybrane automatycznie
//   node export.mjs --source=opensky         OpenSky Network (OAuth2)
//   node export.mjs --source=aerodatabox     AeroDataBox przez API.Market
//   node export.mjs --date=2026-11-03 --airports=EPWA,EPKK
//   node export.mjs --index-only             tylko przebuduj data/index.json
//   node export.mjs --keep=60                po eksporcie zostaw 60 najnowszych dni
//
// Klucze: api_key.txt (wzór w api_key.template.txt) albo zmienne środowiskowe.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, yesterday, sleep, toCsv } from "./lib/common.mjs";
import { createOpenSky } from "./sources/opensky.mjs";
import { createAeroDataBox } from "./sources/aerodatabox.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(ROOT, "data");
const TZ = "Europe/Warsaw";
const DEFAULT_AIRPORTS = ["EPWA", "EPMO", "EPKK", "EPGD", "EPWR", "EPKT", "EPPO", "EPSC", "EPRZ", "EPLB", "EPBY", "EPZG", "EPSY", "EPLL", "EPRA"];

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));

function buildIndex() {
  fs.mkdirSync(DATA, { recursive: true });
  const days = [];
  for (const f of fs.readdirSync(DATA)) {
    const m = /^flights_(\d{4}-\d{2}-\d{2})\.csv$/.exec(f);
    if (!m) continue;
    const rows = fs.readFileSync(path.join(DATA, f), "utf8").trim().split("\n").length - 1;
    let meta = {};
    const metaFile = path.join(DATA, `flights_${m[1]}.meta.json`);
    if (fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
    days.push({ date: m[1], file: f, rows, source: meta.source ?? "?", missing: meta.missing ?? [], note: meta.note });
  }
  days.sort((a, b) => b.date.localeCompare(a.date));
  // --keep=N: zostaw tylko N najnowszych dni (żeby repo i demo nie rosły bez końca).
  const keep = Number(args.keep);
  if (keep > 0 && days.length > keep) {
    for (const d of days.splice(keep)) {
      for (const f of [d.file, `flights_${d.date}.meta.json`]) fs.rmSync(path.join(DATA, f), { force: true });
      console.log(`Usunięto stary dzień ${d.date} (--keep=${keep})`);
    }
  }
  fs.writeFileSync(path.join(DATA, "index.json"), JSON.stringify({ generated: new Date().toISOString(), days }, null, 2));
  console.log(`index.json: ${days.length} dni (${days.map((d) => d.date).join(", ") || "brak"})`);
}

function pickSource(cfg) {
  const want = args.source;
  if (want === "opensky" || (!want && cfg.OPENSKY_CLIENT_ID)) return createOpenSky(cfg, { tz: TZ });
  if (want === "aerodatabox" || (!want && cfg.API_MARKET_KEY)) return createAeroDataBox(cfg);
  if (want) throw new Error(`Nieznane źródło: ${want} (opensky | aerodatabox)`);
  throw new Error("Brak kluczy API. Skopiuj api_key.template.txt jako api_key.txt i uzupełnij.");
}

async function main() {
  if (args["index-only"]) return buildIndex();

  const cfg = loadConfig(path.join(ROOT, "api_key.txt"));
  const source = pickSource(cfg);
  const date = typeof args.date === "string" ? args.date : yesterday(TZ);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Zła data: ${date}`);
  const airports = typeof args.airports === "string" ? args.airports.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) : DEFAULT_AIRPORTS;
  const pause = Number(args.sleep ?? 500);

  console.log(`Eksport ${date} (${TZ}), źródło: ${source.name}`);
  console.log(`Lotniska: ${airports.join(", ")}\n`);

  fs.mkdirSync(DATA, { recursive: true });
  const partial = path.join(DATA, `flights_${date}.partial.csv`);
  const rows = [];
  const failed = [];

  const runJob = async (job) => {
    try {
      const r = await job.run();
      rows.push(...r);
      console.log(`  ${job.label}: ${r.length}`);
      return true;
    } catch (e) {
      console.warn(`  ${job.label}: BŁĄD ${e.message}`);
      if (e.status === 400 || e.status === 401 || e.status === 403) {
        // Problem z kluczem lub subskrypcją: kolejne zapytania też się nie udadzą.
        throw new Error(`Źródło ${source.name} odrzuciło zapytanie (${e.message}). Sprawdź klucz/subskrypcję w api_key.txt.`);
      }
      return false;
    }
  };

  for (const ap of airports) {
    console.log(`== ${ap}`);
    for (const job of source.jobs(ap, date)) {
      if (!(await runJob(job))) failed.push(job);
      await sleep(pause);
    }
    fs.writeFileSync(partial, toCsv(rows)); // punkt kontrolny po każdym lotnisku
  }

  if (failed.length) {
    console.log(`\nPonawiam ${failed.length} nieudanych zapytań...`);
    await sleep(5000);
    for (let i = failed.length - 1; i >= 0; i--) {
      if (await runJob(failed[i])) failed.splice(i, 1);
      await sleep(pause);
    }
  }

  const out = path.join(DATA, `flights_${date}.csv`);
  fs.writeFileSync(out, toCsv(rows));
  fs.rmSync(partial, { force: true });
  const missing = failed.map((j) => j.label);
  fs.writeFileSync(path.join(DATA, `flights_${date}.meta.json`), JSON.stringify({ date, source: source.name, exported: new Date().toISOString(), missing }, null, 2));

  console.log(`\nZapisano ${path.relative(ROOT, out)} (${rows.length} lotów)`);
  if (missing.length) console.warn(`UWAGA, brakuje danych: ${missing.join("; ")}`);
  buildIndex();
  if (missing.length) process.exitCode = 2;
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exitCode = 1;
});
