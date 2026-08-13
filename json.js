/**
 * JSON PBS support (La Base de Sky, Compiler commit 71d6addb) — v21 only.
 *
 * Reading: the JSON is flattened into the same PBS text the v21 parsers
 * already model, so every file type keeps a single parse path (including
 * `_order` capture and unknown-key preservation).
 * Writing: the entry model is serialized straight to JSON. Multi-value CSV
 * fields become native arrays; the compiler flattens them back to the same
 * CSV tokens, so both directions are lossless data-wise.
 *
 * ponytail: stat sextets and Moves/Evolutions are written as positional flat
 * arrays instead of the named-object conveniences the compiler also accepts
 * (`{"HP":...}` / `{"level":...,"move":...}`). Same compiled data; upgrade to
 * the object form if hand-editing friendliness is ever requested.
 * ponytail: JSON has no `!exclude` syntax — excluded entries in a .json file
 * are written back as normal entries (the toggle only affects .txt files).
 */

import { parsePbsFile, splitCsvRespectingQuotes } from './parsers.js';

// GameData::Stat ids in PBS positional order (Speed is 4th on disk).
const STAT_KEYS = ['HP', 'ATTACK', 'DEFENSE', 'SPEED', 'SPECIAL_ATTACK', 'SPECIAL_DEFENSE'];

// ---------------------------------------------------------------------------
// JSON native value → CSV token (mirror of Compiler#json_value_to_csv_token)
// ---------------------------------------------------------------------------

function flat(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    if (value.length && value.every(r => r && typeof r === 'object' && !Array.isArray(r))) {
      // "*ie" Moves / "*ees" Evolutions given as named objects
      return value.flatMap(row => ('level' in row || 'move' in row)
        ? [row.level, row.move]
        : [row.species, row.method, row.parameter ?? '']).map(flat).join(',');
    }
    return value.map(flat).join(',');
  }
  if (typeof value === 'object') {
    // Stat sextet keyed by stat id → positional CSV
    return STAT_KEYS.map(k => flat(value[k])).join(',');
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// JSON → synthetic PBS text (fed to the v21 parsers)
// ---------------------------------------------------------------------------

function sectionsToTxt(data) {
  let out = '';
  for (const [header, fields] of Object.entries(data)) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) continue;
    out += `[${header}]\n`;
    for (const [k, v] of Object.entries(fields)) {
      if (v === null || v === undefined) continue;
      out += `${k} = ${flat(v)}\n`;
    }
    out += '\n';
  }
  return out;
}

function encountersToTxt(data) {
  let out = '';
  for (const [mapKey, types] of Object.entries(data)) {
    if (!types || typeof types !== 'object' || Array.isArray(types)) continue;
    const id = String(mapKey).split('_')[0];   // "MapID_Version" → MapID
    out += `[${id}] # map\n`;   // the JSON format carries no map name comment
    for (const [type, slots] of Object.entries(types)) {
      if (type.endsWith('_chance')) continue;   // consumed with its base type
      if (!Array.isArray(slots)) continue;
      const chance = types[`${type}_chance`];
      out += (chance === null || chance === undefined || chance === '') ? `${type}\n` : `${type},${chance}\n`;
      for (const slot of slots) {
        const row = Array.isArray(slot)
          ? slot
          : [slot.chance, slot.species, slot.min_level, slot.max_level ?? slot.min_level];
        out += `    ${row.map(flat).join(',')}\n`;
      }
    }
    out += '\n';
  }
  return out;
}

function trainersToTxt(data) {
  let out = '';
  for (const [key, fields] of Object.entries(data)) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) continue;
    out += `[${key}]\n`;
    for (const [k, v] of Object.entries(fields)) {
      if (k === 'Pokemon' || v === null || v === undefined) continue;
      out += `${k} = ${flat(v)}\n`;
    }
    const pokes = Array.isArray(fields.Pokemon) ? fields.Pokemon : [];
    for (const p of pokes) {
      out += `Pokemon = ${flat(p.Species)},${flat(p.Level)}\n`;
      for (const [k, v] of Object.entries(p)) {
        if (k === 'Species' || k === 'Level' || v === null || v === undefined) continue;
        out += `    ${k} = ${flat(v)}\n`;
      }
    }
    out += '\n';
  }
  return out;
}

