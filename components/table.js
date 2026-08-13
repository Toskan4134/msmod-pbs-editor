import { h, _t, getTypeIconConfig, makeTypeIndicator } from './dom.js';
import { statColor } from './field-editor.js';
import { TYPE_COLORS } from '../file-types.js';

// ---- SVG preview icons (48px, Lucide-style) ----
const _previewSvg = (d) => `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5">${d}</svg>`;
const ICON_PREVIEW    = _previewSvg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>');
const ICON_LOADING    = _previewSvg('<path d="M21 12a9 9 0 1 1-6.219-8.56"/>');
const ICON_NOT_FOUND = _previewSvg('<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 14.14 14.14"/>');

// ---- Pagination ----
export function createPagination(onPage) {
  let current = 0;
  let totalPages = 1;
  const container = h('div', { className: 'pbs-pagination' });
  const firstBtn = h('button', { className: 'pbs-page-btn', textContent: _t('« First'), onClick: () => { if (current > 0) { current = 0; update(); onPage(current); } } });
  const prevBtn = h('button', { className: 'pbs-page-btn', textContent: _t('← Prev'), onClick: () => { if (current > 0) { current--; update(); onPage(current); } } });
  const info = h('span', { textContent: '' });
  const nextBtn = h('button', { className: 'pbs-page-btn', textContent: _t('Next →'), onClick: () => { if (current < totalPages - 1) { current++; update(); onPage(current); } } });
  const lastBtn = h('button', { className: 'pbs-page-btn', textContent: _t('Last »'), onClick: () => { if (current < totalPages - 1) { current = totalPages - 1; update(); onPage(current); } } });
  container.appendChild(firstBtn);
  container.appendChild(prevBtn);
  container.appendChild(info);
  container.appendChild(nextBtn);
  container.appendChild(lastBtn);

  function update() {
    firstBtn.disabled = current <= 0;
    prevBtn.disabled = current <= 0;
    nextBtn.disabled = current >= totalPages - 1;
    lastBtn.disabled = current >= totalPages - 1;
    info.textContent = _t('Page {current} of {total}', { current: current + 1, total: totalPages });
  }
  function setTotal(total) { totalPages = Math.max(1, total); if (current >= totalPages) current = totalPages - 1; update(); }
  function getPage() { return current; }
  function reset() { current = 0; update(); }

  function _forcePage(p) { current = Math.max(0, Math.min(p, totalPages - 1)); update(); }

  update();
  return { el: container, setTotal, getPage, reset, _forcePage };
}

// ---- Preview panel ----
let _animIntervals = [];
function stopAllAnim() { for (const id of _animIntervals) clearInterval(id); _animIntervals = []; }

