import { h, _t, getTypeIconConfig, makeTypeIndicator, scrollingText } from './dom.js';
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
  function pageButton(label, path, getTarget, trailing = false) {
    const icon = h('span', { className: 'pbs-page-icon', 'aria-hidden': 'true', innerHTML:
      `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>` });
    const text = h('span', { textContent: _t(label) });
    return h('button', { type: 'button', className: 'pbs-page-btn', onClick: () => {
      const target = Math.max(0, Math.min(getTarget(), totalPages - 1));
      if (target === current) return;
      current = target;
      update();
      onPage(current);
    } }, ...(trailing ? [text, icon] : [icon, text]));
  }

  const firstBtn = pageButton('First page', 'M3 4v8m8-8-4 4 4 4', () => 0);
  const prevBtn = pageButton('Previous page', 'm10 4-4 4 4 4', () => current - 1);
  const info = h('span');
  const nextBtn = pageButton('Next page', 'm6 4 4 4-4 4', () => current + 1, true);
  const lastBtn = pageButton('Last page', 'M13 4v8M5 4l4 4-4 4', () => totalPages - 1, true);
  container.append(firstBtn, prevBtn, info, nextBtn, lastBtn);

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

export function squareSpriteStrip(width, height, allowVertical = false) {
  if (!width || !height) return null;
  if (width > height && width % height === 0) return { frames: width / height, vertical: false };
  if (allowVertical && height > width && height % width === 0) return { frames: height / width, vertical: true };
  return null;
}

async function loadGraphic(loadImage, gameRoot, path, fallbackPaths = []) {
  const root = (gameRoot || '').replace(/\\/g, '/');
  for (const candidate of [path, ...fallbackPaths]) {
    const url = await loadImage(`${root}/${candidate}`);
    if (url) return url;
  }
  return null;
}

