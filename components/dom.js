import { TYPE_COLORS } from '../file-types.js';

export let _t = s => s;
export function setI18n(tFn) { _t = tFn; }

// ---- Type icon sprite (loaded from game project) ----
let _typeIconUrl = null;
let _typeIconW = 0;
let _typeIconH = 0;
let _typeIconTotalH = 0;

const TYPE_ICON_DISP_H = 20; // display height in list rows

export function configureTypeIcons(url, iconW, iconH, totalH) {
  _typeIconUrl = url;
  _typeIconW = iconW;
  _typeIconH = iconH;
  _typeIconTotalH = totalH;
}

export function clearTypeIcons() {
  _typeIconUrl = null;
  _typeIconW = 0;
  _typeIconH = 0;
  _typeIconTotalH = 0;
}

export function getTypeIconConfig() {
  return _typeIconUrl ? { url: _typeIconUrl, iconW: _typeIconW, iconH: _typeIconH, totalH: _typeIconTotalH } : null;
}

function typeIconStyle(iconPos, dispH) {
  const dH = dispH || TYPE_ICON_DISP_H;
  const scale = _typeIconH > 0 ? dH / _typeIconH : 1;
  const dispW = Math.round(_typeIconW * scale);
  const dispTotalH = Math.round(_typeIconTotalH * scale);
  return {
    display: 'inline-block',
    width: dispW + 'px',
    height: dH + 'px',
    backgroundImage: `url(${_typeIconUrl})`,
    backgroundPosition: `0 -${iconPos * dH}px`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${dispW}px ${dispTotalH}px`,
    imageRendering: 'pixelated',
    flexShrink: '0',
    alignSelf: 'center',
  };
}

export function makeTypeIndicator(typeName, iconPos) {
  if (_typeIconUrl && iconPos != null) {
    return h('span', { style: typeIconStyle(iconPos) });
  }
  const color = TYPE_COLORS[(typeName || '').toUpperCase()] || null;
  return h('span', { style: {
    display: 'inline-block',
    width: '10px',
    height: '10px',
    borderRadius: '2px',
    background: color || 'var(--border)',
    flexShrink: '0',
    alignSelf: 'center',
    border: '1px solid ' + (color ? color + '66' : 'var(--border)'),
  }});
}

export function updateTypeIndicator(el, typeName, iconPos) {
  if (_typeIconUrl && iconPos != null) {
    Object.assign(el.style, typeIconStyle(iconPos));
    el.style.background = '';
    el.style.border = '';
    el.style.borderRadius = '';
  } else {
    const color = TYPE_COLORS[(typeName || '').toUpperCase()] || null;
    el.style.backgroundImage = '';
    el.style.backgroundPosition = '';
    el.style.backgroundSize = '';
    el.style.width = '10px';
    el.style.height = '10px';
    el.style.borderRadius = '2px';
    el.style.background = color || 'var(--border)';
    el.style.border = '1px solid ' + (color ? color + '66' : 'var(--border)');
  }
}

// ---- Element helper ----
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'className') el.className = v;
      else if (k === 'textContent') el.textContent = v;
      else if (k === 'innerHTML') el.innerHTML = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'selected' || k === 'disabled' || k === 'checked' || k === 'multiple' || k === 'readOnly') { if (v) el[k] = true; }
      else el.setAttribute(k, v);
    }
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    if (typeof c === 'string' || typeof c === 'number') el.appendChild(document.createTextNode(String(c)));
    else if (c instanceof Node) el.appendChild(c);
  }
  return el;
}

export function button(label, onClick, variant = '') {
  const cls = `pbs-btn ${variant}`;
  return label && typeof label === 'string' && label.includes('<')
    ? h('button', { className: cls, onClick, innerHTML: label })
    : h('button', { className: cls, onClick, textContent: label });
}

export function badge(text) {
  return h('span', { className: 'pbs-sidebar-badge', textContent: String(text) });
}

export function searchBox(placeholder, onInput) {
  let timer;
  const input = h('input', { className: 'pbs-search', type: 'text', placeholder: placeholder || _t('Search...'), onInput: () => { clearTimeout(timer); timer = setTimeout(() => onInput(input.value), 150); } });
  return input;
}

// ---- GO TO button helper (module-level for reuse in sub-editors) ----
const GO_TO_SVG = "<svg xmlns='http://www.w3.org/2000/svg' x='0px' y='0px' viewBox='0 0 24 24' width='12' height='12' fill='currentColor'><path d='M 5 3 C 3.9069372 3 3 3.9069372 3 5 L 3 19 C 3 20.093063 3.9069372 21 5 21 L 19 21 C 20.093063 21 21 20.093063 21 19 L 21 12 L 19 12 L 19 19 L 5 19 L 5 5 L 12 5 L 12 3 L 5 3 z M 14 3 L 14 5 L 17.585938 5 L 8.2929688 14.292969 L 9.7070312 15.707031 L 19 6.4140625 L 19 10 L 21 10 L 21 3 L 14 3 z'></path></svg>";
export function goToBtn(refKey, getValue, onNavigate) {
  if (!onNavigate || !refKey) return null;
  return h('button', { className: 'pbs-goto-btn', style: { background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '12px', padding: '0 2px', lineHeight: '1', flexShrink: '0', alignSelf: 'center', display: 'inline-flex', alignItems: 'center' }, innerHTML: GO_TO_SVG, onClick: (e) => { e.stopPropagation(); const v = getValue(); if (v) onNavigate(refKey, v); } });
}

// ---- Context menu ----
let activeCtxMenu = null;
export function showContextMenu(x, y, items, host) {
  closeContextMenu();
  const menu = h('div', { className: 'pbs-ctx-menu', style: { left: x + 'px', top: y + 'px' } });
  for (const item of items) {
    if (item.separator) { menu.appendChild(h('div', { className: 'pbs-ctx-sep' })); continue; }
    menu.appendChild(h('button', { className: `pbs-ctx-item ${item.danger ? 'danger' : ''}`, textContent: item.label, onClick: (e) => { e.stopPropagation(); closeContextMenu(); item.action?.(); } }));
  }
  host.appendChild(menu);
  activeCtxMenu = menu;
  const close = (e) => { if (!menu.contains(e.target)) closeContextMenu(); };
  document.addEventListener('mousedown', close, true);
  menu._cleanup = () => document.removeEventListener('mousedown', close, true);
}
function closeContextMenu() { if (activeCtxMenu) { activeCtxMenu._cleanup?.(); activeCtxMenu.remove(); activeCtxMenu = null; } }

// ---- Reference autocomplete ----
// Custom filtered dropdown (not native <datalist>): styleable, caps the list
// at 20 rows so a 1000-entry Param source stays fast, and keeps its own arrow
// navigation from bubbling to the entry-list keyboard handler.

export function createRefInput(value, suggestions, onChange, placeholder) {
  const wrap = h('div', { style: { position: 'relative' } });
  const input = h('input', {
    type: 'text',
    value: String(value || ''),
    style: { width: '100%' },
    title: String(value || ''), // full text on hover when the cell truncates it
  });
  if (placeholder) input.placeholder = placeholder;
  input.style.cssText += ';padding:3px 6px;border:1px solid var(--border);border-radius:3px;background:var(--input-bg);color:var(--text-primary);font-size:12px;font-family:inherit;outline:none;width:100%;';
  // `suggestions` may be a static array or a function returning the current
  // list (the evolution Param list depends on the selected Method).
  const getList = () => (typeof suggestions === 'function' ? (suggestions() || []) : (suggestions || []));

  const dropdown = h('div', {
    className: 'pbs-ref-dropdown',
    style: { display: 'none' },
  });

  let activeIdx = -1;
  let filtered = [];

  function filterItems(q) {
    const list = getList();
    if (!list.length) { filtered = []; return; }
    if (!q) { filtered = list.filter(s => typeof s === 'string').slice(0, 20); return; }
    const lower = q.toLowerCase();
    filtered = list.filter(s => typeof s === 'string' && s.toLowerCase().includes(lower)).slice(0, 20);
  }

  function renderDropdown() {
    dropdown.innerHTML = '';
    if (!filtered.length) { dropdown.style.display = 'none'; activeIdx = -1; return; }
    dropdown.style.display = 'block';
    filtered.forEach((item, i) => {
      const opt = h('div', { className: `pbs-ref-item ${i === activeIdx ? 'active' : ''}`, textContent: item });
      opt.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.value = item;
        input.title = item;
        dropdown.style.display = 'none';
        onChange(item);
      });
      dropdown.appendChild(opt);
    });
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    filterItems(q);
    activeIdx = -1;
    renderDropdown();
    input.title = input.value;
    onChange(input.value);
  });

  input.addEventListener('focus', () => {
    filterItems(input.value.trim());
    renderDropdown();
  });

  input.addEventListener('blur', () => { setTimeout(() => { dropdown.style.display = 'none'; }, 150); });

  input.addEventListener('keydown', (e) => {
    if (dropdown.style.display === 'none' || !filtered.length) return;
    // Stop propagation so the entry-list handler on the root doesn't also move
    // the selected entry while the user navigates suggestions.
    if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); activeIdx = Math.min(activeIdx + 1, filtered.length - 1); renderDropdown(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); activeIdx = Math.max(activeIdx - 1, 0); renderDropdown(); }
    else if (e.key === 'Enter' || e.key === 'Tab') {
      if (activeIdx >= 0 && activeIdx < filtered.length) {
        e.preventDefault();
        input.value = filtered[activeIdx];
        input.title = input.value;
        dropdown.style.display = 'none';
        onChange(input.value);
      }
    } else if (e.key === 'Escape') { dropdown.style.display = 'none'; }
  });

  wrap.appendChild(input);
  wrap.appendChild(dropdown);
  return { el: wrap, getValue: () => input.value, setValue: (v) => { input.value = v; input.title = v; } };
}