// Shared by `show()` and `showPokemon()`: loads `url` and resolves either a
// <canvas> (multi-frame spritesheet, animated at `fps` if > 0) or a plain
// <img>. `allowSheet=false` forces plain-image handling (town map images can
// be wide without being a frame strip). Resolves null on load failure.
// `scale` is the natural-px → displayed-px ratio, needed to convert a PBS
// pixel offset (see `showPokemon`) into a CSS pixel nudge.
function _loadSpriteVisual(url, fps, maxSize, allowSheet = true) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const frameH = img.naturalHeight;
      const totalW = img.naturalWidth;
      const frameCount = Math.max(1, Math.round(totalW / frameH));
      const isSheet = allowSheet && frameCount > 1 && totalW > frameH;
      if (isSheet) {
        const size = Math.min(maxSize, frameH * 2);
        const canvas = h('canvas', { width: size, height: size, style: { imageRendering: 'pixelated', borderRadius: '4px' } });
        const ctx2d = canvas.getContext('2d');
        ctx2d.imageSmoothingEnabled = false;
        let frame = 0;
        const draw = () => { ctx2d.clearRect(0, 0, size, size); ctx2d.drawImage(img, frame * frameH, 0, frameH, frameH, 0, 0, size, size); };
        draw();
        if (fps > 0) {
          const delay = Math.max(16, Math.round(1000 / fps));
          _animIntervals.push(setInterval(() => { frame = (frame + 1) % frameCount; draw(); }, delay));
        }
        resolve({ el: canvas, frames: frameCount, scale: size / frameH });
      } else {
        const scale = Math.min(1, maxSize / Math.max(totalW, frameH));
        resolve({ el: h('img', { className: 'pbs-preview-img', src: url }), frames: 1, scale });
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function createPreviewPanel(loadImageFn) {
  const panel = h('div', { className: 'pbs-preview' });
  panel.appendChild(placeholder(ICON_PREVIEW, _t('Select an entry to preview')));

  function stopAnim() { stopAllAnim(); }
  function placeholder(icon, ...lines) {
    const ph = h('div', { className: 'pbs-preview-placeholder' });
    ph.appendChild(h('div', { className: 'pbs-preview-placeholder-icon', innerHTML: icon }));
    for (const line of lines) ph.appendChild(typeof line === 'string' ? h('div', { textContent: line }) : h('div', line));
    return ph;
  }
  function nameEl(text) { return h('div', { className: 'pbs-preview-name', textContent: text }); }

  function show(gameRoot, path, displayName, fps, opts = {}) {
    stopAllAnim();
    panel.innerHTML = '';
    if (!path) {
      panel.appendChild(placeholder(ICON_PREVIEW, _t('No graphic')));
      panel.appendChild(nameEl(displayName || ''));
      return;
    }
    if (!loadImageFn) {
      panel.appendChild(placeholder(ICON_PREVIEW, _t('No loader')));
      panel.appendChild(nameEl(displayName || ''));
      return;
    }
    const absPath = (gameRoot || '').replace(/\\/g, '/') + '/' + path;
    panel.appendChild(placeholder(ICON_LOADING, _t('Loading...')));

    const panelName = displayName || '';
    const animFps = fps || 16;

    loadImageFn(absPath).then(async url => {
      if (!url) {
        panel.innerHTML = '';
        panel.appendChild(placeholder(ICON_NOT_FOUND, path.split('/').pop(), { textContent: _t('Not found'), style: { fontSize: '10px' } }));
        panel.appendChild(nameEl(panelName));
        return;
      }
      const visual = await _loadSpriteVisual(url, animFps, 128, !opts.map);
      panel.innerHTML = '';
      if (!visual) {
        panel.appendChild(placeholder(ICON_NOT_FOUND, path.split('/').pop()));
        panel.appendChild(nameEl(panelName));
        return;
      }
      visual.el.className = opts.map ? 'pbs-preview-img pbs-preview-map' : 'pbs-preview-img';
      panel.appendChild(visual.el);
      panel.appendChild(nameEl(panelName + (visual.frames > 1 && !opts.map ? ` (${visual.frames}f)` : '')));
    }).catch(() => {
      panel.innerHTML = '';
      panel.appendChild(placeholder(ICON_NOT_FOUND, path.split('/').pop()));
      panel.appendChild(nameEl(panelName));
    });
  }

  // Pokemon-only: front + back side by side, with a Shiny toggle when the
  // version has separate shiny sprite files (v21). `variants` comes from
  // `getPokemonSpriteVariants` — null fields just skip that slot.
  //
  // Alignment lifted straight from the actual Pokédex forms page
  // (PokemonPokedexInfo_Scene#pbUpdateDummyPokemon): front is drawn with
  // PictureOrigin::CENTER at a fixed point — no per-species correction, it
  // just floats centered. Back is drawn with PictureOrigin::BOTTOM, then
  // nudged by `SpeciesMetrics#back_sprite`'s Y component (doubled) — that's
  // `backOffsetY`, from pokemon_metrics.txt's `BackSprite` field (v21) or 0
  // pre-v21 (no SpeciesMetrics there, back just bottom-aligns as-is).
  function showPokemon(gameRoot, variants, displayName, fps, backOffsetY) {
    stopAllAnim();
    panel.innerHTML = '';
    if (!loadImageFn || !variants?.front) {
      panel.appendChild(placeholder(ICON_PREVIEW, _t('No graphic')));
      panel.appendChild(nameEl(displayName || ''));
      return;
    }
    const base = (gameRoot || '').replace(/\\/g, '/');
    const animFps = fps || 16;
    let shiny = false;
    let token = 0;

    const box = h('div', { className: 'pbs-preview-pokemon' });
    panel.appendChild(box);
    panel.appendChild(nameEl(displayName || ''));
    if (variants.frontShiny || variants.backShiny) {
      const shinyBtn = h('button', { className: 'pbs-preview-shiny-btn', type: 'button', textContent: _t('Shiny'), onClick: () => {
        shiny = !shiny;
        shinyBtn.classList.toggle('active', shiny);
        renderVariant();
      } });
      panel.appendChild(shinyBtn);
    }

    async function renderVariant() {
      const myToken = ++token;
      stopAllAnim();
      box.innerHTML = '';
      box.appendChild(placeholder(ICON_LOADING, _t('Loading...')));
      const frontPath = shiny && variants.frontShiny ? variants.frontShiny : variants.front;
      const backPath = shiny && variants.backShiny ? variants.backShiny : variants.back;
      const [frontUrl, backUrl] = await Promise.all([
        loadImageFn(base + '/' + frontPath),
        backPath ? loadImageFn(base + '/' + backPath) : Promise.resolve(null),
      ]);
      if (myToken !== token) return; // superseded by a newer toggle/row select
      const frontVisual = frontUrl ? await _loadSpriteVisual(frontUrl, animFps, 112) : null;
      if (myToken !== token) return;
      box.innerHTML = '';
      // Battler back art is traditionally drawn larger/zoomed than front in
      // Essentials — cap both explicitly instead of relying on the shared
      // .pbs-preview-img class (128px), or a plain (non-animated) back image
      // renders bigger than the front and the pair looks lopsided.
      if (frontVisual) frontVisual.el.style.cssText += 'max-width:112px;max-height:112px;';
      // Centered, not bottom-anchored — matches PictureOrigin::CENTER.
      const frontSlot = h('div', { className: 'pbs-preview-pokemon-slot pbs-preview-pokemon-front' }, frontVisual ? frontVisual.el : placeholder(ICON_NOT_FOUND, _t('Front')));
      box.appendChild(frontSlot);
      if (backPath) {
        const backVisual = backUrl ? await _loadSpriteVisual(backUrl, animFps, 84) : null;
        if (myToken !== token) return;
        if (backVisual) backVisual.el.style.cssText += 'max-width:84px;max-height:84px;';
        const backSlot = h('div', { className: 'pbs-preview-pokemon-slot' }, backVisual ? backVisual.el : placeholder(ICON_NOT_FOUND, _t('Back')));
        if (backVisual && backOffsetY) backSlot.style.transform = `translateY(${backOffsetY * 2 * backVisual.scale}px)`;
        box.appendChild(backSlot);
      }
    }
    renderVariant();
  }

  function clear() {
    stopAllAnim();
    panel.innerHTML = '';
    panel.appendChild(placeholder(ICON_PREVIEW, _t('Select an entry')));
  }

  function showTypeIcon(displayName, iconPos) {
    stopAnim();
    panel.innerHTML = '';
    const cfg = getTypeIconConfig();
    if (!cfg || iconPos == null) {
      const color = TYPE_COLORS[(displayName || '').toUpperCase()] || null;
      const ph = h('div', { className: 'pbs-preview-placeholder' });
      ph.appendChild(h('div', {
        style: {
          width: '80px', height: '28px', borderRadius: '4px',
          background: color ? color + '33' : 'var(--bg-tertiary)',
          border: '2px solid ' + (color || 'var(--border)'),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: color || 'var(--text-tertiary)', fontWeight: '700', fontSize: '12px',
        },
        textContent: displayName || '?',
      }));
      panel.appendChild(ph);
      panel.appendChild(h('div', { className: 'pbs-preview-name', textContent: displayName || '' }));
      return;
    }
    const SCALE = Math.max(2, Math.floor(128 / cfg.iconW));
    const dispW = cfg.iconW * SCALE;
    const dispH = cfg.iconH * SCALE;
    const canvas = h('canvas', { width: dispW, height: dispH, style: { imageRendering: 'pixelated', borderRadius: '4px' } });
    const ctx2d = canvas.getContext('2d');
    ctx2d.imageSmoothingEnabled = false;
    const img = new Image();
    img.onload = () => {
      ctx2d.clearRect(0, 0, dispW, dispH);
      ctx2d.drawImage(img, 0, iconPos * cfg.iconH, cfg.iconW, cfg.iconH, 0, 0, dispW, dispH);
    };
    img.src = cfg.url;
    panel.appendChild(canvas);
    panel.appendChild(h('div', { className: 'pbs-preview-name', textContent: displayName || '' }));
  }

  return { el: panel, show, showPokemon, clear, showTypeIcon };
}

// ---- Row icon column (Pokemon/Items/Trainers/Trainer Types) ----
// Cached by absolute path across every table instance — paging or switching
// file type never re-fetches an icon already seen this session.
const _iconCache = new Map();   // absPath -> url | null (null = load failed)
const _iconPending = new Map(); // absPath -> in-flight promise

function makeIconVisual(url, frames) {
  const SIZE = 34;
  if (frames > 1) {
    const canvas = h('canvas', { width: SIZE, height: SIZE });
    const ctx2d = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx2d.imageSmoothingEnabled = false;
      ctx2d.drawImage(img, 0, 0, img.naturalWidth / frames, img.naturalHeight, 0, 0, SIZE, SIZE);
    };
    img.src = url;
    return canvas;
  }
  return h('img', { className: 'pbs-icon-img', src: url });
}

