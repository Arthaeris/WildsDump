// categories.js
// WildsDump category definitions and ordering

const CATEGORY_ORDER = [
  "Dialogues",

  "NPCs",
  "Monsters",

  "Quests",
  "Facilities",

  "Items",
  "Equipment",
  "Weapons",
  "Skills",

  "Tutorials",
  "UI",
  "Social",
  "System",

  "References",

  "Unknown / Numeric",
  "Unknown"
];

const CATEGORY_SEPARATOR_BEFORE = new Set([
  "NPCs",
  "Quests",
  "Items",
  "Tutorials",
  "References",
  "Unknown / Numeric"
]);

// Optional hidden families.
// Leave empty for now until the dump is fully mapped.

const HIDDEN_FAMILIES = new Set([
]);

// Optional hidden filenames.

const HIDDEN_FILES = new Set([
]);

// Dialogue families.

const DIALOGUE_FAMILIES = new Set([
  "dia_npc",
  "dia_npcgossip",
  "dia_stch",
  "dia_otomo",
  "dia_pl",
  "dia_trial"
]);

// Weapon files.

const WEAPON_FAMILIES = new Set([
  "greatsword",
  "shortsword",
  "twinsword",
  "tachi",
  "hammer",
  "horn",
  "lance",
  "gunlance",
  "slashaxe",
  "chargeaxe",
  "rod",
  "rodinsect",
  "bow",
  "lightbowgun",
  "heavybowgun",

  "weaponintroduction",
  "weaponseries",
  "weapontutorial"
]);

// Equipment.

const EQUIPMENT_FAMILIES = new Set([
  "armor",
  "armorseries",

  "outerarmor",

  "accessory",
  "accessorydata",

  "amulet",
  "charm",

  "artianbonus",
  "artianparts",
  "artianperformance",

  "otomoarmor",
  "otomoweapon",
  "otomoouterarmor",
  "otomoequipseries",

  "seikretequip"
]);

// Skills.

const SKILL_FAMILIES = new Set([
  "skill",
  "skillexplain",
  "skillgroup",
  "setskill"
]);

// Items.

const ITEM_FAMILIES = new Set([
  "item",
  "itemmix",
  "material",
  "slinger",
  "supplyitem"
]);

// Monsters.

const MONSTER_FAMILIES = new Set([
  "enemy",
  "enemyname",
  "enemyicon",
  "enemysize",
  "enemyparts"
]);

// Facilities.

const FACILITY_FAMILIES = new Set([
  "facility",
  "meallobby",
  "canteen",
  "smithy",
  "trade"
]);

// Tutorials.

const TUTORIAL_FAMILIES = new Set([
  "tutorial",
  "tips",
  "manual"
]);

// UI.

const UI_FAMILIES = new Set([
  "gui",
  "showtext",
  "option",
  "config"
]);

// Social.

const SOCIAL_FAMILIES = new Set([
  "chatlog",
  "gesture",
  "pose",
  "stamp",
  "nameplate"
]);

// System.

const SYSTEM_FAMILIES = new Set([
  "staffroll",
  "medal",
  "trophyachievement",
  "credits"
]);
