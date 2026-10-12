# Plan: Personal Typora-style Markdown Editor (Windows)

## Context

The user wants to build their own desktop Markdown editor, using Typora as a UI/behavior reference
(see `Typora-UI-Design-Reference.md` in the project folder). Decisions already made in conversation:

- **True visual (WYSIWYG) editing** like Typora — not a split preview, not Obsidian-style live preview.
- **Windows only** for now.
- **Personal tool** — no distribution, licensing, auto-update, or code-signing work needed.
- **Stack left to recommendation** → Electron + TypeScript + React + Milkdown (ProseMirror) + CodeMirror 6.

Starting state (before M0): the folder contained only the reference note and `.claude/`.
Tooling: Node v24.20.0, npm 11.19.0, Git 2.55.

The core risk of WYSIWYG Markdown is **silent reformatting on save** (the editor holds a rich document
and re-serializes Markdown). The plan treats Markdown fidelity as a first-class, tested feature from M1.

Working name: **`mdpad`** (placeholder — rename anytime; only appears in `package.json`, window title, userData path).

---

## Stack

| Concern | Choice |
|---|---|
| Shell / build | Electron + `electron-vite` (template `react-ts`), packaged with `electron-builder` (NSIS) |
| Language | TypeScript (strict) |
| UI chrome | React 19 (from the template) + plain CSS modules / CSS variables (no UI kit) |
| WYSIWYG editor | Milkdown v7 via `@milkdown/kit` + `@milkdown/react` (ProseMirror + remark under the hood) |
| Source mode | CodeMirror 6 + `@codemirror/lang-markdown` + `@codemirror/language-data` |
| Markdown pipeline (export, search) | unified: `remark-parse`, `remark-gfm`, `remark-math`, `remark-frontmatter`, `remark-rehype`, `rehype-katex`, `rehype-stringify` |
| Math / diagrams | KaTeX, Mermaid |
| File watching | `chokidar` (main process) |
| Tests | Vitest (+ happy-dom for headless Milkdown), Playwright `_electron` for E2E |
| Lint/format | ESLint + Prettier (from the electron-vite template) |

---

## Architecture

### Process model
```
main process (Node)                 preload (contextBridge)        renderer (React + Milkdown)
- windows, native menu, dialogs  <-> window.api.*  (typed)    <->  - UI shell, editor, outline
- file IO (atomic save), watch                                     - commands, keybindings
- autosave/recovery store                                          - themes
- settings.json, window state
- app-file:// protocol (local images)
```
Security defaults: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, strict CSP,
external links only via `shell.openExternal` after an `http(s):` check.

### Folder layout
```
src/
├── main/
│   ├── index.ts              # app lifecycle, single-instance lock, argv file open
│   ├── window.ts             # BrowserWindow creation, window-state persistence
│   ├── menu.ts               # native menu + accelerators → sends command ids to renderer
│   ├── ipc.ts                # registers all ipcMain.handle channels
│   ├── services/
│   │   ├── fileService.ts    # read (encoding/BOM/EOL detect), atomic write, watch
│   │   ├── recoveryService.ts# drafts + crash recovery in userData/recovery
│   │   ├── settingsService.ts# userData/settings.json (atomic write, schema defaults)
│   │   ├── imageService.ts   # save pasted/dropped images next to document
│   │   └── exportService.ts  # HTML export, printToPDF
│   └── protocol.ts           # app-file:// handler resolving relative to doc dir
├── preload/
│   └── index.ts              # exposes typed window.api
├── shared/
│   ├── ipc-types.ts          # channel names + request/response types (single source of truth)
│   └── commands.ts           # command id list shared by menu + renderer
└── renderer/src/          # electron-vite template keeps renderer code under src/renderer/src
    ├── main.tsx / App.tsx    # layout: sidebar | editor | status bar
    ├── state/                # document store (path, savedText, dirty, eol, bom), UI store
    ├── commands/             # command registry: id → handler; keybinding map
    ├── editor/
    │   ├── MilkdownEditor.tsx
    │   ├── config.ts         # presets, plugins, remarkStringifyOptions
    │   └── plugins/          # syntaxReveal, focusMode, typewriter, imagePaste, mathNode, mermaid…
    ├── source/SourceEditor.tsx
    ├── markdown/             # serialization options, frontmatter helpers, normalize-check
    ├── navigation/           # Outline.tsx, FileTree.tsx, QuickOpen.tsx, SearchPanel.tsx
    ├── themes/               # tokens.css, light.css, dark.css, code.css, print.css
    └── settings/             # SettingsPage.tsx, shortcuts editor
tests/
├── fixtures/                 # user's real notes + CommonMark/GFM samples + large-file sample
├── markdown/                 # round-trip tests (Vitest)
├── main/                     # fileService / recovery tests (Vitest, node env)
└── e2e/                      # Playwright Electron tests
docs/PLAN.md                  # copy of this plan
```

