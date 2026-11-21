# Changelog

## [Unreleased]

- Refresh the open PBS category when files change on disk and offer Cancel, Discard, or Overwrite when saving over external changes.
- Update type badges immediately when a type field changes.

- Animated Pokémon table icons and trainer sprites. Linked the Forms species field to Pokémon entries.

- Added multi-row selection across pages and batch duplicate, delete, and exclude/include.
- Added adjustable page sizes, trainer portraits, and columns that fit the available width.

- Fit columns to all records and distribute extra table width evenly before manual resizing.
- Added direct entry actions and keyboard shortcuts, game-provided move category graphics, and individual flag editors for v21 and LBDS.

- Added resizable table columns, scrolling labels, move category icons and compact switches.
- Fixed sprite preview alignment, numbering across additional PBS files and first-step history navigation.

- Updated the PBS Editor to match Maker Studio controls and themes, with a compact view for narrow dialogs.
- Improved keyboard navigation, entry actions, and reference autocomplete.
- Added a save, discard, or cancel prompt when switching PBS types or Essentials versions. Read errors block saving the affected file type.

## [1.6.1]

PBS Editor now uses the Maker Studio Mod Free Distribution License. The mod
and corresponding source are available free of charge. Earlier releases retain
their published license terms.

## [1.6.0] - 2026-08-13

### Added
- JSON PBS support (La Base de Sky): `.json` PBS files are read and written, with field-by-field merge across files matching compiler semantics.
- Per-file ownership indicators: fields inherited from another file show their source, grayed out, with an "Override here" button; table cells get matching accent coloring.
- Row icons (party/PC icons) for Pokemon and Items in the table.
- Sprite preview variants (front/back/shiny) derived from a single graphic-path formula per Essentials version.
- Type-list and stat-bar renderers for table columns (Types, Base Stats).

### Fixed
- Detail pane no longer clips content in narrow windows — panel can shrink and its field grid collapses to a single column instead of overflowing.
- Consumable and Show Quantity checkboxes render correctly instead of using default browser styling.

### Changed
- General UI polish: tighter table column widths, dash placeholder for empty numeric fields (Power/Accuracy).

## [1.5.0] - 2026-07-27
- Extended PBS file filter for v21 (multi-file PBS support).
- Code clean-up and UI improvements.
- Added mod icon.

## [1.3.1] - 2026-07-15
- Fix for Evolution editor in multiline mode — preserves original order and separators.

## [1.3.0] - 2026-07-14
- Town map previews, extra PBS file detection, evolution editor fixes.
- Data-driven evolution method/param editor.
- Stop dropping Evolution and unmodeled PBS keys on save.

## [1.2.0] - 2026-06-12
- Spanish translation.
- Replaced emoji icons with SVG icons.

## [1.1.1] - 2026-06-03
- Document icon, renamed menu item to "Open PBS Editor".

## [1.1.0] - 2026-05-31
- Type icons, BST sum on stats display, fixed form icons showing base Pokemon, trainer type sprite on trainer entries.

## [1.0.0] - 2026-05-28
- Initial release.
