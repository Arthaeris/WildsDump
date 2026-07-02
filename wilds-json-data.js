const JSON_DATA = {};

const WEAPON_JSON_FILES = [
  "bow",
  "chargeblade",
  "dualblades",
  "greatsword",
  "gunlance",
  "hammer",
  "heavybowgun",
  "huntinghorn",
  "huntinghornechobubbles",
  "huntinghornechowaves",
  "huntinghornmelodies",
  "huntinghornsongs",
  "insectglaive",
  "lance",
  "lightbowgun",
  "longsword",
  "switchaxe",
  "swordshield"
];

async function loadJsonDatabase() {
  const files = [
    "accessory",
    "amulet",
    "armor",
    "armorupgrade",
    "charm",
    "item",
    "largemonsters",
    "partnames",
    "skill",
    "species",
    "stage",
    "weaponseries"
  ];

  await Promise.all([
    ...files.map(async file => {
      const response = await fetch(`./json/${file}.json.txt`);
      if (!response.ok) throw new Error(`Could not load ./json/${file}.json.txt`);
      JSON_DATA[file] = await response.json();
    }),

    ...WEAPON_JSON_FILES.map(async file => {
      const response = await fetch(`./weapons/${file}.json.txt`);
      if (!response.ok) throw new Error(`Could not load ./weapons/${file}.json.txt`);
      JSON_DATA[file] = await response.json();
    })
  ]);
}

const JSON_INDEX = {
  itemByName: new Map(),
  itemByGameId: new Map(),

  skillByName: new Map(),
  skillByGameId: new Map(),

  monsterByName: new Map(),
  armorByName: new Map(),
  accessoryByName: new Map(),
  charmByName: new Map(),
  amuletByName: new Map(),

  weaponByName: new Map(),
  weaponByGameId: new Map(),
  weaponSeriesByGameId: new Map(),

  hhMelodyByGameId: new Map(),
  hhEchoWaveByGameId: new Map(),
  hhEchoBubbleByGameId: new Map(),
  hhSongByGameId: new Map()
};

function getJsonName(item, lang = "en") {
  return item?.names?.[lang] || item?.name?.[lang] || item?.name || "";
}

function addJsonNameIndex(map, item) {
  const en = getJsonName(item, "en");
  const jp = getJsonName(item, "ja");

  if (en) map.set(en.toLowerCase(), item);
  if (jp) map.set(jp, item);
}

function buildJsonIndexes() {
  JSON_INDEX.itemByName.clear();
  JSON_INDEX.itemByGameId.clear();

  JSON_INDEX.skillByName.clear();
  JSON_INDEX.skillByGameId.clear();

  JSON_INDEX.monsterByName.clear();
  JSON_INDEX.armorByName.clear();
  JSON_INDEX.accessoryByName.clear();
  JSON_INDEX.charmByName.clear();
  JSON_INDEX.amuletByName.clear();

  JSON_INDEX.weaponByName.clear();
  JSON_INDEX.weaponByGameId.clear();
  JSON_INDEX.weaponSeriesByGameId.clear();
  
  JSON_INDEX.hhMelodyByGameId.clear();
  JSON_INDEX.hhEchoWaveByGameId.clear();
  JSON_INDEX.hhEchoBubbleByGameId.clear();
  JSON_INDEX.hhSongByGameId.clear();

  for (const item of JSON_DATA.item || []) {
    addJsonNameIndex(JSON_INDEX.itemByName, item);

    if (item.game_id !== undefined) {
      JSON_INDEX.itemByGameId.set(String(item.game_id), item);
    }
  }

  for (const skill of JSON_DATA.skill || []) {
    addJsonNameIndex(JSON_INDEX.skillByName, skill);

    if (skill.game_id !== undefined) {
      JSON_INDEX.skillByGameId.set(String(skill.game_id), skill);
    }
  }

  for (const item of JSON_DATA.largemonsters || []) addJsonNameIndex(JSON_INDEX.monsterByName, item);
  for (const item of JSON_DATA.armor || []) addJsonNameIndex(JSON_INDEX.armorByName, item);
  for (const item of JSON_DATA.accessory || []) addJsonNameIndex(JSON_INDEX.accessoryByName, item);
  for (const item of JSON_DATA.charm || []) addJsonNameIndex(JSON_INDEX.charmByName, item);

  for (const amulet of JSON_DATA.amulet || []) {
    for (const rank of amulet.ranks || []) {
      addJsonNameIndex(JSON_INDEX.amuletByName, {
        ...rank,
        parent_game_id: amulet.game_id,
        is_random: amulet.is_random
      });
    }
  }

  for (const file of WEAPON_JSON_FILES) {
    for (const weapon of JSON_DATA[file] || []) {
      const indexedWeapon = {
        ...weapon,
        weapon_file: file
      };

      addJsonNameIndex(JSON_INDEX.weaponByName, indexedWeapon);

      if (weapon.game_id !== undefined) {
        JSON_INDEX.weaponByGameId.set(String(weapon.game_id), indexedWeapon);
      }
    }
  }

  for (const series of JSON_DATA.weaponseries || []) {
    if (series.game_id !== undefined) {
      JSON_INDEX.weaponSeriesByGameId.set(String(series.game_id), series);
    }
  }
  
  for (const item of JSON_DATA.huntinghornmelodies || []) {
  if (item.game_id !== undefined) {
    JSON_INDEX.hhMelodyByGameId.set(String(item.game_id), item);
  }
}

for (const item of JSON_DATA.huntinghornechowaves || []) {
  if (item.game_id !== undefined) {
    JSON_INDEX.hhEchoWaveByGameId.set(String(item.game_id), item);
  }
}

for (const item of JSON_DATA.huntinghornechobubbles || []) {
  if (item.game_id !== undefined) {
    JSON_INDEX.hhEchoBubbleByGameId.set(String(item.game_id), item);
  }
}

for (const item of JSON_DATA.huntinghornsongs || []) {
  if (item.game_id !== undefined) {
    JSON_INDEX.hhSongByGameId.set(String(item.game_id), item);
  }
 }
}