function iconCell(row, options) {
  const td = h('td', { className: 'pbs-icon-cell' });
  const info = options.rowIcon(row);
  if (!info?.path) return td;
  const absPath = (options.gameRoot || '').replace(/\\/g, '/') + '/' + info.path;
  if (_iconCache.has(absPath)) {
    const url = _iconCache.get(absPath);
    if (url) td.appendChild(makeIconVisual(url, info.frames || 1));
    return td;
  }
  let pending = _iconPending.get(absPath);
  if (!pending) {
    pending = options.loadIcon(absPath).then(url => { _iconCache.set(absPath, url || null); _iconPending.delete(absPath); return url; });
    _iconPending.set(absPath, pending);
  }
  pending.then(url => { if (url && td.isConnected) td.appendChild(makeIconVisual(url, info.frames || 1)); });
  return td;
}

// ---- Type badge cell (Types/Weaknesses/Resistances columns) ----
// `display:flex` set directly on a <td> drops it out of normal table cell
// layout in this webview (column width and border-bottom both break — the
// exact "content bled into the previous column, row separator vanished"
// symptom). Keep the <td> a plain table-cell; the flex row lives on an inner
// <div> instead.
function typeBadgesCell(val, options, extraCls) {
  const td = h('td', { className: `pbs-type-cell ${extraCls || ''}` });
  const inner = h('div', { className: 'pbs-type-cell-inner' });
  const names = String(val).split(',').map(s => s.trim()).filter(Boolean);
  const cfg = getTypeIconConfig();
  for (const name of names) {
    if (cfg) {
      const pos = options.typeIconLookup?.[name.toUpperCase()];
      inner.appendChild(makeTypeIndicator(name, pos != null ? pos : null));
    } else {
      const color = TYPE_COLORS[name.toUpperCase()] || null;
      inner.appendChild(h('span', {
        className: 'pbs-type-pill', textContent: name,
        style: { background: color ? color + '33' : 'var(--bg-tertiary)', color: color || 'var(--text-tertiary)', borderColor: color || 'var(--border)' },
      }));
    }
  }
  td.appendChild(inner);
  if (names.length) td.title = names.join(', ');
  return td;
}

