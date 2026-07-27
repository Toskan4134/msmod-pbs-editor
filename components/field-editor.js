import { h, _t, createRefInput, goToBtn, makeTypeIndicator, updateTypeIndicator } from './dom.js';

// ---- Field editors ----
export function createFieldEditor(fieldDef, value, onChange, refData, ctx, onNavigate) {
  const wrap = h('div', { className: `pbs-field ${fieldDef.fullWidth ? 'full-width' : ''}` });
  wrap.appendChild(h('label', { textContent: _t(fieldDef.label) }));
  const type = fieldDef.type || 'text';

  // Get suggestions for reference fields
  const getSuggestions = (refKey) => {
    const ref = refKey || fieldDef.ref;
    if (!ref || !refData) return [];
    const entries = refData[ref];
    if (!entries) return [];
    return entries.map(e => e.InternalName || e.Name || '').filter(Boolean);
  };

  if (type === 'text' || type === 'number') {
    if (fieldDef.ref && type === 'text') {
      const row = h('div', { style: { display: 'flex', gap: '2px', alignItems: 'center' } });
      const ref = createRefInput(value, getSuggestions(), onChange);
      ref.el.style.flex = '1';
      ref.el.style.minWidth = '0';
      row.appendChild(ref.el);
      const btn = goToBtn(fieldDef.ref, () => ref.getValue(), onNavigate);
      if (btn) row.appendChild(btn);
      wrap.appendChild(row);
      return wrap;
    }
    const input = h('input', { type: type === 'number' ? 'number' : 'text', value: String(value || ''), placeholder: fieldDef.placeholder || '' });
    if (fieldDef.min != null) input.min = fieldDef.min;
    if (fieldDef.max != null) input.max = fieldDef.max;
    if (fieldDef.step != null) input.step = fieldDef.step;
    input.addEventListener('input', () => onChange(input.value));
    wrap.appendChild(input);
    return wrap;
  }
  if (type === 'select') {
    const row = h('div', { style: { display: 'flex', gap: '2px', alignItems: 'center' } });
    const sel = h('select', { style: { flex: '1' } });
    sel.appendChild(h('option', { value: '', textContent: '—' }));
    for (const opt of (fieldDef.options || [])) sel.appendChild(h('option', { value: opt, textContent: opt, selected: opt === value }));
    if (value && !(fieldDef.options || []).includes(value)) {
      sel.appendChild(h('option', { value: value, textContent: value, selected: true }));
    }
    if (value) sel.value = value;
    sel.addEventListener('change', () => onChange(sel.value));
    row.appendChild(sel);
    const btn = goToBtn(fieldDef.ref, () => sel.value, onNavigate);
    if (btn) row.appendChild(btn);
    wrap.appendChild(row);
    return wrap;
  }
  if (type === 'checkbox') {
    const row = h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '4px' } });
    const cb = h('input', { type: 'checkbox', checked: value === 'true' || value === true });
    cb.addEventListener('change', () => onChange(cb.checked ? 'true' : 'false'));
    row.appendChild(cb);
    const lbl = h('span', { textContent: value === 'true' ? _t('Yes') : _t('No'), style: { fontSize: '11px', color: 'var(--text-secondary)' } });
    cb.addEventListener('change', () => { lbl.textContent = cb.checked ? _t('Yes') : _t('No'); });
    row.appendChild(lbl);
    wrap.appendChild(row);
    return wrap;
  }
  if (type === 'textarea') {
    const ta = h('textarea', { textContent: value || '' });
    ta.addEventListener('input', () => onChange(ta.value));
    wrap.appendChild(ta);
    return wrap;
  }
  if (type === 'list') {
    const items = (value || '').split(',').filter(Boolean);
    let typeIconPositions = null;
    if (fieldDef.ref === 'types' && refData?.types) {
      typeIconPositions = {};
      for (const t of refData.types) {
        const name = (t.InternalName || t.Name || '').toUpperCase();
        const pos = parseInt(t.IconPosition ?? t._id);
        if (name && !isNaN(pos)) typeIconPositions[name] = pos;
      }
    }
    const editor = createListEditor(items, onChange, fieldDef.ref ? getSuggestions() : null, onNavigate, fieldDef.ref, typeIconPositions);
    wrap.appendChild(editor);
    return wrap;
  }
  if (type === 'pairs') {
    const rawItems = (value || '').split(',');
    const pairs = [];
    for (let i = 0; i < rawItems.length; i += 2) { if (rawItems[i] && rawItems[i + 1]) pairs.push([rawItems[i].trim(), rawItems[i + 1].trim()]); }
    const editor = createPairsEditor(pairs, fieldDef.pairLabels || ['A', 'B'], onChange, fieldDef.refB ? getSuggestions(fieldDef.refB) : null, onNavigate, fieldDef.refB);
    wrap.appendChild(editor);
    return wrap;
  }
  if (type === 'triplets') {
    const rawItems = (value || '').split(',');
    const trips = [];
    for (let i = 0; i < rawItems.length; i += 3) { if (rawItems[i]) trips.push([rawItems[i]?.trim(), rawItems[i + 1]?.trim(), rawItems[i + 2]?.trim()]); }
    const editor = createTripletsEditor(trips, fieldDef.labels || ['A', 'B', 'C'], onChange, fieldDef.refA ? getSuggestions(fieldDef.refA) : null, onNavigate, fieldDef.refA, refData, !!fieldDef.evolution);
    wrap.appendChild(editor);
    return wrap;
  }
  if (type === 'stats') {
    const parts = (value || '').split(',').map(n => parseInt(n.trim()) || 0);
    const statNames = fieldDef.statsKeys || ['HP', 'Atk', 'Def', 'Spe', 'SpAtk', 'SpDef'];
    const editor = createStatsEditor(parts, statNames, onChange);
    wrap.appendChild(editor);
    return wrap;
  }
  if (type === 'evs') {
    const editor = createEvsEditor(value || '', onChange);
    wrap.appendChild(editor);
    return wrap;
  }
  if (type === 'bgm') {
    const editor = createBgmEditor(value || '', onChange, ctx);
    wrap.appendChild(editor);
    return wrap;
  }
  const input = h('input', { type: 'text', value: String(value || '') });
  input.addEventListener('input', () => onChange(input.value));
  wrap.appendChild(input);
  return wrap;
}

