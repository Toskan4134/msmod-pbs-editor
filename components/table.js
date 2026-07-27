import { h, _t, getTypeIconConfig } from './dom.js';
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
  const prevBtn = h('button', { className: 'pbs-page-btn', textContent: _t('← Prev'), onClick: () => { if (current > 0) { current--; update(); onPage(current); } } });
  const info = h('span', { textContent: '' });
  const nextBtn = h('button', { className: 'pbs-page-btn', textContent: _t('Next →'), onClick: () => { if (current < totalPages - 1) { current++; update(); onPage(current); } } });
  container.appendChild(prevBtn);
  container.appendChild(info);
  container.appendChild(nextBtn);

  function update() {
    prevBtn.disabled = current <= 0;
    nextBtn.disabled = current >= totalPages - 1;
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
let _animInterval = null;

export function createPreviewPanel(loadImageFn) {
  const panel = h('div', { className: 'pbs-preview' });
  panel.appendChild(placeholder(ICON_PREVIEW, _t('Select an entry to preview')));

  function stopAnim() {
    if (_animInterval) { clearInterval(_animInterval); _animInterval = null; }
  }
  function placeholder(icon, ...lines) {
    const ph = h('div', { className: 'pbs-preview-placeholder' });
    ph.appendChild(h('div', { className: 'pbs-preview-placeholder-icon', innerHTML: icon }));
    for (const line of lines) ph.appendChild(typeof line === 'string' ? h('div', { textContent: line }) : h('div', line));
    return ph;
  }

  function show(gameRoot, path, displayName, fps, opts = {}) {
    stopAnim();
    panel.innerHTML = '';
    if (!path) {
      panel.appendChild(placeholder(ICON_PREVIEW, _t('No graphic')));
      panel.appendChild(h('div', { className: 'pbs-preview-name', textContent: displayName || '' }));
      return;
    }
    if (!loadImageFn) {
      panel.appendChild(placeholder(ICON_PREVIEW, _t('No loader')));
      panel.appendChild(h('div', { className: 'pbs-preview-name', textContent: displayName || '' }));
      return;
    }
    const absPath = (gameRoot || '').replace(/\\/g, '/') + '/' + path;
    panel.appendChild(placeholder(ICON_LOADING, _t('Loading...')));

    const panelName = displayName || '';
    const animFps = fps || 16;

    loadImageFn(absPath).then(url => {
      if (!url) {
        panel.innerHTML = '';
        panel.appendChild(placeholder(ICON_NOT_FOUND, path.split('/').pop(), { textContent: _t('Not found'), style: { fontSize: '10px' } }));
        panel.appendChild(h('div', { className: 'pbs-preview-name', textContent: panelName }));
        return;
      }
      const img = new Image();
      img.onload = () => {
        panel.innerHTML = '';
        const frameH = img.naturalHeight;
        const totalW = img.naturalWidth;
        const frameCount = Math.max(1, Math.round(totalW / frameH));
        const isSpritesheet = !opts.map && frameCount > 1 && totalW > frameH;

        if (isSpritesheet) {
          const size = Math.min(128, frameH * 2);
          const canvas = h('canvas', { width: size, height: size, style: { imageRendering: 'pixelated', borderRadius: '4px'} });
          const ctx2d = canvas.getContext('2d');
          ctx2d.imageSmoothingEnabled = false;
          let currentFrame = 0;
          panel.appendChild(canvas);
          panel.appendChild(h('div', { className: 'pbs-preview-name', textContent: panelName + ` (${frameCount}f)` }));

          function drawFrame() {
            ctx2d.clearRect(0, 0, size, size);
            ctx2d.drawImage(img, currentFrame * frameH, 0, frameH, frameH, 0, 0, size, size);
          }
          drawFrame();
          if (animFps > 0) {
            const delayMs = Math.max(16, Math.round(1000 / animFps));
            _animInterval = setInterval(() => {
              currentFrame = (currentFrame + 1) % frameCount;
              drawFrame();
            }, delayMs);
          }
        } else {
          panel.appendChild(h('img', { className: 'pbs-preview-img' + (opts.map ? ' pbs-preview-map' : ''), src: url, alt: panelName }));
          panel.appendChild(h('div', { className: 'pbs-preview-name', textContent: panelName }));
        }
      };
      img.onerror = () => {
        panel.innerHTML = '';
        panel.appendChild(placeholder(ICON_NOT_FOUND, path.split('/').pop()));
        panel.appendChild(h('div', { className: 'pbs-preview-name', textContent: panelName }));
      };
      img.src = url;
    }).catch(() => {
      panel.innerHTML = '';
      panel.appendChild(placeholder(ICON_NOT_FOUND, path.split('/').pop()));
      panel.appendChild(h('div', { className: 'pbs-preview-name', textContent: panelName }));
    });
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

  return { el: panel, show, clear, showTypeIcon };
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
      for (const col of columns) {
        const val = row[col.key] ?? '';
        const td = h('td', { textContent: col.numeric ? (parseInt(val) || '') : String(val) });
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
