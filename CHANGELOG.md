# Changelog

All notable changes to Polish Air Traffic Map. Adding a new version at the top publishes a GitHub release for it. Daily data commits (`Dane: YYYY-MM-DD`) are not listed.

## [Unreleased]

- Heatmap and airport badges are coloured by average flights per hour in the selected hours instead of the total, on a new scale (1, 4, 8, 15, 30, 45+ per hour). Before, the total grew with the number of selected hours, so for the whole day Warsaw, Kraków and Gdańsk were red every day; now red means 30+ flights in an hour (Warsaw's busiest hours), and the whole day shows Warsaw orange, Kraków and Gdańsk yellow. Legend title says "per hour".
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
