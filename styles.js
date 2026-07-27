/**
 * CSS styles for PBS Editor v2 — dialog-based layout.
 */

export const CSS = `
.pbs-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: inherit;
  font-size: 12px;
  color: var(--text-primary);
  background: var(--bg-primary);
  overflow: hidden;
}

/* ---- Toolbar ---- */
.pbs-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.pbs-toolbar-title {
  font-weight: 700;
  font-size: 13px;
  color: var(--text-primary);
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
  border-radius: 4px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 12px;
  width: 200px;
  outline: none;
}
.pbs-search:focus { border-color: var(--accent); }
.pbs-search::placeholder { color: var(--text-tertiary); }
.pbs-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}
.pbs-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.pbs-btn.primary { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }
.pbs-btn.primary:hover { background: var(--accent-hover); }
.pbs-btn.danger { color: var(--danger); border-color: var(--danger); }
.pbs-btn.danger:hover { background: var(--danger); color: #fff; }
.pbs-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ---- Main 3-column layout ---- */
.pbs-main {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ---- File sidebar ---- */
.pbs-sidebar {
  width: 120px;
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
  padding: 6px 8px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 11px;
  transition: background 0.1s;
  gap: 4px;
}
.pbs-sidebar-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.pbs-sidebar-item.active {
  background: var(--accent-muted);
  color: var(--text-primary);
  font-weight: 600;
}
.pbs-sidebar-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pbs-sidebar-badge {
  font-size: 10px;
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
  overflow: auto;
}
.pbs-table {
  width: 100%;
  border-collapse: collapse;
}
.pbs-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 5px 8px;
  text-align: left;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.pbs-table th:hover { color: var(--text-primary); }
.pbs-table th .pbs-sort-arrow { margin-left: 3px; font-size: 9px; }
.pbs-table td {
  padding: 4px 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pbs-table tr:hover td { background: var(--bg-hover); }
.pbs-table tr.selected td {
  background: var(--accent-muted);
  color: var(--text-primary);
}
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
  font-size: 11px;
  color: var(--text-secondary);
}
.pbs-page-btn {
  padding: 2px 8px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 11px;
}
.pbs-page-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.pbs-page-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* ---- Right: preview + detail ---- */
.pbs-right {
  width: 360px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--bg-secondary);
}

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
  border-radius: 4px;
}
.pbs-preview-map {
  max-width: 100%;
  max-height: 320px;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 4px;
}
.pbs-preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--text-tertiary);
  font-size: 11px;
}
.pbs-preview-placeholder-icon {
  font-size: 32px;
  opacity: 0.3;
}
.pbs-preview-name {
  position: absolute;
  bottom: 4px;
  left: 8px;
  font-size: 10px;
  color: var(--text-tertiary);
}

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
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.pbs-detail-body {
  padding: 8px 10px;
  display: grid;
  grid-template-columns: 1fr 1fr;
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
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.pbs-field input,
.pbs-field select,
.pbs-field textarea {
  padding: 3px 6px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 12px;
  font-family: inherit;
  outline: none;
  width: 100%;
}
.pbs-field input:focus,
.pbs-field select:focus,
.pbs-field textarea:focus { border-color: var(--accent); }
.pbs-field textarea { min-height: 36px; resize: vertical; }
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
  font-size: 11px;
  font-weight: 600;
  border-left: none;
  border-right: none;
  border-bottom: none;
  background: none;
  font-family: inherit;
  width: 100%;
  text-align: left;
}
.pbs-section-toggle:hover { color: var(--text-primary); }
.pbs-section-arrow { font-size: 9px; transition: transform 0.15s; }
.pbs-section-arrow.open { transform: rotate(90deg); }
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
  font-size: 11px;
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
.pbs-list-remove:hover { color: var(--danger); }
.pbs-goto-btn:hover { color: var(--accent); }
.pbs-list-add {
  background: transparent;
  border: 1px dashed var(--border);
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  text-align: center;
}
.pbs-list-add:hover { color: var(--accent); border-color: var(--accent); }

/* ---- Stat bars ---- */
.pbs-stat-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 1px 0;
}
.pbs-stat-label {
  width: 32px;
  font-size: 10px;
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
  transition: width 0.2s;
}
.pbs-stat-value {
  width: 28px;
  font-size: 11px;
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
  font-size: 10px;
  font-weight: 600;
}

/* ---- Sub-section (encounters, trainer pokemon) ---- */
.pbs-subsection {
  border: 1px solid var(--border);
  border-radius: 4px;
  margin: 3px 0;
  overflow: hidden;
}
.pbs-subsection-header {
  padding: 3px 8px;
  background: var(--bg-tertiary);
  font-weight: 600;
  font-size: 11px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}
.pbs-subsection-body { padding: 4px 8px; }

/* ---- Context menu ---- */
.pbs-ctx-menu {
  position: fixed;
  z-index: 10000;
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
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
}
.pbs-ctx-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.pbs-ctx-item.danger:hover { background: var(--danger); color: #fff; }
.pbs-ctx-sep { height: 1px; background: var(--border); margin: 4px 0; }

/* ---- Status bar ---- */
.pbs-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 10px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}
.pbs-status-spacer { flex: 1; }
.pbs-dirty-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--warning);
  display: inline-block;
}

/* ---- Empty / Loading ---- */
.pbs-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-tertiary);
  font-size: 12px;
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
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  max-height: 160px;
  overflow-y: auto;
  box-shadow: 0 4px 12px var(--shadow);
}
.pbs-ref-item {
  padding: 3px 8px;
  font-size: 11px;
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

/* ---- Scrollbar ---- */
.pbs-root ::-webkit-scrollbar { width: 6px; height: 6px; }
.pbs-root ::-webkit-scrollbar-track { background: transparent; }
.pbs-root ::-webkit-scrollbar-thumb { background: var(--bg-tertiary); border-radius: 3px; }
.pbs-root ::-webkit-scrollbar-thumb:hover { background: var(--text-tertiary); }

`;
