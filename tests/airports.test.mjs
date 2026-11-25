// Tests for lib/airports.mjs: reading OurAirports rows, the coordinates file and the list of
// airports the export asks about (Poland and its neighbours). No network, no files.
// Run: node --test tests/*.test.mjs
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  COUNTRIES, parseCsv, readAirports, buildCoords, buildTracked, trackedList, countriesOf,
} from "../lib/airports.mjs";

const HEADER = "id,ident,type,name,latitude_deg,longitude_deg,elevation_ft,continent,iso_country,iso_region,municipality,scheduled_service,icao_code,iata_code,gps_code";
const row = (ident, type, name, lat, lon, country, region, city, scheduled, icao = ident, iata = "") =>
  `1,${ident},${type},"${name}",${lat},${lon},0,EU,${country},${region},"${city}",${scheduled},${icao},${iata},${ident}`;
const CSV = [
  HEADER,
  row("EPWA", "large_airport", "Warsaw Chopin Airport", 52.16570, 20.96710, "PL", "PL-MZ", "Warsaw", "yes", "EPWA", "WAW"),
  row("EPSY", "medium_airport", "Olsztyn-Mazury Airport", 53.4819, 20.9377, "PL", "PL-WN", "Szymany", "yes", "EPSY", "SZY"),
  row("EPBC", "small_airport", "Warsaw Babice", 52.2685, 20.911, "PL", "PL-MZ", "Warsaw", "no"),
  row("EDDF", "large_airport", "Frankfurt Main Airport", 50.0267, 8.5584, "DE", "DE-HE", "Frankfurt am Main", "yes", "EDDF", "FRA"),
  row("EDXW", "medium_airport", "Westerland Sylt Airport", 54.9132, 8.3405, "DE", "DE-SH", "Sylt", "yes", "EDXW", "GWT"),
  row("EDDT", "closed", "Berlin Tegel", 52.5597, 13.2877, "DE", "DE-BE", "Berlin", "no"),
  row("LKPR", "large_airport", "Václav Havel Airport Prague", 50.1008, 14.26, "CZ", "CZ-PR", "Prague", "yes", "LKPR", "PRG"),
  row("LKTB", "medium_airport", "Brno-Tuřany Airport", 49.1513, 16.6944, "CZ", "CZ-JM", "Brno", "yes", "LKTB", "BRQ"),
  row("UKBB", "large_airport", "Boryspil International Airport", 50.345, 30.8947, "UA", "UA-32", "Kyiv", "no", "UKBB", "KBP"),
  row("UMKK", "large_airport", "Khrabrovo Airport", 54.89, 20.5926, "RU", "RU-KGD", "Kaliningrad", "yes", "UMKK", "KGD"),
  row("UUEE", "large_airport", "Sheremetyevo International Airport", 55.9726, 37.4146, "RU", "RU-MOS", "Moscow", "yes", "UUEE", "SVO"),
  row("KJFK", "large_airport", "John F Kennedy International Airport", 40.6398, -73.7789, "US", "US-NY", "New York", "yes", "KJFK", "JFK"),
  row("00A", "heliport", "Total RF Heliport", 40.07, -74.93, "US", "US-PA", "Bensalem", "no", ""),
  // The same ICAO code twice: the bigger airport wins.
  row("LZIB", "small_airport", "Old strip", 48.1, 17.1, "SK", "SK-BL", "Bratislava", "no"),
  row("LZIB", "large_airport", "M. R. Štefánik Airport", 48.1702, 17.2127, "SK", "SK-BL", "Bratislava", "yes", "LZIB", "BTS"),
].join("\n") + "\n";

