/**
 * PBS Editor v2 — main UI controller.
 * 3-column dialog: sidebar | table+pagination | preview+detail
 */

import {
  badge,
  baseStatTotal,
  button,
  clearTypeIcons,
  configureTypeIcons,
  createEncounterEditor,
  createFieldEditor,
  createPagination, createPreviewPanel, createSectionToggle,
  createTable,
  createTrainerPokemonEditor,
  h,
  normalizeSearch,
  searchBox,
  showContextMenu,
} from './components.js';
import { getFileTypeConfig, getIconGraphic, getPokemonSpriteVariants, getPrimaryGraphic } from './file-types.js';
import { getAvailableFileTypes, getFilename, matchFileType, parsePbsFile } from './parsers.js';
import { parseJsonPbs, writeJsonPbs } from './json.js';
import { CSS } from './styles.js';
import { writePbsFile } from './writers.js';

let _t = s => s;
export function setI18n(tFn) { _t = tFn; }

// ---- Toolbar SVG icons (14px, Lucide-style) ----
const _tbSvg = (d) => `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle">${d}</svg>`;
const ICON_SAVE  = _tbSvg('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>');
const ICON_DISCARD = _tbSvg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>');

const ICON_DUPLICATE = _tbSvg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 4H6a2 2 0 0 0-2 2v10"/>');
const ICON_EXCLUDE = _tbSvg('<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>');
const ICON_DELETE = _tbSvg('<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v6m4-6v6"/>');

const DEFAULT_PAGE_SIZE = 50;

// File types that never have an associated graphic — the preview pane is
// hidden entirely for them instead of showing a permanent "No graphic" box.
const NO_GRAPHIC_TYPES = new Set(['moves', 'abilities', 'encounters', 'tm']);

// Materialized from the section header by the parsers, not real fields —
// they must never take part in merge provenance or be written to JSON.
const HEADER_DERIVED = new Set(['InternalName', 'FormIndex']);

// Records which file each field of an entry came from (`_fieldFiles`), so a
// section merged from several files saves each field back to its own file.
function stampFieldFiles(entry, fname) {
  entry._fieldFiles = {};
  for (const k of Object.keys(entry)) if (!k.startsWith('_')) entry._fieldFiles[k] = fname;
  for (const k of Object.keys(entry._extra || {})) entry._fieldFiles[k] = fname;
}

// When a later file overrides a field, the earlier file keeps its own (now
// shadowed) line on save — the compiler's field merge makes the winner
// effective in-game either way, and the base file is not rewritten for no
// reason. ponytail: only one level deep; with 3+ overriding files a middle
// file loses its shadowed copy (compiled data still identical).
function keepOverriddenValue(prev, k, fname) {
  const prevFile = prev._fieldFiles[k];
  if (prevFile && prevFile !== fname) {
    const value = (k in (prev._extra || {})) ? prev._extra[k] : prev[k];
    if (value !== '' && value !== undefined) {
      (prev._overridden ||= {})[k] = { file: prevFile, value };
    }
  }
}

// Per-file view of a merged entry: each file gets the fields it owns (the
// winner's current value) plus any shadowed value it originally held.
// Returns null when nothing lands there.
function projectEntryForFile(entry, fname) {
  const ff = entry._fieldFiles || {};
  const ownerOf = (k) => ff[k] || entry._file;
  const copy = {
    _id: entry._id, _header: entry._header, _excluded: entry._excluded,
    _file: fname, _evoFormat: entry._evoFormat, _sep: entry._sep,
    _extra: {},
  };
  // Identity fields belong to every file that touches the section (its header
  // IS `InternalName`/`FormIndex`), not to whichever file loaded first — show
  // them regardless of filter. Writers never emit them for v21 (they come from
  // the section header on save), so carrying them here is display-only, no
  // risk of duplicating them into the written file.
  for (const k of HEADER_DERIVED) if (entry[k] !== undefined && entry[k] !== '') copy[k] = entry[k];
  let any = false;
  for (const k of Object.keys(entry)) {
    if (k.startsWith('_')) continue;
    const shadow = entry._overridden?.[k];
    if (shadow?.file === fname) {
      copy[k] = shadow.value;
      any = true;
      continue;
    }
    if (entry[k] === '' || entry[k] === undefined || ownerOf(k) !== fname) continue;
    copy[k] = entry[k];
    any = true;
  }
  for (const [k, v] of Object.entries(entry._extra || {})) {
    const shadow = entry._overridden?.[k];
    if (shadow?.file === fname) {
      copy._extra[k] = shadow.value;
      any = true;
      continue;
    }
    if (v === '' || ownerOf(k) !== fname) continue;
    copy._extra[k] = v;
    any = true;
  }
  if (entry._encounters) copy._encounters = entry._encounters;
  if (entry._pokemon) copy._pokemon = entry._pokemon;
  if ((entry._encounters || entry._pokemon) && ownerOf('Name') === fname) any = true;
  copy._order = (entry._order || []).filter(k => k in copy || k in copy._extra);
  return any ? copy : null;
}

export class PbsEditor {
  constructor(ctx, host) {
    this.ctx = ctx;
    this.host = host;
    this.version = null;
    this.lbds = false;   // La Base de Sky mode: v21 + JSON PBS + field-level section merge
    this.currentFileType = null;
    this.entries = {};
    this.originalEntries = {};
    this.files = {};
    this.selectedIdx = -1;
    this.dirty = new Set();
    this.searchQuery = '';
    this.gameRoot = '';
    this.columnWidths = new Map();
    this.pageSize = DEFAULT_PAGE_SIZE;
    this.selectedRows = new Set();
    this.selectionAnchor = null;
    this._history = [];
    this._historyIdx = -1;
    this._navigating = false;
    this._metricsCache = null;
    this._fileFilter = null;

    this.build();
  }

  async loadImageBlob(absPath) {
    try {
      const invoke = window.__TAURI__?.core?.invoke;
      if (!invoke) return null;
      const bytes = await invoke('read_binary_file', { path: absPath });
      if (!bytes || !bytes.length) return null;
      const ext = absPath.split('.').pop().toLowerCase();
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'bmp' ? 'image/bmp' : 'image/png';
      const blob = new Blob([new Uint8Array(bytes)], { type: mime });
      return URL.createObjectURL(blob);
    } catch { return null; }
  }

  loadMoveCategories() {
    if (!this.gameRoot || this.moveCategoryLoad) return;
    const folder = this.version >= 21 ? 'Graphics/UI' : 'Graphics/Pictures';
    const root = this.gameRoot.replace(/\\/g, '/');
    const request = this.loadImageBlob(`${root}/${folder}/category.png`);
    this.moveCategoryLoad = request;
    request.then(url => {
      if (this.closed || this.moveCategoryLoad !== request) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      this.moveCategoryUrl = url;
      if (url && this.currentFileType === 'moves') this.renderTable();
    });
  }

  async loadTypeIcons() {
    if (!this.gameRoot) return;
    const base = this.gameRoot.replace(/\\/g, '/');
    const absPath = this.version >= 21
      ? `${base}/Graphics/UI/Battle/icon_types.png`
      : `${base}/Graphics/Pictures/types.png`;
    try {
      const url = await this.loadImageBlob(absPath);
      if (!url) return;
      const img = new Image();
      img.onload = () => {
        const typeCount = this.entries.types?.length || 19;
        const iconH = Math.round(img.naturalHeight / typeCount);
        configureTypeIcons(url, img.naturalWidth, iconH, img.naturalHeight);
        this._refreshTypeVisuals();
      };
      img.src = url;
    } catch { /* sprite not found — colored fallback used */ }
  }


  async resolveTownMapPath(filename) {
    const stem = (filename || '').trim().replace(/^[/\\]+/, '').replace(/\.[^.]+$/, '');
    if (!stem) return null;
    const base = (this.gameRoot || '').replace(/\\/g, '/');
    for (const c of [
      `Graphics/UI/Town Map/${stem}.png`,
      `Graphics/Pictures/${stem}.png`,
      `Graphics/${stem}.png`,
    ]) {
      const url = await this.loadImageBlob(base + '/' + c);
      if (url) { URL.revokeObjectURL(url); return c; }
    }
    return await this.findGraphicFile('Graphics', stem);
  }

  async findGraphicFile(dir, stem) {
    const key = dir.toLowerCase() + '|' + stem.toLowerCase();
    this._graphicSearchCache ||= new Map();
    if (this._graphicSearchCache.has(key)) return this._graphicSearchCache.get(key);
    this._graphicSearchCache.set(key, null); // guards against cycles / re-search

    let entries = [];
    try {
      const list = await this.ctx.fs.listProjectDir(dir);
      entries = (list || []).map(e => (typeof e === 'string' ? e : (e?.name || e?.path || '')));
    } catch { entries = []; }

    const norm = dir.replace(/\/+$/, '');
    const want = stem.toLowerCase();
    // First pass: any returned entry whose basename stem matches.
    for (const e of entries) {
      const clean = e.replace(/^[/\\]+/, '');
      const baseName = clean.split(/[\\/]/).pop();
      if (!baseName) continue;
      if (baseName.replace(/\.[^.]+$/, '').toLowerCase() === want) {
        const full = `${norm}/${clean}`.replace(/\/{2,}/g, '/');
        this._graphicSearchCache.set(key, full);
        return full;
      }
    }
    // Second pass: recurse into immediate subdirectories.
    for (const e of entries) {
      const clean = e.replace(/^[/\\]+/, '');
      if (!clean || clean.includes('/') || clean.includes('\\')) continue; // nested or empty
      if (/\.[^.]+$/.test(clean)) continue; // a file, not a folder
      const found = await this.findGraphicFile(`${norm}/${clean}`, stem);
      if (found) { this._graphicSearchCache.set(key, found); return found; }
    }
    return null;
  }

