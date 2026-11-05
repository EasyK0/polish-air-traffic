// Wspólne funkcje eksportu: konfiguracja, daty w strefie czasowej, HTTP z ponawianiem, CSV.
import fs from "node:fs";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Czyta pary KLUCZ=WARTOŚĆ z api_key.txt. Zmienne środowiskowe mają pierwszeństwo.
export function loadConfig(file = "api_key.txt") {
  const cfg = {};
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i.exec(line);
      if (m && !line.trim().startsWith("#")) cfg[m[1].toUpperCase()] = m[2];
    }
  }
  for (const k of ["OPENSKY_CLIENT_ID", "OPENSKY_CLIENT_SECRET", "API_MARKET_KEY", "GATEWAY_BASE"]) {
    if (process.env[k]) cfg[k] = process.env[k];
  }
  return cfg;
}

// Przesunięcie strefy (ms) w danej chwili, np. +3600000 dla CET.
function tzOffsetMs(ts, tz) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(ts)).map((x) => [x.type, x.value])
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(ts / 1000) * 1000;
}

// Północ lokalna danego dnia jako znacznik UTC (ms).
export function localMidnightUtc(date, tz) {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let ts = guess - tzOffsetMs(guess, tz);
  ts = guess - tzOffsetMs(ts, tz); // poprawka na zmianę czasu
  return ts;
}

export function localDate(ts, tz) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: tz }).format(new Date(ts));
}

export function yesterday(tz) {
  const today = localDate(Date.now(), tz);
  return localDate(localMidnightUtc(today, tz) - 12 * 3600 * 1000, tz);
}

export function dayBoundsUnix(date, tz) {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return { begin: localMidnightUtc(date, tz) / 1000, end: localMidnightUtc(next, tz) / 1000 - 1 };
}

export class HttpError extends Error {
  constructor(status, body) {
    super(`HTTP ${status}: ${String(body).slice(0, 200)}`);
    this.status = status;
  }
}

// GET/POST z ponawianiem przy 429, 5xx, timeoutach i uciętym JSON.
// opts.emptyStatuses: statusy, które oznaczają "brak danych" (zwraca null).
// Błędy 4xx (poza 429) nie są ponawiane.
export async function fetchJson(url, init = {}, opts = {}) {
  const retries = opts.retries ?? 5;
  const baseMs = opts.baseMs ?? 1500;
  const timeoutMs = opts.timeoutMs ?? 30000;
  const maxWaitMs = opts.maxWaitMs ?? 120000;
  let last;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      const text = await res.text();
      clearTimeout(timer);
      if (opts.emptyStatuses?.includes(res.status)) return null;
      if (res.status === 429 || res.status >= 500) {
        const hinted =
          Number(res.headers.get("x-rate-limit-retry-after-seconds")) ||
          Number(res.headers.get("retry-after")) || 0;
        const wait = hinted ? hinted * 1000 : baseMs * attempt;
        if (wait > maxWaitMs) throw new HttpError(res.status, `limit wyczerpany, ponów za ${Math.round(wait / 1000)} s`);
        console.warn(`  [${res.status}] ponawiam ${attempt}/${retries} za ${Math.round(wait / 1000)} s`);
        last = new HttpError(res.status, text);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new HttpError(res.status, text);
      return text ? JSON.parse(text) : null;
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof HttpError) throw e;
      last = e;
      const wait = baseMs * attempt;
      console.warn(`  [ERR] ${e.message} - ponawiam ${attempt}/${retries} za ${Math.round(wait / 1000)} s`);
      await sleep(wait);
    }
  }
  throw last || new Error("wyczerpane próby");
}

export const CSV_HEADER = ["type", "airport", "callsign", "icao24", "firstSeen", "lastSeen", "estDepartureAirport", "estArrivalAirport"];

export function toCsv(rows) {
  const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  return [CSV_HEADER.join(","), ...rows.map((r) => CSV_HEADER.map((k) => esc(r[k])).join(","))].join("\n") + "\n";
}
