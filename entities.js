// entities.js
// Entity registry, reverse indexes and text linkification for WildsDump.
//
// Entity types:
//   monster     key = String(game_id)          (largemonsters.json)
//   monsterText key = display name             (enemytext dump entries, small monsters etc.)
//   item        key = String(game_id)
//   skill       key = String(game_id)
//   weapon      key = `${weaponFile}:${game_id}`
//   armorset    key = set name (lowercase)
//   armorpiece  key = piece name (lowercase)
//   accessory   key = String(game_id)
//   npc         key = display name (opens dialogue view)

const ENTITY_BY_NAME = new Map();   // exact name -> entity descriptor
const ENTITY_LOOKUP = new Map();    // first word (lowercase) -> [descriptors sorted by length desc]
const ENTITY_MIN_NAME_LENGTH = 3;

const JSON_EXTRA_INDEX = {
  accessoryByGameId: new Map(),
  monsterByGameId: new Map(),
  stageByGameId: new Map()
};

const REVERSE_INDEX = {
  // skillId -> { armorPieces: [], accessories: [], amulets: [], weapons: [] }
  skillSources: new Map(),
  // itemId -> { weapons: [], armorPieces: [], amuletRanks: [], craftsInto: [] }
  itemUsage: new Map(),
  // itemId -> [{ monster, rank, kind, chance, amount }]
  itemSources: new Map()
};

function registerEntity(name, type, key) {
  const clean = String(name || "").trim();

  if (clean.length < ENTITY_MIN_NAME_LENGTH) return;
  if (!/^[A-Z0-9]/.test(clean)) return;
  if (ENTITY_BY_NAME.has(clean)) return;

  const descriptor = { name: clean, type, key: String(key) };
  ENTITY_BY_NAME.set(clean, descriptor);

  const firstWord = clean.split(/\s+/)[0].toLowerCase();

  if (!ENTITY_LOOKUP.has(firstWord)) {
    ENTITY_LOOKUP.set(firstWord, []);
  }

  const bucket = ENTITY_LOOKUP.get(firstWord);
  bucket.push(descriptor);
  bucket.sort((a, b) => b.name.length - a.name.length);
}

function ensureReverseEntry(map, id, factory) {
  const key = String(id);

  if (!map.has(key)) {
    map.set(key, factory());
  }

  return map.get(key);
}

function buildEntityIndexes() {
  ENTITY_BY_NAME.clear();
  ENTITY_LOOKUP.clear();

  JSON_EXTRA_INDEX.accessoryByGameId.clear();
  JSON_EXTRA_INDEX.monsterByGameId.clear();
  JSON_EXTRA_INDEX.stageByGameId.clear();

  REVERSE_INDEX.skillSources.clear();
  REVERSE_INDEX.itemUsage.clear();
  REVERSE_INDEX.itemSources.clear();

  // --- extra id indexes ---------------------------------------------------

  for (const accessory of JSON_DATA.accessory || []) {
    if (accessory.game_id !== undefined) {
      JSON_EXTRA_INDEX.accessoryByGameId.set(String(accessory.game_id), accessory);
    }
  }

  for (const monster of JSON_DATA.largemonsters || []) {
    if (monster.game_id !== undefined) {
      JSON_EXTRA_INDEX.monsterByGameId.set(String(monster.game_id), monster);
    }
  }

  for (const stage of JSON_DATA.stage || []) {
    if (stage.game_id !== undefined) {
      JSON_EXTRA_INDEX.stageByGameId.set(String(stage.game_id), stage);
    }
  }

  // --- entity registration (order = precedence on name conflicts) ---------

  for (const monster of JSON_DATA.largemonsters || []) {
    registerEntity(getJsonName(monster, "en"), "monster", monster.game_id);

    for (const variant of monster.variants || []) {
      registerEntity(getJsonName(variant, "en"), "monster", monster.game_id);
    }
  }

  const npcNames = new Set();

  for (const map of [
    typeof NPC_MAP !== "undefined" ? NPC_MAP : {},
    typeof GOSSIP_MAP !== "undefined" ? GOSSIP_MAP : {},
    typeof DIALOGUE_MAP !== "undefined" ? DIALOGUE_MAP : {}
  ]) {
    for (const name of Object.values(map)) {
      const clean = String(name || "").trim();
      if (!clean || clean.includes("?")) continue;
      npcNames.add(clean);
    }
  }

  for (const name of npcNames) {
    registerEntity(name, "npc", name);
  }

  for (const set of JSON_DATA.armor || []) {
    const setName = getJsonName(set, "en");
    registerEntity(setName, "armorset", setName.toLowerCase());

    for (const piece of set.pieces || []) {
      const pieceName = getJsonName(piece, "en");
      registerEntity(pieceName, "armorpiece", pieceName.toLowerCase());
    }
  }

  for (const file of WEAPON_JSON_FILES) {
    if (file.startsWith("huntinghorn") && file !== "huntinghorn") continue;

    for (const weapon of JSON_DATA[file] || []) {
      registerEntity(getJsonName(weapon, "en"), "weapon", `${file}:${weapon.game_id}`);
    }
  }

  for (const item of JSON_DATA.item || []) {
    registerEntity(getJsonName(item, "en"), "item", item.game_id);
  }

  for (const skill of JSON_DATA.skill || []) {
    registerEntity(getJsonName(skill, "en"), "skill", skill.game_id);
  }

  for (const accessory of JSON_DATA.accessory || []) {
    registerEntity(getJsonName(accessory, "en"), "accessory", accessory.game_id);
  }

  buildReverseIndexes();
}