// ---- List editor ----
export function createListEditor(items, onChange, suggestions, onNavigate, refKey, typeIconPositions) {
  const container = h('div', { className: 'pbs-list-editor' });
  const isTypeField = refKey === 'types';

  function getIconPos(typeName) {
    if (!isTypeField || !typeIconPositions) return null;
    const pos = typeIconPositions[(typeName || '').toUpperCase()];
    return pos !== undefined ? pos : null;
  }

  function render() {
    container.innerHTML = '';
    for (let i = 0; i < items.length; i++) {
      const row = h('div', { className: 'pbs-list-row' });

      let indicator = null;
      if (isTypeField) {
        indicator = makeTypeIndicator(items[i], getIconPos(items[i]));
        row.appendChild(indicator);
      }

      if (suggestions) {
        const ii = i;
        const ref = createRefInput(items[i], suggestions, (v) => {
          items[ii] = v;
          if (indicator) updateTypeIndicator(indicator, v, getIconPos(v));
          emitChange();
        });
        ref.el.style.flex = '1';
        ref.el.style.minWidth = '0';
        row.appendChild(ref.el);
      } else {
        const inp = h('input', { value: items[i] });
        inp.addEventListener('input', () => { items[i] = inp.value; emitChange(); });
        row.appendChild(inp);
      }
      const gBtn = goToBtn(refKey, () => items[i], onNavigate);
      if (gBtn) row.appendChild(gBtn);
      row.appendChild(h('button', { className: 'pbs-list-remove', textContent: '×', onClick: () => { items.splice(i, 1); render(); emitChange(); } }));
      container.appendChild(row);
    }
    container.appendChild(h('button', { className: 'pbs-list-add', textContent: _t('+ Add'), onClick: () => { items.push(''); render(); } }));
  }
  function emitChange() { onChange(items.filter(Boolean).join(',')); }
  render();
  return container;
}