  // SpeciesMetrics animation speed keyed by species or species and form.
  async loadMetrics() {
    if (this._metricsCache) return this._metricsCache;
    this._metricsCache = {};
    try {
      const fname = this.version >= 21 ? 'pokemon_metrics.txt' : '';
      if (!fname) return this._metricsCache;
      const raw = await this.readFile('PBS/' + fname);
      let current = null;
      for (const rawLine of raw.split(/\r?\n/)) {
        const t = rawLine.trim();
        const header = t.match(/^\[(.+?)\](!exclude)?$/);
        if (header) {
          // `[SPECIES]` or `[SPECIES,FormIndex]`
          const [name, formStr] = header[1].split(',').map(s => s.trim());
          const form = parseInt(formStr) || 0;
          current = (this._metricsCache[form > 0 ? `${name}_${form}` : name] ||= {});
          continue;
        }
        if (!current) continue;
        const eq = t.indexOf('=');
        if (eq < 0) continue;
        const field = t.slice(0, eq).trim();
        const val = t.slice(eq + 1).trim();
        if (field === 'Speed') current.speed = parseInt(val);
        else if (field === 'FrontSprite') current.frontOffset = val.split(',').map(n => parseInt(n.trim()) || 0);
        else if (field === 'FrontSpriteAltitude') current.frontAltitude = parseInt(val) || 0;
      }
    } catch { /* metrics file may not exist */ }
    return this._metricsCache;
  }

  // A form with no metrics entry of its own inherits the base species' one.
  metricsFor(metrics, entry, fileType) {
    const name = entry.InternalName || '';
    const form = fileType === 'pokemon_forms' ? (parseInt(entry.FormIndex) || 0) : 0;
    if (form > 0) return metrics[`${name}_${form}`] || metrics[name] || {};
    return metrics[name] || {};
  }

  spriteSpeedToFps(speed) {
    if (speed == null) return undefined;
    if (speed === 0) return 0;
    const delayMs = Math.round((speed / 2.0) * 60);
    return delayMs > 0 ? 1000 / delayMs : undefined;
  }

  async getSpriteFps(entry, fileType) {
    if (fileType !== 'pokemon' && fileType !== 'pokemon_forms') return undefined;
    const metrics = await this.loadMetrics();
    const speed = this.metricsFor(metrics, entry, fileType).speed;
    const fps = this.spriteSpeedToFps(speed);
    return fps !== undefined ? fps : 16;
  }

  build() {
    const style = document.createElement('style');
    style.textContent = CSS;
    this.host.appendChild(style);

    this.root = h('div', { className: 'pbs-root' });

    this.buildToolbar();
    this.buildMainLayout();
    this.buildStatusBar();

    this.host.appendChild(this.root);
    this.layoutObserver = new ResizeObserver(() => {
      this.root.classList.toggle('compact', this.root.clientWidth < 960);
      this.table?.fit(this.tableWrap.clientWidth);
    });
    this.layoutObserver.observe(this.root);
    this.layoutObserver.observe(this.tableWrap);

    this.numberWidths = new ResizeObserver(entries => {
      for (const { target, contentRect } of entries) {
        if (contentRect.width > 0) target.classList.toggle('pbs-number-tight', contentRect.width < 48);
      }
    });
    this.numberFields = new MutationObserver(() => {
      this.numberWidths.disconnect();
      for (const input of this.detailPanel.querySelectorAll('input[type="number"]')) {
        this.numberWidths.observe(input);
      }
    });
    this.numberFields.observe(this.detailPanel, { childList: true, subtree: true });

    this.root.tabIndex = -1;
    this.root.focus();
    this.root.addEventListener('keydown', (e) => this.onKeyDown(e));

    this.switching = true;
    this.updateDirtyIndicator();
    this.loadSavedVersion().finally(() => { this.switching = false; this.updateDirtyIndicator(); });
    this.startDiskWatch();
  }

  buildToolbar() {
    this.toolbar = h('div', { className: 'pbs-toolbar' });
    this.backBtn = h('button', { className: 'pbs-btn', innerHTML: _tbSvg('<path d="m15 18-6-6 6-6"/>'), 'aria-label': _t('Back'), onClick: () => this.goBack(), disabled: true });
    this.forwardBtn = h('button', { className: 'pbs-btn', innerHTML: _tbSvg('<path d="m9 18 6-6-6-6"/>'), 'aria-label': _t('Forward'), onClick: () => this.goForward(), disabled: true });
    this.toolbar.appendChild(this.backBtn);
    this.toolbar.appendChild(this.forwardBtn);
    this.toolbar.appendChild(h('div', { className: 'pbs-toolbar-sep' }));
    this.versionSelect = h('select', { className: 'pbs-version-select' });
    for (const v of [16, 17, 21]) {
      this.versionSelect.appendChild(h('option', { value: String(v), textContent: `v${v}` }));
    }
    this.versionSelect.appendChild(h('option', { value: 'lbds', textContent: 'LBDS' }));
    this.versionSelect.setAttribute('aria-label', _t('Essentials version'));
    this.versionSelect.addEventListener('change', async () => {
      const next = this.versionSelect.value;
      this.versionSelect.value = this.lbds ? 'lbds' : String(this.version);
      if (this.switching || this.saving || this.prompting) return;
      this.switching = true;
      try {
        if (await this.confirmPending()) await this.initWithVersion(next === 'lbds' ? 21 : Number(next), next === 'lbds');
      } catch (error) {
        this.showError(String(error));
      } finally {
        this.switching = false;
        this.updateDirtyIndicator();
      }
    });
    this.toolbar.appendChild(this.versionSelect);
    this.fileFilterBar = h('div', { className: 'pbs-file-filter-bar', style: { display: 'none' } });
    this.toolbar.appendChild(this.fileFilterBar);
    this.toolbar.appendChild(h('div', { className: 'pbs-toolbar-sep' }));
    this.toolbar.appendChild(h('div', { className: 'pbs-toolbar-spacer' }));
    this.searchInput = searchBox(_t('Search entries...'), (q) => { if (this.closed) return; this.searchQuery = q; this.pagination.reset(); this.renderTable(); });
    this.categorySelect = h('select', { className: 'pbs-category-select', 'aria-label': _t('PBS type'), onChange: (event) => this.selectFileType(event.target.value) });
    this.toolbar.appendChild(this.categorySelect);
    this.dirtyIndicator = h('span', { className: 'pbs-dirty', role: 'status', hidden: '' });
    this.toolbar.appendChild(this.dirtyIndicator);
    this.saveButton = button(`${ICON_SAVE} ${_t('Save')}`, () => this.saveCurrentFile(), 'accent');
    this.discardButton = button(`${ICON_DISCARD} ${_t('Discard')}`, () => this.discardChanges(), 'danger');
    this.newButton = button(`${_tbSvg('<path d="M12 5v14M5 12h14"/>')} ${_t('New')}`, () => this.addEntry(), 'success');
    this.duplicateButton = button(`${ICON_DUPLICATE} ${_t('Duplicate')}`, () => this.duplicateEntries(this.actionEntries()));
    this.excludeButton = button(ICON_EXCLUDE, () => this.toggleExcluded(this.actionEntries()));
    this.excludeLabel = h('span', { textContent: _t('Exclude entry') });
    this.excludeButton.append(this.excludeLabel);
    this.deleteButton = button(`${ICON_DELETE} ${_t('Delete')}`, () => this.deleteEntries(this.actionEntries()), 'danger');
    this.excludeButton.title = _t('Mark the entry with !exclude without deleting it.');
    for (const [control, shortcut] of [[this.newButton, 'Ctrl+T'], [this.duplicateButton, 'Ctrl+J'], [this.deleteButton, 'Delete'], [this.saveButton, 'Ctrl+S']]) {
      control.setAttribute('aria-keyshortcuts', shortcut.replace('Ctrl', 'Control'));
      control.title = shortcut;
    }
    this.toolbar.append(this.newButton, this.duplicateButton, this.excludeButton, this.deleteButton, this.discardButton, this.saveButton);
    this.root.appendChild(this.toolbar);
  }

