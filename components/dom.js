import { TYPE_COLORS } from '../file-types.js';

export let _t = s => s;
export function setI18n(tFn) { _t = tFn; }

// Accent-insensitive search key: "capsula" must match "Cápsula". NFD splits
// accented chars into base+combining-mark, then the marks get stripped —
// standard JS idiom, no library needed.
export function normalizeSearch(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

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
    el.style.background = '';
    el.style.border = '';
    el.style.borderRadius = '';
    Object.assign(el.style, typeIconStyle(iconPos));
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

// The mod renders plain DOM. Use the host ScrollingText markup and animation.
export function scrollingText(value) {
  const inner = h('span', { textContent: value });
  const box = h('span', { className: 'ms-scroll-text ms-scroll-hover pbs-scrolling-text', title: value }, inner);
  const measure = () => {
    const overflow = inner.scrollWidth - box.clientWidth;
    box.classList.toggle('scrolling', overflow > 2);
    inner.style.setProperty('--ms-scroll-dx', `${-overflow}px`);
    inner.style.setProperty('--ms-scroll-ms', `${Math.max(4000, overflow * 40)}ms`);
  };
  box.addEventListener('pointerenter', measure);
  return box;
}

export function iconSwitch(checked, label, onChange) {
  const symbol = path => `<svg width="12" height="12" viewBox="3 3 18 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  const tick = symbol('<polyline points="20 6 9 17 4 12"/>');
  const cross = symbol('<path d="m18 6-12 12m0-12 12 12"/>');
  const control = h('button', { type: 'button', className: 'ms-bare icon-switch pbs-switch', role: 'switch', 'aria-checked': String(checked), 'aria-label': label },
    h('span', { className: 'icon-switch-track', 'aria-hidden': 'true' },
      h('span', { className: 'icon-switch-symbol icon-switch-off', innerHTML: cross }),
      h('span', { className: 'icon-switch-symbol icon-switch-on', innerHTML: tick }),
      h('span', { className: 'icon-switch-thumb' })));
  control.addEventListener('click', () => {
    checked = !checked;
    control.setAttribute('aria-checked', String(checked));
    onChange(checked);
  });
  return control;
}

export function badge(text) {
  return h('span', { className: 'pbs-sidebar-badge', textContent: String(text) });
}

export function searchBox(placeholder, onInput) {
  let timer;
  const input = h('input', { className: 'pbs-search', type: 'search', 'aria-label': placeholder || _t('Search...'), placeholder: placeholder || _t('Search...'), onInput: () => { clearTimeout(timer); timer = setTimeout(() => onInput(input.value), 150); } });
  return input;
}

// ---- GO TO button helper (module-level for reuse in sub-editors) ----
const GO_TO_SVG = "<svg xmlns='http://www.w3.org/2000/svg' x='0px' y='0px' viewBox='0 0 24 24' width='12' height='12' fill='currentColor'><path d='M 5 3 C 3.9069372 3 3 3.9069372 3 5 L 3 19 C 3 20.093063 3.9069372 21 5 21 L 19 21 C 20.093063 21 21 20.093063 21 19 L 21 12 L 19 12 L 19 19 L 5 19 L 5 5 L 12 5 L 12 3 L 5 3 z M 14 3 L 14 5 L 17.585938 5 L 8.2929688 14.292969 L 9.7070312 15.707031 L 19 6.4140625 L 19 10 L 21 10 L 21 3 L 14 3 z'></path></svg>";
export function goToBtn(refKey, getValue, onNavigate) {
  if (!onNavigate || !refKey) return null;
  return h('button', { className: 'pbs-goto-btn', 'aria-label': _t('Go to reference'), title: _t('Go to reference'), style: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '0 2px', lineHeight: '1', flexShrink: '0', alignSelf: 'center', display: 'inline-flex', alignItems: 'center' }, innerHTML: GO_TO_SVG, onClick: (e) => { e.stopPropagation(); const v = getValue(); if (v) onNavigate(refKey, v); } });
}

// ---- Context menu ----
let activeCtxMenu = null;
export function showContextMenu(x, y, items, host, trigger) {
  closeContextMenu();
  const menu = h('div', { className: 'pbs-ctx-menu', role: 'menu', 'aria-label': _t('Actions') });
  for (const item of items) {
    if (item.separator) { menu.appendChild(h('div', { className: 'pbs-ctx-sep', role: 'separator' })); continue; }
    menu.appendChild(h('button', { className: `pbs-ctx-item ${item.danger ? 'danger' : ''}`, role: 'menuitem', tabIndex: -1, textContent: item.label, onClick: () => { closeContextMenu(); trigger?.focus(); item.action?.(); } }));
  }
  host.appendChild(menu);
  activeCtxMenu = menu;
  menu.style.left = Math.max(4, Math.min(x, innerWidth - menu.offsetWidth - 4)) + 'px';
  menu.style.top = Math.max(4, Math.min(y, innerHeight - menu.offsetHeight - 4)) + 'px';
  const buttons = [...menu.querySelectorAll('button')];
  buttons[0]?.focus();
  const closeOutside = (event) => { if (!menu.contains(event.target)) closeContextMenu(); };
  const onKey = (event) => {
    const index = buttons.indexOf(document.activeElement);
    if (event.key === 'Tab') { closeContextMenu(); trigger?.focus(); return; }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeContextMenu();
      trigger?.focus();
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      buttons[(index + delta + buttons.length) % buttons.length]?.focus();
    }
  };
  menu.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', closeOutside, true);
  menu._cleanup = closeContextMenu;
  menu.removeOutsideListener = () => document.removeEventListener('pointerdown', closeOutside, true);
}

function closeContextMenu() {
  activeCtxMenu?.removeOutsideListener();
  activeCtxMenu?.remove();
  activeCtxMenu = null;
}

// ---- Reference autocomplete ----
// Custom filtered dropdown (not native <datalist>): styleable, caps the list
// at 20 rows so a 1000-entry Param source stays fast, and keeps its own arrow
// navigation from bubbling to the entry-list keyboard handler.

let nextReferenceId = 0;

export function createRefInput(value, suggestions, onChange, placeholder) {
  const id = `pbs-reference-${++nextReferenceId}`;
  const wrap = h('div', { className: 'pbs-reference' });
  const input = h('input', {
    type: 'text', role: 'combobox', 'aria-label': placeholder || _t('Reference'), 'aria-expanded': 'false', 'aria-controls': id, 'aria-autocomplete': 'list',
    value: String(value || ''),
    style: { width: '100%' },
    title: String(value || ''), // full text on hover when the cell truncates it
  });
  if (placeholder) input.placeholder = placeholder;
  // `suggestions` may be a static array or a function returning the current
  // list (the evolution Param list depends on the selected Method).
  const getList = () => (typeof suggestions === 'function' ? (suggestions() || []) : (suggestions || []));

  const dropdown = h('div', {
    className: 'pbs-ref-dropdown', id, role: 'listbox',
    style: { display: 'none' },
  });

  let activeIdx = -1;
  let filtered = [];

  function filterItems(q) {
    const list = getList();
    if (!list.length) { filtered = []; return; }
    if (!q) { filtered = list.filter(s => typeof s === 'string').slice(0, 20); return; }
    const needle = normalizeSearch(q);
    filtered = list.filter(s => typeof s === 'string' && normalizeSearch(s).includes(needle)).slice(0, 20);
  }

  function hide() {
    dropdown.style.display = 'none';
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function renderDropdown() {
    dropdown.innerHTML = '';
    if (!filtered.length) { hide(); activeIdx = -1; return; }
    dropdown.style.display = 'block';
    input.setAttribute('aria-expanded', 'true');
    if (activeIdx >= 0) input.setAttribute('aria-activedescendant', `${id}-${activeIdx}`);
    else input.removeAttribute('aria-activedescendant');
    filtered.forEach((item, i) => {
      const opt = h('div', { id: `${id}-${i}`, role: 'option', 'aria-selected': String(i === activeIdx), className: `pbs-ref-item ${i === activeIdx ? 'active' : ''}`, textContent: item });
      opt.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.value = item;
        input.title = item;
        hide();
        onChange(item);
      });
      dropdown.appendChild(opt);
    });
    const rect = input.getBoundingClientRect();
    dropdown.style.left = rect.left + 'px';
    dropdown.style.minWidth = rect.width + 'px';
    dropdown.style.top = (rect.bottom + dropdown.offsetHeight <= innerHeight ? rect.bottom : Math.max(0, rect.top - dropdown.offsetHeight)) + 'px';
    const active = dropdown.children[activeIdx];
    if (active) {
      const top = active.offsetTop;
      if (top < dropdown.scrollTop) dropdown.scrollTop = top;
      if (top + active.offsetHeight > dropdown.scrollTop + dropdown.clientHeight) {
        dropdown.scrollTop = top + active.offsetHeight - dropdown.clientHeight;
      }
    }
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

  input.addEventListener('blur', hide);

  input.addEventListener('keydown', (e) => {
    if (dropdown.style.display === 'none' || !filtered.length) return;
    // Stop propagation so the entry-list handler on the root doesn't also move
    // the selected entry while the user navigates suggestions.
    if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); activeIdx = Math.min(activeIdx + 1, filtered.length - 1); renderDropdown(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); activeIdx = Math.max(activeIdx - 1, 0); renderDropdown(); }
    else if (e.key === 'Enter' || e.key === 'Tab') {
      if (activeIdx >= 0 && activeIdx < filtered.length) {
        if (e.key === 'Enter') e.preventDefault();
        input.value = filtered[activeIdx];
        input.title = input.value;
        hide();
        onChange(input.value);
      }
    } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hide(); }
  });

  wrap.appendChild(input);
  wrap.appendChild(dropdown);
  return { el: wrap, getValue: () => input.value, setValue: (v) => { input.value = v; input.title = v; } };
}
