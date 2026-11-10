# Plan: mapa lotów dla wszystkich krajów

[🇬🇧 English](plan-world.md) · 🇵🇱 Polski

> **Stan (2026-11-10):** skala kolorów jest już na to gotowa (wersja 1.1.0): kolor zależy od lotów na godzinę, a górna granica skali jest liczona z danych dnia, więc po dodaniu kolejnych krajów mapa nie zrobi się cała czerwona. Reszta planu jest jeszcze do zrobienia.

## Cel
Ta sama mapa co dla Polski (heatmapa, plakietki, trasy, wykres godzinowy, ranking, szczegóły lotniska), ale z wyborem dowolnego kraju i widokiem całego świata. Dane nadal z OpenSky, aktualizowane codziennie przez GitHub Actions, demo na GitHub Pages.

## Dlaczego nie da się po prostu dopisać lotnisk
Obecny eksport pyta OpenSky osobno o każde lotnisko (2 zapytania na lotnisko dziennie). Na świecie jest ok. 4 000 lotnisk z ruchem rozkładowym, czyli ok. 8 000 zapytań dziennie, a darmowe konto ma ok. 4 000 kredytów. Do tego surowe dane świata to ok. 100–150 tys. lotów dziennie (ok. 15 MB CSV), czyli za dużo na repo i do wczytania w przeglądarce.

## Rozwiązanie

### 1. Dane: jedno zapytanie o cały świat zamiast o każde lotnisko
- Endpoint OpenSky `/flights/all?begin&end` zwraca wszystkie loty w przedziale do 2 h. Pełna doba to 12 zapytań.
- **Do sprawdzenia na początku:** koszt w kredytach, czy dane dla Polski zgadzają się z obecnym eksportem i czy wczorajszy dzień jest już przeliczony rano.
- Plan B, jeśli `/flights/all` się nie sprawdzi: zapytania per lotnisko tylko dla największych lotnisk (np. 300–500), rozłożone na kilka dni lub uruchomień.

### 2. Agregacja zamiast surowych lotów
Eksport od razu liczy podsumowania i zapisuje małe pliki:
- `data/YYYY-MM-DD/world.json`: kraje → suma lotów na godzinę (widok świata).
- `data/YYYY-MM-DD/<KRAJ>.json`, np. `PL.json`: lotniska kraju → odloty/przyloty na godzinę, pary tras z liczbą lotów, najczęstsze kierunki.
- Strona pobiera tylko plik wybranego kraju (dziesiątki–setki KB), a nie cały świat.
- Surowy CSV nie trafia do repo. Najwyżej jako artefakt workflow, gdyby był potrzebny do analiz.

### 3. Lotniska, kraje i strefy czasowe
- `tools/build_airports.mjs` rozszerzony o kraj (`iso_country` z OurAirports) i strefę czasową lotniska (np. z bazy OpenFlights albo biblioteki geo-tz), żeby godziny były lokalne nawet w krajach z kilkoma strefami (USA, Rosja, Brazylia).
- Lista lotnisk przestaje być wpisana na sztywno: na mapie są wszystkie lotniska kraju z ruchem danego dnia.

### 4. Interfejs
- **Wybór kraju:** lista z wyszukiwarką (nazwa po polsku/angielsku, flaga), adres `?country=DE`. Polska zostaje domyślna.
- **Widok świata:** kraje pokolorowane według ruchu (mapa kartogramowa), kliknięcie przybliża do kraju.
- **Skala kolorów:** zostaje bezwzględna i logarytmiczna, ale górna granica zależy od kraju (np. 95. percentyl największego lotniska), bo w USA hub ma 1 500+ lotów, a w Polsce 450. Legenda pokazuje liczby.
- **Wydajność:** przy setkach lotnisk plakietki tylko dla największych przy danym przybliżeniu (reszta jako małe kropki), trasy tylko dla wybranego lotniska albo top N.
- Ranking, wykres godzinowy i szczegóły lotniska działają jak teraz, ale dla wybranego kraju.

### 5. Automatyzacja i miejsce na dane
- Workflow: 12 zapytań + agregacja, czas ok. kilku minut.
- Retencja: 30 ostatnich dni w repo. Starsze dni zostają w miesięcznych podsumowaniach albo trafiają do GitHub Releases, żeby repo nie rosło.
- Osobna gałąź `data` na pliki danych zamiast commitów do `main` (czystsza historia kodu).

## Etapy
1. **Test źródła danych (pół dnia):** jedno pobranie `/flights/all` za jeden dzień, porównanie z Polską, koszt kredytów. Tu zapada decyzja: plan główny czy plan B.
2. **Nowy eksport + agregacja:** pliki `world.json` i `<KRAJ>.json`, testy na kilku krajach (PL, DE, US, JP).
3. **Lotniska z krajami i strefami czasowymi.**
4. **Interfejs kraju:** wybór kraju, dynamiczne lotniska, skala zależna od kraju, wydajność plakietek i tras.
5. **Widok świata:** kartogram krajów i przejście do kraju.
6. **Workflow i retencja danych, gałąź `data`.**
7. **README, zrzuty, nazwa projektu** (np. zmiana repo na `air-traffic-map` i tytułu „Mapa lotów”; stary adres przekieruje).

## Ryzyka
- Zasięg OpenSky jest nierówny: Europa i USA bardzo dobrze, Afryka, część Azji i oceany słabo. Strona powinna to uczciwie pokazywać (np. ostrzeżenie „niepełne dane” dla krajów z małym pokryciem).
- Lotniska startu i lądowania są szacowane z ADS-B, więc część lotów nie ma celu (w Polsce ok. 10%).
- Limity i zasady OpenSky mogą się zmienić. Plan B: AeroDataBox dla największych lotnisk.

## Decyzje do podjęcia
- Od razu cały świat, czy najpierw Europa?
- Czy zmienić nazwę repo i projektu (teraz „Polish Air Traffic”)?
- Czy widok świata (kartogram krajów) jest potrzebny w pierwszej wersji?
