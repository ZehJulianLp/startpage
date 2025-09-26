# Repository Guidelines

## Project Structure & Module Organization
This start page is a single-page application built from `index.html`. The document bundles semantic HTML sections (header, widgets grid, modals) with inline `<style>` and `<script>` blocks. UI widgets (search, weather, todos, news) are broken into functions such as `renderTiles`, `loadWeather`, and `renderSystem`. Keep new assets colocated: drop additional images under `assets/` (create if needed) and reference them with relative paths, and keep reusable scripts near the bottom JavaScript block so initialization logic remains in `init()`.

## Build, Test, and Development Commands
- `python -m http.server 4173` — lightweight dev server for local iteration; open `http://localhost:4173` to exercise live widgets.
- `npx serve .` — optional static server with caching headers disabled for testing theme changes.
There is no build step; update `index.html` directly and refresh the browser. When adding tooling, document the command in this section.

## Coding Style & Naming Conventions
Use two-space indentation for HTML, CSS, and JavaScript to match the existing file. Keep CSS custom properties (`--bg`, `--accent`) grouped at the top of the `<style>` block and favor lowercase, hyphenated class names (e.g. `bg-orbs`, `todo-list`). JavaScript identifiers are camelCase, functions start with verbs (`loadWeather`, `renderTodos`), and persistent keys stored via `store.set` use dotted paths (`weather.city`). Terminate statements with semicolons and avoid mixing double and single quotes within the same block.

## Testing Guidelines
Run manual smoke tests in desktop and mobile breakpoints: verify the search form submits using each engine, weather loads after setting a city, todos persist through reloads, and theme toggles cycle through dark/light/auto. Validate localStorage migrations by clearing storage before retesting key flows. If you add automated checks, prefer Playwright or Cypress and place specs under `tests/` with the suffix `.e2e.spec.js`.

## Commit & Pull Request Guidelines
Treat commits as scoped units of work and follow Conventional Commits (`feat: add compact weather card`, `fix: debounce search`). Include before/after screenshots for visual tweaks and detail manual test coverage in the PR description. Reference related issues with `Closes #id` and call out any follow-up work in a checklist. Ensure the branch is rebased on the latest main snapshot before requesting review.
