# Startpage

## Überblick
Startpage ist eine personalisierbare Startseite im Dashboard-Stil, die komplett clientseitig in `index.html` umgesetzt ist. Widgets für Suche, Wetter, Aufgaben, Notizen, News und Systemstatus bieten einen schnellen Überblick über den Alltag. Alle Daten verbleiben lokal im Browser (localStorage) und lassen sich bei Bedarf exportieren oder importieren. Aktuelle Version: **v1.3**.

Eine Live-Version ist unter https://julianverse.de/startpage/ erreichbar.

## Kernfunktionen
- **Schnellsuche**: Auswahl zwischen mehreren Suchmaschinen, Unterstützung von !Bang-Shortcuts (`!g`, `!ddg`, `!wiki`, …) sowie eigenen Kürzeln.
- **Favoriten-Kacheln**: Frei konfigurierbares Linkgitter mit Drag-&-Drop-Reihenfolge, Schnellzugriff per Zahlentasten (1–9) und Reset auf Standard-Kacheln.
- **To-Do & Notizen**: Einfache Aufgabenliste mit Persistenz sowie ein Notizfeld zum schnellen Festhalten von Gedanken.
- **Wetter heute**: Aktuelle Bedingungen, Tageshöchst-/Tiefstwerte und 3-Stunden-Vorschau basierend auf Open-Meteo. Die Standardstadt lässt sich umstellen.
- **News-Feed**: RSS-Leser mit auswählbaren Quellen, erweiterbar über eigene Feeds. Abruf erfolgt via AllOrigins (CORS-Proxy).
- **Zuletzt & Systemstatus**: Historie der eigenen Suchen/Klicks sowie Verbindungs- und Akkustand (soweit vom Browser verfügbar).
- **Quote & Kommandopalette**: Tageszitat zur Motivation und eine Palette (`Strg/⌘ + K`) für Aktionen wie Theme-Wechsel, Tile-Suche oder Widget-Updates.
- **Layout & Styling**: Dark-/Light-/Auto-Modus, vier globale Karten-Stile (Glas, Vollfläche, Transparent, Soft Minimal), konfigurierbare Widgetfarben sowie separate Farbwahlen für Suche und Zeit/Datum.

## Projektstruktur
- `index.html` – Enthält das komplette Markup, CSS und JavaScript. Neue Skripte sollten im unteren `<script>`-Block ergänzt und innerhalb von `init()` initialisiert werden.
- `assets/` – (optional) Ablage für zusätzliche Bilder oder Medien, die von der Startseite referenziert werden.
- `LICENSE` – MIT-Lizenz für den Code.

## Lokale Nutzung
Es ist kein Build-Schritt notwendig; ein beliebiger statischer Server genügt. Empfohlene Varianten:

```bash
python -m http.server 4173
```

```bash
npx serve .
```

Die Seite ist anschließend unter `http://localhost:4173` (oder dem jeweiligen Port) erreichbar.

## Anpassung und Erweiterung
- **Suche**: Aktivieren/Deaktivieren von Engines und eigene !Shortcuts über das Einstellungsmodal („Daten“-Tab). Platzhalter `{q}` steht für die Suchphrase.
- **Wetter & News**: Standardstadt und individuelle RSS-Feeds im Modal („Widgets“ bzw. „Daten“) konfigurieren.
- **Widgets & Layout**: Sichtbarkeit einzelner Karten, globale Karten-Stile und Akzentfarben je Widget lassen sich im Einstellungsmodal anpassen.
- **Header & Suche**: Eigene Farben für Zeit/Datum sowie die Suche festlegen oder per Reset auf den aktuellen Karten-Stil zurücksetzen.
- **Hintergrund**: Eine Bild-URL im Einstellungsmodal hinterlegen, um den Hintergrund zu überschreiben.
- **Datenverwaltung**: Export und Import aller localStorage-Einträge als JSON über das Modal („Daten“-Tab).
- **Kommandopalette**: `Strg/⌘ + K` öffnet eine fuzzy durchsuchbare Aktionsliste (z. B. Tiles aufrufen, Theme wechseln, Widgets neu laden).

Neue Komponenten sollten im vorhandenen Stil ergänzt werden (2-Spaces-Einrückung, camelCase für JavaScript, hyphen-case für CSS-Klassen). Wiederverwendbare Logik wird idealerweise als Funktion unterhalb der bestehenden Utilities abgelegt und aus `init()` gestartet.

## Daten & Integrationen
- **Speicherung**: Alle Nutzerdaten werden lokal im Browser gespeichert (`localStorage`). Es findet keine serverseitige Synchronisation statt.
- **APIs**:
  - [Open-Meteo](https://open-meteo.com/) für Wetterdaten (inkl. Geocoding).
  - [AllOrigins](https://allorigins.win/) als Proxy für RSS-Feeds.
  - Google Fonts (Inter) für die Typografie.

## Tests & Qualitätssicherung
Der Fokus liegt auf manuellen Smoke-Tests:
- Suche mit mehreren Engines und !Shortcuts ausführen.
- Wetterstadt setzen, Seite neu laden und Datenabruf prüfen.
- To-Dos und Notizen anlegen, erledigen und Browser neu laden.
- Theme-Toggle (Dark/Light/Auto) sowie optionales Hintergrundbild validieren.
- News-Feeds wechseln, eigene Feeds hinterlegen und das Neu-Laden testen.
- localStorage ggf. leeren, um Migrationen zu überprüfen.

Automatisierte End-to-End-Tests können mit Playwright oder Cypress ergänzt und unter `tests/*.e2e.spec.js` abgelegt werden.

## Lizenz
Der Code steht unter der [MIT-Lizenz](LICENSE).
