@echo off
setlocal
cd /d "%~dp0"

REM ==========================================================
REM Mapa lotow
REM   start.bat           - sama mapa (zapisane dni z folderu data\)
REM   start.bat export    - najpierw pobierz wczorajszy dzien, potem mapa
REM   start.bat export --date=2026-11-03 --source=opensky
REM Klucze API: api_key.txt (wzor: api_key.template.txt)
REM ==========================================================

where node >nul 2>nul
if errorlevel 1 (
  echo Brak Node.js. Zainstaluj ze strony https://nodejs.org
  pause
  exit /b 1
)

if /i "%~1"=="export" (
  if not exist "api_key.txt" (
    echo Brak api_key.txt. Skopiuj api_key.template.txt jako api_key.txt i uzupelnij klucze.
    pause
    exit /b 1
  )
  echo [1/2] Eksport lotow...
  node export.mjs %2 %3 %4 %5
  if errorlevel 1 echo Eksport nie powiodl sie albo jest niepelny. Mapa pokaze zapisane dni.
) else (
  node export.mjs --index-only
)

echo [2/2] Serwer http://localhost:8000 ...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8000 " ^| findstr "LISTENING"') do taskkill /f /pid %%P >nul 2>nul

where python >nul 2>nul
if errorlevel 1 (
  start "Mapa lotow - serwer" /min cmd /c "py -m http.server 8000"
) else (
  start "Mapa lotow - serwer" /min cmd /c "python -m http.server 8000"
)
timeout /t 2 /nobreak >nul
start "" "http://localhost:8000/index.html"
exit /b 0
