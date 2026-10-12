# mdpad

A personal Typora-style WYSIWYG Markdown editor for Windows, built with Electron, React,
TypeScript and Milkdown. See [docs/PLAN.md](docs/PLAN.md) for the roadmap.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app with hot reload |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Build, then drive the app with Playwright |
| `npm run typecheck` | Type-check main, renderer and tests |
| `npm run lint` | ESLint |
| `npm run build:win` | Build a Windows installer into `dist/` |

## Layout

- `src/main` — Electron main process (windows, menus, file IO)
- `src/preload` — sandboxed bridge exposing `window.api`
- `src/shared` — types shared across processes
- `src/renderer/src` — React UI and the editor
- `tests/` — `main/` and `markdown/` (Vitest), `e2e/` (Playwright), `fixtures/` (sample notes)
