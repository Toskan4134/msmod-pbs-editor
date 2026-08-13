# Changelog

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