  buildMainLayout() {
    this.mainLayout = h('div', { className: 'pbs-main' });

    // Left: file sidebar
    this.sidebar = h('div', { className: 'pbs-sidebar' });
    this.mainLayout.appendChild(this.sidebar);

    // Center: table + pagination
    this.centerCol = h('div', { className: 'pbs-center' });
    this.tableWrap = h('div', { className: 'pbs-table-wrap' });
    const pageSize = h('input', { type: 'number', min: 10, max: 200, step: 1, value: this.pageSize,
      'aria-label': _t('Entries per page'), onChange: () => {
        const size = Number.isFinite(pageSize.valueAsNumber)
          ? Math.max(10, Math.min(200, Math.round(pageSize.valueAsNumber)))
          : this.pageSize;
        pageSize.value = size;
        if (this.pageSize === size) return;
        const start = this.pagination.getPage() * this.pageSize;
        this.pageSize = size;
        const rows = this.sortedEntries();
        const selected = rows.indexOf(this.entries[this.currentFileType]?.[this.selectedIdx]);
        this.pagination.setTotal(Math.ceil(rows.length / size));
        this.pagination._forcePage(Math.floor((selected >= 0 ? selected : start) / size));
        this.renderTable();
      }, onKeyDown: (event) => { if (event.key === 'Enter') pageSize.blur(); } });
    const perPage = h('label', { className: 'pbs-page-size' }, _t('Entries per page'), pageSize);
    const searchBar = h('div', { className: 'pbs-list-toolbar' }, this.searchInput, perPage);
    this.centerCol.append(searchBar, this.tableWrap);
    this.pagination = createPagination((page) => this.renderTable());
    this.centerCol.appendChild(this.pagination.el);
    this.mainLayout.appendChild(this.centerCol);

    // Drag handle: lets the user widen the detail pane themselves (some file
    // types like Encounters only need 2 table columns and could use the room).
    this.resizer = h('div', { className: 'pbs-resizer' });
    this.mainLayout.appendChild(this.resizer);

    // Right: preview + detail
    this.rightCol = h('div', { className: 'pbs-right' });
    this.previewPanel = createPreviewPanel((p) => this.loadImageBlob(p));
    this.returnButton = button(_t('Back to entries'), () => {
      this.mainLayout.classList.remove('show-detail');
      (this.tableWrap.querySelector('tr.selected') || this.searchInput).focus();
    }, 'pbs-return');
    this.rightCol.append(this.returnButton, this.previewPanel.el);
    this.detailPanel = h('div', { className: 'pbs-detail' });
    this.rightCol.appendChild(this.detailPanel);
    this.mainLayout.appendChild(this.rightCol);

    this.root.appendChild(this.mainLayout);
    this.initResizer();
  }