### Document model (renderer)
```ts
interface DocState {
  path: string | null;      // null = untitled
  savedText: string;        // exact text last read/written on disk
  eol: '\n' | '\r\n';       // detected on open, preserved on save
  bom: boolean;             // preserved on save
  dirty: boolean;           // set by Milkdown listener on real doc changes
  normalizesOnSave: boolean;// true if serialize(parse(savedText)) !== savedText
}
```
Fidelity rules:
1. **Untouched docs are never rewritten** — if `!dirty`, Save is a no-op.
2. On open, serialize once headlessly and compare; if it differs, show a subtle status-bar marker
   ("formatting will be normalized on save") with a "view diff" action.
3. Configure `remarkStringifyOptionsCtx` to the user's style: `bullet: '-'`, `emphasis: '*'`,
   `strong: '*'`, `rule: '-'`, `fences: true`, `listItemIndent: 'one'`, `setext: false`.
4. Preserve EOL, BOM, and trailing newline exactly.
5. Saves are atomic: write `file.tmp` → `fs.rename` over the original.

### IPC API (preload `window.api`)
- `file.openDialog()`, `file.read(path)`, `file.save(path, text, {eol, bom})`, `file.saveAsDialog(defaultName)`
- `file.watch(path)` / `onExternalChange(cb)` — reload prompt if changed on disk and doc is dirty, silent reload if clean
- `recovery.writeDraft(id, text)`, `recovery.list()`, `recovery.discard(id)`
- `settings.get()`, `settings.set(patch)`, `onSettingsChanged(cb)`
- `images.save(docPath, bytes, ext)` → returns relative path
- `folder.openDialog()`, `folder.list(path)`, `folder.watch(path)`, `folder.search(path, query)`
- `export.html(markdown, themeCss, outPath)`, `export.pdf(...)`
- `onMenuCommand(cb)` — menu clicks forwarded as command ids

---

## Milestones

Each milestone ends with a git commit/tag and a usable app.

### M0 — Project setup (½ day)
1. `git init`; `.gitignore` (node_modules, out, dist).
2. Scaffold: `npm create @quick-start/electron@latest . -- --template react-ts`; verify `npm run dev` opens a window.
3. Add Vitest + happy-dom, Playwright; scripts: `test`, `test:e2e`, `typecheck`, `lint`.
4. Copy this plan to `docs/PLAN.md`. Create `tests/fixtures/` and ask the user for 5–10 real notes.
- **Done when:** `npm run dev`, `npm test`, `npm run typecheck` all succeed on an empty app.

### M1 — Safe open/edit/save (core)
1. `fileService`: read with UTF-8 + BOM + EOL detection; atomic write; unit tests.
2. Milkdown editor with `commonmark` preset, `history`, `listener`, `clipboard`, `trailing`, `indent`, `cursor`.
3. Document store + dirty tracking; title bar `filename — mdpad` with `●` when dirty.
4. Native menu: File (New, Open, Save, Save As, Close Window, Exit), Edit (Undo/Redo/Cut/Copy/Paste/Select All).
   Shortcuts Ctrl+N/O/S/Shift+S/Z/Y.
