# PBS Editor

A Maker Studio mod that provides a full-featured editor for Pokémon Essentials PBS files
directly inside the map editor. Supports v16, v17, and v21 data formats.

### What it does

1. Registers a **Mods → PBS Editor...** menu item (shortcut **Ctrl+Shift+P**) that opens
   a large dialog.
2. The dialog has a 3-column layout: **file-type sidebar** | **sortable table with
   pagination** | **sprite preview + field editor**.
3. Reads and writes PBS files from the project's `PBS/` directory via the mod API
   (`ctx.fs.readProjectFile` / `ctx.fs.writeProjectFile`).
4. Detects the Essentials version from `pokemon.txt` format and lets you switch between
   v16 / v17 / v21 in the toolbar, plus a separate **LBDS** entry for La Base de Sky's
   v21 + JSON PBS + field-level merge behavior. Picking plain **v21** always parses
   vanilla Essentials semantics — no JSON files, no cross-file field merge, duplicate
   sections listed as-is — even if `.json` PBS files exist in `PBS/`.
   - On first run (nothing saved yet), the toolbar pre-selects **LBDS** automatically
     when `ctx.editor.isLbdsProject()` reports the project runs an LBDS integration
     build (needs Maker Studio with that API; older builds just keep the v21 default).
     A saved choice always wins — the guess never overrides a pick you already made.
5. Picks up **extra PBS files** the same way the Essentials compiler does: `<base>_*.txt`
   (e.g. `pokemon_juego.txt`) is loaded alongside `pokemon.txt`, and each entry is saved
   back to the file it came from, so packs don't get overwritten. The longest base name
   wins, so `pokemon_metrics.txt` is never mistaken for a `pokemon` extra.
   - **JSON PBS (La Base de Sky, v21+)**: `.json` PBS files are read and written too.
     A `.txt` always shadows a same-named `.json` (same rule as the compiler).
     A section repeated in a later file is **merged field-by-field** (compiler
     semantics): the table shows the effective data and each field saves back to
     its own file, so an override `.json` stays minimal. Stats and
     Moves/Evolutions are written as positional arrays, and `!exclude` has no
     JSON representation (excluded entries in a `.json` save back as normal
     entries). Encounters/trainers compile as whole-section replacement, so
     duplicates stay listed separately (use the file filter to tell them apart).
   - **Per-file ownership colors**: with the file filter set to one file, fields it
     doesn't own show their inherited (merged) value grayed out and tagged with the
     real owner, plus an **Override here** button that starts owning the field in
     that file. With **All files** selected, fields whose effective value comes
     from a non-base file are tagged and accent-colored so an override is visible
     without switching tabs. Table cells get the same coloring. Editing a field
     that's still shown as inherited always writes back to whichever file
     currently owns it — `Override here` is the only way to change that.
6. Supports **11 file types**: Pokemon, Pokemon Forms, Moves, Abilities, Items, Types,
   Encounters, Trainers, Trainer Types, Town Map, and TM (v16/v17 only).
7. Provides typed field editors for each file type — stat bars, EV dropdowns, list editors
   with autocomplete from other loaded files, BGM file pickers, evolution triplets, etc.
8. **Cross-reference navigation**: "Go to" buttons on reference fields jump to the
   referenced entry in another PBS file, with back/forward history.
9. **Sprite preview** shows front/back/shiny graphics for Pokemon and Trainer sprites,
   including animated spritesheet playback using `pokemon_metrics.txt` speed data.
10. Full CRUD: add, duplicate, delete, toggle exclude (`!exclude`) via context menu.
11. Unsaved-change tracking with dirty indicator, confirmation on close/switch, and
    **Ctrl+S** save.

### Supported PBS files

| File type | v16 | v17 | v21 | Format |
|---|---|---|---|---|
| Pokemon | `pokemon.txt` | `pokemon.txt` | `pokemon.txt` | Section (v21) / ID section (v16) |
| Pokemon Forms | — | `pokemonforms.txt` | `pokemon_forms.txt` | Section |
| Moves | `moves.txt` | `moves.txt` | `moves.txt` | CSV (v16) / Section (v21) |
| Abilities | `abilities.txt` | `abilities.txt` | `abilities.txt` | CSV (v16) / Section (v21) |
| Items | `items.txt` | `items.txt` | `items.txt` | CSV (v16) / Section (v21) |
| Types | `types.txt` | `types.txt` | `types.txt` | ID section |
| Encounters | `encounters.txt` | `encounters.txt` | `encounters.txt` | Block |
| Trainers | `trainers.txt` | `trainers.txt` | `trainers.txt` | Block |
| Trainer Types | `trainertypes.txt` | `trainertypes.txt` | `trainer_types.txt` | CSV (v16) / Section (v21) |
| Town Map | `townmap.txt` | `townmap.txt` | `town_map.txt` | ID section |
| TM | `tm.txt` | `tm.txt` | — | Section |

### Concepts covered

| Concept | API used |
|---|---|
| Menu items | `ctx.menu.registerMenuItem(...)` |
| Custom dialogs | `ctx.ui.showCustomDialog({ title, width, height, render })` |
| Confirm dialogs | `ctx.ui.showConfirmDialog(...)` |
| Input dialogs | `ctx.ui.showInputDialog(...)` |
| Toast notifications | `ctx.ui.showToast(...)` |
| File I/O | `ctx.fs.readProjectFile(...)`, `ctx.fs.writeProjectFile(...)`, `ctx.fs.listProjectDir(...)` |
| Persistent storage | `ctx.storage.get(...)`, `ctx.storage.set(...)` |
| Game root path | `ctx.editor.gameRoot()` |
| Tauri IPC | `window.__TAURI__.core.invoke('read_binary_file', ...)` |
| Vanilla DOM rendering | `render(host: HTMLElement)` — no framework |
| Dialog close interception | Override `dialog.close` for unsaved-changes guard |

### File structure

| File | Purpose |
|---|---|
| `manifest.json` | Mod metadata, permissions (`fs.project`, `fs.write.project`, `ui.dialogs`, `ui.toasts`) |
| `index.js` | Entry point — `activate(ctx)`, menu registration, dialog lifecycle |
| `editor.js` | `PbsEditor` class — main UI controller (3-column layout, table, detail, save, CRUD) |
| `parsers.js` | Pure parsers: PBS text → structured data per file type and version |
| `writers.js` | Pure writers: structured data → PBS text per file type and version |
| `json.js` | JSON PBS support (La Base de Sky): JSON ↔ entry model, reusing the v21 parsers |
| `components.js` | Barrel — re-exports everything under `components/` |
| `components/dom.js` | Core DOM helpers — `h`, buttons, search, autocomplete, type-icon indicators, context menu, shared i18n (`_t`) |
| `components/table.js` | Table, pagination, preview panel, collapsible sections |
| `components/field-editor.js` | Typed field editor + list / pairs / triplets / stats / EVs / BGM sub-editors |
| `components/editors.js` | Specialized sub-entity editors — encounters, trainer pokemon |
| `file-types.js` | Per-file-type field definitions, column configs, graphic paths, reference maps |
| `styles.js` | All CSS as a template string |

### Try it

1. Copy this folder into `<gameRoot>/Plugins/MakerStudio/003_Editor/Mods/`.
2. Open the project in the editor.
3. Go to **Mods → PBS Editor...** (or press **Ctrl+Shift+P**).
4. Select a file type from the sidebar — the table populates from the project's PBS files.
5. Click a row to edit in the detail panel. Click a "Go to" arrow to navigate to a
   referenced entry.
6. Press **Ctrl+S** or the Save button to write changes back.
