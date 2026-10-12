# Typora UI & Design Reference

A local reference for designing an independent Markdown editor inspired by Typora's interface and organization.

## Installation inspected

- **Application:** Typora for Windows, version **1.14.10** (from `resources/package.json`)
- **Install folder:** `C:\Program Files\Typora`
- **Architecture indicated by the files:** Electron/Chromium desktop application
- **Purpose of this note:** record useful locations and design areas to study. This is not a copy of Typora's source code.

## Installation structure

```text
C:\Program Files\Typora\
├── Typora.exe                         # Desktop application executable
├── locales\                           # Chromium/Electron locale resources
└── resources\
    ├── appsrc\                         # Some application-side files
    │   ├── editor\                     # Editor-related resource(s)
    │   ├── window\                     # Window-side bundled code
    │   └── finder-worker.js
    ├── app.asar                         # Packaged application resources
    ├── lib.asar                         # Packaged library resources
    ├── window.html                      # Main window markup
    ├── html\                           # Content and preview templates
    ├── style\                          # Shared UI styles and icons
    │   ├── base.css
    │   ├── base-control.css
    │   ├── window.css
    │   ├── megamenu.css
    │   ├── codemirror.css
    │   └── themes\                      # Built-in document themes
    ├── page-dist\                       # Settings, welcome, and app pages
    ├── Docs\                            # User guides and Markdown reference
    └── conf.default.json                # Default configuration
```

The installed copy is packaged and does not expose the full application as a clean, modular source tree. For example, `appsrc/window/frame.js` is a very large bundled file; `.asar` files are packaged resources.

## Useful local reference files

| Location | What it may help you study |
|---|---|
| `resources\window.html` | Main application window markup and high-level UI structure |
| `resources\style\base.css` | Shared interface styles |
| `resources\style\base-control.css` | Controls and reusable UI styling |
| `resources\style\window.css` | Window-level appearance |
| `resources\style\megamenu.css` | Menu styling |
| `resources\style\themes\` | Document appearance and theme variation |
| `resources\html\content.html` | Document/content template |
| `resources\html\preview.html` | Preview-related template |
| `resources\Docs\Markdown Reference.md` | Markdown features to consider supporting |
| `resources\Docs\Custom Themes.md` | Typora theme customization guidance |
| `resources\Docs\Custom Shortcut Keys.md` | Shortcut customization guidance |
| `resources\Docs\Table Editing.md` | Table interaction reference |
| `resources\Docs\Auto Save, Version Control and Recovery.md` | Saving and recovery behavior reference |

Built-in theme folders/files observed include **GitHub**, **Night**, **Newsprint**, **Pixyll**, and **Whitey**. Theme assets include CSS and, in some cases, bundled fonts.

## UI and design qualities to examine in the running app

Use the application itself to observe these details; the installation file names alone do not establish exact visual behavior.

- **Writing canvas:** page width, margins, line length, paragraph spacing, and focus behavior.
- **Inline editing:** how headings, emphasis, lists, links, and code look while the cursor is in or near them.
- **Document hierarchy:** heading scale, indentation, blockquotes, dividers, and nested lists.
- **Tables:** creation, cell navigation, resizing, and editing controls.
- **Code blocks:** language selection, syntax coloring, spacing, and overflow handling.
- **Menus and toolbar:** command grouping, discoverability, keyboard shortcuts, and contextual actions.
- **Outline/navigation:** heading navigation and synchronization with the current cursor position.
- **Themes:** color, typography, spacing, and code styles as a coherent, switchable system.
- **Window behavior:** title bar, tabs or document switching, side panels, and resize states.
- **Polish and accessibility:** focus indicators, selection contrast, empty states, keyboard-only operation, and reduced-motion behavior.

## Suggested structure for an independent editor

Keep your implementation modular rather than copying the packaging layout:

```text
src/
├── app/             # Window shell, menus, app lifecycle
├── editor/          # Editing surface, selection, keyboard handling
├── markdown/        # Parsing, rendering, serialization
├── documents/       # Open/save, tabs, autosave, recovery
├── navigation/      # Outline and document navigation
├── themes/          # Theme definitions and shared design tokens
└── settings/        # Preferences and shortcuts
tests/
├── markdown/        # Parsing and round-trip tests
└── editor/          # Interaction and keyboard tests
```

## Practical design principles to carry forward

1. Make the document the visual focus; keep application chrome quiet.
2. Use consistent typography, spacing, and readable line lengths.
3. Treat light/dark appearance as a complete theme system, not a one-off color swap.
4. Make Markdown structures easy to recognize without making the source syntax dominate the page.
5. Keep mouse interactions discoverable while making common editing actions efficient by keyboard.
6. Preserve user content reliably with clear save status and recovery behavior.
7. Test editing and serialization together so formatting does not silently damage Markdown source.

## Notes and boundaries

- The folder listing was inspected locally. The running app's screenshots and detailed visual states have **not** been recorded in this note yet.
- Use Typora as a UI/behavior reference; build your own implementation and assets. Do not modify the installation under `C:\Program Files\Typora`.
- Before inspecting or reusing bundled resources in a distributed product, review Typora's license and applicable terms.
