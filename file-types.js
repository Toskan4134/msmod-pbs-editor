/**
 * Per-file-type field definitions, columns, and graphics config.
 */

// Type color map for badges
export const TYPE_COLORS = {
  NORMAL:'#A8A878', FIRE:'#F08030', WATER:'#6890F0', GRASS:'#78C850',
  ELECTRIC:'#F8D030', ICE:'#98D8D8', FIGHTING:'#C03028', POISON:'#A040A0',
  GROUND:'#E0C068', FLYING:'#A890F0', PSYCHIC:'#F85888', BUG:'#A8B820',
  ROCK:'#B8A038', GHOST:'#705898', DRAGON:'#7038F8', DARK:'#705848',
  STEEL:'#B8B8D0', FAIRY:'#EE99AC',
};

// ---- Graphics config per file type and version ----
// Entry can have _id (numeric) or InternalName for substitution.

function padId(entry) {
  const id = entry._id;
  if (id == null) return '';
  return String(id).padStart(3, '0');
}

export function getPrimaryGraphic(fileType, entry, version) {
  const id = padId(entry);
  const name = entry.InternalName || '';

  if (fileType === 'pokemon' || fileType === 'pokemon_forms') {
    const formIndex = fileType === 'pokemon_forms' ? (parseInt(entry.FormIndex) || 0) : 0;
    const formSuffix = formIndex > 0 ? `_${formIndex}` : '';
    const formName = `${name}${formSuffix}`;
    const formId = formIndex > 0 ? `${id}_${formIndex}` : id;
    if (version >= 21) return `Graphics/Pokemon/Front/${formName}.png`;
    if (version >= 17) return `Graphics/Battlers/Front/${formId}.png`;
    return `Graphics/Battlers/${formId}.png`;
  }
  if (fileType === 'trainers' || fileType === 'trainer_types') {
    const trainerName = fileType === 'trainers' ? (entry.TrainerType || name) : name;
    if (version >= 21) return `Graphics/Trainers/${trainerName}.png`;
    return `Graphics/Characters/trainer${id}.png`;
  }
  if (fileType === 'items') {
    if (version >= 21) return `Graphics/Items/${name}.png`;
    return `Graphics/Icons/item${id}.png`;
  }
  return null;
}

// ---- SVG icon helper (Lucide-style) ----
function _svg(d, sz = 16) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle">${d}</svg>`;
}

const _ICONS = {
  pokemon:       _svg('<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><circle cx="12" cy="12" r="3"/>'),
  forms:         _svg('<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>'),
  moves:         _svg('<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>'),
  abilities:     _svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
  items:         _svg('<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>'),
  types:         _svg('<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>'),
  encounters:    _svg('<path d="M2 12a5 5 0 0 0 5 5 8 8 0 0 1 5 2 8 8 0 0 1 5-2 5 5 0 0 0 5-5V7h-5a8 8 0 0 0-5 2 8 8 0 0 0-5-2H2Z"/>'),
  trainers:      _svg('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  trainerTypes:  _svg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'),
  townMap:       _svg('<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15"/><path d="M15 6v15"/>'),
  tm:            _svg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>'),
};