// ---- Compact stat bar cell (BaseStats column) ----
const _STAT_LABELS = ['HP', 'Atk', 'Def', 'Spe', 'SpAtk', 'SpDef'];
function statBarCell(val, extraCls) {
  const td = h('td', { className: `pbs-statbar-cell ${extraCls || ''}` });
  const nums = String(val).split(',').map(n => parseInt(n) || 0);
  if (!nums.length || nums.every(n => !n)) return td;
  const inner = h('div', { className: 'pbs-statbar-cell-inner' });
  const bst = nums.reduce((a, b) => a + b, 0);
  const bar = h('div', { className: 'pbs-mini-statbar' });
  for (const n of nums) {
    bar.appendChild(h('span', { className: 'pbs-mini-statbar-seg', style: { height: Math.max(2, Math.round(Math.min(255, n) / 255 * 34)) + 'px', background: statColor(n) } }));
  }
  inner.appendChild(bar);
  inner.appendChild(h('span', { className: 'pbs-mini-statbar-total', textContent: String(bst) }));
  td.appendChild(inner);
  td.title = nums.map((n, i) => `${_STAT_LABELS[i] || ''} ${n}`).join(' · ');
  return td;
}

// ---- Sortable table ----
export function createTable(columns, rows, options = {}) {
  let sortCol = options.sortCol ?? 0;
  let sortDir = options.sortDir ?? 1;
  let selectedIdx = options.selectedIdx ?? -1;
  const table = h('table', { className: 'pbs-table' });
  const thead = h('thead');
  const tbody = h('tbody');
  table.appendChild(thead);
  table.appendChild(tbody);

  function renderHead() {
    thead.innerHTML = '';
    const tr = h('tr');
    if (options.rowIcon) tr.appendChild(h('th', { className: 'pbs-icon-cell' }));
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const th = h('th', { style: { width: (col.width || 80) + 'px' } });
      th.textContent = _t(col.label);
      if (i === sortCol) th.appendChild(h('span', { className: 'pbs-sort-arrow', textContent: sortDir === 1 ? '▲' : '▼' }));
      th.addEventListener('click', () => { if (sortCol === i) sortDir = -sortDir; else { sortCol = i; sortDir = 1; } render(); options.onSort?.(); });
      tr.appendChild(th);
    }
    thead.appendChild(tr);
  }

  function renderBody() {
    tbody.innerHTML = '';
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const tr = h('tr', { className: `${i === selectedIdx ? 'selected' : ''} ${row._excluded ? 'excluded' : ''}` });
      if (options.rowIcon) tr.appendChild(iconCell(row, options));
      for (const col of columns) {
        if (col.typeList) { tr.appendChild(typeBadgesCell(row[col.key] ?? '', options, options.cellClass?.(row, col))); continue; }
        if (col.statBar) { tr.appendChild(statBarCell(row[col.key] ?? '', options.cellClass?.(row, col))); continue; }
        const val = row[col.key] ?? '';
        const cls = options.cellClass ? options.cellClass(row, col) : '';
        const numText = parseInt(val) || (col.dashIfEmpty ? '—' : '');
        const td = h('td', { className: cls, textContent: col.numeric ? numText : String(val) });
        // ponytail: set title only when text overflows, checked lazily on hover (no reflow at render)
        td.addEventListener('mouseenter', () => { td.title = td.scrollWidth > td.clientWidth ? String(val) : ''; });
        tr.appendChild(td);
      }
      tr.addEventListener('click', () => { selectedIdx = i; renderBody(); options.onSelect?.(i, row); });
      tr.addEventListener('contextmenu', (e) => { e.preventDefault(); selectedIdx = i; renderBody(); options.onContextMenu?.(e.clientX, e.clientY, i, row); });
      tbody.appendChild(tr);
    }
  }

  function render() { renderHead(); renderBody(); }
  function setSelected(idx) { selectedIdx = idx; renderBody(); }
  function getSortCol() { return sortCol; }
  function getSortDir() { return sortDir; }
  render();
  return { el: table, setSelected, render, getSortCol, getSortDir };
}

// ---- Collapsible section ----
export function createSectionToggle(label) {
  let open = true;
  const toggle = h('button', { className: 'pbs-section-toggle' });
  const arrow = h('span', { className: 'pbs-section-arrow open', textContent: '▶' });
  toggle.appendChild(arrow);
  toggle.appendChild(h('span', { textContent: _t(label) }));
  const body = h('div', { className: 'pbs-section-body', style: { display: 'block' } });
  toggle.addEventListener('click', () => { open = !open; arrow.className = `pbs-section-arrow ${open ? 'open' : ''}`; body.style.display = open ? 'block' : 'none'; });
  return { toggle, body };
}
