/**
 * PBS file parsers — supports v16, v17, and v21 formats.
 * Pure functions: text content → structured data.
 */

// ---------------------------------------------------------------------------
// Section parser (v21, and v16/v17 pokemon/types/town_map)
// ---------------------------------------------------------------------------

function parseSections(raw) {
  const blocks = raw.split(/\r?\n(?=#-+\r?\n|\[)/);
  const results = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    let header = null;
    let excluded = false;

    for (const line of lines) {
      const m = line.trim().match(/^\[(.+?)\](!exclude)?$/i);
      if (m) { header = m[1]; excluded = !!m[2]; break; }
    }
    if (header === null) continue;

    const data = {};
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('#') || t.startsWith('[') || t === '') continue;
      const idx = t.indexOf('=');
      if (idx === -1) continue;
      const key = t.slice(0, idx).trim();
      const val = t.slice(idx + 1).trim();
      // Repeatable keys (schema "^", e.g. `Evolution`) appear on several lines;
      // flatten them the same way their "*" counterpart is written on one line.
      if (key === 'Evolution') {
        // An evolution entry is a triplet (Species,Method,Param). Methods with no
        // parameter (e.g. `Trade`) are written as only 2 values. Padding the
        // missing slot keeps triplet alignment when several `Evolution =` lines
        // are flattened into one comma-joined string.
        let value = val;
        if (value.split(',').length === 2) value += ',';
        data[key] = data[key] ? `${data[key]},${value}` : value;
      } else {
        data[key] = data[key] ? `${data[key]},${val}` : val;
      }
    }

    results.push({ header, data, excluded });
  }
  return results;
}

// Keys the entry model doesn't know about (Generation, Shape, Flags, WildItem*,
// plugin-added keys...). Kept verbatim so writing back never deletes them.
function extraKeys(data, entry) {
  const extra = {};
  for (const k in data) {
    if (!(k in entry)) extra[k] = data[k];
  }
  return extra;
}

// ---------------------------------------------------------------------------
// Filename map per version
// ---------------------------------------------------------------------------

export const FILE_MAP = {
  pokemon:        { 16: 'pokemon.txt', 17: 'pokemon.txt', 21: 'pokemon.txt' },
  pokemon_forms:  { 17: 'pokemonforms.txt', 21: 'pokemon_forms.txt' },
  moves:          { 16: 'moves.txt', 17: 'moves.txt', 21: 'moves.txt' },
  abilities:      { 16: 'abilities.txt', 17: 'abilities.txt', 21: 'abilities.txt' },
  items:          { 16: 'items.txt', 17: 'items.txt', 21: 'items.txt' },
  types:          { 16: 'types.txt', 17: 'types.txt', 21: 'types.txt' },
  encounters:     { 16: 'encounters.txt', 17: 'encounters.txt', 21: 'encounters.txt' },
  trainers:       { 16: 'trainers.txt', 17: 'trainers.txt', 21: 'trainers.txt' },
  trainer_types:  { 16: 'trainertypes.txt', 17: 'trainertypes.txt', 21: 'trainer_types.txt' },
  town_map:       { 16: 'townmap.txt', 17: 'townmap.txt', 21: 'town_map.txt' },
  tm:             { 16: 'tm.txt', 17: 'tm.txt' },
};

// Base filenames Essentials compiles but this editor doesn't edit. Listed so a
// file like `pokemon_metrics.txt` is claimed by its own base instead of being
// mistaken for an extra `pokemon` file.
const RESERVED_BASES = [
  'pokemon_metrics', 'shadow_pokemon', 'berry_plants', 'ribbons',
  'metadata', 'map_metadata', 'map_connections', 'regional_dexes',
  'battle_facility_lists', 'dungeon_tilesets', 'dungeon_parameters', 'phone',
];

// Essentials compiles every PBS file named `<base>.txt` or `<base>_*.txt`, so
// packs can add entries in their own file without overwriting the base one
// (Compiler#get_all_pbs_files_to_compile). Longest base name wins the match.
// Returns the file type a PBS filename belongs to, or null if none.
export function matchFileType(filename, version) {
  const name = filename.replace(/\.txt$/i, '');
  const bases = Object.entries(FILE_MAP)
    .filter(([, v]) => v[version])
    .map(([ft, v]) => [v[version].replace(/\.txt$/i, ''), ft])
    .concat(RESERVED_BASES.map(b => [b, null]))
    .sort((a, b) => b[0].length - a[0].length);
  for (const [base, ft] of bases) {
    if (name === base || name.startsWith(base + '_')) return ft;
  }
  return null;
}