// ---- Pairs editor ----
function createPairsEditor(pairs, labels, onChange, suggestions, onNavigate, refKey) {
  const container = h('div', { className: 'pbs-list-editor' });
  function render() {
    container.innerHTML = '';
    for (let i = 0; i < pairs.length; i++) {
      const row = h('div', { className: 'pbs-list-row' });
      // First column (always plain input)
      const inp0 = h('input', { value: pairs[i][0], placeholder: _t(labels[0]), style: { width: '40px', flex: 'none' } });
      const ii0 = i;
      inp0.addEventListener('input', () => { pairs[ii0][0] = inp0.value; emitChange(); });
      row.appendChild(inp0);
      // Second column (with suggestions if provided)
      if (suggestions) {
        const ref = createRefInput(pairs[i][1], suggestions, (v) => { pairs[ii0][1] = v; emitChange(); });
        ref.el.style.flex = '1';
        ref.el.style.minWidth = '0';
        row.appendChild(ref.el);
      } else {
        const inp1 = h('input', { value: pairs[i][1], placeholder: _t(labels[1]) });
        const ii1 = i;
        inp1.addEventListener('input', () => { pairs[ii1][1] = inp1.value; emitChange(); });
        row.appendChild(inp1);
      }
      const pBtn = goToBtn(refKey, () => pairs[i]?.[1] || '', onNavigate);
      if (pBtn) row.appendChild(pBtn);
      row.appendChild(h('button', { className: 'pbs-list-remove', textContent: '×', onClick: () => { pairs.splice(i, 1); render(); emitChange(); } }));
      container.appendChild(row);
    }
    container.appendChild(h('button', { className: 'pbs-list-add', textContent: _t('+ Add'), onClick: () => { pairs.push(['', '']); render(); } }));
  }
  function emitChange() { onChange(pairs.map(p => `${p[0]},${p[1]}`).join(',')); }
  render();
  return container;
}

// ---- Triplets editor ----
// Build an uppercase internal-name set for a file type (items / pokemon / moves / types).
function pbsNameSet(refData, key) {
  const set = new Set();
  const list = refData && Array.isArray(refData[key]) ? refData[key] : [];
  for (const e of list) {
    const n = (e.InternalName || e.Name || '').toUpperCase();
    if (n) set.add(n);
  }
  return set;
}

// Infer, from how each evolution method is actually used in the loaded PBS
// data, what KIND of value its parameter takes (item / pokemon / move / type).
// No hardcoded method list: a method is classified by majority vote of its
// observed parameters against the project's own name sets. Methods whose
// parameters are numbers or unrecognized get no autocomplete (free text).
function buildEvoParamKinds(refData) {
  const sets = {
    items: pbsNameSet(refData, 'items'),
    pokemon: pbsNameSet(refData, 'pokemon'),
    moves: pbsNameSet(refData, 'moves'),
    types: pbsNameSet(refData, 'types'),
  };
  const paramsByMethod = new Map();
  const collect = (raw) => {
    if (!raw) return;
    const toks = raw.split(',');
    for (let i = 1; i + 1 < toks.length; i += 3) {
      const method = (toks[i] || '').trim();
      if (!method) continue;
      const param = (toks[i + 1] || '').trim();
      if (!param) continue;
      if (!paramsByMethod.has(method)) paramsByMethod.set(method, []);
      paramsByMethod.get(method).push(param);
    }
  };
  for (const key of ['pokemon', 'pokemon_forms']) {
    const list = refData && refData[key];
    if (Array.isArray(list)) for (const e of list) collect(e.Evolutions || e.Evolution || '');
  }
  const kindFor = new Map();
  for (const [method, params] of paramsByMethod) {
    const votes = { items: 0, pokemon: 0, moves: 0, types: 0 };
    for (const p of params) {
      const up = p.toUpperCase();
      if (sets.items.has(up)) votes.items++;
      else if (sets.pokemon.has(up)) votes.pokemon++;
      else if (sets.moves.has(up)) votes.moves++;
      else if (sets.types.has(up)) votes.types++;
    }
    let best = null, bestN = 0, total = 0;
    for (const k of ['items', 'pokemon', 'moves', 'types']) {
      total += votes[k];
      if (votes[k] > bestN) { bestN = votes[k]; best = k; }
    }
    if (best && total > 0 && bestN * 2 >= total) kindFor.set(method, best);
  }
  return kindFor;
}

// Names to suggest for a given method's parameter (empty array → free text).
function evoParamNames(refData, method, kindMap) {
  const kind = kindMap && kindMap.get(method);
  if (!kind) return [];
  return (refData && Array.isArray(refData[kind]) ? refData[kind] : [])
    .map(e => e.InternalName || e.Name || '').filter(Boolean);
}

// Scan every Evolutions line in the loaded PBS data and collect the distinct
// method names actually in use. This is the source of truth (not a hardcoded
// list), so methods added by custom bases show up automatically.
function collectEvolutionMethods(refData) {
  const set = new Set();
  for (const key of ['pokemon', 'pokemon_forms']) {
    const list = refData && refData[key];
    if (!Array.isArray(list)) continue;
    for (const e of list) {
      const raw = e.Evolutions || e.Evolution || '';
      if (!raw) continue;
      const toks = raw.split(',');
      for (let i = 1; i < toks.length; i += 3) {
        const m = (toks[i] || '').trim();
        if (m) set.add(m);
      }
    }
  }
  return [...set].sort();
}

