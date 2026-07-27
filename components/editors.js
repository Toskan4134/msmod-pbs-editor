import { h, _t, createRefInput, goToBtn } from './dom.js';
import { createListEditor, createEvsEditor } from './field-editor.js';

// ---- Encounter sub-section editor ----
const ENCOUNTER_TYPES = ['Land', 'LandDay', 'LandNight', 'LandMorning', 'Cave', 'Water', 'None'];

export function createEncounterEditor(entry, onChange, onRebuild, refData, onNavigate) {
  const container = h('div', {});
  const pokemonSuggestions = refData?.pokemon?.map(e => e.InternalName || e.Name || '').filter(Boolean) || [];

  function buildEncounter(ei, enc) {
    const sub = h('div', { className: 'pbs-subsection' });

    // Header with type dropdown, density, and delete
    const header = h('div', { className: 'pbs-subsection-header' });
    const typeSelect = h('select', { style: { fontSize: '11px', background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '3px', padding: '1px 4px' } });
    for (const t of ENCOUNTER_TYPES) {
      typeSelect.appendChild(h('option', { value: t, textContent: t, selected: t === enc.type }));
    }
    typeSelect.addEventListener('change', () => { enc.type = typeSelect.value; onChange(); });
    header.appendChild(typeSelect);

    header.appendChild(h('span', { textContent: _t('Density:'), style: { fontSize: '10px', color: 'var(--text-tertiary)', marginLeft: '6px' } }));
    const densityInp = h('input', { type: 'number', value: enc.density || '20', min: 1, max: 999, style: { width: '40px', fontSize: '11px', padding: '1px 4px', background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '3px' } });
    densityInp.addEventListener('input', () => { enc.density = densityInp.value; onChange(); });
    header.appendChild(densityInp);

    header.appendChild(h('div', { style: { flex: '1' } }));
    header.appendChild(h('button', { className: 'pbs-list-remove', textContent: '×', onClick: () => { entry._encounters.splice(ei, 1); onChange(); onRebuild(); } }));
    sub.appendChild(header);

    const body = h('div', { className: 'pbs-subsection-body' });

    // Column header: Prob, Pokemon, Min Lv, Max Lv
    const colHeader = h('div', { className: 'pbs-list-row', style: { fontWeight: '600', fontSize: '10px', color: 'var(--text-tertiary)' } });
    colHeader.appendChild(h('span', { style: { width: '30px', flexShrink: '0' }, textContent: '#' }));
    colHeader.appendChild(h('span', { style: { width: '45px' }, textContent: 'Prob' }));
    colHeader.appendChild(h('span', { style: { flex: '1' }, textContent: _t('Pokemon') }));
    colHeader.appendChild(h('span', { style: { width: '45px' }, textContent: _t('Min Lv') }));
    colHeader.appendChild(h('span', { style: { width: '45px' }, textContent: _t('Max Lv') }));
    colHeader.appendChild(h('span', { style: { width: '20px' } }));
    body.appendChild(colHeader);

    function buildPokemonRows() {
      while (body.children.length > 1) body.removeChild(body.lastChild);

      for (let pi = 0; pi < enc.pokemons.length; pi++) {
        const rawParts = (enc.pokemons[pi] || '').split(',');
        // Format: PROBABILITY,SPECIES,MIN_LV,MAX_LV
        const prob = (rawParts[0] || '').trim();
        const species = (rawParts[1] || '').trim();
        const minLv = (rawParts[2] || '').trim();
        const maxLv = (rawParts[3] || '').trim();

        const row = h('div', { className: 'pbs-list-row' });
        row.appendChild(h('span', { style: { width: '30px', flexShrink: '0', fontSize: '10px', color: 'var(--text-tertiary)' }, textContent: String(pi + 1) }));

        // Probability
        const probInp = h('input', { type: 'number', value: prob, min: 0, max: 100, placeholder: '%', style: { width: '35px', fontFamily: 'inherit', fontSize: '12px', padding: '3px 6px' } });
        probInp.addEventListener('input', () => { rawParts[0] = probInp.value; enc.pokemons[pi] = rawParts.join(','); onChange(); });
        row.appendChild(probInp);

        // Species with reference autocomplete
        const speciesRef = createRefInput(species, pokemonSuggestions, (v) => {
          rawParts[1] = v;
          enc.pokemons[pi] = rawParts.join(',');
          onChange();
        });
        speciesRef.el.style.flex = '2';
        speciesRef.el.style.minWidth = '80px';
        row.appendChild(speciesRef.el);
        const speciesBtn = goToBtn('pokemon', () => species, onNavigate);
        if (speciesBtn) row.appendChild(speciesBtn);

        // Min level
        const minInp = h('input', { type: 'number', value: minLv, min: 1, max: 100, placeholder: 'Min', style: { width: '35px', fontFamily: 'inherit', fontSize: '12px', padding: '3px 6px' } });
        minInp.addEventListener('input', () => { rawParts[2] = minInp.value; enc.pokemons[pi] = rawParts.join(','); onChange(); });
        row.appendChild(minInp);

        // Max level
        const maxInp = h('input', { type: 'number', value: maxLv, min: 1, max: 100, placeholder: 'Max', style: { width: '35px', fontFamily: 'inherit', fontSize: '12px', padding: '3px 6px' } });
        maxInp.addEventListener('input', () => { rawParts[3] = maxInp.value; enc.pokemons[pi] = rawParts.join(','); onChange(); });
        row.appendChild(maxInp);

        row.appendChild(h('button', { className: 'pbs-list-remove', textContent: '×', onClick: () => { enc.pokemons.splice(pi, 1); onChange(); buildPokemonRows(); } }));
        body.appendChild(row);
      }

      body.appendChild(h('button', { className: 'pbs-list-add', textContent: _t('+ Add Pokemon'), onClick: () => {
        enc.pokemons.push('20,SPECIES,5,5');
        onChange();
        buildPokemonRows();
      } }));
    }

    buildPokemonRows();
    sub.appendChild(body);
    return sub;
  }

  function renderAll() {
    container.innerHTML = '';
    for (let ei = 0; ei < (entry._encounters || []).length; ei++) {
      container.appendChild(buildEncounter(ei, entry._encounters[ei]));
    }
    container.appendChild(h('button', { className: 'pbs-list-add', textContent: _t('+ Add Encounter Type'), style: { marginTop: '4px' }, onClick: () => {
      entry._encounters.push({ type: 'Land', density: '20', pokemons: [] });
      onChange();
      renderAll();
    } }));
  }
  renderAll();
  return container;
}