// Shared by `show()` and `showPokemon()`: loads `url` and resolves either a
// <canvas> (multi-frame spritesheet, animated at `fps` if > 0) or a plain
// <img>. `allowSheet=false` forces plain-image handling (town map images can
// be wide without being a frame strip). Resolves null on load failure.
function _loadSpriteVisual(url, fps, maxSize, allowSheet, current, trainer = false) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (!current()) { resolve(null); return; }
      const frameH = img.naturalHeight;
      const totalW = img.naturalWidth;
      const strip = trainer ? squareSpriteStrip(totalW, frameH, true) : null;
      const frameCount = trainer ? strip?.frames ?? 1 : Math.max(1, Math.round(totalW / frameH));
      const frameSize = strip?.vertical ? totalW : frameH;
      const isSheet = allowSheet && frameCount > 1;
      if (isSheet) {
        const size = Math.min(maxSize, frameSize * 2);
        const canvas = h('canvas', { width: size, height: size, style: { imageRendering: 'pixelated', borderRadius: '4px' } });
        const ctx2d = canvas.getContext('2d');
        ctx2d.imageSmoothingEnabled = false;
        let frame = 0;
        const draw = () => { ctx2d.clearRect(0, 0, size, size); ctx2d.drawImage(img, strip?.vertical ? 0 : frame * frameSize, strip?.vertical ? frame * frameSize : 0, frameSize, frameSize, 0, 0, size, size); };
        draw();
        if (fps > 0 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const delay = Math.max(16, Math.round(1000 / fps));
          _animIntervals.push(setInterval(() => { frame = (frame + 1) % frameCount; draw(); }, delay));
        }
        resolve({ el: canvas, frames: frameCount });
      } else {
        resolve({ el: h('img', { className: 'pbs-preview-img', src: url }), frames: 1 });
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function createPreviewPanel(loadImageFn) {
  const panel = h('div', { className: 'pbs-preview' });
  panel.appendChild(placeholder(ICON_PREVIEW, _t('Select an entry to preview')));

  let generation = 0;
  function stopAnim() { generation++; stopAllAnim(); }
  function placeholder(icon, ...lines) {
    const ph = h('div', { className: 'pbs-preview-placeholder' });
    ph.appendChild(h('div', { className: 'pbs-preview-placeholder-icon', innerHTML: icon }));
    for (const line of lines) ph.appendChild(typeof line === 'string' ? h('div', { textContent: line }) : h('div', line));
    return ph;
  }
  function nameEl(text) { return h('div', { className: 'pbs-preview-name', textContent: text }); }

  function show(gameRoot, path, displayName, fps, opts = {}) {
    stopAnim();
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
    panel.appendChild(placeholder(ICON_LOADING, _t('Loading...')));

    const request = generation;
    const current = () => generation === request;
    const panelName = displayName || '';
    const animFps = fps || 16;

    loadGraphic(loadImageFn, gameRoot, path, opts.fallbackPaths).then(async url => {
      if (!current()) return;
      if (!url) {
        panel.innerHTML = '';
        panel.appendChild(placeholder(ICON_NOT_FOUND, path.split('/').pop(), { textContent: _t('Not found'), style: { fontSize: '10px' } }));
        panel.appendChild(nameEl(panelName));
        return;
      }
      const visual = await _loadSpriteVisual(url, animFps, 128, !opts.map, current, opts.trainer);
      if (!current()) return;
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
      if (!current()) return;
      panel.innerHTML = '';
      panel.appendChild(placeholder(ICON_NOT_FOUND, path.split('/').pop()));
      panel.appendChild(nameEl(panelName));
    });
  }

  // Pokemon-only: front + back side by side, with a Shiny toggle when the
  // version has separate shiny sprite files (v21). `variants` comes from
  // `getPokemonSpriteVariants` — null fields just skip that slot.
  //
  function showPokemon(gameRoot, variants, displayName, fps) {
    stopAnim();
    panel.innerHTML = '';
    if (!loadImageFn || !variants?.front) {
      panel.appendChild(placeholder(ICON_PREVIEW, _t('No graphic')));
      panel.appendChild(nameEl(displayName || ''));
      return;
    }
    const base = (gameRoot || '').replace(/\\/g, '/');
    const animFps = fps || 16;
    let shiny = false;
    const request = generation;
    let token = 0;

    const box = h('div', { className: 'pbs-preview-pokemon' });
    panel.appendChild(box);
    panel.appendChild(nameEl(displayName || ''));
    if (variants.frontShiny || variants.backShiny) {
      const shinyBtn = h('button', { className: 'pbs-preview-shiny-btn', type: 'button', 'aria-pressed': 'false', textContent: _t('Shiny'), onClick: () => {
        shiny = !shiny;
        shinyBtn.classList.toggle('active', shiny);
        shinyBtn.setAttribute('aria-pressed', String(shiny));
        renderVariant();
      } });
      panel.appendChild(shinyBtn);
    }

    async function renderVariant() {
      const myToken = ++token;
      const current = () => generation === request && token === myToken;
      stopAllAnim();
      box.innerHTML = '';
      box.appendChild(placeholder(ICON_LOADING, _t('Loading...')));
      const frontPath = shiny && variants.frontShiny ? variants.frontShiny : variants.front;
      const backPath = shiny && variants.backShiny ? variants.backShiny : variants.back;
      const [frontUrl, backUrl] = await Promise.all([
        loadImageFn(base + '/' + frontPath),
        backPath ? loadImageFn(base + '/' + backPath) : Promise.resolve(null),
      ]);
      if (!current()) return; // superseded by a newer toggle/row select
      const frontVisual = frontUrl ? await _loadSpriteVisual(frontUrl, animFps, 112, true, current) : null;
      if (!current()) return;
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
        const backVisual = backUrl ? await _loadSpriteVisual(backUrl, animFps, 84, true, current) : null;
        if (!current()) return;
        if (backVisual) backVisual.el.style.cssText += 'max-width:84px;max-height:84px;';
        const backSlot = h('div', { className: 'pbs-preview-pokemon-slot' }, backVisual ? backVisual.el : placeholder(ICON_NOT_FOUND, _t('Back')));
        box.appendChild(backSlot);
      }
    }
    renderVariant();
  }

  function clear() {
    stopAnim();
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

function addRowIcon(host, info, options) {
  if (!info?.path) return;
  const root = (options.gameRoot || '').replace(/\\/g, '/');
  const absPath = `${root}/${info.path}`;
  const append = url => {
    if (!url) return;
    const img = h('img', { className: 'pbs-icon-img', alt: '' });
    if (!info.animation) {
      img.src = url;
      host.appendChild(img);
      return;
    }
    img.onload = () => {
      if (!host.isConnected) return;
      const trainer = info.animation === 'trainer';
      const strip = squareSpriteStrip(img.naturalWidth, img.naturalHeight, trainer);
      if (!strip) {
        host.appendChild(img);
        return;
      }
      const { frames, vertical } = strip;
      const size = trainer ? 26 : 34;
      const distance = -size * frames + 'px';
      const icon = h('span', { className: 'pbs-icon-strip', 'aria-hidden': 'true', style: {
        width: size + 'px',
        height: size + 'px',
        backgroundImage: `url(${url})`,
        backgroundSize: `${vertical ? size : size * frames}px ${vertical ? size * frames : size}px`,
      } });
      icon.style.setProperty('--pbs-icon-end', vertical ? `0 ${distance}` : `${distance} 0`);
      icon.style.setProperty('--pbs-icon-frames', String(frames));
      icon.style.setProperty('--pbs-icon-duration', trainer ? `${frames * 100}ms` : '250ms');
      host.appendChild(icon);
    };
    img.src = url;
  };
  if (_iconCache.has(absPath)) {
    append(_iconCache.get(absPath));
    return;
  }
  let pending = _iconPending.get(absPath);
  if (!pending) {
    pending = loadGraphic(options.loadIcon, root, info.path, info.fallbackPaths).then(url => {
      _iconCache.set(absPath, url);
      _iconPending.delete(absPath);
      return url;
    });
    _iconPending.set(absPath, pending);
  }
  pending.then(url => { if (host.isConnected) append(url); });
}

function iconCell(row, options) {
  const td = h('td', { className: 'pbs-icon-cell' });
  addRowIcon(td, options.rowIcon(row), options);
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
    const pos = options.typeIconLookup?.[name.toUpperCase()];
    if (cfg && pos != null) {
      inner.appendChild(makeTypeIndicator(name, pos));
    } else {
      const color = TYPE_COLORS[name.toUpperCase()] || null;
      inner.appendChild(h('span', {
        className: 'pbs-type-pill',
        style: { background: color ? color + '33' : 'var(--bg-tertiary)', color: color || 'var(--text-tertiary)', borderColor: color || 'var(--border)' },
      }, scrollingText(name)));
    }
  }
  td.appendChild(inner);
  if (names.length) td.title = names.join(', ');
  return td;
}

// ---- Compact stat bar cell (BaseStats column) ----
const _STAT_LABELS = ['HP', 'Atk', 'Def', 'Spe', 'SpAtk', 'SpDef'];
function baseStats(value) {
  return String(value ?? '').split(',').map(stat => Number.parseInt(stat, 10) || 0);
}

export function baseStatTotal(value) {
  return baseStats(value).reduce((total, stat) => total + stat, 0);
}

function statBarCell(val, extraCls) {
  const td = h('td', { className: `pbs-statbar-cell ${extraCls || ''}` });
  const nums = baseStats(val);
  if (!nums.length || nums.every(n => !n)) return td;
  const inner = h('div', { className: 'pbs-statbar-cell-inner' });
  const bst = baseStatTotal(val);
  const bar = h('div', { className: 'pbs-mini-statbar' });
  for (const n of nums) {
    bar.appendChild(h('span', { className: 'pbs-mini-statbar-seg', style: { height: Math.max(2, Math.round(Math.min(255, n) / 255 * 34)) + 'px', background: statColor(n) } }));
  }
  inner.appendChild(bar);
  inner.appendChild(h('span', { className: 'pbs-mini-statbar-total' }, scrollingText(String(bst))));
  td.appendChild(inner);
  td.title = nums.map((n, i) => `${_STAT_LABELS[i] || ''} ${n}`).join(' · ');
  return td;
}

const MOVE_CATEGORIES = ['Physical', 'Special', 'Status'];

function categoryName(value) {
  return /^[012]$/.test(String(value)) ? MOVE_CATEGORIES[Number(value)] : String(value);
}

function moveCategory(value, url) {
  const category = categoryName(value);
  const index = MOVE_CATEGORIES.indexOf(category);
  if (!url || index < 0) return scrollingText(_t(category));
  return h('span', { className: 'pbs-move-category', title: _t(category), role: 'img', 'aria-label': _t(category), style: {
    backgroundImage: `url(${url})`,
    backgroundPosition: `0 -${index * 20}px`,
  } });
}

function fitColumnWidths(columns, rows, options) {
  const measure = document.createElement('canvas').getContext('2d');
  const font = getComputedStyle(document.body).fontFamily;
  const typeConfig = getTypeIconConfig();
  const typeWidth = typeConfig ? Math.round(typeConfig.iconW * 20 / typeConfig.iconH) : 0;
  return columns.map(column => {
    measure.font = `600 11px ${font}`;
    let width = Math.max(36, measure.measureText(_t(column.label).toUpperCase()).width + 42);
    measure.font = `${column.typeList ? '700 11px' : '12px'} ${font}`;
    for (const row of rows) {
      const value = options.value?.(row, column) ?? row[column.key] ?? '';
      let content;
      if (column.typeList) {
        content = String(value).split(',').map(name => name.trim()).filter(Boolean).reduce((sum, name) => {
          const icon = options.typeIconLookup?.[name.toUpperCase()];
          return sum + (typeWidth && icon != null ? typeWidth : measure.measureText(name).width + 12) + 2;
        }, 0);
      } else if (column.statBar) {
        content = 96;
      } else if (column.categoryIcon) {
        content = options.categoryUrl ? 46 : measure.measureText(_t(categoryName(value))).width;
      } else {
        content = measure.measureText(String(value)).width + (column.trainerIcon ? 30 : 0);
      }
      width = Math.max(width, content + 16);
    }
    return Math.ceil(width);
  });
}

// ---- Sortable table ----
export function createTable(columns, rows, options = {}) {
  let sortCol = options.sortCol ?? 0;
  let sortDir = options.sortDir ?? 1;
  let selectedIdx = options.selectedIdx ?? -1;
  const table = h('table', { className: 'pbs-table' });
  const thead = h('thead');
  const tbody = h('tbody');
  const group = h('colgroup');
  const widths = options.widths || [];
  const iconWidth = options.rowIcon ? 44 : 0;
  if (iconWidth) group.append(h('col', { style: { width: iconWidth + 'px' } }));
  const dataCols = columns.map(() => h('col'));
  group.append(...dataCols);
  table.append(group, thead);
  const natural = fitColumnWidths(columns, options.measureRows || rows, options);
  let available = 0;
  function fit(width = available) {
    available = width;
    if (!width) return;
    const reserved = Math.min(iconWidth, width / 3);
    const budget = width - reserved;
    const base = natural.map((size, index) => widths[index] ?? size);
    let total = base.reduce((sum, size) => sum + size, 0);
    if (total > budget) {
      const wrapColumns = columns.flatMap((column, index) =>
        column.typeList && widths[index] == null ? [index] : []);
      if (wrapColumns.length) {
        const wrapWidth = wrapColumns.reduce((sum, index) => sum + base[index], 0);
        const textWidth = total - wrapWidth;
        const sharedWidth = Math.max(88, (budget - textWidth) / wrapColumns.length);
        for (const index of wrapColumns) base[index] = sharedWidth;
        total = base.reduce((sum, size) => sum + size, 0);
      }
    }
    if (total > budget) {
      // Lower the largest columns to a common cap before shrinking smaller ones.
      let remaining = budget;
      const sorted = [...base].sort((a, b) => a - b);
      const index = sorted.findIndex((size, i) => {
        if (size * (sorted.length - i) >= remaining) return true;
        remaining -= size;
        return false;
      });
      const cap = remaining / (sorted.length - index);
      base.forEach((size, i) => { base[i] = Math.min(size, cap); });
    } else {
      const automatic = widths.length ? base.filter((_, index) => widths[index] == null).length : base.length;
      const extra = (budget - total) / (automatic || base.length);
      base.forEach((size, index) => {
        if (!automatic || widths[index] == null) base[index] = size + extra;
      });
    }
    if (iconWidth) group.children[0].style.width = reserved + 'px';
    dataCols.forEach((col, index) => { col.style.width = base[index] + 'px'; });
    table.style.width = width + 'px';
  }
  fit();
  table.appendChild(tbody);

  function renderHead() {
    thead.innerHTML = '';
    const tr = h('tr');
    if (options.rowIcon) tr.appendChild(h('th', { className: 'pbs-icon-cell' }));
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const th = h('th');
      th.scope = 'col';
      if (i === sortCol) th.setAttribute('aria-sort', sortDir === 1 ? 'ascending' : 'descending');
      const sort = h('button', { type: 'button', className: 'pbs-sort', onClick: () => {
        if (sortCol === i) sortDir = -sortDir;
        else { sortCol = i; sortDir = 1; }
        options.onSort?.(i);
      } }, scrollingText(_t(col.label)));
      if (i === sortCol) {
        sort.append(h('span', { className: 'pbs-sort-arrow', 'aria-hidden': 'true', innerHTML:
          `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${sortDir === 1 ? 'm4 10 4-4 4 4' : 'm4 6 4 4 4-4'}"/></svg>` }));
      }
      const handle = h('span', { className: 'pbs-column-resize', role: 'separator', tabIndex: 0,
        'aria-label': _t('Resize {column}', { column: _t(col.label) }), 'aria-orientation': 'vertical' });
      const resize = (width) => {
        widths[i] = Math.max(32, Math.round(width));
        handle.setAttribute('aria-valuenow', String(widths[i]));
        fit();
      };
      handle.setAttribute('aria-valuemin', '32');
      handle.setAttribute('aria-valuenow', String(widths[i] ?? natural[i]));
      handle.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        handle.setPointerCapture(event.pointerId);
        const startX = event.clientX;
        const startWidth = th.getBoundingClientRect().width;
        const move = (event) => resize(startWidth + event.clientX - startX);
        handle.addEventListener('pointermove', move);
        handle.addEventListener('lostpointercapture', () => handle.removeEventListener('pointermove', move), { once: true });
      });
      handle.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        resize(th.getBoundingClientRect().width + (event.key === 'ArrowLeft' ? -10 : 10));
      });
      th.append(sort, handle);
      tr.appendChild(th);
    }
    thead.appendChild(tr);
  }

  function renderBody() {
    tbody.innerHTML = '';
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const tr = h('tr', { className: `${options.isSelected?.(row) ? 'selected' : ''} ${row._excluded ? 'excluded' : ''}` });
      if (options.rowIcon) tr.appendChild(iconCell(row, options));
      for (const col of columns) {
        if (col.typeList) { tr.appendChild(typeBadgesCell(row[col.key] ?? '', options, options.cellClass?.(row, col))); continue; }
        if (col.statBar) { tr.appendChild(statBarCell(row[col.key] ?? '', options.cellClass?.(row, col))); continue; }
        const val = options.value?.(row, col) ?? row[col.key] ?? '';
        const cls = options.cellClass?.(row, col) || '';
        const number = Number.parseInt(val, 10);
        const numText = Number.isNaN(number) ? (col.dashIfEmpty ? '—' : '') : String(number);
        const td = h('td', { className: cls });
        if (col.numeric) td.append(scrollingText(numText));
        else if (col.categoryIcon) {
          td.classList.add('pbs-type-cell');
          td.append(h('div', { className: 'pbs-type-cell-inner' }, moveCategory(val, options.categoryUrl)));
        } else if (col.trainerIcon) {
          const icon = h('span', { className: 'pbs-trainer-icon', 'aria-hidden': 'true' });
          addRowIcon(icon, options.trainerIcon?.(row), options);
          td.append(h('div', { className: 'pbs-trainer-cell' }, icon, scrollingText(String(val))));
        } else td.append(scrollingText(String(val)));
        tr.appendChild(td);
      }
      tr.tabIndex = i === selectedIdx || (selectedIdx < 0 && i === 0) ? 0 : -1;
      const select = event => options.onSelect?.(i, row, event);
      const openMenu = (x, y) => options.onContextMenu?.(x, y, i, row, tr);
      tr.addEventListener('click', select);
      tr.addEventListener('contextmenu', (event) => { event.preventDefault(); openMenu(event.clientX, event.clientY); });
      tr.addEventListener('keydown', (event) => {
        if (event.target !== tr) return;
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(event); }
        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          event.preventDefault();
          const rect = tr.getBoundingClientRect();
          openMenu(rect.left, rect.bottom);
        }
      });
      tbody.appendChild(tr);
    }
  }

  function render() { renderHead(); renderBody(); }
  function setSelected(idx) {
    selectedIdx = idx;
    Array.from(tbody.rows).forEach((row, index) => {
      const selected = options.isSelected?.(rows[index]) || false;
      row.classList.toggle('selected', selected);
      row.tabIndex = index === idx ? 0 : -1;
    });
    tbody.rows[idx]?.focus();
  }
  function getSortCol() { return sortCol; }
  function getSortDir() { return sortDir; }
  render();
  return { el: table, setSelected, render, getSortCol, getSortDir, fit };
}

// ---- Collapsible section ----
export function createSectionToggle(label) {
  let open = true;
  const toggle = h('button', { className: 'pbs-section-toggle', 'aria-expanded': 'true' });
  const arrow = h('span', { className: 'pbs-section-arrow open', textContent: '▶' });
  toggle.appendChild(arrow);
  toggle.appendChild(h('span', { textContent: _t(label) }));
  const body = h('div', { className: 'pbs-section-body', style: { display: 'block' } });
  toggle.addEventListener('click', () => { open = !open; toggle.setAttribute('aria-expanded', String(open)); arrow.className = `pbs-section-arrow ${open ? 'open' : ''}`; body.style.display = open ? 'block' : 'none'; });
  return { toggle, body };
}
