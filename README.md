# Startpage

## Ueberblick
Startpage ist eine personalisierbare Startseite im Dashboard-Stil. Suche, Wetter, Aufgaben, Notizen, News und Systemstatus laufen vollstaendig im Browser (localStorage). Version: **v1.4**. Live: https://julianverse.de/startpage/

## Kernfunktionen
- Schnellsuche: Mehrere Engines, !Bangs (!g, !ddg, !bing, !yt, !wiki, !maps), eigene Shortcuts und Autocomplete (Bangs, Shortcuts, Recent, globale Wortliste + Preset-Wortliste).
- Hintergrund-Engine: Presets, Uploads, Sammlungen, Rotation (Zeit/Thema/Intervall), Quick Actions (Random, Undo, Lock) und automatische Akzentfarbe aus dem Hintergrund.
- Favoriten-Kacheln: Drag & Drop, Schnellzugriff 1-9, Reset auf Defaults.
- To-Do & Notizen: Persistente Liste und Notizfeld.
- Wetter: Aktuell + Tages-Min/Max + 3h-Prognose via Open-Meteo; Standardstadt setzbar.
- News: RSS-Reader mit Standardquellen, erweiterbar um eigene Feeds (AllOrigins Proxy).
- Zuletzt & Systemstatus: Verlaufs-Chips sowie Browser-Infos (RAM, CPU-Kerne, Netztyp).
- Layout & Styling: Dark/Light/Auto, Karten-Stile (Glas, Vollflaeche, Transparent, Soft Minimal), Widget-Farben, separate Farben fuer Uhr/Suche, Button "Widgets einfaerben".
- Kommandopalette: Strg/Cmd+K fuer Aktionen (Theme, Tiles, Widget-Updates etc.).
- Daten: Export/Import als JSON plus Data Presets direkt aus assets/presets/ (starter, coding, gaming, minimal, productivity, reading, art, privacy, student, finance).

## Projektstruktur
- index.html ? Markup, Styles, JS; neue Logik unten im <script> und aus init() starten.
- script.js / style.css ? zentrale Logik/Styles; Wortliste global unter assets/wordlist.json, Preset-Wordlists inline in assets/presets/*.json.
- assets/ ? optionale Dateien (Wortliste, Bilder).
- LICENSE ? MIT-Lizenz.

## Lokale Nutzung
Kein Build notwendig. Starte z.B.:
`ash
python -m http.server 4173
`
oder
`ash
npx serve .
`
Danach: http://localhost:4173.

## Anpassung & Erweiterung
- Hintergrund & Erscheinung: Presets/Uploads/Sammlungen/Rotation im Tab; Akzentfarbe wird aus dem aktiven Bild gesetzt.
- Suche & Feeds: Engines ein-/ausschalten, !Shortcuts + {q} im Tab "Suche & Feeds" pflegen; Autocomplete nutzt Bangs/Shortcuts/Recent + globale & Preset-Wortliste.
- Widgets & Layout: Sichtbarkeit, Karten-Stil, Standard-Stadt (Wetter), Widget-Farben, Uhr/Suche-Farben; Reset stellt Stilvorgaben her.
- Daten: Export/Import aller localStorage-Eintraege als JSON oder fertige Data Presets laden (assets/data-presets.json + assets/presets/*).
- Palette: Strg/Cmd+K fuer Befehle (Tiles oeffnen, Theme wechseln, Widgets einfuegen, etc.).

Neue Komponenten bitte mit 2-Spaces-Indent, camelCase (JS), hyphen-case (CSS). Wiederverwendbare Logik unter den Utilities platzieren und in init() aufrufen.

## Daten & Integrationen
- Speicherung: localStorage only.
- APIs: Open-Meteo (Wetter/Geocoding), AllOrigins (RSS), Google Fonts (Inter).

## Tests
Manuelle Smoke-Tests:
- Suche/Bangs/Shortcuts + Autocomplete pruefen.
- Wetterstadt setzen, Reload.
- Todos/Notizen anlegen, Reload.
- Theme/Card-Style wechseln, Hintergrundrotation + Akzent kontrollieren.
- Feeds wechseln/Custom Feeds laden.
- localStorage ggf. leeren fuer Migrations-Check.

Automatisierte E2E-Tests optional (Playwright/Cypress) unter tests/*.e2e.spec.js.

## Lizenz
MIT-Lizenz (siehe LICENSE).