function createTripletsEditor(trips, labels, onChange, suggestions, onNavigate, refKey, refData, isEvolution) {
  const container = h('div', { className: 'pbs-list-editor' });
  const cell = (t, idx) => (t[idx] == null ? '' : t[idx]);
  const methodList = isEvolution ? collectEvolutionMethods(refData) : [];
  const paramKindMap = isEvolution ? buildEvoParamKinds(refData) : null;
  function render() {
    container.innerHTML = '';
    for (let i = 0; i < trips.length; i++) {
      const row = h('div', { className: 'pbs-list-row' });
      const ii = i;
      // Column 0: Target (species autocomplete if provided)
      if (suggestions) {
        const ref = createRefInput(cell(trips[i], 0), suggestions, (v) => { trips[i][0] = v; emitChange(); }, _t(labels[0]));
        ref.el.style.width = '70px';
        ref.el.style.flex = 'none';
        row.appendChild(ref.el);
      } else {
        const inp = h('input', { value: cell(trips[i], 0), placeholder: _t(labels[0]), style: { width: '70px', flex: 'none' } });
        inp.addEventListener('input', () => { trips[ii][0] = inp.value; emitChange(); });
        row.appendChild(inp);
      }
      // Column 1: Method — free-text combo backed by the methods seen in the
      // data, so a brand-new method can also be typed in.
      const methodRef = createRefInput(cell(trips[i], 1), methodList, (v) => { trips[ii][1] = v; emitChange(); }, _t(labels[1]));
      methodRef.el.style.width = '92px';
      methodRef.el.style.flex = 'none';
      row.appendChild(methodRef.el);
      // Column 2: Param — autocomplete kind follows the currently entered method.
      const paramSrc = isEvolution ? () => evoParamNames(refData, cell(trips[ii], 1), paramKindMap) : [];
      const paramRef = createRefInput(cell(trips[i], 2), paramSrc, (v) => { trips[ii][2] = v; emitChange(); }, _t(labels[2]));
      paramRef.el.style.flex = '1';
      paramRef.el.style.minWidth = '0';
      row.appendChild(paramRef.el);
      const tBtn = goToBtn(refKey, () => cell(trips[i], 0), onNavigate);
      if (tBtn) row.appendChild(tBtn);
      row.appendChild(h('button', { className: 'pbs-list-remove', textContent: '×', onClick: () => { trips.splice(i, 1); render(); emitChange(); } }));
      container.appendChild(row);
    }
    container.appendChild(h('button', { className: 'pbs-list-add', textContent: _t('+ Add'), onClick: () => { trips.push(['', '', '']); render(); } }));
  }
  // Coerce missing cells to '' so an unset param never serializes as the
  // literal string "undefined", and drop rows whose target species is empty.
  const serialize = () => trips.filter(t => cell(t, 0)).map(t => `${cell(t, 0)},${cell(t, 1)},${cell(t, 2)}`).join(',');
  function emitChange() { onChange(serialize()); }
  render();
  return container;
}

// ---- Stats editor ----
function statColor(val) {
  if (val <= 30) return '#ff6b6b';
  if (val <= 60) return '#fbbf24';
  if (val <= 90) return '#4ade80';
  return '#7c8aff';
}
function createStatsEditor(values, names, onChange) {
  const container = h('div', {});
  let _bstFill = null;
  let _bstVal = null;

  function calcBst() { return values.reduce((s, v) => s + (v || 0), 0); }
  function updateBst() {
    const bst = calcBst();
    if (_bstFill) _bstFill.style.width = Math.min(100, bst / 7.2) + '%';
    if (_bstVal) _bstVal.textContent = String(bst);
  }

  function render() {
    container.innerHTML = '';
    for (let i = 0; i < names.length; i++) {
      const row = h('div', { className: 'pbs-stat-row' });
      row.appendChild(h('span', { className: 'pbs-stat-label', textContent: names[i] }));
      const barBg = h('div', { className: 'pbs-stat-bar-bg' });
      const fill = h('div', { className: 'pbs-stat-bar-fill', style: { width: Math.min(100, (values[i] || 0) / 2.55) + '%', background: statColor(values[i] || 0) } });
      barBg.appendChild(fill);
      row.appendChild(barBg);
      const inp = h('input', { type: 'number', className: 'pbs-stat-value', value: values[i] || 0, min: 0, max: 255 });
      const ii = i;
      inp.addEventListener('input', () => { values[ii] = parseInt(inp.value) || 0; fill.style.width = Math.min(100, values[ii] / 2.55) + '%'; fill.style.background = statColor(values[ii]); updateBst(); emitChange(); });
      row.appendChild(inp);
      container.appendChild(row);
    }

    // BST row
    const bst = calcBst();
    const bstRow = h('div', { className: 'pbs-stat-row pbs-stat-bst-row' });
    bstRow.appendChild(h('span', { className: 'pbs-stat-label', textContent: 'BST' }));
    const bstBarBg = h('div', { className: 'pbs-stat-bar-bg' });
    _bstFill = h('div', { className: 'pbs-stat-bar-fill', style: { width: Math.min(100, bst / 7.2) + '%', background: '#7c8aff' } });
    bstBarBg.appendChild(_bstFill);
    bstRow.appendChild(bstBarBg);
    _bstVal = h('span', { className: 'pbs-stat-value', textContent: String(bst) });
    bstRow.appendChild(_bstVal);
    container.appendChild(bstRow);
  }
  function emitChange() { onChange(values.join(',')); }
  render();
  return container;
}