// Called once the dump entries are loaded, adds text-only monsters
// (small monsters, endemic life) that only exist in enemytext.
function addDumpEntities(monsterGroupsMap) {
  for (const name of monsterGroupsMap.keys()) {
    registerEntity(name, "monsterText", name);
  }
}

function buildReverseIndexes() {
  const addSkillSource = (skillId, listName, ref) => {
    const bucket = ensureReverseEntry(REVERSE_INDEX.skillSources, skillId, () => ({
      armorPieces: [],
      accessories: [],
      amulets: [],
      weapons: []
    }));

    bucket[listName].push(ref);
  };

  const addItemUsage = (itemId, listName, ref) => {
    const bucket = ensureReverseEntry(REVERSE_INDEX.itemUsage, itemId, () => ({
      weapons: [],
      armorPieces: [],
      amuletRanks: [],
      craftsInto: []
    }));

    bucket[listName].push(ref);
  };

  // Weapons: skills + crafting inputs
  for (const file of WEAPON_JSON_FILES) {
    if (file.startsWith("huntinghorn") && file !== "huntinghorn") continue;

    for (const weapon of JSON_DATA[file] || []) {
      const ref = { ...weapon, weapon_file: file };

      for (const skillId of Object.keys(weapon.skills || {})) {
        addSkillSource(skillId, "weapons", ref);
      }

      for (const itemId of Object.keys(weapon.crafting?.inputs || {})) {
        addItemUsage(itemId, "weapons", ref);
      }
    }
  }

  // Armor pieces: skills + crafting inputs
  for (const set of JSON_DATA.armor || []) {
    for (const piece of set.pieces || []) {
      const ref = { piece, set };

      for (const skillId of Object.keys(piece.skills || {})) {
        addSkillSource(skillId, "armorPieces", ref);
      }

      for (const itemId of Object.keys(piece.crafting?.inputs || {})) {
        addItemUsage(itemId, "armorPieces", ref);
      }
    }
  }

  // Accessories: skills
  for (const accessory of JSON_DATA.accessory || []) {
    for (const skillId of Object.keys(accessory.skills || {})) {
      addSkillSource(skillId, "accessories", accessory);
    }
  }

  // Amulets: skills + recipes
  for (const amulet of JSON_DATA.amulet || []) {
    for (const rank of amulet.ranks || []) {
      for (const skillId of Object.keys(rank.skills || {})) {
        addSkillSource(skillId, "amulets", rank);
      }

      for (const itemId of Object.keys(rank.recipe?.inputs || {})) {
        addItemUsage(itemId, "amuletRanks", rank);
      }
    }
  }

  // Item recipes: which item is crafted from which inputs
  for (const item of JSON_DATA.item || []) {
    for (const recipe of item.recipes || []) {
      const rawInputs = recipe.inputs || [];

      const inputIds = Array.isArray(rawInputs)
        ? rawInputs
        : Object.keys(rawInputs);

      for (const inputId of inputIds) {
        addItemUsage(inputId, "craftsInto", item);
      }
    }
  }

  // Monster rewards: item -> monsters that drop it
  for (const monster of JSON_DATA.largemonsters || []) {
    for (const reward of monster.rewards || []) {
      if (reward.item_id === undefined) continue;

      const bucket = ensureReverseEntry(
        REVERSE_INDEX.itemSources,
        reward.item_id,
        () => []
      );

      bucket.push({
        monster,
        rank: reward.rank,
        kind: reward.kind,
        chance: reward.chance,
        amount: reward.amount
      });
    }
  }
}

