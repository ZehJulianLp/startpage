# Startpage

## Overview
Startpage is a customizable dashboard-style browser start page. Search, weather, tasks, notes, news, system status, and the integrated Startpage Agent run fully in the browser (localStorage). Version: **v1.10**. Live: https://julianverse.de/startpage/

## Core Features
- Quick search: Multiple engines, bang shortcuts (`!g`, `!ddg`, `!bing`, `!yt`, `!wiki`, `!maps`), custom shortcuts, and autocomplete (bangs, shortcuts, recent searches, global wordlist + preset wordlist).
- Background engine: Presets, uploads, collections, rotation (time/theme/interval), quick actions (random, undo, lock), and automatic accent color extraction from the active background.
- Favorite tiles: Drag and drop, quick access keys `1-9`, and reset to defaults.
- To-do and notes: Persistent to-do list and notes field.
- Weather: Multiple cities with quick city chips (switch/remove), current weather + min/max, rolling 24-hour forecast (not bound to day boundaries) in 3-hour steps via Open-Meteo.
- Transport: Station search + departures (via Startpage proxy for transport.rest); configurable default station.
- News: RSS reader with default sources, extendable with custom feeds (Startpage RSS proxy).
- Recent actions and system status: History chips plus browser info (RAM, CPU cores, network type).
- Setup assistant: Compact onboarding with preset selection, theme/style + background, search engine, widgets + transport default, and one weather city (skippable and restartable).
- Layout and styling: Dark/Light/Auto theme, card styles (glass, solid, transparent, soft minimal), widget colors, dedicated header/search colors, and a "Tint widgets" action.
- Command palette: `Ctrl/Cmd+K` for quick actions (theme, tiles, widget refresh, and more).
- Data: JSON export/import plus data presets from `assets/presets/` (starter, coding, gaming, minimal, productivity, reading, art, privacy, student, finance); local user presets in `assets/user-presets/` are auto-detected.
- Startpage Agent: Docked AI chat with Ollama (`/api/tags`, `/api/chat` stream), persistent chat history, model selection, tool-confirm modes, configurable agent loop limit, custom prompt + persistent memory, and agentic tools for reading/updating widgets/settings.

## Project Structure
- `index.html` - Main markup.
- `script.js` / `style.css` - Main logic and styles.
- `assets/` - Optional assets (wordlists, images, presets, i18n files).
- `LICENSE` - MIT license.

## Local Development
No build step is required. Start a local static server, for example:

```bash
python -m http.server 4173
```

or

```bash
npx serve .
```

Then open: `http://localhost:4173`.

## Configuration and Extension
- Background and appearance: Manage presets/uploads/collections/rotation in Settings; accent color is derived from the active background.
- Search and feeds: Enable/disable engines, configure custom `!shortcuts` with `{q}`, manage feed sources.
- Widgets and layout: Visibility, weather cities (one city per line), default transport station.
- Appearance (same settings area): Card style, widget colors, dedicated clock/search colors.
- Data: Export/import all localStorage entries as JSON, or load ready-made data presets (`assets/data-presets.json` + `assets/presets/*`).
- Setup assistant: Opens on first run, can be skipped, and can be restarted in the Data tab.
- Command palette: `Ctrl/Cmd+K` for fast actions and navigation.

Follow existing conventions: 2-space indentation, camelCase in JavaScript, hyphen-case in CSS.

## Data and Integrations
- Storage: localStorage only.
- APIs and services: Open-Meteo (weather/geocoding), Startpage proxy (transport.rest + RSS), Google Fonts.

## Testing
Manual smoke tests:
- Verify search/bangs/shortcuts + autocomplete.
- Add multiple weather cities, switch active city, remove one city (`x` and middle-click), press `Enter` in weather input, then reload.
- Create todos/notes and reload.
- Switch theme/card style, verify background rotation + accent updates.
- Switch feeds and test custom feed loading.
- Clear localStorage when re-testing migration-sensitive flows.

Optional automated E2E tests (Playwright/Cypress) can be placed under `tests/*.e2e.spec.js`.

## License
MIT License (see `LICENSE`).