export const FILE_TYPES = {
  pokemon: {
    label: 'Pokemon', icon: _ICONS.pokemon,
    displayField: 'Name', headerField: 'InternalName',
    sections: [
      { label: 'Basic', fields: [
        { key: 'Name', label: 'Name', type: 'text' },
        { key: 'InternalName', label: 'Internal Name', type: 'text' },
        { key: 'Types', label: 'Types', type: 'list', ref: 'types' },
        { key: 'GenderRatio', label: 'Gender Ratio', type: 'select', options: ['AlwaysMale','AlwaysFemale','FemaleOneEighth','Female25Percent','Female50Percent','Female75Percent','Genderless'] },
        { key: 'GrowthRate', label: 'Growth Rate', type: 'select', options: ['Medium','Fast','Slow','Erratic','Fluctuating','MediumFast','MediumSlow','Parabolic'] },
        { key: 'Color', label: 'Color', type: 'select', options: ['Red','Blue','Yellow','Green','Black','Brown','Purple','Gray','White','Pink'] },
      ]},
      { label: 'Stats', fields: [
        { key: 'BaseStats', label: 'Base Stats', type: 'stats', statsKeys: ['HP','Atk','Def','Spe','SpAtk','SpDef'] },
        { key: 'EVs', label: 'EVs', type: 'evs' },
        { key: 'BaseExp', label: 'Base Exp', type: 'number' },
        { key: 'CatchRate', label: 'Catch Rate', type: 'number' },
        { key: 'Happiness', label: 'Happiness', type: 'number' },
      ]},
      { label: 'Abilities', fields: [
        { key: 'Abilities', label: 'Abilities', type: 'list', ref: 'abilities' },
        { key: 'HiddenAbilities', label: 'Hidden Ability', type: 'list', ref: 'abilities' },
      ]},
      { label: 'Moves & Breeding', fields: [
        { key: 'Moves', label: 'Level Moves', type: 'pairs', pairLabels: ['Level', 'Move'], refB: 'moves' },
        { key: 'TutorMoves', label: 'Tutor Moves', type: 'list', ref: 'moves' },
        { key: 'EggMoves', label: 'Egg Moves', type: 'list', ref: 'moves' },
        { key: 'EggGroups', label: 'Egg Groups', type: 'list' },
      ]},
      { label: 'Evolution & Other', fields: [
        { key: 'Evolutions', label: 'Evolutions', type: 'triplets', labels: ['Target', 'Method', 'Param'], refA: 'pokemon', evolution: true },
        { key: 'HatchSteps', label: 'Hatch Steps', type: 'number' },
        { key: 'Height', label: 'Height', type: 'number', step: 0.1 },
        { key: 'Weight', label: 'Weight', type: 'number', step: 0.1 },
        { key: 'Category', label: 'Category', type: 'text' },
        { key: 'Habitat', label: 'Habitat', type: 'text' },
        { key: 'Pokedex', label: 'Pokedex Entry', type: 'textarea', fullWidth: true },
        { key: 'BattlerPlayerY', label: 'Battler Player Y', type: 'number' },
        { key: 'BattlerEnemyY', label: 'Battler Enemy Y', type: 'number' },
        { key: 'BattlerAltitude', label: 'Battler Altitude', type: 'number' },
      ]},
    ],
    columns: [
      { key: '_id', label: '#', width: 35, numeric: true },
      { key: 'Name', label: 'Name', width: 110 },
      { key: 'InternalName', label: 'Internal', width: 95 },
      { key: 'Types', label: 'Types', width: 90 },
      { key: 'BaseStats', label: 'Stats', width: 120 },
    ],
  },
  pokemon_forms: {
    label: 'Forms', icon: _ICONS.forms,
    displayField: 'FormName', headerField: 'InternalName',
    sections: [
      { label: 'Basic', fields: [
        { key: 'InternalName', label: 'Pokemon', type: 'text' },
        { key: 'FormIndex', label: 'Form Index', type: 'number' },
        { key: 'FormName', label: 'Form Name', type: 'text' },
        { key: 'Types', label: 'Types', type: 'list', ref: 'types' },
      ]},
      { label: 'Stats & Abilities', fields: [
        { key: 'BaseStats', label: 'Base Stats', type: 'stats', statsKeys: ['HP','Atk','Def','Spe','SpAtk','SpDef'] },
        { key: 'Abilities', label: 'Abilities', type: 'list', ref: 'abilities' },
        { key: 'HiddenAbilities', label: 'Hidden Ability', type: 'list', ref: 'abilities' },
      ]},
      { label: 'Moves & Evolution', fields: [
        { key: 'Moves', label: 'Level Moves', type: 'pairs', pairLabels: ['Level', 'Move'], refB: 'moves' },
        { key: 'TutorMoves', label: 'Tutor Moves', type: 'list', ref: 'moves' },
        { key: 'EggMoves', label: 'Egg Moves', type: 'list', ref: 'moves' },
        { key: 'Evolutions', label: 'Evolutions', type: 'triplets', labels: ['Target', 'Method', 'Param'], refA: 'pokemon', evolution: true },
      ]},
      { label: 'Other', fields: [
        { key: 'Height', label: 'Height', type: 'number', step: 0.1 },
        { key: 'Weight', label: 'Weight', type: 'number', step: 0.1 },
        { key: 'Color', label: 'Color', type: 'text' },
        { key: 'Pokedex', label: 'Pokedex', type: 'textarea', fullWidth: true },
        { key: 'MegaStone', label: 'Mega Stone', type: 'text' },
        { key: 'Region', label: 'Region', type: 'text' },
      ]},
    ],
    columns: [
      { key: 'InternalName', label: 'Pokemon', width: 100 },
      { key: 'FormIndex', label: 'Form', width: 40, numeric: true },
      { key: 'FormName', label: 'Name', width: 100 },
      { key: 'Types', label: 'Types', width: 80 },
    ],
  },
  moves: {
    label: 'Moves', icon: _ICONS.moves,
    displayField: 'Name', headerField: 'InternalName',
    sections: [{ label: 'All Fields', fields: [
      { key: 'Name', label: 'Name', type: 'text' },
      { key: 'InternalName', label: 'Internal Name', type: 'text' },
      { key: 'FunctionCode', label: 'Function Code', type: 'text' },
      { key: 'Power', label: 'Power', type: 'number', min: 0, max: 255 },
      { key: 'Type', label: 'Type', type: 'text', ref: 'types' },
      { key: 'Category', label: 'Category', type: 'select', options: ['Physical','Special','Status'] },
      { key: 'Accuracy', label: 'Accuracy', type: 'number', min: 0, max: 100 },
      { key: 'TotalPP', label: 'PP', type: 'number', min: 1, max: 99 },
      { key: 'EffectChance', label: 'Effect Chance', type: 'number', min: 0, max: 100 },
      { key: 'Priority', label: 'Priority', type: 'number', min: -7, max: 7 },
      { key: 'Target', label: 'Target', type: 'text' },
      { key: 'Flags', label: 'Flags', type: 'text' },
      { key: 'Description', label: 'Description', type: 'textarea', fullWidth: true },
    ]}],
    columns: [
      { key: '_id', label: '#', width: 35, numeric: true },
      { key: 'Name', label: 'Name', width: 110 },
      { key: 'Type', label: 'Type', width: 60 },
      { key: 'Category', label: 'Cat', width: 55 },
      { key: 'Power', label: 'Pow', width: 40, numeric: true },
      { key: 'Accuracy', label: 'Acc', width: 40, numeric: true },
      { key: 'TotalPP', label: 'PP', width: 35, numeric: true },
    ],
  },
  abilities: {
    label: 'Abilities', icon: _ICONS.abilities,
    displayField: 'Name', headerField: 'InternalName',
    sections: [{ label: 'All Fields', fields: [
      { key: 'Name', label: 'Name', type: 'text' },
      { key: 'InternalName', label: 'Internal Name', type: 'text' },
      { key: 'Description', label: 'Description', type: 'textarea', fullWidth: true },
    ]}],
    columns: [
      { key: '_id', label: '#', width: 35, numeric: true },
      { key: 'Name', label: 'Name', width: 130 },
      { key: 'InternalName', label: 'Internal', width: 110 },
    ],
  },
  items: {
    label: 'Items', icon: _ICONS.items,
    displayField: 'Name', headerField: 'InternalName',
    sections: [{ label: 'All Fields', fields: [
      { key: 'Name', label: 'Name', type: 'text' },
      { key: 'InternalName', label: 'Internal Name', type: 'text' },
      { key: 'NamePlural', label: 'Plural Name', type: 'text' },
      { key: 'Pocket', label: 'Pocket', type: 'number' },
      { key: 'Price', label: 'Price', type: 'number' },
      { key: 'SellPrice', label: 'Sell Price', type: 'number' },
      { key: 'BPPrice', label: 'BP Price', type: 'number' },
      { key: 'Description', label: 'Description', type: 'textarea', fullWidth: true },
      { key: 'FieldUse', label: 'Field Use', type: 'text' },
      { key: 'BattleUse', label: 'Battle Use', type: 'text' },
      { key: 'Flags', label: 'Flags', type: 'text' },
      { key: 'Consumable', label: 'Consumable', type: 'checkbox' },
      { key: 'ShowQuantity', label: 'Show Quantity', type: 'checkbox' },
      { key: 'Move', label: 'Move', type: 'text', ref: 'moves' },
    ]}],
    columns: [
      { key: '_id', label: '#', width: 35, numeric: true },
      { key: 'Name', label: 'Name', width: 130 },
      { key: 'Pocket', label: 'Pocket', width: 50, numeric: true },
      { key: 'Price', label: 'Price', width: 50, numeric: true },
    ],
  },
  types: {
    label: 'Types', icon: _ICONS.types,
    displayField: 'Name', headerField: 'InternalName',
    sections: [{ label: 'All Fields', fields: [
      { key: 'Name', label: 'Name', type: 'text' },
      { key: 'InternalName', label: 'Internal Name', type: 'text' },
      { key: 'IconPosition', label: 'Icon Position', type: 'number' },
      { key: 'IsPseudoType', label: 'Pseudo Type', type: 'checkbox' },
      { key: 'IsSpecialType', label: 'Special Type', type: 'checkbox' },
      { key: 'Weaknesses', label: 'Weaknesses', type: 'list', ref: 'types' },
      { key: 'Resistances', label: 'Resistances', type: 'list', ref: 'types' },
      { key: 'Immunities', label: 'Immunities', type: 'list', ref: 'types' },
    ]}],
    columns: [
      { key: 'Name', label: 'Name', width: 80 },
      { key: 'InternalName', label: 'Internal', width: 80 },
      { key: 'Weaknesses', label: 'Weak', width: 120 },
      { key: 'Resistances', label: 'Resist', width: 120 },
    ],
  },
  encounters: {
    label: 'Encounters', icon: _ICONS.encounters,
    displayField: 'Name', headerField: '_id',
    hasSubSections: true,
    sections: [],
    columns: [
      { key: '_id', label: 'ID', width: 40, numeric: true },
      { key: 'Name', label: 'Map', width: 160 },
    ],
  },
  trainers: {
    label: 'Trainers', icon: _ICONS.trainers,
    displayField: 'Name', headerField: '_header',
    hasSubSections: true,
    sections: [{ label: 'Trainer Info', fields: [
      { key: 'TrainerType', label: 'Trainer Type', type: 'text', ref: 'trainer_types' },
      { key: 'Name', label: 'Name', type: 'text' },
      { key: 'Version', label: 'Version', type: 'number' },
      { key: 'LoseText', label: 'Lose Text', type: 'text', fullWidth: true },
      { key: 'Items', label: 'Items', type: 'list', ref: 'items' },
    ]}],
    columns: [
      { key: 'TrainerType', label: 'Type', width: 100 },
      { key: 'Name', label: 'Name', width: 100 },
      { key: 'Version', label: 'Ver', width: 40 },
    ],
  },
  trainer_types: {
    label: 'Trainer Types', icon: _ICONS.trainerTypes,
    displayField: 'Name', headerField: 'InternalName',
    sections: [{ label: 'All Fields', fields: [
      { key: 'Name', label: 'Name', type: 'text' },
      { key: 'InternalName', label: 'Internal Name', type: 'text' },
      { key: 'BaseMoney', label: 'Base Money', type: 'number' },
      { key: 'Gender', label: 'Gender', type: 'select', options: ['Male','Female','Mixed'] },
      { key: 'SkillLevel', label: 'Skill Level', type: 'number' },
      { key: 'BattleBGM', label: 'Battle BGM', type: 'bgm' },
      { key: 'VictoryBGM', label: 'Victory BGM', type: 'bgm' },
      { key: 'IntroBGM', label: 'Intro BGM', type: 'bgm' },
    ]}],
    columns: [
      { key: 'Name', label: 'Name', width: 120 },
      { key: 'InternalName', label: 'Internal', width: 100 },
      { key: 'BaseMoney', label: 'Base $', width: 60, numeric: true },
    ],
  },
  town_map: {
    label: 'Town Map', icon: _ICONS.townMap,
    displayField: 'Name', headerField: '_id',
    sections: [{ label: 'All Fields', fields: [
      { key: 'Name', label: 'Name', type: 'text' },
      { key: 'Filename', label: 'Filename', type: 'text' },
    ]}],
    columns: [
      { key: '_id', label: 'Index', width: 50, numeric: true },
      { key: 'Name', label: 'Name', width: 130 },
      { key: 'Filename', label: 'Filename', width: 130 },
    ],
  },
  tm: {
    label: 'TM', icon: _ICONS.tm,
    displayField: 'Move', headerField: 'Move',
    sections: [{ label: 'All Fields', fields: [
      { key: 'Move', label: 'Move Name', type: 'text' },
      { key: 'Pokemon', label: 'Compatible Pokemon', type: 'list', ref: 'pokemon' },
    ]}],
    columns: [
      { key: 'Move', label: 'Move', width: 120 },
      { key: 'Pokemon', label: 'Compatible', width: 200 },
    ],
  },
};

export function getFileTypeConfig(fileType) {
  return FILE_TYPES[fileType] || null;
}