// --- linkification ---------------------------------------------------------

// Finds ranges of entity names in a RAW (unescaped) text.
function findEntityRanges(text) {
  if (!ENTITY_LOOKUP.size || !text) return [];

  const ranges = [];
  const wordRegex = /[A-Z][A-Za-z0-9'’\-]*/g;
  let match;

  while ((match = wordRegex.exec(text))) {
    const candidates = ENTITY_LOOKUP.get(match[0].toLowerCase());
    if (!candidates) continue;

    for (const candidate of candidates) {
      if (!text.startsWith(candidate.name, match.index)) continue;

      const end = match.index + candidate.name.length;
      const next = text[end];

      if (next !== undefined && /[A-Za-z0-9]/.test(next)) continue;

      ranges.push({ start: match.index, end, entity: candidate });
      wordRegex.lastIndex = end;
      break;
    }
  }

  return ranges;
}

// Finds highlight ranges for search terms (case-insensitive), skipping
// ranges that overlap the given blocked ranges.
function findHighlightRanges(text, terms, blockedRanges) {
  if (!terms?.length || !text) return [];

  const lower = text.toLowerCase();
  const ranges = [];

  const overlapsBlocked = (start, end) =>
    blockedRanges.some(range => start < range.end && end > range.start);

  for (const term of terms) {
    const needle = String(term || "").toLowerCase();
    if (needle.length < 2) continue;

    let from = 0;
    let index;

    while ((index = lower.indexOf(needle, from)) !== -1) {
      const end = index + needle.length;

      if (!overlapsBlocked(index, end)) {
        ranges.push({ start: index, end, mark: true });
      }

      from = end;
    }
  }

  return ranges;
}

// Builds escaped HTML for a single line of raw text with entity links
// and search-term highlighting.
function buildEntityHtml(text, { linkify = false, highlightTerms = null } = {}) {
  const value = String(text || "");

  if (!value) return "";

  const entityRanges = linkify ? findEntityRanges(value) : [];
  const highlightRanges = findHighlightRanges(value, highlightTerms, entityRanges);

  const all = [...entityRanges, ...highlightRanges]
    .sort((a, b) => a.start - b.start);

  // Drop overlapping ranges (first wins).
  const accepted = [];
  let lastEnd = 0;

  for (const range of all) {
    if (range.start < lastEnd) continue;
    accepted.push(range);
    lastEnd = range.end;
  }

  if (!accepted.length) {
    return escapeHtml(value);
  }

  let html = "";
  let cursor = 0;

  for (const range of accepted) {
    html += escapeHtml(value.slice(cursor, range.start));

    const inner = escapeHtml(value.slice(range.start, range.end));

    if (range.entity) {
      html += `<button
        class="entity-link entity-link-${escapeAttribute(range.entity.type)}"
        type="button"
        data-entity-type="${escapeAttribute(range.entity.type)}"
        data-entity-key="${escapeAttribute(range.entity.key)}"
      >${inner}</button>`;
    } else {
      html += `<mark>${inner}</mark>`;
    }

    cursor = range.end;
  }

  html += escapeHtml(value.slice(cursor));

  return html;
}

// Convenience: an inline entity link with explicit label (used by JSON panels).
function entityLinkHtml(type, key, label) {
  return `<button
    class="entity-link entity-link-${escapeAttribute(type)}"
    type="button"
    data-entity-type="${escapeAttribute(type)}"
    data-entity-key="${escapeAttribute(key)}"
  >${escapeHtml(label)}</button>`;
}

function getStageNameById(id) {
  const stage = JSON_EXTRA_INDEX.stageByGameId.get(String(id));
  return getJsonName(stage, "en") || `Stage ${id}`;
}