// ---- EVs editor ----
const EV_STAT_MAP = [
  { key: 'HP', display: 'HP' },
  { key: 'ATTACK', display: 'Atk' },
  { key: 'DEFENSE', display: 'Def' },
  { key: 'SPEED', display: 'Spe' },
  { key: 'SPECIAL_ATTACK', display: 'SpAtk' },
  { key: 'SPECIAL_DEFENSE', display: 'SpDef' },
];
export function createEvsEditor(value, onChange) {
  const container = h('div', { className: 'pbs-list-editor' });
  const pairs = [];
  const parts = (value || '').split(',');
  for (let i = 0; i < parts.length; i += 2) {
    const stat = (parts[i] || '').trim();
    const val = parseInt((parts[i + 1] || '').trim()) || 0;
    if (stat) pairs.push({ stat, val });
  }

  function emitChange() {
    onChange(pairs.map(p => `${p.stat},${p.val}`).join(','));
  }

  function render() {
    container.innerHTML = '';
    for (let i = 0; i < pairs.length; i++) {
      const row = h('div', { className: 'pbs-list-row' });
      const statInput = h('select', { style: { flex: '1' } });
      for (const s of EV_STAT_MAP) {
        statInput.appendChild(h('option', { value: s.key, textContent: s.display, selected: s.key === pairs[i].stat }));
      }
      if (!EV_STAT_MAP.some(s => s.key === pairs[i].stat)) {
        statInput.appendChild(h('option', { value: pairs[i].stat, textContent: pairs[i].stat, selected: true }));
      }
      const ii = i;
      statInput.addEventListener('change', () => { pairs[ii].stat = statInput.value; emitChange(); });
      row.appendChild(statInput);

      const numInput = h('input', { type: 'number', value: pairs[i].val, min: 0, max: 255, style: { width: '55px' } });
      numInput.addEventListener('input', () => { pairs[ii].val = parseInt(numInput.value) || 0; emitChange(); });
      row.appendChild(numInput);

      row.appendChild(h('button', { className: 'pbs-list-remove', textContent: '×', onClick: () => { pairs.splice(i, 1); render(); emitChange(); } }));
      container.appendChild(row);
    }
    container.appendChild(h('button', { className: 'pbs-list-add', textContent: _t('+ Add EV'), onClick: () => { pairs.push({ stat: 'HP', val: 0 }); render(); emitChange(); } }));
  }
  render();
  return container;
}

// ---- BGM editor ----
function createBgmEditor(value, onChange, ctx) {
  const row = h('div', { className: 'pbs-list-row' });
  const input = h('input', { type: 'text', value: String(value || ''), placeholder: 'Audio/BGM/filename', style: { flex: '1' } });
  input.addEventListener('input', () => onChange(input.value));
  row.appendChild(input);

  if (ctx?.selectors?.pickAudio) {
    const browseBtn = h('button', { className: 'pbs-btn', textContent: _t('Browse'), onClick: async () => {
      try {
        const result = await ctx.selectors.pickAudio('BGM');
        if (result) {
          const val = typeof result === 'string' ? result : (result.path || result.name || String(result));
          input.value = val;
          onChange(val);
        }
      } catch {}
    } });
    row.appendChild(browseBtn);
  }
  return row;
}
