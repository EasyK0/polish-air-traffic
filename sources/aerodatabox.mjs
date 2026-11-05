// Źródło: AeroDataBox przez API.Market (wymaga aktywnej subskrypcji, np. darmowego planu Basic).
// API pozwala pobrać maksymalnie 12 h na zapytanie, więc dzień to 2 okna na lotnisko.
import { fetchJson } from "../lib/common.mjs";

const STORE = "aedbx", PRODUCT = "aerodatabox";

const unix = (ts) => {
  if (!ts) return "";
  const n = Math.floor(new Date(ts.replace(" ", "T")).getTime() / 1000);
  return Number.isFinite(n) ? n : "";
};
// Najlepszy znany czas ruchu: rzeczywisty (runway) -> zmieniony (revised) -> planowy.
const bestTime = (mv) => mv?.runwayTime?.utc || mv?.revisedTime?.utc || mv?.scheduledTime?.utc || "";
const icaoOf = (mv) => mv?.airport?.icao || "";

export function createAeroDataBox(cfg) {
  const key = cfg.API_MARKET_KEY;
  if (!key) throw new Error("Brak API_MARKET_KEY w api_key.txt");
  const base = `${cfg.GATEWAY_BASE || "https://prod.api.market/api/v1"}/${STORE}/${PRODUCT}`;

  function url(ap, from, to) {
    const u = new URL(`${base}/flights/airports/icao/${ap}/${from}/${to}`);
    const p = { withLeg: "true", direction: "Both", withCancelled: "false", withCodeshared: "true",
      withCargo: "false", withPrivate: "false", withLocation: "false" };
    for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v);
    return u.toString();
  }

  function rowsFrom(json, ap) {
    const out = [];
    const seen = new Set();
    const add = (f, type) => {
      // Rejs w kodzie współdzielonym (codeshare) to ten sam samolot pod innym numerem: pomijamy.
      if (f.codeshareStatus === "IsCodeshared") return;
      const dep = f.departure, arr = f.arrival;
      // Odlot liczymy w chwili odlotu z naszego lotniska, przylot w chwili lądowania u nas.
      const depT = unix(bestTime(dep)), arrT = unix(bestTime(arr));
      const row = {
        type, airport: ap, callsign: f.number || f.callSign || "", icao24: f.aircraft?.modeS || "",
        firstSeen: depT, lastSeen: arrT,
        estDepartureAirport: type === "departure" ? ap : icaoOf(dep),
        estArrivalAirport: type === "arrival" ? ap : icaoOf(arr),
      };
      if ((type === "departure" && !depT) || (type === "arrival" && !arrT)) return;
      const k = [type, row.firstSeen, row.lastSeen, row.estDepartureAirport, row.estArrivalAirport].join("|");
      if (seen.has(k)) return; // drugi numer tego samego rejsu
      seen.add(k);
      out.push(row);
    };
    for (const f of json?.departures ?? []) add(f, "departure");
    for (const f of json?.arrivals ?? []) add(f, "arrival");
    return out;
  }

  const headers = { Accept: "application/json", "x-magicapi-key": key };

  return {
    name: "aerodatabox",
    jobs(ap, date) {
      return [[`${date}T00:00`, `${date}T11:59`], [`${date}T12:00`, `${date}T23:59`]].map(([from, to]) => ({
        label: `${ap} ${from.slice(11)}-${to.slice(11)}`,
        run: async () => rowsFrom(await fetchJson(url(ap, from, to), { headers }), ap),
      }));
    },
  };
}
