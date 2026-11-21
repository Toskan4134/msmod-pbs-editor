/**
 * CSS styles for PBS Editor v2 — dialog-based layout.
 */

export const CSS = `
.pbs-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: inherit;
  font-size: var(--font-md, 12px);
  color: var(--text-primary);
  background: var(--bg-primary);
  overflow: hidden;
}

/* ---- Toolbar ---- */
.pbs-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3, 6px);
  padding: var(--space-3, 6px) var(--space-4, 8px);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.pbs-toolbar-sep {
  width: 1px;
  height: 18px;
  background: var(--border);
}
.pbs-toolbar-spacer { flex: 1; }
.pbs-search {
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md, 4px);
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: var(--font-md, 12px);
  width: 200px;
  outline: none;
}
.pbs-search:focus { border-color: var(--accent); }
.pbs-search::placeholder { color: var(--text-tertiary); }
.pbs-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: var(--control-h-md, 26px);
  padding: 0 var(--space-4, 8px);
  border: 1px solid var(--border);
  border-radius: var(--radius-md, 4px);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: var(--font-sm, 11px);
  cursor: pointer;
  white-space: nowrap;
}
.pbs-btn:hover:not(:disabled) { background: var(--bg-hover); color: var(--text-primary); }
.pbs-btn.accent { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }
.pbs-btn.accent:hover:not(:disabled) { background: var(--accent-hover); }
.pbs-btn.danger { color: var(--danger); border-color: var(--danger); }
.pbs-btn.danger:hover:not(:disabled) { background: var(--danger); color: var(--accent-text); }
.pbs-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.pbs-file-filter-bar { display: flex; align-items: center; }

/* ---- Main 3-column layout ---- */
.pbs-main {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ---- File sidebar ---- */
.pbs-sidebar {
  width: 152px;
  min-width: 100px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  flex-shrink: 0;
}
.pbs-sidebar-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: var(--control-h-md, 26px);
  border: 0;
  background: transparent;
  font-family: inherit;
  text-align: left;
  padding: var(--space-3, 6px) var(--space-4, 8px);
  cursor: pointer;
  color: var(--text-secondary);
  font-size: var(--font-sm, 11px);
  transition: background 0.1s;
  gap: 4px;
}
.pbs-sidebar-item:hover:not(:disabled) { background: var(--bg-hover); color: var(--text-primary); }
.pbs-sidebar-item.active {
  background: var(--accent-muted);
  color: var(--text-primary);
  font-weight: 600;
  box-shadow: inset 3px 0 0 var(--accent);
}
.pbs-sidebar-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pbs-sidebar-badge {
  font-size: var(--font-sm, 11px);
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  padding: 1px 5px;
  border-radius: 8px;
  min-width: 18px;
  text-align: center;
  flex-shrink: 0;
}
.pbs-sidebar-item.active .pbs-sidebar-badge {
  background: var(--accent-muted);
  color: var(--accent);
}

/* ---- Center: table + pagination ---- */
.pbs-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  border-right: 1px solid var(--border);
}
.pbs-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden auto;
}
.pbs-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.pbs-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 5px 8px;
  text-align: left;
  font-size: var(--font-sm, 11px);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pbs-table th:hover { color: var(--text-primary); }
.pbs-sort-arrow { display: inline-flex; flex: none; color: var(--accent); }
.pbs-table td {
  height: 44px;
  box-sizing: border-box;
  padding: 4px 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
  color: var(--text-secondary);
  font-size: var(--font-md, 12px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}
.pbs-table tr:hover td { background: var(--bg-hover); }
.pbs-table tr.selected td {
  background: var(--accent-muted);
  color: var(--text-primary);
}
.pbs-table tr.selected td:first-child {
  box-shadow: inset 3px 0 0 var(--accent);
}

/* ---- Row icon column (Pokemon/Items/Trainers) ---- */
.pbs-table td.pbs-icon-cell, .pbs-table th.pbs-icon-cell { padding: 2px 4px; text-align: center; text-overflow: clip; }
.pbs-selection-count:empty { display: none; }
.pbs-icon-img, .pbs-icon-cell canvas {
  width: 34px;
  height: 34px;
  object-fit: contain;
  image-rendering: pixelated;
  display: block;
  margin: 0 auto;
}

/* ---- Type badges (table cell) ---- */
/* The <td> itself stays a plain table-cell (default display) — border-bottom
   and column width both depend on that. The flex row lives on the inner div;
   display:flex set directly on a <td> drops it out of table layout in this
   webview (column bleeds into its neighbor, border disappears). */
.pbs-table td.pbs-type-cell { padding: 0 6px; }
.pbs-type-cell-inner {
  display: flex;
  gap: var(--space-1, 2px);
  align-items: center;
  flex-wrap: wrap;
  padding-block: var(--space-2, 4px);
}
.pbs-type-pill {
  display: inline-block;
  flex-shrink: 0;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 700;
  border: 1px solid;
  line-height: 1.5;
  white-space: nowrap;
}

/* ---- Mini stat bar (table cell) ---- */
.pbs-table td.pbs-statbar-cell { padding: 0 6px; }
.pbs-statbar-cell-inner { display: flex; align-items: center; gap: 10px; height: 100%; }
.pbs-mini-statbar { display: flex; align-items: flex-end; gap: 3px; height: 34px; flex-shrink: 0; }
.pbs-mini-statbar-seg { width: 8px; min-height: 2px; border-radius: 1px; }
.pbs-mini-statbar-total { font-size: 13px; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.pbs-table tr.excluded td {
  opacity: 0.4;
  text-decoration: line-through;
}
.pbs-table tr:nth-child(even) td {
  background: color-mix(in srgb, var(--bg-primary) 95%, var(--bg-secondary));
}
.pbs-table tr:nth-child(even):hover td,
.pbs-table tr:nth-child(even).selected td {
  background: var(--bg-hover);
}

/* ---- Pagination ---- */
.pbs-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 5px 8px;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  font-size: var(--font-sm, 11px);
  color: var(--text-secondary);
}
.pbs-page-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2, 4px);
  padding: 2px 8px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: var(--font-sm, 11px);
}
.pbs-page-icon { display: inline-flex; flex: none; }
.pbs-page-btn:hover:not(:disabled) { background: var(--bg-hover); color: var(--text-primary); }
.pbs-page-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* ---- Right: preview + detail ---- */
.pbs-right {
  width: 440px;
  min-width: 320px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* flex-shrink:0 here pinned the pane at exactly 440px no matter how narrow
     the window got — .pbs-main's overflow:hidden then silently clipped
     whatever didn't fit instead of letting the pane shrink toward
     min-width like it's supposed to. */
  flex-shrink: 1;
  background: var(--bg-secondary);
}

/* ---- Drag handle between table and detail pane (user-resizable width) ---- */
.pbs-resizer {
  width: 5px;
  flex-shrink: 0;
  cursor: col-resize;
  background: var(--border);
  position: relative;
}
.pbs-resizer::after {
  content: '';
  position: absolute;
  inset: 0 -3px;
}
.pbs-resizer:hover, .pbs-resizer.dragging { background: var(--accent); }

/* ---- Preview pane ---- */
.pbs-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  min-height: 160px;
  position: relative;
}
.pbs-preview-img {
  max-width: 128px;
  max-height: 128px;
  image-rendering: pixelated;
  background-size: 12px 12px;
  background-position: 0 0, 0 6px, 6px -6px, -6px 0px;
  border-radius: var(--radius-md, 4px);
}
.pbs-preview-map {
  max-width: 100%;
  max-height: 320px;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: var(--radius-md, 4px);
}
.pbs-preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--text-tertiary);
  font-size: var(--font-sm, 11px);
}
.pbs-preview-placeholder-icon {
  font-size: 32px;
  opacity: 0.3;
}
.pbs-preview-name {
  position: absolute;
  bottom: 4px;
  left: 8px;
  font-size: var(--font-sm, 11px);
  color: var(--text-tertiary);
}

/* ---- Pokemon front + back preview ---- */
/* Back bottom-anchors here (PictureOrigin::BOTTOM in-game); front overrides
   to align-self:center below (PictureOrigin::CENTER — it floats, no
   per-species correction, unlike back's SpeciesMetrics nudge). */
.pbs-preview-pokemon {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.pbs-preview-pokemon-slot {
  display: flex;
  align-items: center;
  justify-content: center;
}
.pbs-preview-pokemon-front { align-self: center; }
.pbs-preview-shiny-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 3px 9px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: var(--font-sm, 11px);
  font-weight: 600;
  cursor: pointer;
}
.pbs-preview-shiny-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--text-primary); }
.pbs-preview-shiny-btn.active { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }

/* ---- Detail panel ---- */
.pbs-detail {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
.pbs-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
  font-size: var(--font-sm, 11px);
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.pbs-detail-body {
  padding: 8px 10px;
  display: grid;
  /* auto-fit instead of a hard 1fr 1fr: on a narrow pane (small window, or
     the user dragged the resizer down) this collapses to a single column on
     its own instead of squeezing two 150px+ columns into less room than
     that and overflowing sideways. */
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 5px 14px;
}

/* ---- Form fields ---- */
.pbs-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  margin-top: 10px;
}
.pbs-field.full-width { grid-column: 1 / -1; }
.pbs-field label {
  font-size: var(--font-sm, 11px);
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
/* ---- Multi-file ownership (LBDS field-by-field merge) ---- */
.pbs-field-label-row { display: flex; align-items: center; gap: 6px; }
.pbs-field-tag {
  font-size: 9px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  text-transform: none;
  letter-spacing: 0;
  white-space: nowrap;
}
.pbs-field-adopt {
  font-size: 9px;
  padding: 1px 5px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg-hover);
  color: var(--text-secondary);
  cursor: pointer;
  margin-left: auto;
}
.pbs-field-adopt:hover:not(:disabled) { border-color: var(--accent); color: var(--text-primary); }
/* Filtered to one file: fields it doesn't own show the inherited value, muted
   and non-interactive — "Override here" is the only live control. */
.pbs-field-inherited .pbs-field-tag { background: var(--bg-hover); color: var(--text-tertiary); }
.pbs-field-inherited input,
.pbs-field-inherited select,
.pbs-field-inherited textarea,
.pbs-field-inherited .pbs-switch,
.pbs-field-inherited :is(.pbs-list-editor, .pbs-stat-row) :is(input, select, button):not(.pbs-field-adopt) {
  opacity: 0.55;
  pointer-events: none;
}
/* All-files view: field's effective value comes from a non-base file — still
   fully editable, just flagged so the override is visible without switching tabs. */
.pbs-field-overridden .pbs-field-tag { background: var(--accent-muted); color: var(--accent-text); }
.pbs-field-overridden input,
.pbs-field-overridden select,
.pbs-field-overridden textarea { border-color: var(--accent); }
.pbs-cell-inherited { color: var(--text-tertiary); font-style: italic; }
.pbs-cell-overridden { color: var(--accent-text); font-weight: 600; }
.pbs-field input,
.pbs-field select,
.pbs-field textarea {
  padding: 3px 6px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: var(--font-md, 12px);
  font-family: inherit;
  outline: none;
  width: 100%;
}
.pbs-field input:focus,
.pbs-field select:focus,
.pbs-field textarea:focus { border-color: var(--accent); }
.pbs-field textarea { min-height: 140px; resize: vertical; }
.pbs-field input[type="number"] { width: 70px; }
.pbs-field select {
  -webkit-appearance: none;
  appearance: none;
  background-color: var(--input-bg);
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888888'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 8px auto;
  padding-right: 22px;
  color: var(--text-primary);
}

/* ---- Collapsible section ---- */
.pbs-section-toggle {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
  margin-top: 12px;
  border-top: 1px solid var(--border);
  cursor: pointer;
  color: var(--text-secondary);
  font-size: var(--font-sm, 11px);
  font-weight: 600;
  border-left: none;
  border-right: none;
  border-bottom: none;
  background: none;
  font-family: inherit;
  width: 100%;
  text-align: left;
}
.pbs-section-toggle:hover:not(:disabled) { color: var(--text-primary); }
.pbs-section-arrow { font-size: 9px; transition: transform 0.15s; }
.pbs-section-arrow.open { transform: rotate(90deg); }
.pbs-section-arrow.open + span { color: var(--accent); }
.pbs-section-body { grid-column: 1 / -1; padding-bottom: 8px; }

/* ---- List editor ---- */
.pbs-list-editor {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pbs-list-row {
  margin-bottom: 4px;
  display: flex;
  gap: 4px;
  align-items: center;
}
.pbs-list-row input {
  padding: 2px 4px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: var(--font-md, 12px);
  outline: none;
  flex: 1;
  min-width: 0;
}
.pbs-list-row input:focus { border-color: var(--accent); }
.pbs-list-remove {
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
  line-height: 1;
}
.pbs-list-remove:hover:not(:disabled) { color: var(--danger); }
.pbs-goto-btn { color: var(--text-tertiary); }
.pbs-goto-btn:not(:disabled):is(:hover, :focus-visible) { color: var(--accent); }
.pbs-list-add {
  background: transparent;
  border: 1px dashed var(--border);
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: var(--font-sm, 11px);
  padding: 2px 6px;
  border-radius: 3px;
  text-align: center;
}
.pbs-list-add:hover:not(:disabled) { color: var(--accent); border-color: var(--accent); }

/* ---- Stat bars ---- */
.pbs-stat-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 1px 0;
}
.pbs-stat-label {
  width: 32px;
  font-size: var(--font-sm, 11px);
  font-weight: 600;
  color: var(--text-tertiary);
  text-align: right;
}
.pbs-stat-bar-bg {
  flex: 1;
  height: 6px;
  background: var(--bg-tertiary);
  border-radius: 3px;
  overflow: hidden;
}
.pbs-stat-bar-fill {
  height: 100%;
  border-radius: 3px;
}
.pbs-stat-value {
  width: 28px;
  font-size: var(--font-sm, 11px);
  color: var(--text-secondary);
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* ---- BST row ---- */
.pbs-stat-bst-row {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
}
.pbs-stat-bst-row .pbs-stat-label {
  font-weight: 700;
  color: var(--text-secondary);
}
.pbs-stat-bst-row .pbs-stat-value {
  font-weight: 700;
  color: var(--text-secondary);
}

/* ---- Type badge ---- */
.pbs-tag {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: var(--font-sm, 11px);
  font-weight: 600;
}

/* ---- Sub-section (encounters, trainer pokemon) ---- */
.pbs-subsection {
  border: 1px solid var(--border);
  border-radius: var(--radius-md, 4px);
  margin: 3px 0;
  overflow: hidden;
}
.pbs-subsection-header {
  padding: 3px 8px;
  background: var(--bg-tertiary);
  font-weight: 600;
  font-size: var(--font-sm, 11px);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}
.pbs-subsection-body { padding: 4px 8px; }

/* ---- Context menu ---- */
.pbs-ctx-menu {
  position: fixed;
  z-index: var(--z-context, 19999);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 0;
  box-shadow: 0 4px 12px var(--shadow);
  min-width: 150px;
}
.pbs-ctx-item {
  display: block;
  width: 100%;
  padding: 4px 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-md, 12px);
  font-family: inherit;
  cursor: pointer;
  text-align: left;
}
.pbs-ctx-item:hover:not(:disabled) { background: var(--bg-hover); color: var(--text-primary); }
.pbs-ctx-item.danger:hover:not(:disabled) { background: var(--danger); color: var(--accent-text); }
.pbs-ctx-sep { height: 1px; background: var(--border); margin: 4px 0; }

/* ---- Status bar ---- */
.pbs-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 10px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
  font-size: var(--font-sm, 11px);
  color: var(--text-tertiary);
  flex-shrink: 0;
}
.pbs-status-spacer { flex: 1; }
.pbs-status-file { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ---- Empty / Loading ---- */
.pbs-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-tertiary);
  font-size: var(--font-md, 12px);
  padding: 20px;
  text-align: center;
}
.pbs-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-tertiary);
}

/* ---- Reference autocomplete ---- */
.pbs-ref-dropdown {
  position: fixed;
  z-index: var(--z-dropdown, 1000);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md, 4px);
  max-height: 160px;
  overflow-y: auto;
  box-shadow: 0 4px 12px var(--shadow);
}
.pbs-ref-item {
  padding: 3px 8px;
  font-size: var(--font-sm, 11px);
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pbs-ref-item:hover, .pbs-ref-item.active {
  background: var(--accent-muted);
  color: var(--text-primary);
}

/* ---- Workspace controls ---- */
.pbs-detail-body, .pbs-section-body, .pbs-field, .pbs-reference { min-width: 0; }
.pbs-root [hidden] { display: none !important; }
.pbs-root :is(button, input, select, textarea, tr, [role="separator"]):focus-visible,
.pbs-ctx-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.pbs-list-toolbar {
  padding: var(--space-3, 6px) var(--space-4, 8px);
  border-bottom: 1px solid var(--border);
}
.pbs-list-toolbar { display: flex; align-items: center; gap: var(--space-4, 8px); }
.pbs-list-toolbar .pbs-search { flex: 1; width: 100%; min-width: 0; }
.pbs-page-size { display: flex; align-items: center; gap: var(--space-2, 4px); white-space: nowrap; }
.pbs-page-size input { width: 62px; box-sizing: border-box; }
.pbs-version-select, .pbs-file-select { max-width: 160px; }
.pbs-btn.success svg { color: var(--success); }
.pbs-table { font-variant-numeric: tabular-nums; }
.pbs-sort {
  display: flex;
  align-items: center;
  gap: var(--space-2, 4px);
  padding: 0;
  width: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.pbs-detail-header { position: sticky; top: 0; z-index: 1; min-height: 30px; }
.pbs-field-label-row { flex-wrap: wrap; }
.pbs-category-select, .pbs-btn.pbs-return { display: none; }
.pbs-dirty { color: var(--warning); font-size: var(--font-sm, 11px); }
.pbs-error { flex-direction: column; gap: var(--space-4, 8px); color: var(--danger); }
.pbs-resizer { touch-action: none; }

.pbs-root.compact :is(.pbs-sidebar, .pbs-resizer, .pbs-right) { display: none; }
.pbs-root.compact .pbs-preview { min-height: 0; max-height: 140px; overflow: auto; }
.pbs-root.compact .pbs-category-select { display: inline-block; max-width: 150px; }
.pbs-root.compact .show-detail .pbs-center { display: none; }
.pbs-root.compact .show-detail .pbs-right { display: flex; width: 100% !important; min-width: 0; }
.pbs-root.compact .pbs-btn.pbs-return { display: inline-flex; align-self: start; margin: var(--space-3, 6px); }

.pbs-column-resize {
  position: absolute;
  inset: 0 0 0 auto;
  width: 7px;
  cursor: col-resize;
  touch-action: none;
}
.pbs-column-resize:is(:hover, :focus-visible) { background: var(--accent); }
.pbs-table th { padding-inline-end: 10px; }
.pbs-scrolling-text { display: block; }
.pbs-sort > .pbs-scrolling-text { flex: 1; }
.pbs-type-pill { min-width: 0; max-width: 100%; }
.pbs-mini-statbar-total { min-width: 0; }
.pbs-move-category {
  display: inline-block;
  flex: none;
  width: 46px;
  height: 20px;
  background-size: 46px 60px;
  vertical-align: middle;
  background-repeat: no-repeat;
  image-rendering: pixelated;
}
.pbs-type-cell-inner > .pbs-scrolling-text { width: 100%; }
.pbs-trainer-cell { display: flex; align-items: center; gap: var(--space-2, 4px); }
.pbs-trainer-cell > .pbs-scrolling-text { flex: 1; }
.pbs-trainer-icon { display: inline-flex; flex: 0 0 26px; }
.pbs-icon-strip {
  display: inline-block;
  vertical-align: middle;
  image-rendering: pixelated;
  background-repeat: no-repeat;
}
@media (prefers-reduced-motion: no-preference) {
  .pbs-icon-strip { animation: pbs-icon-frames var(--pbs-icon-duration) steps(var(--pbs-icon-frames)) infinite; }
}
@keyframes pbs-icon-frames {
  to { background-position: var(--pbs-icon-end); }
}
.pbs-trainer-icon img { width: 26px; height: 26px; }
.pbs-encounter-type, .pbs-bgm-row input {
  box-sizing: border-box;
  min-height: var(--control-h-md, 26px);
}
.pbs-bgm-row input { min-width: 0; font-size: var(--font-md, 12px); }
.pbs-root input.pbs-number-tight { appearance: textfield; }
.pbs-root input.pbs-number-tight::-webkit-inner-spin-button,
.pbs-root input.pbs-number-tight::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

.pbs-switch {
  display: inline-flex;
  border-radius: var(--radius-lg, 10px);
}

.pbs-switch.ms-bare:focus-visible {
  outline: 2px solid var(--accent, #7c8aff);
  outline-offset: 2px;
}

.icon-switch-track {
  position: relative;
  width: 44px;
  height: 22px;
  border-radius: var(--radius-lg, 10px);
  background: var(--bg-tertiary, #313244);
  border: 1px solid var(--text-secondary, #a0a0b0);
  transition: background var(--transition-slow, 200ms) ease, border-color var(--transition-slow, 200ms) ease;
  overflow: hidden;
}

.pbs-switch[aria-checked="true"] .icon-switch-track {
  background: var(--accent-muted, rgba(124, 138, 255, 0.15));
  border-color: var(--accent, #7c8aff);
}

.icon-switch-symbol {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  inline-size: calc(100% - 18px);
  justify-content: center;
  color: var(--text-primary, #e0e0e8);
  pointer-events: none;
  transition: opacity var(--transition-slow, 200ms) ease;
}

.icon-switch-off { right: 0; }
.icon-switch-on { left: 0; }

.pbs-switch[aria-checked="true"] .icon-switch-off,
.pbs-switch[aria-checked="false"] .icon-switch-on { opacity: 0.75; }

.icon-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  /* Concentric with the track: its radius minus the 3px (border + inset) gap. */
  border-radius: calc(var(--radius-lg, 10px) - 3px);
  background: var(--text-secondary, #a0a0b0);
  border: 1px solid transparent;
  box-shadow: var(--shadow-popup, none);
  transition: transform var(--transition-slow, 200ms) cubic-bezier(0.4, 0, 0.2, 1), background var(--transition-slow, 200ms) ease;
}

.pbs-switch[aria-checked="true"] .icon-switch-thumb {
  transform: translateX(22px);
  background: var(--accent, #7c8aff);
  border-color: var(--accent, #7c8aff);
}

.pbs-switch:hover:not(:disabled) .icon-switch-thumb {
  background: var(--text-primary, #e0e0e8);
}

.pbs-switch:hover:not(:disabled) .icon-switch-track {
  background: var(--bg-hover, #2a2a40);
  border-color: var(--text-primary, #e0e0e8);
}

.pbs-switch[aria-checked="true"]:hover:not(:disabled) .icon-switch-track {
  background: color-mix(in srgb, var(--accent, #7c8aff) 28%, var(--bg-tertiary, #313244));
  border-color: var(--accent-hover, #959fff);
}

.pbs-switch[aria-checked="true"]:hover:not(:disabled) .icon-switch-thumb {
  background: var(--accent-hover, #959fff);
  border-color: var(--accent-hover, #959fff);
}

@media (prefers-reduced-motion: reduce) {
  .pbs-root * { transition: none; }
}

`;