export function getFilename(fileType, version) {
  return FILE_MAP[fileType]?.[version] || null;
}

export function getAvailableFileTypes(version) {
  return Object.entries(FILE_MAP)
    .filter(([, v]) => v[version])
    .map(([type]) => type);
}

// ---------------------------------------------------------------------------
// CSV helpers (v16/v17)
// ---------------------------------------------------------------------------

function splitCsvRespectingQuotes(line) {
  return line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(p => p.trim());
}

// ---------------------------------------------------------------------------
// Parsers per file type and version
// ---------------------------------------------------------------------------

// ---- Pokemon ----------------------------------------------------------------

function parsePokemonV21(raw) {
  const hasSep = /^#-+/m.test(raw);
  return parseSections(raw).map((s, i) => {
    const d = s.data;
    if (!d.Name) return null;
    // `Evolution` (singular) is the same data as `Evolutions`; fold it in so it
    // shows up in the editor instead of being written back out twice.
    const evolutions = d.Evolutions || d.Evolution || '';
    const evoFormat = d.Evolution !== undefined ? 'multi' : (d.Evolutions !== undefined ? 'single' : null);
    // Original key order (with singular Evolution normalized) so the writer can
    // reproduce the file's layout instead of a fixed schema order.
    const order = Object.keys(d).map(k => k === 'Evolution' ? 'Evolutions' : k);
    delete d.Evolution;
    const entry = {
      _id: i + 1, _header: s.header, _excluded: s.excluded, _evoFormat: evoFormat,
      _order: order, _sep: hasSep,
      Name: d.Name, InternalName: s.header,
      Types: d.Types || '', BaseStats: d.BaseStats || '',
      HP: '', Atk: '', Def: '', Spe: '', SpAtk: '', SpDef: '',
      GenderRatio: d.GenderRatio || '', GrowthRate: d.GrowthRate || '',
      BaseExp: d.BaseExp || '', EVs: d.EVs || '',
      CatchRate: d.CatchRate || '', Happiness: d.Happiness || '',
      Abilities: d.Abilities || '', HiddenAbilities: d.HiddenAbilities || '',
      Moves: d.Moves || '', TutorMoves: d.TutorMoves || '',
      EggMoves: d.EggMoves || '', EggGroups: d.EggGroups || '',
      Evolutions: evolutions,
      HatchSteps: d.HatchSteps || '', Height: d.Height || '', Weight: d.Weight || '',
      Color: d.Color || '', Category: d.Category || '',
      Habitat: d.Habitat || '', Pokedex: d.Pokedex || '',
      BattlerPlayerY: d.BattlerPlayerY || '', BattlerEnemyY: d.BattlerEnemyY || '',
      BattlerAltitude: d.BattlerAltitude || '',
    };
    entry._extra = extraKeys(d, entry);
    return entry;
  }).filter(Boolean);
}

