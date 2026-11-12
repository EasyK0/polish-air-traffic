# Changelog

All notable changes to Polish Air Traffic Map. Adding a new version at the top publishes a GitHub release for it. Daily data commits (`Dane: YYYY-MM-DD`) are not listed.

## [Unreleased]

- Unit tests (`tests/common.test.mjs`, `node --test`) for `lib/common.mjs`: Warsaw midnight and day bounds including the 23 h and 25 h DST change days, local dates, CSV quoting, `api_key.txt` parsing with environment variables winning, and the HTTP retry logic with a fake fetch (429/5xx and network errors retried, other 4xx not, `emptyStatuses`, giving up after the last try or on a too-long retry hint). New `Tests` workflow runs a syntax check and the tests on Node 20 and 22 for every push (except data-only commits) and pull request.
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
