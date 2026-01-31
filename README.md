# Startpage

## Überblick
Startpage ist eine personalisierbare Startseite im Dashboard-Stil. Suche, Wetter, Aufgaben, Notizen, News und Systemstatus laufen vollständig im Browser (localStorage). Version: **v1.7.1**. Live: https://julianverse.de/startpage/

## Kernfunktionen
- Schnellsuche: Mehrere Engines, !Bangs (!g, !ddg, !bing, !yt, !wiki, !maps), eigene Shortcuts und Autocomplete (Bangs, Shortcuts, Recent, globale Wortliste + Preset-Wortliste).
- Hintergrund-Engine: Presets, Uploads, Sammlungen, Rotation (Zeit/Thema/Intervall), Quick Actions (Random, Undo, Lock) und automatische Akzentfarbe aus dem Hintergrund.
- Favoriten-Kacheln: Drag & Drop, Schnellzugriff 1-9, Reset auf Defaults.
- To-Do & Notizen: Persistente Liste und Notizfeld.
- Wetter: Aktuell + Tages-Min/Max + 3h-Prognose via Open-Meteo; Standardstadt setzbar.
- Transport: Haltestellen-Suche + Abfahrten (via Startpage-Proxy für transport.rest); Standard-Haltestelle setzbar.
- News: RSS-Reader mit Standardquellen, erweiterbar um eigene Feeds (Startpage RSS Proxy).
- Zuletzt & Systemstatus: Verlaufs-Chips sowie Browser-Infos (RAM, CPU-Kerne, Netztyp).
- Setup-Assistent: Kompakter Dialog mit Preset-Wahl, Theme/Stil + Hintergrund, Suchmaschine, Widgets + Transport-Default sowie Wetter (überspringbar, später erneut startbar).
- Layout & Styling: Dark/Light/Auto, Karten-Stile (Glas, Vollfläche, Transparent, Soft Minimal), Widget-Farben, separate Farben für Uhr/Suche, Button "Widgets einfürben".
- Kommandopalette: Strg/Cmd+K für Aktionen (Theme, Tiles, Widget-Updates etc.).
- Daten: Export/Import als JSON plus Data Presets direkt aus assets/presets/ (starter, coding, gaming, minimal, productivity, reading, art, privacy, student, finance); lokale User-Presets unter assets/user-presets/ werden automatisch erkannt.

## Projektstruktur
- index.html – Markup, Styles, JS; neue Logik unten im <script> und aus init() starten.
- script.js / style.css – zentrale Logik/Styles; Wortliste global unter assets/wordlist.json, Preset-Wordlists inline in assets/presets/*.json.
- assets/ – optionale Dateien (Wortliste, Bilder).
- LICENSE – MIT-Lizenz.

## Lokale Nutzung
Kein Build notwendig. Starte z.B.:
```bash
python -m http.server 4173
```
oder
```bash
npx serve .
```
Danach: http://localhost:4173.

## Anpassung & Erweiterung
- Hintergrund & Erscheinung: Presets/Uploads/Sammlungen/Rotation im Tab; Akzentfarbe wird aus dem aktiven Bild gesetzt.
- Suche & Feeds: Engines ein-/ausschalten, !Shortcuts + {q} im Tab "Suche & Feeds" pflegen; Autocomplete nutzt Bangs/Shortcuts/Recent + globale & Preset-Wortliste.
- Widgets & Layout: Sichtbarkeit, Karten-Stil, Standard-Stadt (Wetter) + Standard-Haltestelle (Transport), Widget-Farben, Uhr/Suche-Farben; Reset stellt Stilvorgaben her.
- Daten: Export/Import aller localStorage-Einträge als JSON oder fertige Data Presets laden (assets/data-presets.json + assets/presets/*); User-Presets kannst du unter assets/user-presets/ ablegen (optional eigenes data-presets.json Manifest).
- Setup: Der Assistent erscheint beim ersten Start, ist überspringbar und lässt sich im Tab "Daten" via "Setup neu starten" erneut öffnen.
- Palette: Strg/Cmd+K für Befehle (Tiles öffnen, Theme wechseln, Widgets einfügen, etc.).

Neue Komponenten bitte mit 2-Spaces-Indent, camelCase (JS), hyphen-case (CSS). Wiederverwendbare Logik unter den Utilities platzieren und in init() aufrufen.

## Daten & Integrationen
- Speicherung: localStorage only.
- APIs: Open-Meteo (Wetter/Geocoding), Startpage-Proxy (transport.rest + RSS), Google Fonts (Inter).

## Tests
Manuelle Smoke-Tests:
- Suche/Bangs/Shortcuts + Autocomplete prüfen.
- Wetterstadt setzen, Reload.
- Todos/Notizen anlegen, Reload.
- Theme/Card-Style wechseln, Hintergrundrotation + Akzent kontrollieren.
- Feeds wechseln/Custom Feeds laden.
- localStorage ggf. leeren für Migrations-Check.

Automatisierte E2E-Tests optional (Playwright/Cypress) unter tests/*.e2e.spec.js.

## Lizenz
MIT-Lizenz (siehe LICENSE)