// ---- Trainer pokemon editor ----
export function createTrainerPokemonEditor(entry, onChange, onRebuild, refData, ctx, onNavigate) {
  const container = h('div', {});
  const pokemonSuggestions = refData?.pokemon?.map(e => e.InternalName || e.Name || '').filter(Boolean) || [];
  const moveSuggestions = refData?.moves?.map(e => e.InternalName || e.Name || '').filter(Boolean) || [];
  const itemSuggestions = refData?.items?.map(e => e.InternalName || e.Name || '').filter(Boolean) || [];

  function renderAll() {
    container.innerHTML = '';
    for (let pi = 0; pi < (entry._pokemon || []).length; pi++) {
      const p = entry._pokemon[pi];
      const sub = h('div', { className: 'pbs-subsection' });
      const header = h('div', { className: 'pbs-subsection-header' });
      header.appendChild(h('span', { textContent: _t('Pokemon {n}', { n: pi + 1 }) }));
      header.appendChild(h('button', { className: 'pbs-list-remove', textContent: '×', onClick: () => { entry._pokemon.splice(pi, 1); onRebuild(); } }));
      sub.appendChild(header);
      const body = h('div', { className: 'pbs-subsection-body', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' } });

      // Parse Pokemon field: SPECIES,LEVEL
      const pokeParts = (p.Pokemon || '').split(',');
      const species = (pokeParts[0] || '').trim();
      const level = (pokeParts[1] || '').trim();

      // Species
      const speciesField = h('div', { className: 'pbs-field' });
      speciesField.appendChild(h('label', { textContent: _t('Species') }));
      const speciesRow = h('div', { style: { display: 'flex', gap: '2px', alignItems: 'center' } });
      const speciesRef = createRefInput(species, pokemonSuggestions, (v) => {
        pokeParts[0] = v;
        p.Pokemon = pokeParts.filter(Boolean).join(',');
        onChange();
      });
      speciesRef.el.style.flex = '1';
      speciesRef.el.style.minWidth = '0';
      speciesRow.appendChild(speciesRef.el);
      const speciesBtn = goToBtn('pokemon', () => species, onNavigate);
      if (speciesBtn) speciesRow.appendChild(speciesBtn);
      speciesField.appendChild(speciesRow);
      body.appendChild(speciesField);

      // Level
      const levelField = h('div', { className: 'pbs-field' });
      levelField.appendChild(h('label', { textContent: _t('Level') }));
      const levelInp = h('input', { type: 'number', value: level, min: 1, max: 100, placeholder: 'Level' });
      levelInp.addEventListener('input', () => {
        pokeParts[1] = levelInp.value;
        p.Pokemon = pokeParts.filter(Boolean).join(',');
        onChange();
      });
      levelField.appendChild(levelInp);
      body.appendChild(levelField);

      // Item (referenced)
      const itemField = h('div', { className: 'pbs-field' });
      itemField.appendChild(h('label', { textContent: _t('Item') }));
      const itemRow = h('div', { style: { display: 'flex', gap: '2px', alignItems: 'center' } });
      const itemRef = createRefInput(p.Item || '', itemSuggestions, (v) => { p.Item = v; onChange(); });
      itemRef.el.style.flex = '1';
      itemRef.el.style.minWidth = '0';
      itemRow.appendChild(itemRef.el);
      const itemBtn = goToBtn('items', () => p.Item || '', onNavigate);
      if (itemBtn) itemRow.appendChild(itemBtn);
      itemField.appendChild(itemRow);
      body.appendChild(itemField);

      // AbilityIndex
      const abilityField = h('div', { className: 'pbs-field' });
      abilityField.appendChild(h('label', { textContent: _t('Ability Index') }));
      const abilityInp = h('input', { type: 'number', value: p.AbilityIndex || '', min: 0, placeholder: '0' });
      abilityInp.addEventListener('input', () => { p.AbilityIndex = abilityInp.value; onChange(); });
      abilityField.appendChild(abilityInp);
      body.appendChild(abilityField);

      // Moves (list with move references)
      const movesField = h('div', { className: 'pbs-field', style: { gridColumn: '1 / -1' } });
      movesField.appendChild(h('label', { textContent: _t('Moves') }));
      const movesItems = (p.Moves || '').split(',').filter(Boolean);
      const movesEditor = createListEditor(movesItems, (v) => { p.Moves = v; onChange(); }, moveSuggestions, onNavigate, 'moves');
      movesField.appendChild(movesEditor);
      body.appendChild(movesField);

      // Nature
      const natureField = h('div', { className: 'pbs-field' });
      natureField.appendChild(h('label', { textContent: _t('Nature') }));
      const natureInp = h('input', { type: 'text', value: p.Nature || '', placeholder: 'Nature' });
      natureInp.addEventListener('input', () => { p.Nature = natureInp.value; onChange(); });
      natureField.appendChild(natureInp);
      body.appendChild(natureField);

      // Gender
      const genderField = h('div', { className: 'pbs-field' });
      genderField.appendChild(h('label', { textContent: _t('Gender') }));
      const genderInp = h('input', { type: 'text', value: p.Gender || '', placeholder: 'M/F' });
      genderInp.addEventListener('input', () => { p.Gender = genderInp.value; onChange(); });
      genderField.appendChild(genderInp);
      body.appendChild(genderField);

      // Form
      const formField = h('div', { className: 'pbs-field' });
      formField.appendChild(h('label', { textContent: _t('Form') }));
      const formInp = h('input', { type: 'number', value: p.Form || '', min: 0, placeholder: '0' });
      formInp.addEventListener('input', () => { p.Form = formInp.value; onChange(); });
      formField.appendChild(formInp);
      body.appendChild(formField);

      // Shiny
      const shinyField = h('div', { className: 'pbs-field' });
      shinyField.appendChild(h('label', { textContent: _t('Shiny') }));
      const shinyRow = h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } });
      const shinyCb = h('input', { type: 'checkbox', checked: p.Shiny === 'true' || p.Shiny === true });
      const shinyLbl = h('span', { textContent: p.Shiny === 'true' ? _t('Yes') : _t('No'), style: { fontSize: '11px', color: 'var(--text-secondary)' } });
      shinyCb.addEventListener('change', () => { p.Shiny = shinyCb.checked ? 'true' : 'false'; shinyLbl.textContent = shinyCb.checked ? _t('Yes') : _t('No'); onChange(); });
      shinyRow.appendChild(shinyCb);
      shinyRow.appendChild(shinyLbl);
      shinyField.appendChild(shinyRow);
      body.appendChild(shinyField);

      // IV (full width, structured like EVs)
      const ivField = h('div', { className: 'pbs-field', style: { gridColumn: '1 / -1' } });
      ivField.appendChild(h('label', { textContent: _t('IVs') }));
      const ivEditor = createEvsEditor(p.IV || '', (v) => { p.IV = v; onChange(); });
      ivField.appendChild(ivEditor);
      body.appendChild(ivField);

      // EV (full width)
      const evField = h('div', { className: 'pbs-field', style: { gridColumn: '1 / -1' } });
      evField.appendChild(h('label', { textContent: _t('EVs') }));
      const evEditor = createEvsEditor(p.EV || '', (v) => { p.EV = v; onChange(); });
      evField.appendChild(evEditor);
      body.appendChild(evField);

      sub.appendChild(body);
      container.appendChild(sub);
    }
    container.appendChild(h('button', { className: 'pbs-list-add', textContent: _t('+ Add Pokemon'), style: { marginTop: '4px' }, onClick: () => { entry._pokemon.push({ Pokemon: '' }); onRebuild(); } }));
  }
  renderAll();
  return container;
}
