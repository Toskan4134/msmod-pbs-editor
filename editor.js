/**
 * PBS Editor v2 — main UI controller.
 * 3-column dialog: sidebar | table+pagination | preview+detail
 */

import {
  badge,
  button,
  clearTypeIcons,
  configureTypeIcons,
  createEncounterEditor,
  createFieldEditor,
  createPagination, createPreviewPanel, createSectionToggle,
  createTable,
  createTrainerPokemonEditor,
  h,
  searchBox,
  showContextMenu,
} from './components.js';
import { getFileTypeConfig, getPrimaryGraphic } from './file-types.js';
import { getAvailableFileTypes, getFilename, matchFileType, parsePbsFile } from './parsers.js';
import { parseJsonPbs, writeJsonPbs } from './json.js';
import { CSS } from './styles.js';
import { writePbsFile } from './writers.js';

let _t = s => s;
export function setI18n(tFn) { _t = tFn; }

// ---- Toolbar SVG icons (14px, Lucide-style) ----
const _tbSvg = (d) => `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle">${d}</svg>`;
const ICON_SAVE  = _tbSvg('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>');
const ICON_TRASH = _tbSvg('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>');
const ICON_DISCARD = _tbSvg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>');

const PAGE_SIZE = 50;

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

  async loadMetrics() {    if (this._metricsCache) return this._metricsCache;
    this._metricsCache = {};
    try {
      const fname = this.version >= 21 ? 'pokemon_metrics.txt' : '';
      if (!fname) return this._metricsCache;
      const raw = await this.readFile('PBS/' + fname);
      const lines = raw.split(/\r?\n/);
      for (const line of lines) {
        const t = line.trim();
        const m = t.match(/^\[(.+?)\](!exclude)?$/);
        if (!m) continue;
        const name = m[1];
        // Scan following lines for Speed
        const idx = lines.indexOf(line);
        let speed = null;
        for (let j = idx + 1; j < lines.length; j++) {
          const lt = lines[j].trim();
          if (lt.startsWith('[')) break;
          if (lt.startsWith('Speed')) {
            const eq = lt.indexOf('=');
            if (eq >= 0) speed = parseInt(lt.slice(eq + 1).trim());
          }
        }
        if (speed != null) this._metricsCache[name] = speed;
      }
    } catch { /* metrics file may not exist */ }
    return this._metricsCache;
  }

  spriteSpeedToFps(speed) {
    if (speed == null) return undefined;
    if (speed === 0) return 0;
    const delayMs = Math.round((speed / 2.0) * 60);
    return delayMs > 0 ? 1000 / delayMs : undefined;
  }

  async getSpriteFps(entry, fileType) {
    if (fileType !== 'pokemon' && fileType !== 'pokemon_forms') return undefined;
    const name = entry.InternalName || '';
    const metrics = await this.loadMetrics();
    const speed = metrics[name];
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

    this.root.tabIndex = 0;
    this.root.addEventListener('keydown', (e) => this.onKeyDown(e));

    this.loadSavedVersion();
  }

  buildToolbar() {
    this.toolbar = h('div', { className: 'pbs-toolbar' });
    this.toolbar.appendChild(h('span', { className: 'pbs-toolbar-title', textContent: _t('PBS Editor') }));
    this.toolbar.appendChild(h('div', { className: 'pbs-toolbar-sep' }));
    this.backBtn = h('button', { className: 'pbs-btn', textContent: '←', onClick: () => this.goBack(), disabled: true });
    this.forwardBtn = h('button', { className: 'pbs-btn', textContent: '→', onClick: () => this.goForward(), disabled: true });
    this.toolbar.appendChild(this.backBtn);
    this.toolbar.appendChild(this.forwardBtn);
    this.toolbar.appendChild(h('div', { className: 'pbs-toolbar-sep' }));
    this.versionSelect = h('select', { className: 'pbs-search', style: { width: '70px', fontSize: '11px' } });
    for (const v of [16, 17, 21]) {
      this.versionSelect.appendChild(h('option', { value: String(v), textContent: `v${v}` }));
    }
    this.versionSelect.appendChild(h('option', { value: 'lbds', textContent: 'LBDS' }));
    this.versionSelect.addEventListener('change', () => {
      const lbds = this.versionSelect.value === 'lbds';
      const v = lbds ? 21 : parseInt(this.versionSelect.value);
      if (v !== this.version || lbds !== this.lbds) this.initWithVersion(v, lbds);
    });
    this.toolbar.appendChild(this.versionSelect);
    this.fileFilterBar = h('div', { className: 'pbs-file-filter-bar', style: { display: 'none' } });
    this.toolbar.appendChild(this.fileFilterBar);
    this.toolbar.appendChild(h('div', { className: 'pbs-toolbar-sep' }));
    this.toolbar.appendChild(h('div', { className: 'pbs-toolbar-spacer' }));
    this.searchInput = searchBox(_t('Search entries...'), (q) => { this.searchQuery = q; this.pagination.reset(); this.renderTable(); });
    this.toolbar.appendChild(this.searchInput);
    this.dirtyIndicator = h('span', { style: { display: 'none' } });
    this.toolbar.appendChild(this.dirtyIndicator);
    this.toolbar.appendChild(button(`${ICON_SAVE} ${_t('Save')}`, () => this.saveCurrentFile(), 'primary'));
    this.toolbar.appendChild(button(`${ICON_DISCARD} ${_t('Discard')}`, () => this.discardChanges()));
    this.toolbar.appendChild(button(_t('+ New'), () => this.addEntry()));
    this.toolbar.appendChild(button(`${ICON_TRASH} ${_t('Delete')}`, () => this.deleteEntry(), 'danger'));
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
    this.centerCol.appendChild(this.tableWrap);
    this.pagination = createPagination((page) => this.renderTable());
    this.centerCol.appendChild(this.pagination.el);
    this.mainLayout.appendChild(this.centerCol);

    // Right: preview + detail
    this.rightCol = h('div', { className: 'pbs-right' });
    this.previewPanel = createPreviewPanel((p) => this.loadImageBlob(p));
    this.rightCol.appendChild(this.previewPanel.el);
    this.detailPanel = h('div', { className: 'pbs-detail' });
    this.rightCol.appendChild(this.detailPanel);
    this.mainLayout.appendChild(this.rightCol);

    this.root.appendChild(this.mainLayout);
  }

  buildStatusBar() {
    this.statusBar = h('div', { className: 'pbs-status' });
    this.statusCount = h('span', { textContent: '' });
    this.statusBar.appendChild(this.statusCount);
    this.statusBar.appendChild(h('div', { className: 'pbs-status-spacer' }));
    this.statusFile = h('span', { textContent: '' });
    this.statusBar.appendChild(this.statusFile);
    this.root.appendChild(this.statusBar);
  }

  // ---- Keyboard ----
  onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      this.saveCurrentFile();
      return;
    }
    const ft = this.currentFileType;
    if (!ft) return;
    const entries = this.entries[ft];
    if (!entries?.length) return;

    // Don't hijack arrows while the user is typing in a field or navigating a
    // suggestion dropdown — only move the selected entry from the list itself.
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const newIdx = Math.max(0, Math.min(entries.length - 1, this.selectedIdx + dir));
      if (newIdx !== this.selectedIdx) {
        this.selectedIdx = newIdx;
        this.renderTable();
        this.renderDetail();
        this.updatePreview();
      }
    }
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
    if (saved === null) {
      try {
        if (await this.ctx.editor.isLbdsProject?.()) saved = 'lbds';
      } catch { /* detection unavailable — fall through to default */ }
    }

    const lbds = saved === 'lbds';
    let v = lbds ? 21 : parseInt(saved);
    if (!v || ![16, 17, 21].includes(v)) v = 21;
    this.versionSelect.value = lbds ? 'lbds' : String(v);
    try {
      await this.initWithVersion(v, lbds);
    } catch (e) {
      console.error('PBS Editor init failed:', e);
      this.showError('Init failed: ' + (e?.message || e));
    }
  }

  async initWithVersion(v, lbds = false) {
    this.version = v;
    this.lbds = lbds;
    this.versionSelect.value = lbds ? 'lbds' : String(v);
    this.entries = {};
    this.originalEntries = {};
    this.selectedIdx = -1;
    this.currentFileType = null;
    this.dirty.clear();
    this.gameRoot = '';
    try { this.gameRoot = this.ctx.editor?.gameRoot?.() || ''; } catch {}

    try { await this.ctx.storage.set('pbs_version', lbds ? 'lbds' : String(v)); } catch {}

    clearTypeIcons();
    this.loadTypeIcons();

    await this.scanPbsDir();
    this.buildSidebar();
    this.pagination.reset();
    this.renderDetail();
    this.previewPanel.clear();
    this.updateDirtyIndicator();
    this.updateStatusBar();

    const types = getAvailableFileTypes(this.version);
    if (types.length) await this.selectFileType(types[0]);
  }

  // ---- PBS files ----
  // A file type can span several files: the base one plus any `<base>_*.txt`
  // (or `<base>_*.json` on La Base de Sky) extras a pack dropped in, which
  // Essentials compiles together.
  async scanPbsDir() {
    this.files = {};
    let names = [];
    try {
      const list = await this.ctx.fs.listProjectDir('PBS/');
      names = (list || [])
        .map(e => (typeof e === 'string' ? e : e?.name || e?.path || ''))
        .map(n => n.split(/[\\/]/).pop())
        .filter(n => (this.lbds ? /\.(txt|json)$/i : /\.txt$/i).test(n));
    } catch { /* no listing available — fall back to the base file only */ }

    if (this.lbds) {
      // Mirror the compiler: a .txt always wins over a .json with the same base
      // name, so editing that .json would have no effect in-game.
      const txtBases = new Set(names.filter(n => /\.txt$/i.test(n)).map(n => n.replace(/\.txt$/i, '')));
      names = names.filter(n => !/\.json$/i.test(n) || !txtBases.has(n.replace(/\.json$/i, '')));
    }

    for (const name of names.sort()) {
      const ft = matchFileType(name, this.version, this.lbds);
      if (!ft) continue;
      (this.files[ft] ||= []).push(name);
    }
    // Base file first: it's where new entries go, and it keeps compile order.
    for (const ft of Object.keys(this.files)) {
      const base = getFilename(ft, this.version);
      this.files[ft].sort((a, b) => (a === base ? -1 : b === base ? 1 : 0));
    }
  }

  filesFor(ft) {
    if (this.files[ft]?.length) return this.files[ft];
    const base = getFilename(ft, this.version);
    return base ? [base] : [];
  }

  async loadEntries(ft) {
    const all = [];
    const byHeader = new Map();
    for (const fname of this.filesFor(ft)) {
      let parsed;
      try {
        const content = await this.readFile('PBS/' + fname);
        // `partial` (LBdS): repeated sections merge field-by-field across
        // files, so an override file (txt or json) may hold only the fields it
        // changes — sections without Name must not be dropped.
        parsed = /\.json$/i.test(fname)
          ? parseJsonPbs(content, ft)
          : parsePbsFile(content, ft, this.version, this.lbds);
      } catch { continue; /* file listed but unreadable — skip it */ }
      for (const entry of parsed) {
        entry._file = fname;   // remembered so saving writes it back where it came from
        stampFieldFiles(entry, fname);
        const key = String(entry._header ?? entry._id);
        const prev = byHeader.get(key);
        // Vanilla Essentials has no cross-file section merge: list everything.
        // Encounters/trainers compile as whole-section replacement even on
        // LBdS; showing only the winner would delete the loser on save, so
        // both stay listed (the per-file filter tells them apart).
        if (!prev || !this.lbds || ft === 'encounters' || ft === 'trainers') {
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

  // ---- Sidebar ----
  buildSidebar() {
    this.sidebar.innerHTML = '';
    const types = getAvailableFileTypes(this.version);
    for (const ft of types) {
      const config = getFileTypeConfig(ft);
      if (!config) continue;
      const item = h('div', {
        className: `pbs-sidebar-item ${ft === this.currentFileType ? 'active' : ''}`,
        onClick: () => { if (!this._navigating) this.pushHistory(); this.selectFileType(ft); },
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
      this.entries[ft] = await this.loadEntries(ft);
      this.originalEntries[ft] = JSON.parse(JSON.stringify(this.entries[ft]));
    }
    badgeEl.textContent = String(this.entries[ft].length);
  }

  // ---- File selection ----
  async selectFileType(ft) {
    if (this.currentFileType && this.dirty.has(this.currentFileType)) {
      const confirmed = await this.ctx.ui.showConfirmDialog({
        title: _t('Unsaved Changes'),
        message: _t('You have unsaved changes in {fileType}. Discard?', { fileType: this.currentFileType }),
        danger: true,
      });
      if (!confirmed) return;
      const orig = this.originalEntries[this.currentFileType];
      if (orig) this.entries[this.currentFileType] = JSON.parse(JSON.stringify(orig));
      this.dirty.delete(this.currentFileType);
    }

    this.currentFileType = ft;
    this.searchQuery = '';
    this.searchInput.value = '';
    this._fileFilter = null;

    const items = this.sidebar.querySelectorAll('.pbs-sidebar-item');
    const types = getAvailableFileTypes(this.version);
    items.forEach((el, i) => el.classList.toggle('active', types[i] === ft));

    if (!this.entries[ft]) {
      this.showLoading(_t('Loading...'));
      this.entries[ft] = await this.loadEntries(ft);
      this.originalEntries[ft] = JSON.parse(JSON.stringify(this.entries[ft]));
    }

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
  pushHistory() {
    if (!this.currentFileType || this.selectedIdx < 0 || this._navigating) return;
    const state = { fileType: this.currentFileType, selectedIdx: this.selectedIdx };
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
    this._historyIdx--;
    await this.restoreHistory(this._history[this._historyIdx]);
  }

  async goForward() {
    if (this._historyIdx >= this._history.length - 1) return;
    this._historyIdx++;
    await this.restoreHistory(this._history[this._historyIdx]);
  }

  async restoreHistory(state) {
    this._navigating = true;
    try {
      await this.selectFileType(state.fileType);
      this.selectedIdx = state.selectedIdx;
      // Jump to correct page in sorted order
      const ft = state.fileType;
      const config = getFileTypeConfig(ft);
      const sorted = this._sortEntries(this.entries[ft], config, this._tableSortCol ?? 0, this._tableSortDir ?? 1);
      const sortedIdx = sorted.indexOf(this.entries[ft][this.selectedIdx]);
      const page = Math.floor(sortedIdx / PAGE_SIZE);
      this.pagination._forcePage?.(page);
      this.renderTable();
      this.renderDetail();
      this.updatePreview();
    } finally {
      this._navigating = false;
    }
  }

  async navigateTo(refType, name) {
    if (!name) return;
    this.pushHistory();
    this._navigating = true;
    try {
      await this.selectFileType(refType);
      const entries = this.entries[refType];
      if (entries) {
        const idx = entries.findIndex(e =>
          (e.InternalName || e.Name || '').toUpperCase() === name.toUpperCase()
        );
        if (idx >= 0) {
          this.selectedIdx = idx;
          // Find position in sorted order for correct page
          const config = getFileTypeConfig(refType);
          const sorted = this._sortEntries(entries, config, this._tableSortCol ?? 0, this._tableSortDir ?? 1);
          const sortedIdx = sorted.indexOf(entries[idx]);
          const page = Math.floor(sortedIdx / PAGE_SIZE);
          this.pagination._forcePage?.(page);
          this.renderTable();
          this.renderDetail();
          this.updatePreview();
          this.pushHistory();
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
  getPageEntries() {
    const ft = this.currentFileType;
    let entries = this.entries[ft];
    if (!entries) return [];
    if (this._fileFilter) {
      entries = entries.filter(e => projectEntryForFile(e, this._fileFilter) !== null);
    }
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      const config = getFileTypeConfig(ft);
      entries = entries.filter(r =>
        config.columns.some(c => String(r[c.key] ?? '').toLowerCase().includes(q))
      );
    }
    return entries;
  }

  _sortEntries(entries, config, sortCol, sortDir) {
    const col = config.columns[sortCol];
    if (!col) return entries;
    return entries.slice().sort((a, b) => {
      let va = a[col.key] ?? '', vb = b[col.key] ?? '';
      if (col.numeric) { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; }
      return va < vb ? -sortDir : va > vb ? sortDir : 0;
    });
  }

  renderTable() {
    this.tableWrap.innerHTML = '';
    const ft = this.currentFileType;
    const config = getFileTypeConfig(ft);
    if (!config || !this.entries[ft]?.length) {
      this.tableWrap.appendChild(h('div', { className: 'pbs-empty', textContent: this.entries[ft]?.length === 0 ? _t('No entries in this file.') : _t('Select a file type.') }));
      this.pagination.setTotal(0);
      return;
    }

    // Sort ALL entries first, then paginate
    const sortCol = this._tableSortCol ?? 0;
    const sortDir = this._tableSortDir ?? 1;
    const allFiltered = this._sortEntries(this.getPageEntries(), config, sortCol, sortDir);

    const page = this.pagination.getPage();
    const totalPages = Math.max(1, Math.ceil(allFiltered.length / PAGE_SIZE));
    this.pagination.setTotal(totalPages);

    const start = page * PAGE_SIZE;
    const pageRows = allFiltered.slice(start, start + PAGE_SIZE);

    if (!pageRows.length) {
      this.tableWrap.appendChild(h('div', { className: 'pbs-empty', textContent: _t('No entries match search.') }));
      return;
    }

    this.table = createTable(config.columns, pageRows, {
      sortCol, sortDir,
      cellClass: (row, col) => {
        const o = this.fieldOwnership(row, col.key);
        return o ? `pbs-cell-${o.state}` : '';
      },
      selectedIdx: (() => {
        const idx = allFiltered.indexOf(this.entries[ft][this.selectedIdx]);
        return idx >= start && idx < start + PAGE_SIZE ? idx - start : -1;
      })(),
      onSelect: (pageIdx, row) => {
        const realIdx = this.entries[ft].indexOf(row);
        this.pushHistory();
        this.selectedIdx = realIdx;
        this.table.setSelected(pageIdx);
        this.renderDetail();
        this.updatePreview();
      },
      onContextMenu: (x, y, pageIdx, row) => {
        const realIdx = this.entries[ft].indexOf(row);
        showContextMenu(x, y, [
          { label: _t('Duplicate'), action: () => this.duplicateEntry(realIdx) },
          { label: _t('Toggle Exclude'), action: () => this.toggleExclude(realIdx) },
          { separator: true },
          { label: _t('Delete'), danger: true, action: () => this.deleteEntryAt(realIdx) },
        ], this.host);
      },
      onSort: () => {
        this._tableSortCol = this.table.getSortCol();
        this._tableSortDir = this.table.getSortDir();
        this.renderTable();
        this.renderDetail();
        this.updatePreview();
      },
    });
    this.tableWrap.appendChild(this.table.el);
    this.updateStatusBar();
  }

  // ---- Preview ----
  async updatePreview() {
    const ft = this.currentFileType;
    const config = getFileTypeConfig(ft);
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
      this.previewPanel.show(this.gameRoot, resolved, String(displayVal), 0, { map: true });
      return;
    }

    const path = getPrimaryGraphic(ft, entry, this.version);
    const displayVal = entry[config.displayField] || entry[config.headerField] || '';
    const fps = await this.getSpriteFps(entry, ft);
    this.previewPanel.show(this.gameRoot, path, displayVal, fps);
  }

  // ---- Detail ----
  makeFieldEditor(fieldDef, val, entry, config) {
    const onNavigate = (refType, name) => this.navigateTo(refType, name);
    const ownership = this.fieldOwnership(entry, fieldDef.key);
    return createFieldEditor(fieldDef, val, (newVal) => {
      entry[fieldDef.key] = newVal;
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
    if (!config || this.selectedIdx < 0 || !this.entries[ft]) return;

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
    const sel = h('select', { className: 'pbs-search', style: { width: '90px', fontSize: '11px' } });
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
    if (!entries || !base) return null;

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
    for (const [fname, group] of groups) {
      const out = /\.json$/i.test(fname)
        ? writeJsonPbs(group, ft)
        : writePbsFile(group, ft, this.version);
      await this.ctx.fs.writeProjectFile('PBS/' + fname, out);
    }

    this.dirty.delete(ft);
    this.originalEntries[ft] = JSON.parse(JSON.stringify(entries));
    return [...groups.keys()].join(', ');
  }

  async saveCurrentFile() {
    const ft = this.currentFileType;
    if (!ft) return;
    try {
      const saved = await this.saveFileType(ft);
      if (!saved) return;
      this.updateDirtyIndicator();
      this.ctx.ui.showToast({ message: _t('Saved {file}', { file: saved }), level: 'info' });
    } catch (e) {
      this.ctx.ui.showToast({ message: _t('Save failed: {error}', { error: e.message }), level: 'error' });
    }
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
    this.dirty.delete(ft);
    this.updateDirtyIndicator();
    this.renderTable();
    this.renderDetail();
    this.updatePreview();
    this.updateStatusBar();
  }

  async saveAllDirty() {
    for (const ft of [...this.dirty]) await this.saveFileType(ft);
    this.updateDirtyIndicator();
  }

  markDirty() {
    this.dirty.add(this.currentFileType);
    this.updateDirtyIndicator();
  }

  updateDirtyIndicator() {
    if (this.dirty.size > 0) {
      this.dirtyIndicator.style.display = 'inline-flex';
      this.dirtyIndicator.innerHTML = '';
      this.dirtyIndicator.appendChild(h('span', { className: 'pbs-dirty-dot' }));
    } else {
      this.dirtyIndicator.style.display = 'none';
    }
  }

  updateStatusBar() {
    const ft = this.currentFileType;
    const entries = this.entries[ft];
    const count = entries?.length || 0;
    const filtered = this.getPageEntries().length;
    this.statusCount.textContent = filtered === count ? _t('{count} entries', { count }) : _t('{filtered} / {count}', { filtered, count });
    const files = ft ? this.filesFor(ft) : [];
    this.statusFile.textContent = files.length
      ? `PBS/${files[0]}` + (files.length > 1 ? ` +${files.length - 1}` : '')
      : '';
  }

  // ---- CRUD ----
  async addEntry() {
    const ft = this.currentFileType;
    if (!ft) return;
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
    this.selectedIdx = entries.length - 1;
    this._fileFilter = null;
    this.buildFileFilter();

    // Jump to last page
    const allFiltered = this.getPageEntries();
    const lastPage = Math.max(0, Math.ceil(allFiltered.length / PAGE_SIZE) - 1);
    this.pagination.setTotal(Math.max(1, Math.ceil(allFiltered.length / PAGE_SIZE)));
    // Force page to last
    this.pagination._forcePage?.(lastPage);

    this.renderTable();
    this.renderDetail();
    this.updatePreview();
    this.markDirty();
    this.updateSidebarBadge(ft, entries.length);
  }

  async deleteEntry() {
    if (this.selectedIdx < 0) return;
    await this.deleteEntryAt(this.selectedIdx);
  }

  async deleteEntryAt(idx) {
    const ft = this.currentFileType;
    const entries = this.entries[ft];
    const entry = entries[idx];
    if (!entry) return;

    const config = getFileTypeConfig(ft);
    const displayVal = entry[config.displayField] || entry[config.headerField] || `#${idx + 1}`;

    const confirmed = await this.ctx.ui.showConfirmDialog({
      title: _t('Delete Entry'),
      message: _t('Delete "{name}"? This cannot be undone.', { name: displayVal }),
      danger: true,
    });
    if (!confirmed) return;

    entries.splice(idx, 1);
    this.selectedIdx = Math.min(idx, entries.length - 1);
    this.renderTable();
    this.renderDetail();
    this.updatePreview();
    this.markDirty();
    this.updateSidebarBadge(ft, entries.length);
  }

  async duplicateEntry(idx) {
    const ft = this.currentFileType;
    const entries = this.entries[ft];
    const entry = entries[idx];
    if (!entry) return;

    const copy = JSON.parse(JSON.stringify(entry));
    delete copy._fieldFiles;   // a duplicate belongs whole to its target file
    delete copy._overridden;
    copy._id = entries.length + 1;
    copy._header = copy._header + '_COPY';
    if (copy.Name) copy.Name = copy.Name + ' Copy';
    if (copy.InternalName) copy.InternalName = copy.InternalName + '_COPY';
    entries.push(copy);
    this.selectedIdx = entries.length - 1;
    this._fileFilter = null;
    this.buildFileFilter();
    this.renderTable();
    this.renderDetail();
    this.updatePreview();
    this.markDirty();
    this.updateSidebarBadge(ft, entries.length);
  }

  toggleExclude(idx) {
    const ft = this.currentFileType;
    const entry = this.entries[ft][idx];
    if (!entry) return;
    entry._excluded = !entry._excluded;
    this.renderTable();
    this.renderDetail();
    this.markDirty();
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
    this.tableWrap.appendChild(h('div', { className: 'pbs-loading', textContent: msg || _t('Loading...') }));
  }

  showError(msg) {
    this.tableWrap.innerHTML = '';
    this.tableWrap.appendChild(h('div', { className: 'pbs-empty', textContent: msg }));
  }

  async readFile(path) {
    return await this.ctx.fs.readProjectFile(path);
  }
}
