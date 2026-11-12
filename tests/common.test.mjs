// Tests for lib/common.mjs: Warsaw dates (including DST change days), CSV output,
// config loading and the HTTP retry logic (with a fake fetch, no network).
// Run: node --test tests/*.test.mjs
import { test, describe, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  localMidnightUtc, localDate, dayBoundsUnix, toCsv, CSV_HEADER,
  loadConfig, fetchJson, HttpError,
} from "../lib/common.mjs";

const TZ = "Europe/Warsaw";
const iso = (ms) => new Date(ms).toISOString();

describe("Warsaw dates", () => {
  test("midnight in winter (CET, UTC+1) and summer (CEST, UTC+2)", () => {
    assert.equal(iso(localMidnightUtc("2026-01-15", TZ)), "2026-01-14T23:00:00.000Z");
    assert.equal(iso(localMidnightUtc("2026-07-01", TZ)), "2026-06-30T22:00:00.000Z");
  });

  test("DST change days start at the right UTC time", () => {
    // 2026-03-29: clocks go forward at 02:00, midnight is still CET.
    assert.equal(iso(localMidnightUtc("2026-03-29", TZ)), "2026-03-28T23:00:00.000Z");
    assert.equal(iso(localMidnightUtc("2026-03-30", TZ)), "2026-03-29T22:00:00.000Z");
    // 2026-10-25: clocks go back at 03:00, midnight is still CEST.
    assert.equal(iso(localMidnightUtc("2026-10-25", TZ)), "2026-10-24T22:00:00.000Z");
    assert.equal(iso(localMidnightUtc("2026-10-26", TZ)), "2026-10-25T23:00:00.000Z");
  });

  test("day bounds: 24 h normally, 23 h in March, 25 h in October", () => {
    const hours = (d) => {
      const { begin, end } = dayBoundsUnix(d, TZ);
      return (end + 1 - begin) / 3600;
    };
    assert.equal(hours("2026-11-12", TZ), 24);
    assert.equal(hours("2026-03-29", TZ), 23);
    assert.equal(hours("2026-10-25", TZ), 25);
  });

  test("day bounds across a month and year end", () => {
    const { begin, end } = dayBoundsUnix("2026-12-31", TZ);
    assert.equal(iso(begin * 1000), "2026-12-30T23:00:00.000Z");
    assert.equal(iso((end + 1) * 1000), "2026-12-31T23:00:00.000Z");
  });

  test("localDate uses Warsaw time, not UTC", () => {
    assert.equal(localDate(Date.parse("2026-03-28T23:30:00Z"), TZ), "2026-03-29");
    assert.equal(localDate(Date.parse("2026-07-01T21:59:59Z"), TZ), "2026-07-01");
    assert.equal(localDate(Date.parse("2026-07-01T22:00:00Z"), TZ), "2026-07-02");
  });
});

describe("toCsv", () => {
  test("header only for no rows", () => {
    assert.equal(toCsv([]), CSV_HEADER.join(",") + "\n");
  });

  test("quotes every value, doubles quotes, empty for missing values", () => {
    const csv = toCsv([{ type: "dep", airport: "EPWA", callsign: 'LO "1"', icao24: null, firstSeen: 0, lastSeen: 10 }]);
    const lines = csv.split("\n");
    assert.equal(lines.length, 3);
    assert.equal(lines[2], "");
    assert.equal(lines[1], '"dep","EPWA","LO ""1""","","0","10","",""');
  });

  test("commas and newlines stay inside one quoted field", () => {
    const csv = toCsv([{ callsign: "A,B\nC" }]);
    assert.ok(csv.includes('"A,B\nC"'));
  });
});

describe("loadConfig", () => {
  const KEYS = ["OPENSKY_CLIENT_ID", "OPENSKY_CLIENT_SECRET", "API_MARKET_KEY", "GATEWAY_BASE"];
  let saved, dir;
  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
    for (const k of KEYS) delete process.env[k];
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "pat-"));
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("reads KEY=VALUE lines, skips comments, keys upper-cased", () => {
    const file = path.join(dir, "api_key.txt");
    fs.writeFileSync(file, "# comment\r\nopensky_client_id = abc \r\nOPENSKY_CLIENT_SECRET=x=y\n#API_MARKET_KEY=no\n");
    assert.deepEqual(loadConfig(file), { OPENSKY_CLIENT_ID: "abc", OPENSKY_CLIENT_SECRET: "x=y" });
  });

  test("environment variables win; missing file is fine", () => {
    const file = path.join(dir, "api_key.txt");
    fs.writeFileSync(file, "OPENSKY_CLIENT_ID=from-file\n");
    process.env.OPENSKY_CLIENT_ID = "from-env";
    assert.equal(loadConfig(file).OPENSKY_CLIENT_ID, "from-env");
    assert.deepEqual(loadConfig(path.join(dir, "missing.txt")), { OPENSKY_CLIENT_ID: "from-env" });
  });
});

describe("fetchJson", () => {
  let calls;
  const fast = { baseMs: 1, timeoutMs: 1000 };
  // Fake fetch answering with the given responses in order.
  const fakeFetch = (...responses) => {
    calls = 0;
    mock.method(globalThis, "fetch", async () => {
      const r = responses[Math.min(calls++, responses.length - 1)];
      if (r instanceof Error) throw r;
      return new Response(r.body ?? "", { status: r.status ?? 200, headers: r.headers ?? {} });
    });
  };
  beforeEach(() => mock.method(console, "warn", () => {}));
  afterEach(() => mock.restoreAll());

  test("returns parsed JSON, null for an empty body", async () => {
    fakeFetch({ body: '{"a":1}' });
    assert.deepEqual(await fetchJson("https://x", {}, fast), { a: 1 });
    fakeFetch({ body: "" });
    assert.equal(await fetchJson("https://x", {}, fast), null);
  });

  test("retries 429 and 5xx, then succeeds", async () => {
    fakeFetch({ status: 429 }, { status: 503 }, { body: "[1]" });
    assert.deepEqual(await fetchJson("https://x", {}, fast), [1]);
    assert.equal(calls, 3);
  });

  test("retries network errors", async () => {
    fakeFetch(new TypeError("fetch failed"), { body: "2" });
    assert.equal(await fetchJson("https://x", {}, fast), 2);
    assert.equal(calls, 2);
  });

  test("other 4xx errors are not retried", async () => {
    fakeFetch({ status: 404, body: "not found" }, { body: "1" });
    await assert.rejects(fetchJson("https://x", {}, fast), (e) => e instanceof HttpError && e.status === 404);
    assert.equal(calls, 1);
  });

  test("emptyStatuses mean no data", async () => {
    fakeFetch({ status: 404 });
    assert.equal(await fetchJson("https://x", {}, { ...fast, emptyStatuses: [404] }), null);
  });

  test("gives up after the last retry with the last error", async () => {
    fakeFetch({ status: 500, body: "boom" });
    await assert.rejects(fetchJson("https://x", {}, { ...fast, retries: 3 }), (e) => e instanceof HttpError && e.status === 500);
    assert.equal(calls, 3);
  });

  test("a retry hint longer than maxWaitMs stops at once", async () => {
    fakeFetch({ status: 429, headers: { "x-rate-limit-retry-after-seconds": "3600" } });
    await assert.rejects(fetchJson("https://x", {}, fast), (e) => e instanceof HttpError && e.status === 429);
    assert.equal(calls, 1);
  });
});