5. Unsaved-changes guard on window close (Save / Don't Save / Cancel).
6. Open file from command line / "Open with" (`process.argv`, `second-instance`).
7. Stringify options + fidelity rules 1–5 above; normalize-check marker in status bar.
8. Round-trip tests: for every fixture, `serialize(parse(x))` equals `x` or a committed
   `*.expected.md`; plus idempotency `f(f(x)) === f(x)`.
9. Minimal readable theme (centered column, ~760px max width, system fonts with CJK fallback
   `"Segoe UI", "Microsoft YaHei", sans-serif`).
- **Done when:** every real-note fixture survives open → edit one word → save with only that word changed in `git diff`.

### M2 — Typora feel
1. **Input rules** (from commonmark preset, verify): `# ` headings, `> ` quotes, `- `/`1. ` lists, ```` ``` ```` fences, `---` rule, `**x**`/`*x*`/`` `x` `` inline.
   Guard custom rules with `view.composing` so IME input isn't broken.
2. **Syntax reveal plugin** (`editor/plugins/syntaxReveal.ts`): ProseMirror decorations that show
   `**`, `*`, `` ` ``, `[]()`, and heading `#` markers as faded widget decorations when the cursor is inside that
   mark/heading; hidden otherwise.
3. **Formatting shortcuts**: Ctrl+1…6 heading level, Ctrl+0 paragraph, Ctrl+B/I/U(none)/Shift+` code,
   Ctrl+K link, Ctrl+Shift+Q quote, Ctrl+Shift+[ / ] lists, Ctrl+Shift+K code block.
   Paragraph & Format menus mirror these.
4. **Links**: link tooltip component (edit/open); Ctrl+click opens external URL or `.md` file.
5. **Outline panel** (`navigation/Outline.tsx`): headings from doc (debounced on update), click to jump,
   active heading follows cursor; toggle Ctrl+Shift+1.
6. **Source mode** (Ctrl+/): swap to CodeMirror with current Markdown; switch back re-parses. Keep scroll ratio.
7. **Polished light theme**: design tokens in `themes/tokens.css` (type scale, spacing, colors),
   heading scale, list/quote/hr styling, selection color, focus ring.
8. **Status bar**: word/char count, normalize marker, save state.
- **Done when:** user can write a typical note entirely by keyboard without seeing raw syntax except where the cursor is.

### M3 — Daily driver
1. **GFM**: `gfm` preset — tables, task lists, strikethrough, autolinks. Table block component:
   Tab/Shift+Tab cell nav, Enter new row, insert/delete row/col toolbar, column alignment. Ctrl+T insert table.
2. **Code blocks**: kit `code-block` component (CodeMirror inside) with language picker + highlighting via `@codemirror/language-data`.
3. **Images**: `app-file://` protocol so relative paths render; paste/drag → `imageService` saves to
   `./<docname>.assets/image-YYYYMMDD-HHmmss.png`, inserts relative link; untitled docs prompt to save first.
   Image block component for resize-free display + alt text edit.
4. **Find/replace in document** (Ctrl+F / Ctrl+H) using `prosemirror-search`.
5. **Autosave + recovery**: debounced (2s) save for files with a path (setting, default on);
   untitled/dirty drafts mirrored to `userData/recovery/` every 5s; on startup offer to restore.
6. **External change handling** via `file.watch`.
7. **Front matter** (`remark-frontmatter`) preserved verbatim and shown as a collapsible YAML block.
8. **Packaging**: `electron-builder` NSIS installer with `.md`/`.markdown` file association; run the installed build daily.
- **Done when:** user uses the installed app as their main note editor for a week with no lost or mangled content.

### M4 — Workspace & appearance
1. **Folder mode**: Open Folder → sidebar file tree (chokidar-watched), create/rename/delete (to Recycle Bin via `shell.trashItem`).
2. **Quick open** (Ctrl+P) fuzzy file search; **search across folder** (Ctrl+Shift+F) with result list.
3. Sidebar tabs: Files | Outline; toggle Ctrl+Shift+L.
4. **Dark theme** + theme switcher (Light / Dark / Follow system via `nativeTheme`); user theme CSS folder in userData.
5. **Settings page** (`settings/SettingsPage.tsx`): font, font size, line width, autosave, image folder pattern,
   stringify style options, theme. **Custom shortcuts** stored in settings, applied to menu + keymap.
6. Optional: custom title bar (`titleBarStyle: 'hidden'` + `titleBarOverlay`) with menu in a hamburger, Typora-style.
7. Recent files / folders in File menu.

**As built (M4):** folder watching uses Node's recursive `fs.watch` (no chokidar); the sidebar
has a third tab, Search; user CSS is a single `userData/custom.css` (re-applied on save)
rather than a themes folder; Preferences is a dialog (`settings/SettingsDialog.tsx`) covering
theme, font, font size, text width, autosave and shortcuts. Not done: image folder pattern,
stringify style options (both would change what gets written to files, so they wait until
there is a reason), and the optional custom title bar. All shortcuts, including New/Open/Close,
are now handled by the renderer keymap so they can be customised.

### M5 — Extras
1. **Math**: `remark-math` + KaTeX node views for `$inline$` and `$$block$$` (edit source when focused, render when not).
2. **Mermaid**: code blocks with lang `mermaid` show rendered diagram below when not focused.
3. **Footnotes**, highlight `==x==` (custom remark plugin), sub/sup if wanted.
4. **Export**: HTML (unified pipeline + inlined theme + KaTeX CSS) and PDF (hidden window → `webContents.printToPDF`, `print.css`).
5. **Focus mode** (F8: dim all but current block) and **typewriter mode** (F9: keep caret line centered).
6. Performance pass with a ~1 MB fixture: measure open time, typing latency; debounce outline/word count.

---

## Testing strategy

- **Round-trip (Vitest, happy-dom)** — `tests/markdown/roundtrip.test.ts`: headless Milkdown instance;
  fixtures + `*.expected.md` snapshots for intentional normalizations; idempotency check. Runs on every change.
- **Main services (Vitest, node)** — `tests/main/fileService.test.ts`: BOM/EOL preservation, atomic write
  (no partial file on simulated failure), recovery write/list/discard in a temp dir.
- **E2E (Playwright `_electron.launch`)** — `tests/e2e/`: type `## Hi` → `<h2>`; Ctrl+B toggles bold; Ctrl+S writes
  expected text to a temp file; close-with-unsaved shows dialog; table Tab navigation; paste image creates file in `.assets`.
- **Manual checklist per milestone** — Microsoft Pinyin / Japanese IME composition inside bold, lists, tables;
  undo/redo across formatting; window resize; dark mode contrast.

## Verification (end-to-end, each milestone)

1. `npm run typecheck && npm run lint && npm test` — all green.
2. `npm run test:e2e` — all green.
3. `npm run dev`, open each fixture, edit one word, save, `git diff tests/fixtures` shows only that word.
4. Run the milestone's "Done when" scenario manually (from M3 on, using the packaged installer build).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Re-serialization changes user formatting | Fidelity rules, stringify options, round-trip tests, no-op save when clean, normalize marker, source mode |
| IME/composition bugs from custom input rules | `view.composing` guards; manual IME checklist |
| Syntax-reveal plugin complexity | Ship M2 without it if blocked; it's additive (decorations only, doesn't touch doc) |
| Milkdown API changes between versions | Pin exact versions in `package.json`; upgrade deliberately |
| Local images blocked by CSP/sandbox | Dedicated `app-file://` protocol scoped to document/folder directories |
