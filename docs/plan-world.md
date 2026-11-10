# Plan: the flight map for every country

🇬🇧 English · [🇵🇱 Polski](plan-swiat.md)

> **Status (2026-11-10):** the colour scale is ready for it (release 1.1.0): colours follow flights per hour and the top of the scale is computed from the day's data, so the map will not turn red everywhere when more countries are added. Everything else below is still to do.

## Goal
The same map as for Poland (heatmap, badges, routes, hourly chart, ranking, airport details), but with any country to choose from and a view of the whole world. Data still from OpenSky, updated daily by GitHub Actions, demo on GitHub Pages.

## Why we can't just add more airports
The current export asks OpenSky about each airport separately (2 requests per airport per day). The world has about 4,000 airports with scheduled traffic, so about 8,000 requests a day, while a free account has about 4,000 credits. On top of that, raw world data is about 100–150 thousand flights a day (about 15 MB of CSV), too much for the repo and for loading in a browser.

## Solution

### 1. Data: one request for the whole world instead of one per airport
- The OpenSky endpoint `/flights/all?begin&end` returns all flights in a window of up to 2 h. A full day is 12 requests.
- **To check first:** the credit cost, whether the Polish data matches the current export, and whether yesterday is already processed in the morning.
- Plan B, if `/flights/all` does not work out: per-airport requests only for the biggest airports (e.g. 300–500), spread over several days or runs.

### 2. Aggregation instead of raw flights
The export computes summaries right away and saves small files:
- `data/YYYY-MM-DD/world.json`: countries → total flights per hour (world view).
- `data/YYYY-MM-DD/<COUNTRY>.json`, e.g. `PL.json`: the country's airports → departures/arrivals per hour, route pairs with flight counts, top destinations.
- The page loads only the chosen country's file (tens to hundreds of KB), not the whole world.
- The raw CSV does not go into the repo. At most as a workflow artifact, if needed for analysis.

### 3. Airports, countries and time zones
- `tools/build_airports.mjs` extended with the country (`iso_country` from OurAirports) and the airport's time zone (e.g. from the OpenFlights database or the geo-tz library), so hours are local even in countries with several time zones (USA, Russia, Brazil).
- The airport list is no longer hard-coded: the map shows every airport of the country that had traffic that day.

### 4. Interface
- **Country picker:** a list with search (Polish/English name, flag), address `?country=DE`. Poland stays the default.
- **World view:** countries coloured by traffic (choropleth map), a click zooms into the country.
- **Colour scale:** stays absolute and logarithmic, but its top depends on the data (done in 1.1.0: 1.3 × the 99th percentile of flights per airport per hour in the day), because a US hub has 1,500+ flights a day and Poland's biggest 450. The legend shows the numbers.
- **Performance:** with hundreds of airports, badges only for the biggest ones at a given zoom (the rest as small dots), routes only for the selected airport or the top N.
- Ranking, hourly chart and airport details work as now, but for the chosen country.

### 5. Automation and data storage
- Workflow: 12 requests + aggregation, a few minutes.
- Retention: the last 30 days in the repo. Older days kept as monthly summaries or moved to GitHub Releases, so the repo does not keep growing.
- A separate `data` branch for the data files instead of commits to `main` (cleaner code history).

## Stages
1. **Data source test (half a day):** one `/flights/all` download for one day, comparison with Poland, credit cost. This decides: main plan or plan B.
2. **New export + aggregation:** `world.json` and `<COUNTRY>.json` files, tests on a few countries (PL, DE, US, JP).
3. **Airports with countries and time zones.**
4. **Country interface:** country picker, dynamic airports, data-based scale (scale done in 1.1.0), performance of badges and routes.
5. **World view:** country choropleth and zooming into a country.
6. **Workflow and data retention, `data` branch.**
7. **README, screenshots, project name** (e.g. renaming the repo to `air-traffic-map` and the title to "Flight map"; the old address will redirect).

## Risks
- OpenSky coverage is uneven: Europe and the USA very good, Africa, parts of Asia and the oceans poor. The page should show this honestly (e.g. an "incomplete data" warning for countries with low coverage).
- Departure and arrival airports are estimated from ADS-B, so some flights have no destination (about 10% in Poland).
- OpenSky limits and rules may change. Plan B: AeroDataBox for the biggest airports.

## Decisions to make
- The whole world right away, or Europe first?
- Rename the repo and the project (now "Polish Air Traffic")?
- Is the world view (country choropleth) needed in the first version?