export function parseJsonPbs(content, fileType) {
  let data;
  try {
    data = JSON.parse(content);
  } catch (e) {
    console.error(`PBS JSON parse error (${fileType}):`, e);
    return [];
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const txt = fileType === 'encounters' ? encountersToTxt(data)
    : fileType === 'trainers' ? trainersToTxt(data)
    : sectionsToTxt(data);
  return parsePbsFile(txt, fileType, 21, true);
}

// ---------------------------------------------------------------------------
// Entry model → JSON
// ---------------------------------------------------------------------------

// Never serialized: editor-internal duplicates of BaseStats, plus
// InternalName/FormIndex (the model materializes them from the section
// header; they are not real PBS fields and the compiler rejects them).
const IGNORE_KEYS = new Set(['HP', 'Atk', 'Def', 'Spe', 'SpAtk', 'SpDef', 'InternalName', 'FormIndex']);

// Single-value text fields that may legitimately contain commas — never split
// them into arrays. Everything else with commas is a list.
const SCALAR_KEYS = new Set([
  'Name', 'NamePlural', 'PortionName', 'PortionNamePlural', 'FormName',
  'Description', 'Pokedex', 'LoseText', 'LoseText_F', 'Category', 'Habitat',
  'Region', 'Filename', 'MegaStone', 'BattleBGM', 'VictoryBGM', 'IntroBGM',
  'InternalName', 'TrainerType', 'GenderRatio', 'GrowthRate', 'Color',
  'FunctionCode', 'Type', 'Target', 'FieldUse', 'BattleUse', 'Move', 'Gender',
]);

function token(s) {
  const t = String(s).replace(/^"(.*)"$/s, '$1').replace(/""/g, '"');
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  if (/^-?\d+\.\d+$/.test(t)) return parseFloat(t);
  return t;
}

function csvToJsonValue(csv, key) {
  if (SCALAR_KEYS.has(key)) return token(csv);   // never split free-text fields
  const parts = splitCsvRespectingQuotes(String(csv));
  if (parts.length === 1) return token(parts[0] ?? '');
  return parts.map(token);
}

// Field keys in original file order (`_order`, captured at parse), then any
// remaining modeled keys, then unknown extras.
function entryFields(entry) {
  const out = {};
  const keys = [...(entry._order || []),
    ...Object.keys(entry).filter(k => !k.startsWith('_')),
    ...Object.keys(entry._extra || {})];
  const seen = new Set();
  for (const k of keys) {
    if (seen.has(k) || IGNORE_KEYS.has(k) || k.startsWith('_')) continue;
    seen.add(k);
    const v = (k in entry) ? entry[k] : entry._extra[k];
    if (v === undefined || v === '') continue;
    out[k] = csvToJsonValue(v, k);
  }
  return out;
}

function sectionsJson(entries) {
  const obj = {};
  for (const e of entries) obj[e._header] = entryFields(e);
  return obj;
}

function encountersJson(entries) {
  const obj = {};
  for (const e of entries) {
    const types = {};
    for (const enc of (e._encounters || [])) {
      if (enc.density !== undefined && enc.density !== '') {
        types[`${enc.type}_chance`] = token(enc.density);
      }
      types[enc.type] = (enc.pokemons || []).map(line => {
        const p = splitCsvRespectingQuotes(line);
        const slot = { chance: token(p[0] ?? ''), species: p[1] ?? '', min_level: token(p[2] ?? '') };
        if (p[3] !== undefined && p[3] !== '') slot.max_level = token(p[3]);
        return slot;
      });
    }
    obj[String(e._id)] = types;
  }
  return obj;
}

function trainersJson(entries) {
  const obj = {};
  for (const e of entries) {
    const fields = {};
    if (e.LoseText) fields.LoseText = e.LoseText;
    if (e.Items) fields.Items = csvToJsonValue(e.Items, 'Items');
    fields.Pokemon = (e._pokemon || []).map(p => {
      const [species, level] = splitCsvRespectingQuotes(p.Pokemon || '');
      const poke = { Species: species ?? '', Level: token(level ?? '') };
      for (const [k, v] of Object.entries(p)) {
        if (k === 'Pokemon' || v === '' || v === undefined) continue;
        poke[k] = csvToJsonValue(v, k);
      }
      return poke;
    });
    obj[e._header] = fields;
  }
  return obj;
}

export function writeJsonPbs(entries, fileType) {
  const obj = fileType === 'encounters' ? encountersJson(entries)
    : fileType === 'trainers' ? trainersJson(entries)
    : sectionsJson(entries);
  return JSON.stringify(obj, null, 2) + '\n';
}