describe("parseCsv", () => {
  test("quoted fields with commas, doubled quotes and CRLF line ends", () => {
    assert.deepEqual(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n'), [["a", "b"], ["x, y", 'say "hi"']]);
  });
});

describe("readAirports", () => {
  const airports = readAirports(CSV);
  const byIcao = Object.fromEntries(airports.map((a) => [a.icao, a]));

  test("skips rows without a 4-letter ICAO code, closed airports and heliports", () => {
    assert.equal(byIcao.EDDT, undefined);
    assert.ok(airports.every((a) => /^[A-Z]{4}$/.test(a.icao)));
  });

  test("keeps country, region, scheduled service and rounds coordinates to 4 places", () => {
    assert.deepEqual(
      { ...byIcao.EPWA },
      { icao: "EPWA", rank: 3, type: "large_airport", lat: 52.1657, lon: 20.9671, iata: "WAW", name: "Warsaw Chopin Airport", city: "Warsaw", country: "PL", region: "PL-MZ", scheduled: true },
    );
  });

  test("a duplicated ICAO code keeps the bigger airport", () => {
    assert.equal(byIcao.LZIB.name, "M. R. Štefánik Airport");
  });
});

describe("buildCoords", () => {
  const coords = buildCoords(readAirports(CSV));

  test("entry is [lat, lon, IATA, name, city, country]", () => {
    assert.deepEqual(coords.EDDF, [50.0267, 8.5584, "FRA", "Frankfurt Main Airport", "Frankfurt am Main", "DE"]);
  });

  test("keeps every Polish airport, drops small foreign ones without scheduled flights", () => {
    assert.ok(coords.EPBC);
    assert.ok(coords.KJFK);
    assert.equal(Object.keys(coords).length, 12);
  });
});

describe("buildTracked", () => {
  const tracked = buildTracked(readAirports(CSV));

  test("Poland first, then the neighbours, in the order of COUNTRIES", () => {
    assert.deepEqual(Object.keys(tracked), ["PL", "DE", "CZ", "SK", "UA", "BY", "LT", "RU"]);
    assert.deepEqual(Object.keys(tracked), COUNTRIES.map((c) => c.code));
  });

  test("Poland: large and medium airports with scheduled flights, large first", () => {
    assert.deepEqual(tracked.PL, ["EPWA", "EPSY"]);
  });

  test("neighbours: only large airports with scheduled flights, plus the listed extras", () => {
    assert.deepEqual(tracked.DE, ["EDDF"]);
    assert.deepEqual(tracked.CZ, ["LKPR", "LKTB"]);
    assert.deepEqual(tracked.SK, ["LZIB"]);
  });

  test("Ukraine has no scheduled flights, so its list is empty", () => {
    assert.deepEqual(tracked.UA, []);
  });

  test("Russia means the Kaliningrad region only", () => {
    assert.deepEqual(tracked.RU, ["UMKK"]);
  });

  test("trackedList and countriesOf", () => {
    assert.deepEqual(trackedList(tracked), ["EPWA", "EPSY", "EDDF", "LKPR", "LKTB", "LZIB", "UMKK"]);
    assert.deepEqual(countriesOf(["EPWA", "EDDF", "KJFK"], tracked), ["PL", "DE"]);
    assert.deepEqual(countriesOf(trackedList(tracked), tracked), ["PL", "DE", "CZ", "SK", "RU"]);
  });
});

describe("data/airports_tracked.json", () => {
  const tracked = JSON.parse(fs.readFileSync(new URL("../data/airports_tracked.json", import.meta.url), "utf8"));
  const coords = JSON.parse(fs.readFileSync(new URL("../data/airports_coords.json", import.meta.url), "utf8"));

  test("lists the countries of COUNTRIES and still has the 15 Polish airports", () => {
    assert.deepEqual(Object.keys(tracked), COUNTRIES.map((c) => c.code));
    assert.deepEqual([...tracked.PL].sort(), ["EPBY", "EPGD", "EPKK", "EPKT", "EPLB", "EPLL", "EPMO", "EPPO", "EPRA", "EPRZ", "EPSC", "EPSY", "EPWA", "EPWR", "EPZG"]);
  });

  test("every tracked airport has coordinates and the right country, with no duplicates", () => {
    const all = trackedList(tracked);
    assert.equal(new Set(all).size, all.length);
    for (const [code, list] of Object.entries(tracked)) {
      for (const icao of list) assert.equal(coords[icao]?.[5], code, icao);
    }
  });

  test("the day's export stays inside the free OpenSky budget", () => {
    // 2 requests per airport, 30 credits each (a Warsaw day spans two UTC days), 4000 credits a day.
    assert.ok(trackedList(tracked).length * 2 * 30 <= 3600, `${trackedList(tracked).length} airports`);
  });
});