  // Drag pbs-resizer to resize the detail pane. Session-only (not persisted) —
  // the default width already fits most file types; this just covers the ones
  // that don't (Encounters' 2-column table, long Forms names, etc).
  initResizer() {
    let startX = 0, startWidth = 0;
    const onMove = (e) => {
      const delta = startX - e.clientX; // dragging left grows the right pane
      const min = 320, max = Math.round(this.mainLayout.clientWidth * 0.7);
      this.rightCol.style.width = Math.max(min, Math.min(max, startWidth + delta)) + 'px';
    };
    const onUp = () => {
      this.resizer.classList.remove('dragging');
      this.resizer.removeEventListener('pointermove', onMove);
    };
    this.cleanupResize = onUp;
    this.resizer.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      startX = event.clientX;
      startWidth = this.rightCol.getBoundingClientRect().width;
      this.resizer.setPointerCapture(event.pointerId);
      this.resizer.classList.add('dragging');
      this.resizer.addEventListener('pointermove', onMove);
    });
    this.resizer.addEventListener('lostpointercapture', onUp);
    this.resizer.tabIndex = 0;
    this.resizer.setAttribute('role', 'separator');
    this.resizer.setAttribute('aria-orientation', 'vertical');
    this.resizer.setAttribute('aria-label', _t('Resize details'));
    this.resizer.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      startWidth = this.rightCol.getBoundingClientRect().width;
      startX = 0;
      onMove({ clientX: event.key === 'ArrowLeft' ? -20 : 20 });
    });
  }

  buildStatusBar() {
    this.statusBar = h('div', { className: 'pbs-status' });
    this.statusCount = h('span', { textContent: '', role: 'status' });
    this.statusBar.appendChild(this.statusCount);
    this.selectionCount = h('span', { role: 'status', className: 'pbs-selection-count' });
    this.statusBar.appendChild(this.selectionCount);
    this.statusBar.appendChild(h('div', { className: 'pbs-status-spacer' }));
    this.statusFile = h('span', { className: 'pbs-status-file', textContent: '' });
    this.statusBar.appendChild(this.statusFile);
    this.root.appendChild(this.statusBar);
  }

  // ---- Keyboard ----
  onKeyDown(e) {
    if (e.defaultPrevented || e.isComposing) return;
    const editing = e.target.closest('input, textarea, select, [contenteditable="true"]');
    const modifier = (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey;
    const key = e.key.toLowerCase();
    const command = modifier && key === 's' ? this.saveButton
      : modifier && key === 't' ? this.newButton
      : modifier && key === 'j' ? this.duplicateButton
      : !editing && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && key === 'delete' ? this.deleteButton
      : null;
    if (command) {
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat && !this.switching && !this.saving && !this.prompting) command.click();
      return;
    }
    const ft = this.currentFileType;
    if (!ft) return;
    const entries = this.entries[ft];
    if (!entries?.length) return;

    if (!e.target.matches('.pbs-table tbody tr')) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const visible = this.sortedEntries();
      const index = this.pagination.getPage() * this.pageSize + e.target.sectionRowIndex;
      const row = visible[Math.max(0, Math.min(visible.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1)))];
      if (!row) return;
      this.pushHistory();
      this.selectedIdx = entries.indexOf(row);
      this.selectRows(row, false, e.shiftKey);
      this.pushHistory();
      this.pagination._forcePage(Math.floor(visible.indexOf(row) / this.pageSize));
      this.renderTable();
      this.renderDetail();
      this.updatePreview();
      this.tableWrap.querySelector('tr.selected')?.focus();
    }
  }

  showDetail() {
    this.mainLayout.classList.add('show-detail');
    if (this.returnButton.getClientRects().length) this.returnButton.focus();
  }

  actionEntries(row) {
    if (row && !this.selectedRows.has(row)) return [row];
    return (this.entries[this.currentFileType] || []).filter(entry => this.selectedRows.has(entry));
  }

  selectRows(row, additive, range) {
    if (range && this.selectionAnchor) {
      const rows = this.sortedEntries();
      const start = rows.indexOf(this.selectionAnchor);
      const end = rows.indexOf(row);
      if (start >= 0 && end >= 0) {
        for (const entry of rows.slice(Math.min(start, end), Math.max(start, end) + 1)) this.selectedRows.add(entry);
        return;
      }
    }
    this.selectionAnchor = row || null;
    if (!additive) this.selectedRows.clear();
    if (!row) return;
    if (additive && this.selectedRows.has(row)) this.selectedRows.delete(row);
    else this.selectedRows.add(row);
  }

  openActions(x, y, index, trigger) {
    const entry = this.entries[this.currentFileType]?.[index];
    if (!entry || this.saving || this.switching) return;
    const entries = this.actionEntries(entry);
    showContextMenu(x, y, [
      { label: _t('Duplicate'), action: () => this.duplicateEntries(entries) },
      { label: _t(entries.every(row => row._excluded) ? 'Include entry' : 'Exclude entry'), action: () => this.toggleExcluded(entries) },
      { separator: true },
      { label: _t('Delete'), danger: true, action: () => this.deleteEntries(entries) },
    ], this.host, trigger);
  }

  // ---- Version selection ----
  async loadSavedVersion() {
    let saved = null;
    try {
      saved = await this.ctx.storage.get('pbs_version');
    } catch { /* storage unavailable */ }

    // First run (nothing saved yet): ask Maker Studio what the project actually
    // is instead of defaulting to plain v21. Older Maker Studio builds lack
    // isLbdsProject — `?.()` just skips the guess and keeps the v21 default.
    // A saved choice always wins; auto-detect never overrides an explicit pick.
    if (saved == null) {
      try {
        if (await this.ctx.editor.isLbdsProject?.()) saved = 'lbds';
      } catch { /* detection unavailable — fall through to default */ }
    }

    const lbds = saved === 'lbds';
    let v = lbds ? 21 : parseInt(saved);
    if (!v || ![16, 17, 21].includes(v)) v = 21;
    if (this.closed) return;
    this.versionSelect.value = lbds ? 'lbds' : String(v);
    try {
      await this.initWithVersion(v, lbds);
    } catch (e) {
      console.error('PBS Editor init failed:', e);
      this.showError('Init failed: ' + (e?.message || e));
    }
  }

  async initWithVersion(v, lbds = false) {
    this.readErrors = new Map();
    this.pendingLoads = new Map();
    this.diskSources = new Map();
    this._history = [];
    this._historyIdx = -1;
    URL.revokeObjectURL(this.moveCategoryUrl || '');
    this.moveCategoryUrl = null;
    this.moveCategoryLoad = null;
    this.version = v;
    this.lbds = lbds;
    this.versionSelect.value = lbds ? 'lbds' : String(v);
    this.entries = {};
    this.originalEntries = {};
    this.previewRequest = null;
    this.selectedIdx = -1;
    this.currentFileType = null;
    this.dirty.clear();
    this.gameRoot = '';
    try { this.gameRoot = this.ctx.editor?.gameRoot?.() || ''; } catch {}

    try { await this.ctx.storage.set('pbs_version', lbds ? 'lbds' : String(v)); } catch {}

    clearTypeIcons();
    this.loadTypeIcons();

    await this.scanPbsDir();
    if (this.closed) return;
    this.buildSidebar();
    this.pagination.reset();
    this.renderDetail();
    this.previewPanel.clear();
    this.updateDirtyIndicator();
    this.updateStatusBar();

    const types = getAvailableFileTypes(this.version);
    if (types.length) await this.openFileType(types[0]);
  }

  // ---- PBS files ----
  // A file type can span several files: the base one plus any `<base>_*.txt`
  // (or `<base>_*.json` on La Base de Sky) extras a pack dropped in, which
  // Essentials compiles together.
  async scanPbsDir() {
    this.scanError = null;
    try {
      this.files = await this.discoverPbsFiles();
    } catch (error) {
      this.files = {};
      this.scanError = String(error);
    }
  }

  async discoverPbsFiles() {
    const files = {};
    let names = (await this.ctx.fs.listProjectDir('PBS/') || [])
      .map(entry => typeof entry === 'string' ? entry : entry?.name || entry?.path || '')
      .map(name => name.split(/[\\/]/).pop())
      .filter(name => (this.lbds ? /\.(txt|json)$/i : /\.txt$/i).test(name));
    if (this.lbds) {
      // Mirror the compiler: a .txt always wins over a .json with the same base
      // name, so editing that .json would have no effect in-game.
      const txtBases = new Set(names.filter(n => /\.txt$/i.test(n)).map(n => n.replace(/\.txt$/i, '')));
      names = names.filter(n => !/\.json$/i.test(n) || !txtBases.has(n.replace(/\.json$/i, '')));
    }

    for (const name of names.sort()) {
      const ft = matchFileType(name, this.version, this.lbds);
      if (!ft) continue;
      (files[ft] ||= []).push(name);
    }
    // Base file first: it's where new entries go, and it keeps compile order.
    for (const ft of Object.keys(files)) {
      const base = getFilename(ft, this.version);
      files[ft].sort((a, b) => (a === base ? -1 : b === base ? 1 : 0));
    }
    return files;
  }

  filesFor(ft) {
    if (this.files[ft]?.length) return this.files[ft];
    const base = getFilename(ft, this.version);
    return base ? [base] : [];
  }

  async readDiskSources(ft, files, version) {
    const sources = new Map();
    const errors = new Map();
    const base = getFilename(ft, version);
    for (const fname of files || (base ? [base] : [])) {
      const path = 'PBS/' + fname;
      try {
        if (!files && !await this.ctx.fs.projectExists(path)) continue;
        sources.set(fname, await this.readFile(path));
      } catch (error) {
        errors.set(ft, { file: fname, error: String(error) });
      }
    }
    return { sources, errors };
  }

  parseEntries(ft, sources, version, lbds, errors) {
    const all = [];
    const byHeader = new Map();
    for (const [fname, content] of sources) {
      let parsed;
      try {
        // `partial` (LBdS): repeated sections merge field-by-field across
        // files, so an override file (txt or json) may hold only the fields it
        // changes — sections without Name must not be dropped.
        parsed = /\.json$/i.test(fname)
          ? parseJsonPbs(content, ft)
          : parsePbsFile(content, ft, version, lbds);
      } catch (error) {
        errors.set(ft, { file: fname, error: String(error) });
      }
      if (!parsed) continue;
      for (const entry of parsed) {
        entry._file = fname;   // remembered so saving writes it back where it came from
        stampFieldFiles(entry, fname);
        const key = String(entry._header ?? entry._id);
        const prev = byHeader.get(key);
        // Vanilla Essentials has no cross-file section merge: list everything.
        // Encounters/trainers compile as whole-section replacement even on
        // LBdS; showing only the winner would delete the loser on save, so
        // both stay listed (the per-file filter tells them apart).
        if (!prev || !lbds || ft === 'encounters' || ft === 'trainers') {
          if (!prev) byHeader.set(key, entry);
          all.push(entry);
          continue;
        }
        // LBdS, same section in a later file: the compiler merges
        // field-by-field (later wins), so the editor shows the same effective
        // data and remembers each field's file for saving.
        for (const k of Object.keys(entry)) {
          if (k.startsWith('_') || HEADER_DERIVED.has(k) || entry[k] === '') continue;
          keepOverriddenValue(prev, k, fname);
          prev[k] = entry[k];
          prev._fieldFiles[k] = fname;
        }
        for (const [k, v] of Object.entries(entry._extra || {})) {
          if (v === '') continue;
          keepOverriddenValue(prev, k, fname);
          (prev._extra ||= {})[k] = v;
          prev._fieldFiles[k] = fname;
        }
        if (entry.Evolutions) prev._evoFormat = entry._evoFormat;
      }
    }
    return all;
  }

  async ensureEntries(ft) {
    const pending = this.pendingLoads;
    if (!pending.has(ft)) {
      const version = this.version;
      const lbds = this.lbds;
      pending.set(ft, this.readDiskSources(ft, this.files[ft], version).then(({ sources, errors }) => {
        if (this.pendingLoads !== pending || this.closed) return;
        this.applyDiskSources(ft, sources, errors, version, lbds);
      }));

    }
    await pending.get(ft);
  }

  applyDiskSources(ft, sources, errors, version = this.version, lbds = this.lbds) {
    const entries = this.parseEntries(ft, sources, version, lbds, errors);
    if (errors.has(ft)) this.readErrors.set(ft, errors.get(ft));
    else this.readErrors.delete(ft);
    this.diskSources.set(ft, sources);
    this.entries[ft] = entries;
    this.originalEntries[ft] = structuredClone(entries);
  }

  sameSources(previous, next) {
    return !!previous && previous.size === next.size &&
      [...previous].every(([name, content]) => next.get(name) === content);
  }

  startDiskWatch() {
    const doc = this.host.ownerDocument;
    const refresh = () => { void this.refreshExternalChanges(); };
    const onVisibility = () => { if (!doc.hidden) refresh(); };
    doc.defaultView?.addEventListener('focus', refresh);
    doc.addEventListener('visibilitychange', onVisibility);
    const timer = setInterval(refresh, 2000);
    this.stopDiskWatch = () => {
      clearInterval(timer);
      doc.defaultView?.removeEventListener('focus', refresh);
      doc.removeEventListener('visibilitychange', onVisibility);
    };
  }

  async refreshExternalChanges() {
    const ft = this.currentFileType;
    const baseline = this.diskSources?.get(ft);
    if (!baseline || this.checkingDisk || this.closed ||
        this.switching || this.saving || this.prompting) return;
    this.checkingDisk = true;
    try {
      const files = await this.discoverPbsFiles();
      const { sources, errors } = await this.readDiskSources(ft, files[ft], this.version);
      if (this.closed || this.currentFileType !== ft || this.diskSources.get(ft) !== baseline ||
          this.switching || this.saving || this.prompting) return;
      if (errors.size) { this.reportDiskRefreshError(errors.get(ft)?.error); return; }
      this.lastDiskRefreshError = null;
      if (this.sameSources(baseline, sources) || this.dirty.has(ft)) return;
      this.reloadDiskCategory(ft, files[ft], sources, errors);
    } catch (error) {
      this.reportDiskRefreshError(error);
    } finally {
      this.checkingDisk = false;
    }
  }

  reloadDiskCategory(ft, files, sources, errors) {
    if (ft !== this.currentFileType) {
      this.files[ft] = files;
      this.applyDiskSources(ft, sources, errors);
      return;
    }
    const oldEntries = this.entries[ft];
    const key = entry => entry && JSON.stringify([entry._file, entry._header ?? entry._id]);
    const selected = new Set([...this.selectedRows].map(key));
    const active = key(oldEntries[this.selectedIdx]);
    this.files[ft] = files;
    this.applyDiskSources(ft, sources, errors);
    const rows = this.entries[ft];
    this.selectedRows = new Set(rows.filter(row => selected.has(key(row))));
    this.selectedIdx = rows.findIndex(row => key(row) === active);
    this.selectionAnchor = rows[this.selectedIdx] || null;
    if (this._fileFilter && !this.filesFor(ft).includes(this._fileFilter)) this._fileFilter = null;
    this.buildFileFilter();
    this.renderTable();
    this.renderDetail();
    this.updatePreview();
    this.updateSidebarBadge(ft, this.readErrors.has(ft) ? '!' : rows.length);
  }

  reportDiskRefreshError(error) {
    const message = String(error);
    if (message === this.lastDiskRefreshError) return;
    this.lastDiskRefreshError = message;
    this.ctx.log.warn('PBS disk refresh failed:', message);
  }

  // ---- Sidebar ----
  buildSidebar() {
    this.sidebar.textContent = '';
    this.categorySelect.textContent = '';
    const types = getAvailableFileTypes(this.version);
    for (const ft of types) {
      const config = getFileTypeConfig(ft);
      if (!config) continue;
      this.categorySelect.appendChild(h('option', { value: ft, textContent: _t(config.label) }));
      const item = h('button', { type: 'button', dataset: { type: ft },
        className: `pbs-sidebar-item ${ft === this.currentFileType ? 'active' : ''}`,
        onClick: () => { this.selectFileType(ft); },
      });
      const label = h('span', { className: 'pbs-sidebar-label', innerHTML: `${config.icon} ${_t(config.label)}` });
      item.appendChild(label);
      const countBadge = badge('...');
      item.appendChild(countBadge);
      this.sidebar.appendChild(item);
      this.loadFileCount(ft, countBadge);
    }
  }

  async loadFileCount(ft, badgeEl) {
    if (!this.filesFor(ft).length) { badgeEl.textContent = '0'; return; }
    if (!this.entries[ft]) {
      await this.ensureEntries(ft);
      // Types loads in the background for every version (sidebar badge count);
      // once it lands, any table already showing type badges needs a repaint
      // to pick up real icon positions instead of the color-swatch fallback.
      if (badgeEl.isConnected && (ft === 'types' || (ft === 'trainer_types' && this.currentFileType === 'trainers'))) {
        this._refreshTypeVisuals();
        if (ft === 'trainer_types') this.updatePreview();
      }
    }
    if (!badgeEl.isConnected || !this.entries[ft]) return;
    badgeEl.textContent = this.readErrors.has(ft) ? '!' : String(this.entries[ft].length);
  }

  // Name (uppercase) -> IconPosition for the type-icon sprite. Null until
  // `entries.types` has loaded (background load kicked off from the sidebar).
  typeIconLookup() {
    const list = this.entries.types;
    if (!list) return null;
    const map = {};
    for (const t of list) {
      const name = (t.InternalName || t.Name || '').toUpperCase();
      const pos = parseInt(this.version >= 21 ? t.IconPosition : t._id);
      if (name && !isNaN(pos)) map[name] = pos;
    }
    return map;
  }

  _refreshTypeVisuals() {
    if (this.currentFileType && !this.closed) this.renderTable();
  }

  // ---- File selection ----
  async selectFileType(ft) {
    if (ft === this.currentFileType) return true;
    if (this.switching || this.saving || this.prompting || this.closed) return false;
    this.switching = true;
    try {
      if (!await this.confirmPending()) return false;
      if (!this._navigating) this.pushHistory();
      await this.openFileType(ft);
      if (!this._navigating) this.pushHistory();
      return true;
    } finally {
      this.switching = false;
      this.categorySelect.value = this.currentFileType || '';
    }
  }

  async openFileType(ft) {
    this.currentFileType = ft;
    if (ft === 'moves') this.loadMoveCategories();
    this.categorySelect.value = ft;
    this.selectedIdx = -1;
    this.mainLayout.classList.remove('show-detail');
    this.searchQuery = '';
    this.searchInput.value = '';
    this._fileFilter = null;

    const items = this.sidebar.querySelectorAll('.pbs-sidebar-item');
    items.forEach(el => {
      const active = el.dataset.type === ft;
      el.classList.toggle('active', active);
      el.setAttribute('aria-pressed', String(active));
    });

    if (!this.entries[ft]) {
      this.renderDetail();
      this.previewPanel.clear();
      this.updateDirtyIndicator();
      this.showLoading(_t('Loading...'));
      await this.ensureEntries(ft);
    } else if (!this.dirty.has(ft)) {
      try {
        const files = await this.discoverPbsFiles();
        const { sources, errors } = await this.readDiskSources(ft, files[ft], this.version);
        if (this.closed) return;
        if (errors.size) this.reportDiskRefreshError(errors.get(ft)?.error);
        else if (!this.sameSources(this.diskSources.get(ft), sources)) {
          this.files[ft] = files[ft];
          this.applyDiskSources(ft, sources, errors);
          this.updateSidebarBadge(ft, this.readErrors.has(ft) ? '!' : this.entries[ft].length);
        }
      } catch (error) {
        this.reportDiskRefreshError(error);
      }
    }
    if (this.closed) return;

    // Select first entry in default sort order (column 0 ascending)
    this._tableSortCol = 0;
    this._tableSortDir = 1;
    if (this.entries[ft]?.length > 0) {
      const config = getFileTypeConfig(ft);
      const sorted = this._sortEntries(this.entries[ft], config, 0, 1);
      this.selectedIdx = this.entries[ft].indexOf(sorted[0]);
    } else {
      this.selectedIdx = -1;
    }

    this.selectRows(this.entries[ft]?.[this.selectedIdx], false, false);
    this.pagination.reset();
    this.buildFileFilter();
    this.renderTable();
    this.renderDetail();
    this.updatePreview();
    this.updateDirtyIndicator();
    this.updateStatusBar();
    this.updateNavButtons();
  }

  // ---- Navigation history ----
  pushHistory(state = { fileType: this.currentFileType, selectedIdx: this.selectedIdx }) {
    if (!state.fileType || state.selectedIdx < 0 || this._navigating) return;
    // Don't push if same as current
    if (this._historyIdx >= 0 && this._history[this._historyIdx]?.fileType === state.fileType && this._history[this._historyIdx]?.selectedIdx === state.selectedIdx) return;
    // Delete forward history when branching
    this._history = this._history.slice(0, this._historyIdx + 1);
    this._history.push(state);
    this._historyIdx = this._history.length - 1;
    this.updateNavButtons();
  }

  updateNavButtons() {
    if (this.backBtn) this.backBtn.disabled = this._historyIdx <= 0;
    if (this.forwardBtn) this.forwardBtn.disabled = this._historyIdx >= this._history.length - 1;
  }

  async goBack() {
    if (this._historyIdx <= 0) return;
    if (await this.restoreHistory(this._history[this._historyIdx - 1])) this._historyIdx--;
    this.updateNavButtons();
  }

  async goForward() {
    if (this._historyIdx >= this._history.length - 1) return;
    if (await this.restoreHistory(this._history[this._historyIdx + 1])) this._historyIdx++;
    this.updateNavButtons();
  }

  async restoreHistory(state) {
    this._navigating = true;
    try {
      if (!await this.selectFileType(state.fileType)) return false;
      this.selectedIdx = Math.min(state.selectedIdx, (this.entries[state.fileType]?.length ?? 0) - 1);
      this.selectRows(this.entries[state.fileType]?.[this.selectedIdx], false, false);
      // Jump to correct page in sorted order
      const ft = state.fileType;
      const config = getFileTypeConfig(ft);
      const sorted = this._sortEntries(this.entries[ft], config, this._tableSortCol ?? 0, this._tableSortDir ?? 1);
      const sortedIdx = sorted.indexOf(this.entries[ft][this.selectedIdx]);
      const page = Math.floor(sortedIdx / this.pageSize);
      this.pagination.setTotal(Math.ceil(this.getPageEntries().length / this.pageSize));
      this.pagination._forcePage(page);
      this.renderTable();
      this.renderDetail();
      this.updatePreview();
      return true;
    } finally {
      this._navigating = false;
    }
  }

  async navigateTo(refType, name) {
    if (!name) return;
    const before = { fileType: this.currentFileType, selectedIdx: this.selectedIdx };
    this._navigating = true;
    try {
      if (!await this.selectFileType(refType)) return;
      const entries = this.entries[refType];
      if (entries) {
        const idx = entries.findIndex(e =>
          (e.InternalName || e.Name || '').toUpperCase() === name.toUpperCase()
        );
        if (idx >= 0) {
          this.selectedIdx = idx;
          this.selectRows(entries[idx], false, false);
          // Find position in sorted order for correct page
          const config = getFileTypeConfig(refType);
          const sorted = this._sortEntries(entries, config, this._tableSortCol ?? 0, this._tableSortDir ?? 1);
          const sortedIdx = sorted.indexOf(entries[idx]);
          const page = Math.floor(sortedIdx / this.pageSize);
          this.pagination.setTotal(Math.ceil(this.getPageEntries().length / this.pageSize));
          this.pagination._forcePage(page);
          this.renderTable();
          this.renderDetail();
          this.updatePreview();
          this._navigating = false;
          this.pushHistory(before);
          this.pushHistory();
          this.showDetail();
        }
      }
    } finally {
      this._navigating = false;
    }
  }

  // ---- Table ----
  // A merged entry (LBDS field-by-field merge) is ONE object shared by every
  // file that touches it — `entry._file` only ever names the first file it was
  // seen in, so filtering by that equality hid every other owner's rows.
  // `projectEntryForFile` (already used for saving) is the real per-file
  // membership test: does this file own at least one field. Rows keep showing
  // the full merged/effective values (not just this file's own) — inherited
  // vs. owned is a per-field color, not a blank cell (see `fieldOwnership`).
  getFileEntries() {
    const entries = this.entries[this.currentFileType] || [];
    return this._fileFilter
      ? entries.filter(entry => projectEntryForFile(entry, this._fileFilter) !== null)
      : entries;
  }

  getPageEntries(entries = this.getFileEntries(), positions) {
    const ft = this.currentFileType;
    if (this.searchQuery) {
      const q = normalizeSearch(this.searchQuery);
      const config = getFileTypeConfig(ft);
      positions ??= new Map(entries.map((entry, index) => [entry, index + 1]));
      entries = entries.filter(r =>
        config.columns.some(c => normalizeSearch(this.tableValue(r, c, positions)).includes(q))
      );
    }
    return entries;
  }

  tableValue(entry, column, positions) {
    if (column.key === '_id' && this.version >= 21 &&
        ['pokemon', 'moves', 'items', 'abilities'].includes(this.currentFileType)) {
      if (positions) return positions.get(entry) ?? '';
      return this.getFileEntries().indexOf(entry) + 1;
    }
    return entry[column.key] ?? '';
  }

  _sortEntries(entries, config, sortCol, sortDir, positions) {
    const col = config?.columns[sortCol];
    if (!col) return entries;
    return entries.slice().sort((a, b) => {
      let va = this.tableValue(a, col, positions), vb = this.tableValue(b, col, positions);
      if (col.statBar) { va = baseStatTotal(va); vb = baseStatTotal(vb); }
      else if (col.numeric) { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; }
      return va < vb ? -sortDir : va > vb ? sortDir : 0;
    });
  }

  sortedEntries(fileEntries = this.getFileEntries(), positions = new Map(fileEntries.map((entry, index) => [entry, index + 1]))) {
    return this._sortEntries(this.getPageEntries(fileEntries, positions), getFileTypeConfig(this.currentFileType), this._tableSortCol ?? 0, this._tableSortDir ?? 1, positions);
  }

  renderTable() {
    this.tableWrap.innerHTML = '';
    this.table = null;
    const ft = this.currentFileType;
    const config = getFileTypeConfig(ft);
    this.updateDirtyIndicator();
    const readError = this.readErrors?.get(ft);
    if (this.scanError || readError) {
      this.showError(this.scanError || _t('Could not read {file}: {error}', readError));
      this.tableWrap.firstChild.appendChild(button(_t('Retry'), async () => {
        if (this.switching || this.saving || this.prompting) return;
        this.switching = true;
        try {
          if (!await this.confirmPending()) return;
          await this.scanPbsDir();
          this.pendingLoads.delete(ft);
          this.readErrors.delete(ft);
          delete this.entries[ft];
          this.buildSidebar();
          await this.openFileType(ft);
        } catch (error) { this.showError(String(error)); }
        finally { this.switching = false; this.updateDirtyIndicator(); }
      }));
      this.pagination.setTotal(0);
      return;
    }
    this.updateStatusBar();
    if (!config || !this.entries[ft]?.length) {
      this.tableWrap.appendChild(h('div', { className: 'pbs-empty', textContent: this.entries[ft]?.length === 0 ? _t('No entries in this file.') : _t('Select a file type.') }));
      this.pagination.setTotal(0);
      return;
    }

    // Sort ALL entries first, then paginate
    const sortCol = this._tableSortCol ?? 0;
    const sortDir = this._tableSortDir ?? 1;
    const fileEntries = this.getFileEntries();
    const positions = new Map(fileEntries.map((entry, index) => [entry, index + 1]));
    const allFiltered = this.sortedEntries(fileEntries, positions);
    const totalPages = Math.max(1, Math.ceil(allFiltered.length / this.pageSize));
    this.pagination.setTotal(totalPages);

    const start = this.pagination.getPage() * this.pageSize;
    const pageRows = allFiltered.slice(start, start + this.pageSize);

    if (!pageRows.length) {
      this.tableWrap.appendChild(h('div', { className: 'pbs-empty', textContent: _t('No entries match search.') }));
      return;
    }

    if (!this.columnWidths.has(ft)) this.columnWidths.set(ft, []);
    this.table = createTable(config.columns, pageRows, {
      widths: this.columnWidths.get(ft),
      measureRows: fileEntries,
      categoryUrl: this.moveCategoryUrl,
      value: (row, column) => this.tableValue(row, column, positions),
      sortCol, sortDir,
      rowIcon: config.rowIcon ? (row) => getIconGraphic(ft, row, this.version) : null,
      trainerIcon: (ft === 'trainers' || ft === 'trainer_types') ? row => this.trainerGraphic(ft, row) : null,
      gameRoot: this.gameRoot,
      loadIcon: (p) => this.loadImageBlob(p),
      typeIconLookup: this.typeIconLookup(),
      cellClass: (row, col) => {
        const o = this.fieldOwnership(row, col.key);
        return o ? `pbs-cell-${o.state}` : '';
      },
      selectedIdx: (() => {
        const idx = allFiltered.indexOf(this.entries[ft][this.selectedIdx]);
        return idx >= start && idx < start + this.pageSize ? idx - start : -1;
      })(),
      isSelected: row => this.selectedRows.has(row),
      onSelect: (pageIdx, row, event) => {
        const realIdx = this.entries[ft].indexOf(row);
        this.pushHistory();
        this.selectedIdx = realIdx;
        this.selectRows(row, event.ctrlKey || event.metaKey, event.shiftKey);
        this.pushHistory();
        this.table.setSelected(pageIdx);
        this.updateDirtyIndicator();
        if (!event.shiftKey && !event.ctrlKey && !event.metaKey) this.showDetail();
        this.renderDetail();
        this.updatePreview();
      },
      onContextMenu: (x, y, pageIdx, row, trigger) => this.openActions(x, y, this.entries[ft].indexOf(row), trigger),
      onSort: (column) => {
        this._tableSortCol = this.table.getSortCol();
        this._tableSortDir = this.table.getSortDir();
        this.renderTable();
        this.tableWrap.querySelectorAll('.pbs-sort')[column]?.focus();
        this.renderDetail();
        this.updatePreview();
      },
    });
    this.tableWrap.appendChild(this.table.el);
    this.table.fit(this.tableWrap.clientWidth);
    this.updateStatusBar();
  }

  // ---- Preview ----
  trainerGraphic(fileType, row) {
    if (fileType === 'trainer_types' || this.version >= 21) return getIconGraphic(fileType, row, this.version);
    const name = String(row.TrainerType || '').toUpperCase();
    const type = this.entries.trainer_types?.find(entry =>
      String(entry.InternalName).toUpperCase() === name || String(entry._id) === name);
    return type ? getIconGraphic('trainer_types', type, this.version) : null;
  }

  async updatePreview() {
    const ft = this.currentFileType;
    const config = getFileTypeConfig(ft);
    const request = this.previewRequest = Symbol();
    const current = () => !this.closed && this.previewRequest === request;
    if (this.scanError || this.readErrors?.has(ft)) { this.previewPanel.clear(); return; }
    this.previewPanel.el.style.display = NO_GRAPHIC_TYPES.has(ft) ? 'none' : '';
    if (NO_GRAPHIC_TYPES.has(ft)) { this.previewPanel.clear(); return; }
    if (!config || this.selectedIdx < 0 || !this.entries[ft]) {
      this.previewPanel.clear();
      return;
    }
    const entry = this.entries[ft][this.selectedIdx];
    if (!entry) { this.previewPanel.clear(); return; }

    if (ft === 'types') {
      const displayVal = entry[config.displayField] || entry[config.headerField] || '';
      const rawPos = this.version >= 21 ? entry.IconPosition : entry._id;
      const iconPos = parseInt(rawPos);
      this.previewPanel.showTypeIcon(displayVal, !isNaN(iconPos) ? iconPos : null);
      return;
    }

    if (ft === 'town_map') {
      const displayVal = entry[config.displayField] || entry.Name || entry._id;
      const resolved = await this.resolveTownMapPath(entry.Filename);
      if (current()) this.previewPanel.show(this.gameRoot, resolved, String(displayVal), 0, { map: true });
      return;
    }

    if (ft === 'pokemon' || ft === 'pokemon_forms') {
      const displayVal = entry[config.displayField] || entry[config.headerField] || '';
      const variants = getPokemonSpriteVariants(ft, entry, this.version);
      const fps = await this.getSpriteFps(entry, ft);
      if (current()) this.previewPanel.showPokemon(this.gameRoot, variants, displayVal, fps);
      return;
    }

    const displayVal = entry[config.displayField] || entry[config.headerField] || '';
    if (ft === 'trainers' || ft === 'trainer_types') {
      const graphic = this.trainerGraphic(ft, entry);
      this.previewPanel.show(this.gameRoot, graphic?.path, displayVal, 10, { trainer: true, fallbackPaths: graphic?.fallbackPaths });
      return;
    }
    this.previewPanel.show(this.gameRoot, getPrimaryGraphic(ft, entry, this.version), displayVal, 0);
  }

  // ---- Detail ----
  makeFieldEditor(fieldDef, val, entry, config) {
    const onNavigate = (refType, name) => this.navigateTo(refType, name);
    const ownership = this.fieldOwnership(entry, fieldDef.key);
    const field = fieldDef.key === 'Flags' && this.version < 21
      ? { ...fieldDef, type: 'text' }
      : fieldDef;
    const target = Object.hasOwn(entry._extra || {}, fieldDef.key) ? entry._extra : entry;
    return createFieldEditor(field, val, (newVal) => {
      target[fieldDef.key] = newVal;
      if (this.currentFileType === 'pokemon_forms' && HEADER_DERIVED.has(fieldDef.key) &&
          /^[a-z0-9_]+$/i.test(entry.InternalName) && /^\d+$/.test(entry.FormIndex)) {
        const separator = this.version >= 21 ? ',' : '-';
        entry._header = `${entry.InternalName}${separator}${entry.FormIndex}`;
      }
      this.markDirty();
      if (config.columns.some(c => c.key === fieldDef.key)) {
        this.renderTable();
      }
    }, this.entries, this.ctx, onNavigate, ownership);
  }

  renderDetail() {
    this.detailPanel.innerHTML = '';
    const ft = this.currentFileType;
    const config = getFileTypeConfig(ft);
    if (this.scanError || this.readErrors?.has(ft) || !config || this.selectedIdx < 0 || !this.entries[ft]) return;

    const entry = this.entries[ft][this.selectedIdx];
    if (!entry) return;

    const header = h('div', { className: 'pbs-detail-header' });
    const displayVal = entry[config.displayField] || entry[config.headerField] || `Entry ${this.selectedIdx + 1}`;
    header.appendChild(h('span', { textContent: displayVal }));
    if (entry._excluded) {
      header.appendChild(h('span', { textContent: _t('[Excluded]'), style: { color: 'var(--warning)', fontSize: '10px' } }));
    }
    this.detailPanel.appendChild(header);

    if (config.hasSubSections) {
      this.renderSubSectionDetail(ft, config, entry);
      return;
    }

    const body = h('div', { className: 'pbs-detail-body' });

    if (config.sections?.length) {
      for (const section of config.sections) {
        const toggle = createSectionToggle(section.label);
        body.appendChild(toggle.toggle);
        for (const fieldDef of section.fields) {
          const val = entry[fieldDef.key] || '';
          const editor = this.makeFieldEditor(fieldDef, val, entry, config);
          toggle.body.appendChild(editor);
        }
        body.appendChild(toggle.body);
      }
    } else {
      for (const fieldDef of (config.fields || [])) {
        const val = entry[fieldDef.key] || '';
        const editor = this.makeFieldEditor(fieldDef, val, entry, config);
        body.appendChild(editor);
      }
    }

    if (this.version >= 21 && Object.hasOwn(entry._extra || {}, 'Flags')) {
      body.append(this.makeFieldEditor({ key: 'Flags', label: 'Flags', type: 'list', fullWidth: true }, entry._extra.Flags, entry, config));
    }
    this.detailPanel.appendChild(body);
  }

  renderSubSectionDetail(ft, config, entry) {
    const body = h('div', { className: 'pbs-detail-body', style: { display: 'block', padding: '8px 10px' } });

    for (const section of (config.sections || [])) {
      for (const fieldDef of section.fields) {
        const val = entry[fieldDef.key] || '';
        const editor = this.makeFieldEditor(fieldDef, val, entry, config);
        body.appendChild(editor);
      }
    }

    if (ft === 'encounters') {
      body.appendChild(createEncounterEditor(entry, () => this.markDirty(), () => this.renderDetail(), this.entries, (refType, name) => this.navigateTo(refType, name)));
    } else if (ft === 'trainers') {
      body.appendChild(createTrainerPokemonEditor(entry, () => this.markDirty(), () => this.renderDetail(), this.entries, this.ctx, (refType, name) => this.navigateTo(refType, name)));
    }

    this.detailPanel.appendChild(body);
  }

  // Short label for a file within this type's group: "pokemon.txt" → "Base",
  // "pokemon_test_msmod.json" → "test_msmod". Shared by the filter dropdown
  // and the per-field ownership tags.
  fileLabel(fname) {
    const baseName = getFilename(this.currentFileType, this.version).replace(/\.txt$/i, '');
    return fname.replace(/\.(txt|json)$/i, '').slice(baseName.length + 1) || _t('Base');
  }

  // Per-field ownership badge for the LBDS multi-file merge — null means "no
  // badge, render plain". Two views:
  //  - filtered to one file: fields that file doesn't own show the inherited
  //    (merged) value grayed out, tagged with the real owner, and an "adopt"
  //    action that starts overriding the field in the active file.
  //  - "All files": fields whose effective value comes from a file other than
  //    the base get tagged so the override is visible without switching tabs.
  fieldOwnership(entry, key) {
    if (!this.lbds || key.startsWith('_') || HEADER_DERIVED.has(key)) return null;
    if ((this.files[this.currentFileType]?.length || 0) <= 1) return null;
    const owner = entry._fieldFiles?.[key] || entry._file;
    if (this._fileFilter) {
      if (owner === this._fileFilter) return null;
      return {
        state: 'inherited',
        tag: this.fileLabel(owner),
        title: _t('Inherited from {file}', { file: owner }),
        onAdopt: () => {
          (entry._fieldFiles ||= {})[key] = this._fileFilter;
          this.markDirty();
          this.renderDetail();
        },
      };
    }
    if (owner === entry._file) return null;
    return { state: 'overridden', tag: this.fileLabel(owner), title: _t('Overridden by {file}', { file: owner }) };
  }

  // Only worth showing on v21, where a pack can drop `<base>_<suffix>.txt`
  // extras next to the base file; earlier versions only ever have the one.
  buildFileFilter() {
    this.fileFilterBar.innerHTML = '';
    const files = this.files[this.currentFileType] || [];
    if (this.version !== 21 || files.length <= 1) {
      this.fileFilterBar.style.display = 'none';
      return;
    }
    this.fileFilterBar.style.display = '';
    const sel = h('select', { 'aria-label': _t('Source file'), className: 'pbs-file-select' });
    sel.appendChild(h('option', { value: '', textContent: _t('All files') }));
    for (const f of files) {
      sel.appendChild(h('option', { value: f, textContent: this.fileLabel(f) }));
    }
    sel.value = this._fileFilter || '';
    sel.addEventListener('change', () => this.setFileFilter(sel.value || null));
    this.fileFilterBar.appendChild(sel);
  }

  setFileFilter(filter) {
    this._fileFilter = filter;
    this.buildFileFilter();
    const ft = this.currentFileType;
    const entries = this.entries[ft];
    if (entries && this.selectedIdx >= 0) {
      const selectedEntry = entries[this.selectedIdx];
      const filtered = this.getPageEntries();
      if (!filtered.some(r => (r.__real || r) === selectedEntry) && filtered.length > 0) {
        this.selectedIdx = entries.indexOf(filtered[0].__real || filtered[0]);
      }
    }
    this.pagination.reset();
    this.renderTable();
    this.renderDetail();
    this.updatePreview();
    this.updateStatusBar();
  }

  // ---- Save ----
  // Each entry goes back to the file it was read from, so an extra file's
  // entries never get merged into the base file (and vice versa).
  async saveFileType(ft) {
    const entries = this.entries[ft];
    // First known file is the fallback for entries with no remembered source —
    // NOT always the .txt base: creating it would make the compiler ignore a
    // same-named .json the file type is actually stored in.
    const base = this.filesFor(ft)[0];
    if (this.scanError || this.readErrors.has(ft) || !entries || !base) throw new Error(_t('The PBS files are unavailable.'));

    const readLatest = async () => {
      const listed = await this.discoverPbsFiles();
      const disk = await this.readDiskSources(ft, listed[ft], this.version);
      if (disk.errors.size) throw new Error(_t('The PBS files are unavailable.'));
      return { ...disk, files: listed[ft] };
    };
    const disk = await readLatest();
    const baseline = this.diskSources.get(ft);
    if (!this.sameSources(baseline, disk.sources)) {
      const choice = await this.ctx.ui.showUnsavedChangesDialog({
        title: _t('PBS files changed on disk'),
        message: _t('Discard your local edits to load the disk version, or overwrite the files with your edits.'),
        saveLabel: _t('Overwrite'),
        discardLabel: _t('Discard'),
      });
      if (this.closed || (choice !== 'save' && choice !== 'discard')) return false;
      const latest = await readLatest();
      if (choice === 'discard') {
        this.dirty.delete(ft);
        this.reloadDiskCategory(ft, latest.files, latest.sources, latest.errors);
        return null;
      }
      if (!this.sameSources(disk.sources, latest.sources)) {
        throw new Error(_t('The PBS files changed again. Try saving again.'));
      }
    }
    const groups = new Map(this.filesFor(ft).map(f => [f, []]));
    for (const entry of entries) {
      if (!entry._fieldFiles) {
        // Created in the UI — belongs whole to a single file.
        const fname = groups.has(entry._file) ? entry._file : base;
        if (!groups.has(fname)) groups.set(fname, []);
        groups.get(fname).push(entry);
        continue;
      }
      // Merged entry: each field goes back to the file it came from.
      for (const fname of groups.keys()) {
        const proj = projectEntryForFile(entry, fname);
        if (proj) groups.get(fname).push(proj);
      }
    }
    const outputs = Array.from(groups, ([fname, group]) => [fname, /\.json$/i.test(fname)
      ? writeJsonPbs(group, ft)
      : writePbsFile(group, ft, this.version)]);
    for (const [fname, content] of outputs) {
      const path = 'PBS/' + fname;
      const actual = await this.ctx.fs.projectExists(path) ? await this.readFile(path) : undefined;
      if (actual !== disk.sources.get(fname)) {
        throw new Error(_t('The PBS files changed again. Try saving again.'));
      }
      await this.ctx.fs.writeProjectFile(path, content);
      baseline.set(fname, content);
      this.diskSources.set(ft, new Map(baseline));
    }

    this.dirty.delete(ft);
    this.originalEntries[ft] = structuredClone(entries);
    return [...groups.keys()].join(', ');
  }

  async saveTypes(types) {
    if (this.saving) return false;
    this.saving = true;
    const focused = this.host.ownerDocument.activeElement;
    this.root.inert = true;
    this.updateDirtyIndicator();
    try {
      for (const type of types) {
        const files = await this.saveFileType(type);
        if (files === false) return false;
        if (files) this.ctx.ui.showToast({ message: _t('Saved {file}', { file: files }), level: 'info' });
      }
      return true;
    } catch (error) {
      this.ctx.ui.showToast({ message: _t('Save failed: {error}', { error: String(error) }), level: 'error' });
      return false;
    } finally {
      this.saving = false;
      this.root.inert = false;
      this.updateDirtyIndicator();
      if (this.root.contains(focused)) focused.focus();
    }
  }

  async confirmPending() {
    if (this.closed || this.saving || this.prompting) return false;
    if (!this.dirty.size) return true;
    this.prompting = true;
    try {
      const result = await this.ctx.ui.showUnsavedChangesDialog({
        message: _t('You have unsaved changes in the PBS Editor.'),
      });
      if (result === 'save') return await this.saveTypes([...this.dirty]);
      if (result !== 'discard') return false;
      for (const type of this.dirty) this.entries[type] = structuredClone(this.originalEntries[type]);
      this.dirty.clear();
      return true;
    } finally {
      this.prompting = false;
    }
  }

  saveCurrentFile() {
    if (!this.switching && this.dirty.has(this.currentFileType)) return this.saveTypes([this.currentFileType]);
  }

  async discardChanges() {
    const ft = this.currentFileType;
    if (!ft || !this.dirty.has(ft)) return;
    const confirmed = await this.ctx.ui.showConfirmDialog({
      title: _t('Discard Changes'),
      message: _t('Discard all unsaved changes in {fileType}?', { fileType: ft }),
      danger: true,
    });
    if (!confirmed) return;
    const orig = this.originalEntries[ft];
    if (orig) this.entries[ft] = JSON.parse(JSON.stringify(orig));
    // Discarding can shrink the list past the selection.
    this.selectedIdx = Math.min(this.selectedIdx, this.entries[ft].length - 1);
    this.selectRows(this.entries[ft][this.selectedIdx], false, false);
    this.dirty.delete(ft);
    this.updateDirtyIndicator();
    this.renderTable();
    this.renderDetail();
    this.updatePreview();
    this.updateStatusBar();
    await this.refreshExternalChanges();
  }

  markDirty() {
    this.dirty.add(this.currentFileType);
    this.updateDirtyIndicator();
  }

  updateDirtyIndicator() {
    const type = this.currentFileType;
    const ready = !!this.entries[type] && !this.scanError && !this.readErrors?.has(type) && !this.saving;
    this.saveButton.disabled = !ready || !this.dirty.has(type);
    this.discardButton.disabled = !ready || !this.dirty.has(type);
    this.newButton.disabled = !ready;
    const selected = this.actionEntries();
    const count = selected.length;
    this.duplicateButton.disabled = this.deleteButton.disabled = this.excludeButton.disabled = !ready || !count;
    const include = count && selected.every(row => row._excluded);
    this.excludeLabel.textContent = _t(include
      ? (count > 1 ? 'Include selected' : 'Include entry')
      : (count > 1 ? 'Exclude selected' : 'Exclude entry'));
    this.selectionCount.textContent = count ? _t('{count} selected', { count }) : '';
    if (this.dirty.size > 0) {
      this.dirtyIndicator.hidden = false;
      this.dirtyIndicator.textContent = _t('Unsaved changes');
    } else {
      this.dirtyIndicator.hidden = true;
    }
  }

  updateStatusBar() {
    const ft = this.currentFileType;
    const entries = this.entries[ft];
    const count = entries?.length || 0;
    const filtered = this.getPageEntries().length;
    this.statusCount.textContent = filtered === count ? _t('{count} entries', { count }) : _t('{filtered} / {count}', { filtered, count });
    const files = ft ? this.filesFor(ft) : [];
    this.statusFile.title = files.map(file => 'PBS/' + file).join(', ');
    this.statusFile.textContent = files.length
      ? `PBS/${files[0]}` + (files.length > 1 ? ` +${files.length - 1}` : '')
      : '';
  }

  // ---- CRUD ----
  async addEntry() {
    const ft = this.currentFileType;
    if (!ft || this.newButton.disabled || this.switching) return;
    const config = getFileTypeConfig(ft);

    const name = await this.ctx.ui.showInputDialog({
      title: _t('New Entry'),
      message: _t('Enter name for new {type} entry:', { type: _t(config.label) }),
      placeholder: 'INTERNAL_NAME',
    });
    if (!name) return;

    const entries = this.entries[ft];
    const newEntry = {
      _id: entries.length + 1, _header: name, _excluded: false,
      _file: this.filesFor(ft)[0], Name: name, InternalName: name,
    };

    const allFields = (config.sections || []).flatMap(s => s.fields).concat(config.fields || []);
    for (const f of allFields) {
      if (!newEntry[f.key]) newEntry[f.key] = '';
    }
    if (ft === 'encounters') newEntry._encounters = [];
    if (ft === 'trainers') newEntry._pokemon = [];

    entries.push(newEntry);
    this.selectRows(newEntry, false, false);
    this.selectedIdx = entries.length - 1;
    this._fileFilter = null;
    this.buildFileFilter();

    this.revealEntry(newEntry);
    this.renderTable();
    this.renderDetail();
    this.updatePreview();
    this.markDirty();
    this.updateSidebarBadge(ft, entries.length);
    this.showDetail();
  }

  revealEntry(entry) {
    this.searchInput.value = this.searchQuery = '';
    const rows = this.sortedEntries();
    this.pagination.setTotal(Math.ceil(rows.length / this.pageSize));
    this.pagination._forcePage(Math.floor(rows.indexOf(entry) / this.pageSize));
  }

  async deleteEntries(selected) {
    const ft = this.currentFileType;
    const entries = this.entries[ft];
    if (!selected.length || this.switching || this.saving || this.prompting) return;
    const config = getFileTypeConfig(ft);
    const first = selected[0];
    const name = first[config.displayField] || first[config.headerField] || `#${entries.indexOf(first) + 1}`;
    this.prompting = true;
    let confirmed;
    try {
      confirmed = await this.ctx.ui.showConfirmDialog({
        title: _t(selected.length === 1 ? 'Delete Entry' : 'Delete entries'),
        message: selected.length === 1
          ? _t('Delete "{name}"? This cannot be undone.', { name })
          : _t('Delete {count} selected entries?', { count: selected.length }),
        danger: true,
      });
    } finally {
      this.prompting = false;
    }
    if (!confirmed || this.closed || this.entries[ft] !== entries || this.currentFileType !== ft) return;

    const deleted = new Set(selected);
    const active = entries[this.selectedIdx];
    this.entries[ft] = entries.filter(entry => !deleted.has(entry));
    for (const entry of deleted) this.selectedRows.delete(entry);
    const remaining = this.entries[ft];
    this.selectedIdx = deleted.has(active) ? Math.min(this.selectedIdx, remaining.length - 1) : remaining.indexOf(active);
    if (!this.selectedRows.size) this.selectRows(remaining[this.selectedIdx], false, false);
    this.refreshEntries(ft);
  }

  duplicateEntries(selected) {
    if (!selected.length || this.switching || this.saving || this.prompting) return;
    const ft = this.currentFileType;
    const entries = this.entries[ft];
    const headers = new Set(entries.map(entry => entry._header));
    let nextId = entries.reduce((max, entry) => Math.max(max, Number(entry._id) || 0), 0) + 1;
    const copies = selected.map(entry => {
      const copy = structuredClone(entry);
      delete copy._fieldFiles;
      delete copy._overridden;
      let suffix = '_COPY';
      for (let i = 2; headers.has(entry._header + suffix); i++) suffix = '_COPY' + i;
      copy._id = nextId++;
      copy._header += suffix;
      headers.add(copy._header);
      if (copy.Name) copy.Name += suffix.replace('_COPY', ' Copy');
      if (copy.InternalName) copy.InternalName += suffix;
      return copy;
    });
    entries.push(...copies);
    this.selectedIdx = entries.length - copies.length;
    this.selectedRows = new Set(copies);
    this.selectionAnchor = copies[0];
    this._fileFilter = null;
    this.buildFileFilter();
    this.revealEntry(copies[0]);
    this.refreshEntries(ft);
    if (copies.length === 1) this.showDetail();
  }

  toggleExcluded(selected) {
    if (!selected.length || this.switching || this.saving || this.prompting) return;
    const exclude = selected.some(entry => !entry._excluded);
    for (const entry of selected) entry._excluded = exclude;
    this.renderTable();
    this.renderDetail();
    this.markDirty();
  }

  refreshEntries(ft) {
    this.markDirty();
    this.renderTable();
    this.renderDetail();
    this.updatePreview();
    this.updateSidebarBadge(ft, this.entries[ft].length);
  }

  updateSidebarBadge(ft, count) {
    const types = getAvailableFileTypes(this.version);
    const items = this.sidebar.querySelectorAll('.pbs-sidebar-item');
    const idx = types.indexOf(ft);
    if (idx >= 0 && items[idx]) {
      const b = items[idx].querySelector('.pbs-sidebar-badge');
      if (b) b.textContent = String(count);
    }
  }

  showLoading(msg) {
    this.tableWrap.innerHTML = '';
    this.tableWrap.appendChild(h('div', { className: 'pbs-loading', role: 'status', textContent: msg || _t('Loading...') }));
  }

  showError(msg) {
    this.tableWrap.innerHTML = '';
    this.tableWrap.appendChild(h('div', { className: 'pbs-empty pbs-error', role: 'alert', textContent: msg }));
  }

  dispose() {
    this.closed = true;
    this.stopDiskWatch?.();
    this.layoutObserver.disconnect();
    this.numberFields.disconnect();
    this.numberWidths.disconnect();
    if (this.moveCategoryUrl) URL.revokeObjectURL(this.moveCategoryUrl);
    this.previewPanel.clear();
    this.cleanupResize?.();
    this.host.querySelector('.pbs-ctx-menu')?._cleanup?.();
  }

  async readFile(path) {
    return await this.ctx.fs.readProjectFile(path);
  }
}
