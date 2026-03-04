# Contributing

Thanks for contributing to Startpage.

## Getting Started

1. Fork the repository or create a branch from `main`.
2. Create a feature branch.

```bash
git checkout -b feat/my-feature
```

3. Make your changes.
4. Commit using Conventional Commits.
5. Open a pull request.

## Local Development

This project is a static, local-first start page. There is no build step.

Run a local server from the repository root:

```bash
python -m http.server 4173
```

Or:

```bash
npx serve .
```

Then open `http://localhost:4173`.

## Project Layout

- `index.html` contains the core app structure and still matters as the main integration point.
- `script.js` and `style.css` contain the main behavior and styling.
- `assets/` contains images, presets, wordlists, and i18n files.
- `assets/presets/` stores built-in data presets.
- `assets/user-presets/` stores local user preset examples and manifest data.
- `assets/i18n/` stores translation files.

## Project Philosophy

Startpage intentionally stays simple and local-first.

Please prefer:

- browser-native APIs over external dependencies
- minimal JavaScript where possible
- readable code over clever abstractions
- privacy-friendly integrations

Avoid adding build systems, frameworks, or heavy dependencies unless there is a very strong reason.

## Coding Conventions

- Use 2-space indentation in HTML, CSS, and JavaScript.
- Use camelCase for JavaScript identifiers.
- Use lowercase hyphenated names for CSS classes.
- Keep persistent storage keys consistent with the existing dotted-path style.
- End JavaScript statements with semicolons.
- Preserve existing UI and repo patterns unless the change intentionally updates them.

## Testing

Before opening a PR, run manual smoke tests:

- Verify search works across the available engines.
- Verify weather loads after setting a city.
- Verify todos and notes persist after reload.
- Verify theme toggles cycle through dark, light, and auto.
- Verify any changed UI works on desktop and mobile widths.
- Clear localStorage when retesting migration-sensitive flows.

If you add automated tests, prefer Playwright or Cypress and place them under `tests/` with the suffix `.e2e.spec.js`.

## Commits

Use Conventional Commits where possible:

- `feat: add compact weather card`
- `fix: debounce search`
- `chore: update release workflow`

Version releases are generated automatically based on commit messages.
Use `feat:` for new features and `fix:` for bug fixes.

Keep commits scoped to a single unit of work.

## Pull Requests

- Rebase or update your branch from the latest `main` before requesting review.
- Describe what changed and why.
- Include manual test coverage in the PR description.
- Add before/after screenshots for visual changes.
- Reference related issues with keywords like `Closes #3` when appropriate.

## Feature Requests

For larger changes, please open an issue first to discuss the idea before implementing it.

## Notes

- Prefer small, reviewable changes over large mixed refactors.
- Keep new assets colocated under `assets/` when they belong to the app.
- If you add new tooling or commands, document them in `README.md`.
