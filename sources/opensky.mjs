// Źródło: OpenSky Network REST API (darmowe konto, logowanie OAuth2 client credentials).
// Dokumentacja: https://openskynetwork.github.io/opensky-api/rest.html
// Endpointy /flights/arrival i /flights/departure zwracają loty z danego lotniska
// w przedziale czasu (dane z poprzedniego dnia są przeliczane w nocy).
import { fetchJson, dayBoundsUnix, HttpError } from "../lib/common.mjs";

const TOKEN_URL = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const API = "https://opensky-network.org/api";

export function createOpenSky(cfg, { tz }) {
  const id = cfg.OPENSKY_CLIENT_ID, secret = cfg.OPENSKY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Brak OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET w api_key.txt");

  let token = null, tokenExp = 0;
  async function getToken(force = false) {
    if (!force && token && Date.now() < tokenExp) return token;
    const json = await fetchJson(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
    }, { retries: 3 });
    token = json.access_token;
    tokenExp = Date.now() + ((json.expires_in ?? 1800) - 60) * 1000; // odśwież minutę przed końcem
    return token;
  }

  async function get(path, params) {
    const url = `${API}${path}?${new URLSearchParams(params)}`;
    for (let i = 0; i < 2; i++) {
      try {
        const t = await getToken(i > 0);
        // OpenSky zwraca 404, gdy w przedziale nie ma lotów.
        return (await fetchJson(url, { headers: { Authorization: `Bearer ${t}` } }, { emptyStatuses: [404] })) ?? [];
      } catch (e) {
        if (e instanceof HttpError && e.status === 401 && i === 0) continue; // token wygasł
        throw e;
      }
    }
  }

  const clean = (s) => (s ?? "").trim();

  return {
    name: "opensky",
    jobs(ap, date) {
      const { begin, end } = dayBoundsUnix(date, tz);
      const params = { airport: ap, begin: String(begin), end: String(end) };
      return [
        {
          label: `${ap} odloty`,
          run: async () => (await get("/flights/departure", params)).map((f) => ({
            type: "departure", airport: ap, callsign: clean(f.callsign), icao24: clean(f.icao24).toUpperCase(),
            firstSeen: f.firstSeen ?? "", lastSeen: f.lastSeen ?? "",
            estDepartureAirport: f.estDepartureAirport || ap, estArrivalAirport: f.estArrivalAirport || "",
          })),
        },
        {
          label: `${ap} przyloty`,
          run: async () => (await get("/flights/arrival", params)).map((f) => ({
            type: "arrival", airport: ap, callsign: clean(f.callsign), icao24: clean(f.icao24).toUpperCase(),
            firstSeen: f.firstSeen ?? "", lastSeen: f.lastSeen ?? "",
            estDepartureAirport: f.estDepartureAirport || "", estArrivalAirport: f.estArrivalAirport || ap,
          })),
        },
      ];
    },
  };
}