function parsePokemonV16(raw) {
  const blocks = raw.split(/\r?\n(?=\[\d+\])/);
  return blocks.map(block => {
    const lines = block.split(/\r?\n/);
    const m = lines[0].trim().match(/^\[(\d+)\](!exclude)?/i);
    if (!m) return null;
    const data = { _id: parseInt(m[1]), _excluded: !!m[2] };
    for (const line of lines.slice(1)) {
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      data[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    if (!data.InternalName) return null;
    data._header = data.InternalName;
    // Normalize field names
    data.Types = [data.Type1, data.Type2].filter(Boolean).join(',');
    data.BaseExp = data.BaseEXP || data.BaseExp || '';
    data.CatchRate = data.Rareness || '';
    data.Category = data.Kind || '';
    data.HiddenAbilities = data.HiddenAbility || '';
    data.EggGroups = data.Compatibility || '';
    data.HatchSteps = data.StepsToHatch || '';
    data.EVs = data.EffortPoints || '';
    data.TutorMoves = '';
    return data;
  }).filter(Boolean);
}

// ---- Pokemon Forms -----------------------------------------------------------

function parsePokemonFormsV21(raw) {
  const hasSep = /^#-+/m.test(raw);
  return parseSections(raw).map((s, i) => {
    const parts = s.header.split(',');
    if (parts.length < 2) return null;
    const d = s.data;
    const evolutions = d.Evolutions || d.Evolution || '';
    const evoFormat = d.Evolution !== undefined ? 'multi' : (d.Evolutions !== undefined ? 'single' : null);
    const order = Object.keys(d).map(k => k === 'Evolution' ? 'Evolutions' : k);
    delete d.Evolution;
    const entry = {
      _id: i + 1, _header: s.header, _excluded: s.excluded, _evoFormat: evoFormat,
      _order: order, _sep: hasSep,
      InternalName: parts[0], FormIndex: parts[1],
      FormName: d.FormName || '', Name: d.Name || parts[0],
      Types: d.Types || '', BaseStats: d.BaseStats || '',
      Abilities: d.Abilities || '', HiddenAbilities: d.HiddenAbilities || '',
      Moves: d.Moves || '', TutorMoves: d.TutorMoves || '',
      EggMoves: d.EggMoves || '', Evolutions: evolutions,
      Height: d.Height || '', Weight: d.Weight || '',
      Color: d.Color || '', Pokedex: d.Pokedex || '',
      MegaStone: d.MegaStone || '', Region: d.Region || '',
    };
    entry._extra = extraKeys(d, entry);
    return entry;
  }).filter(Boolean);
}

function parsePokemonFormsV17(raw) {
  const blocks = raw.split(/#+---+/).filter(b => b.trim());
  return blocks.map(block => {
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    if (!lines.length) return null;
    const m = lines[0].match(/^\[([A-Z0-9_]+)-(\d+)\](!exclude)?$/i);
    if (!m) return null;
    const data = { _id: 0, _header: `${m[1]}-${m[2]}`, _excluded: !!m[3], InternalName: m[1], FormIndex: m[2] };
    for (const line of lines.slice(1)) {
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      data[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    data.FormName = data.FormName || `Form ${data.FormIndex}`;
    return data;
  }).filter(Boolean);
}

// ---- Moves ------------------------------------------------------------------

function parseMovesV21(raw) {
  return parseSections(raw).map((s, i) => {
    const d = s.data;
    if (!d.Name) return null;
    return {
      _id: i + 1, _header: s.header, _excluded: s.excluded,
      InternalName: s.header, Name: d.Name,
      FunctionCode: d.FunctionCode || '', Power: d.Power || '',
      Type: d.Type || '', Category: d.Category || '',
      Accuracy: d.Accuracy || '', TotalPP: d.TotalPP || '',
      EffectChance: d.EffectChance || '', Priority: d.Priority || '',
      Target: d.Target || '', Flags: d.Flags || '',
      Description: d.Description || '',
    };
  }).filter(Boolean);
}

function parseMovesV16(raw) {
  return raw.split(/\r?\n/).filter(Boolean).map(line => {
    const t = line.trim();
    const excluded = /^\d+!exclude,/i.test(t);
    const clean = excluded ? t.replace(/^(\d+)!exclude,/i, '$1,') : t;
    const p = clean.match(/^(\d+),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),"(.*)"/);
    if (!p) return null;
    return {
      _id: parseInt(p[1]), _header: p[2], _excluded: excluded,
      InternalName: p[2], Name: p[3],
      FunctionCode: p[4], Power: p[5], Type: p[6], Category: p[7],
      Accuracy: p[8], TotalPP: p[9], EffectChance: p[10],
      Priority: p[11], Target: p[12], Flags: p[13],
      Description: p[14],
    };
  }).filter(Boolean);
}

// ---- Abilities ---------------------------------------------------------------

function parseAbilitiesV21(raw) {
  return parseSections(raw).map((s, i) => {
    const d = s.data;
    if (!d.Name) return null;
    return {
      _id: i + 1, _header: s.header, _excluded: s.excluded,
      InternalName: s.header, Name: d.Name, Description: d.Description || '',
    };
  }).filter(Boolean);
}

function parseAbilitiesV16(raw) {
  return raw.split(/\r?\n/).map(line => line.trim()).filter(l => l && !l.startsWith('#')).map(line => {
    const clean = line.replace(/#.*$/, '');
    const parts = splitCsvRespectingQuotes(clean);
    if (parts.length < 4) return null;
    const rawId = parts[0];
    const excluded = /!exclude$/i.test(rawId);
    return {
      _id: parseInt(rawId.replace(/!exclude$/i, '')),
      _header: parts[1], _excluded: excluded,
      InternalName: parts[1], Name: parts[2],
      Description: parts[3].replace(/^"|"$/g, ''),
    };
  }).filter(Boolean);
}

// ---- Items -------------------------------------------------------------------

function parseItemsV21(raw) {
  return parseSections(raw).map((s, i) => {
    const d = s.data;
    if (!d.Name) return null;
    return {
      _id: i + 1, _header: s.header, _excluded: s.excluded,
      InternalName: s.header, Name: d.Name,
      NamePlural: d.NamePlural || '', Pocket: d.Pocket || '',
      Price: d.Price || '', SellPrice: d.SellPrice || '',
      BPPrice: d.BPPrice || '', Description: d.Description || '',
      FieldUse: d.FieldUse || '', BattleUse: d.BattleUse || '',
      Flags: d.Flags || '', Consumable: d.Consumable || '',
      ShowQuantity: d.ShowQuantity || '', Move: d.Move || '',
    };
  }).filter(Boolean);
}

function parseItemsV16(raw) {
  return raw.split(/\r?\n/).filter(l => l.trim()).map(line => {
    const parts = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
    if (!parts || parts.length < 10) return null;
    const rawId = parts[0];
    const excluded = /!exclude$/i.test(rawId.trim());
    return {
      _id: parseInt(rawId.replace(/!exclude$/i, '').trim()),
      _header: parts[1].trim(), _excluded: excluded,
      InternalName: parts[1].trim(), Name: parts[2].trim(),
      NamePlural: parts[3].trim(), Pocket: parts[4].trim(),
      Price: parts[5].trim(),
      Description: parts[6].replace(/^"|"$/g, '').trim(),
      FieldUse: parts[7].trim(), BattleUse: parts[8].trim(),
      Flags: parts[9].trim(), Move: (parts[10] || '').trim(),
    };
  }).filter(Boolean);
}

// ---- Types -------------------------------------------------------------------

function parseTypesV21(raw) {
  return parseSections(raw).map((s) => {
    const d = s.data;
    return {
      _id: s.header, _header: s.header, _excluded: s.excluded,
      InternalName: s.header, Name: d.Name || s.header,
      IconPosition: d.IconPosition || '', IsPseudoType: d.IsPseudoType || '',
      IsSpecialType: d.IsSpecialType || '',
      Weaknesses: d.Weaknesses || '', Resistances: d.Resistances || '',
      Immunities: d.Immunities || '',
    };
  });
}

function parseTypesV16(raw) {
  const blocks = raw.split(/\r?\n(?=\[\d+\])/);
  return blocks.map(block => {
    const lines = block.split(/\r?\n/);
    const m = lines[0].trim().match(/^\[(\d+)\](!exclude)?/i);
    if (!m) return null;
    const data = {};
    for (const line of lines.slice(1)) {
      if (line.trim().startsWith('#') || !line.trim()) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      data[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    if (!data.InternalName) return null;
    return {
      _id: parseInt(m[1]), _header: data.InternalName, _excluded: !!m[2],
      InternalName: data.InternalName, Name: data.Name || data.InternalName,
      IconPosition: data.IconPosition || '',
      IsPseudoType: data.IsPseudoType || '', IsSpecialType: data.IsSpecialType || '',
      Weaknesses: data.Weaknesses || '', Resistances: data.Resistances || '',
      Immunities: data.Immunities || '',
    };
  }).filter(Boolean);
}

// ---- Encounters --------------------------------------------------------------

function parseEncountersV21(raw) {
  const lines = raw.split(/\r?\n/);
  const results = [];
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    const hm = t.match(/^\[(\d+)\](!exclude)?\s*#\s*(.+)$/i);
    if (!hm) { i++; continue; }
    const entry = {
      _id: parseInt(hm[1]), _header: hm[1], _excluded: !!hm[2],
      Name: hm[3].trim(), _encounters: [],
    };
    i++;
    while (i < lines.length) {
      const cur = lines[i];
      const ct = cur.trim();
      if (ct.match(/^\[\d+\]/) || ct.startsWith('#=')) break;
      if (ct === '' || ct.startsWith('#')) { i++; continue; }
      if (!cur.startsWith(' ') && !cur.startsWith('\t')) {
        const typeParts = ct.split(',');
        const encType = typeParts[0].trim();
        const density = typeParts[1]?.trim() || '';
        const pokemons = [];
        i++;
        while (i < lines.length) {
          const pl = lines[i];
          const pt = pl.trim();
          if ((!pl.startsWith(' ') && !pl.startsWith('\t')) || pt === '' || pt.startsWith('#')) break;
          pokemons.push(pt);
          i++;
        }
        entry._encounters.push({ type: encType, density, pokemons });
      } else { i++; }
    }
    results.push(entry);
  }
  return results;
}

function parseEncountersV16(raw) {
  const blocks = raw.split(/^#{5,}.*$/m).map(b => b.trim()).filter(Boolean);
  return blocks.map(block => {
    const lines = block.split(/\r?\n/).filter(l => l.trim());
    const hm = lines[0].match(/^(\d+)(!exclude)?\s*#\s*(.+)$/i);
    if (!hm) return null;
    const entry = {
      _id: parseInt(hm[1]), _header: hm[1], _excluded: !!hm[2],
      Name: hm[3].trim(), _encounters: [], _densities: '',
    };
    let idx = 1;
    if (/^\d+,\d+,\d+$/.test(lines[idx]?.trim())) {
      entry._densities = lines[idx].trim();
      idx++;
    }
    while (idx < lines.length) {
      const type = lines[idx++].trim();
      if (!type || type.startsWith('#')) continue;
      const pokemons = [];
      while (idx < lines.length && lines[idx].includes(',')) {
        const pt = lines[idx].trim();
        if (pt.startsWith('#')) { idx++; continue; }
        // Must be a pokemon line: species,level[,level]
        if (/^[A-Z]/i.test(pt)) { pokemons.push(pt); }
        else break;
        idx++;
      }
      entry._encounters.push({ type, pokemons });
    }
    return entry;
  }).filter(Boolean);
}

// ---- Trainers ----------------------------------------------------------------

function parseTrainersV21(raw) {
  const lines = raw.split(/\r?\n/);
  const results = [];
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    const hm = t.match(/^\[([^\]]+)\](!exclude)?$/i);
    if (!hm) { i++; continue; }
    const parts = hm[1].split(',');
    const entry = {
      _id: results.length + 1, _header: hm[1], _excluded: !!hm[2],
      TrainerType: parts[0]?.trim() || '', Name: parts[1]?.trim() || '',
      Version: parts[2]?.trim() || '',
      LoseText: '', Items: '', _pokemon: [],
    };
    i++;
    let currentPoke = null;
    let pokeProps = null;
    while (i < lines.length) {
      const cur = lines[i];
      const ct = cur.trim();
      if (ct.match(/^\[.+\]$/) || ct.match(/^#-+$/)) break;
      if (ct === '' || (ct.startsWith('#') && !ct.match(/^#-/))) { i++; continue; }
      const eqIdx = ct.indexOf('=');
      if (eqIdx === -1) { i++; continue; }
      const key = ct.slice(0, eqIdx).trim();
      const val = ct.slice(eqIdx + 1).trim();
      const indented = cur.startsWith(' ') || cur.startsWith('\t');
      if (indented && currentPoke) {
        pokeProps[key] = val;
      } else {
        if (key === 'LoseText') entry.LoseText = val;
        else if (key === 'Items') entry.Items = val;
        else if (key === 'Pokemon') {
          currentPoke = val;
          pokeProps = { Pokemon: val };
          entry._pokemon.push(pokeProps);
        }
      }
      i++;
    }
    results.push(entry);
  }
  return results;
}

function parseTrainersV16(raw) {
  const blocks = raw.split(/#+---+/).filter(b => b.trim());
  return blocks.map(block => {
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 3) return null;
    const tl = lines[0];
    const excluded = /!exclude$/i.test(tl);
    const trainerType = tl.replace(/!exclude$/i, '').trim();
    const nameParts = lines[1].split(',');
    const pokemonCount = parseInt(lines[2].split(',')[0], 10);
    const items = lines[2].split(',').slice(1).filter(Boolean).join(',');
    const pokemon = [];
    for (let j = 3; j < lines.length && pokemon.length < pokemonCount; j++) {
      pokemon.push({ Pokemon: lines[j] });
    }
    return {
      _id: 0, _header: `${trainerType},${nameParts[0]}`, _excluded: excluded,
      TrainerType: trainerType, Name: nameParts[0],
      Version: nameParts[1] || '', LoseText: '', Items: items,
      _pokemon: pokemon,
    };
  }).filter(Boolean);
}

// ---- Trainer Types -----------------------------------------------------------

function parseTrainerTypesV21(raw) {
  return parseSections(raw).map((s) => {
    const d = s.data;
    return {
      _id: s.header, _header: s.header, _excluded: s.excluded,
      InternalName: s.header, Name: d.Name || s.header,
      BaseMoney: d.BaseMoney || '', Gender: d.Gender || '',
      SkillLevel: d.SkillLevel || '',
      BattleBGM: d.BattleBGM || '', VictoryBGM: d.VictoryBGM || '',
      IntroBGM: d.IntroBGM || '',
    };
  });
}

function parseTrainerTypesV16(raw) {
  return raw.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#')).map(line => {
    const p = line.split(',');
    if (p.length < 4) return null;
    const excluded = /!exclude$/i.test(p[0].trim());
    return {
      _id: parseInt(p[0].replace(/!exclude$/i, '').trim()),
      _header: p[1].trim(), _excluded: excluded,
      InternalName: p[1].trim(), Name: p[2].trim(),
      BaseMoney: p[3].trim(), Gender: p[7]?.trim() || '',
      SkillLevel: p[8]?.trim() || '',
      BattleBGM: p[4]?.trim() || '', VictoryBGM: p[5]?.trim() || '',
      IntroBGM: p[6]?.trim() || '',
    };
  }).filter(Boolean);
}

// ---- Town Map ----------------------------------------------------------------

function parseTownMap(raw) {
  const blocks = raw.split(/\r?\n(?=\[\d+\])/);
  return blocks.map(block => {
    const lines = block.split(/\r?\n/);
    const m = lines[0].trim().match(/^\[(\d+)\]$/);
    if (!m) return null;
    const data = { _id: parseInt(m[1]), _header: m[1] };
    for (const line of lines.slice(1)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const idx = t.indexOf('=');
      if (idx === -1) continue;
      data[t.slice(0, idx).trim()] = t.slice(idx + 1).trim();
    }
    if (!data.Name) data.Name = '';
    if (!data.Filename) data.Filename = '';
    return data;
  }).filter(Boolean);
}

// ---- TM (v16/v17 only) -------------------------------------------------------

function parseTm(raw) {
  const lines = raw.split(/\r?\n/);
  const results = [];
  let current = null;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('#') || t === '') continue;
    const mm = t.match(/^\[(.+?)\]$/);
    if (mm) {
      current = { _id: mm[1], _header: mm[1], Move: mm[1], Pokemon: '' };
      results.push(current);
      continue;
    }
    if (current) {
      current.Pokemon = current.Pokemon ? current.Pokemon + ',' + t : t;
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main dispatch
// ---------------------------------------------------------------------------

const PARSERS = {
  pokemon:        { 16: parsePokemonV16, 17: parsePokemonV16, 21: parsePokemonV21 },
  pokemon_forms:  { 17: parsePokemonFormsV17, 21: parsePokemonFormsV21 },
  moves:          { 16: parseMovesV16, 17: parseMovesV16, 21: parseMovesV21 },
  abilities:      { 16: parseAbilitiesV16, 17: parseAbilitiesV16, 21: parseAbilitiesV21 },
  items:          { 16: parseItemsV16, 17: parseItemsV16, 21: parseItemsV21 },
  types:          { 16: parseTypesV16, 17: parseTypesV16, 21: parseTypesV21 },
  encounters:     { 16: parseEncountersV16, 17: parseEncountersV16, 21: parseEncountersV21 },
  trainers:       { 16: parseTrainersV16, 17: parseTrainersV16, 21: parseTrainersV21 },
  trainer_types:  { 16: parseTrainerTypesV16, 17: parseTrainerTypesV16, 21: parseTrainerTypesV21 },
  town_map:       { 16: parseTownMap, 17: parseTownMap, 21: parseTownMap },
  tm:             { 16: parseTm, 17: parseTm },
};

export function parsePbsFile(content, fileType, version) {
  const parser = PARSERS[fileType]?.[version];
  if (!parser) return [];
  try {
    return parser(content);
  } catch (e) {
    console.error(`PBS parse error (${fileType} v${version}):`, e);
    return [];
  }
}
