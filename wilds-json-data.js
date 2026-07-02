const JSON_DATA = {};

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

  await Promise.all(
    files.map(async file => {
      const response = await fetch(`./json/${file}.json.txt`);
      JSON_DATA[file] = await response.json();
    })
  );
}

const JSON_INDEX = {
  itemByName: new Map(),
  skillByName: new Map(),
  skillByGameId: new Map()
  monsterByName: new Map(),
  armorByName: new Map(),
  accessoryByName: new Map(),
  charmByName: new Map(),
  amuletByName: new Map()
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
  JSON_INDEX.skillByName.clear();
  JSON_INDEX.skillByGameId.clear();
  JSON_INDEX.monsterByName.clear();
  JSON_INDEX.armorByName.clear();
  JSON_INDEX.accessoryByName.clear();
  JSON_INDEX.charmByName.clear();
  JSON_INDEX.amuletByName.clear();

  for (const item of JSON_DATA.item || []) {
    addJsonNameIndex(JSON_INDEX.itemByName, item);
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
}