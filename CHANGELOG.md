# Changelog

All notable changes to Polish Air Traffic Map. Adding a new version at the top publishes a GitHub release for it. Daily data commits (`Dane: YYYY-MM-DD`) are not listed.

## [Unreleased]

- Airport data for Poland and the countries bordering it: `tools/build_airports.mjs` now also writes `data/airports_tracked.json`, the airports the map covers, by country (Poland 15, Germany 22, Czechia 6, Slovakia 3, Lithuania 3, Belarus 2, Kaliningrad Oblast 1; Ukraine is listed with none, its airspace is closed to civilian flights). Poland keeps every large and medium airport with scheduled flights; the neighbours get the large ones plus Brno, Košice and Poprad, to stay inside the daily OpenSky credits. `data/airports_coords.json` gains the airport's country as a sixth field and is rebuilt from the current OurAirports file. The country list and the rules live in the new `lib/airports.mjs`.
- Unit tests for `lib/airports.mjs` (`tests/airports.test.mjs`): OurAirports CSV parsing, duplicate ICAO codes, the coordinates entry, which airports are tracked per country (Kaliningrad only for Russia, none for Ukraine), and checks of the committed `data/airports_tracked.json` (the 15 Polish airports, coordinates and country for each one, the export staying under 3,600 OpenSky credits a day).
- `export.mjs` fetches every airport from `data/airports_tracked.json` (52 instead of the 15 Polish ones; Poland goes first) and saves the covered countries in the day's `meta.json` and in `data/index.json` (`countries`). The day is still the Warsaw day for every country, so hours are comparable. Without the tracked file the export falls back to the 15 Polish airports.
- The export prints how many OpenSky requests it made and how many credits are left for the day (`X-Rate-Limit-Remaining`), now that 52 airports use about 3,100 of the 4,000 daily credits. `fetchJson` gets an `onResponse` option for that, with a test.
- Map ready for more airports: heatmap blobs shrink when zoomed out (so neighbouring airports do not merge into one), airports without flights become small dots at a distance, and with no airport selected only the 400 busiest routes are drawn.
- The map covers Poland and the countries bordering it. New country picker (all together or one country, address `?country=DE`, the view zooms to the chosen country); countries without data for the chosen day are greyed out, and days saved before this change show Poland with a note. Airports are no longer hard-coded in the page: they come from `data/airports_tracked.json` and `data/airports_coords.json` (the 15 Polish airports remain as a fallback). The colour scale is shared by every country, the subtitle shows the number of airports, the ranking lists the 15 busiest with a "Show all" button and a country code next to each name. Page title is now "Air Traffic Map: Poland and neighbours".
- Unit tests (`tests/common.test.mjs`, `node --test`) for `lib/common.mjs`: Warsaw midnight and day bounds including the 23 h and 25 h DST change days, local dates, CSV quoting, `api_key.txt` parsing with environment variables winning, and the HTTP retry logic with a fake fetch (429/5xx and network errors retried, other 4xx not, `emptyStatuses`, giving up after the last try or on a too-long retry hint). New `Tests` workflow runs a syntax check and the tests on Node 20 and 22 for every push (except data-only commits) and pull request.
- Both READMEs: Tests badge and a `tests/` row in the structure table.
- `docs/plan-swiat.md` (Polish) and `docs/plan-world.md` (English): the plan for extending the map to every country and the whole world, linked from both READMEs. The 1.1.0 release notes point to it.

## [1.1.0] - 2026-11-10

Preparation for the world map (see `docs/plan-swiat.md`): the colour scale no longer depends on Poland's numbers, so when more countries or the whole world are added, the map will not turn red everywhere.

- Heatmap and airport badges are coloured by average flights per hour in the selected hours instead of the total. Before, the total grew with the number of selected hours, so for the whole day Warsaw, Kraków and Gdańsk were red every day. The top of the scale is no longer fixed: it is 1.3 × the 99th percentile of flights per airport per hour in the loaded day (about 40-45 in Poland, thresholds 1, 4, 7-8, 15, 25-30, 40-45+), so with more airports (e.g. a world view) red still means only the busiest hubs at their peak. Now the whole day shows Warsaw orange, Kraków and Gdańsk yellow, and red appears only in Warsaw's busiest hours. Legend title says "per hour" and its labels follow the day's scale.
- MIT licence for the code (`LICENSE`), mentioned in both READMEs. Flight data, airport coordinates and the basemap keep their own terms.

## [1.0.0] - 2026-11-08

First release of the map as it runs on the [live demo](https://easyk0.github.io/polish-air-traffic/).

- Interactive map of 15 Polish airports (Leaflet): traffic heatmap and airport badges on one shared absolute, logarithmic colour scale (1 to 250+ flights) with a continuous legend.
- Routes to destination airports, line width by number of flights (coordinates of about 5,900 airports from OurAirports, `tools/build_airports.mjs`).
- Hourly chart with drag selection, times of day and a whole-day animation; all / departures / arrivals filter; airport details with hourly chart and top destinations; airport ranking; day picker; local time (Europe/Warsaw).
- Polish / English interface (remembered, `?lang=en` in the address), light and dark theme, mobile layout, keyboard support. English README (`README.en.md`).
- `export.mjs`: daily departures and arrivals from the OpenSky REST API (OAuth2 client credentials, token refresh, HTTP 429 handling, retries, duplicates removed) to `data/flights_YYYY-MM-DD.csv` and `data/index.json`; `--date`, `--airports`, `--keep=N`; optional AeroDataBox source.
- GitHub Actions workflow that exports the previous day every morning (and on demand for a chosen day) and keeps the last 60 days; GitHub Pages serves the demo.
- Security: Subresource Integrity for the cdnjs libraries, a Content-Security-Policy limiting scripts and data to allowed sources, GitHub Actions pinned to commits, validation of the manually entered date.
