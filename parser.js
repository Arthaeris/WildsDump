// parser.js
// WildsDump parser for appended MH Wilds .txt dumps

const WILDS_SECTION_SEPARATOR =
  "================================================================================";

function parseWildsDump(rawText, language = "en") {
  const text = String(rawText || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const sections = [];

  const sectionRegex =
    /(?:^|\n)={80}\nTITLE:[\s\S]*?(?=\n={80}\nTITLE:|$)/g;

  const matches = text.match(sectionRegex) || [];

  for (const block of matches) {
    const parsed = parseWildsSection(block, language);

    if (parsed) {
      sections.push(parsed);
    }
  }

  return sections;
}

/* ---------------------------------------------------------
   Monster Hunter Rise (rise_en_dump.txt / rise_jp_dump.txt)
   Rise files are recognized by their ".msg.539100710" version
   and categorized by the game folder in their SOURCE PATH.
   --------------------------------------------------------- */

function isRiseFile(filename) {
  return /\.msg\.539100710\.txt$/i.test(String(filename || ""));
}

// Sunbreak followers, named in ServantProfile_MR (Name_ServantId001_MR…).
const RISE_FOLLOWER_NAMES = {
  "001": "Fiorayne",
  "002": "Galleus",
  "003": "Luchika",
  "004": "Arlow",
  "005": "Jae",
  "006": "Rondine",
  "007": "Fugen",
  "008": "Hinoa",
  "009": "Minoto",
  "010": "Utsushi"
};

// NPC dialogue files are only numbered (nid001, nid001_MR, nid001_chat…),
// so they're shown as "NPC 001" until real names are mapped.
function getRiseSpeaker(fileKey) {
  const key = String(fileKey || "").toLowerCase();

  const npc = key.match(/^nid(\d+)/);
  if (npc) return `NPC ${npc[1].padStart(3, "0")}`;

  const follower = key.match(/^sid(\d+)_/);
  if (follower) {
    const id = follower[1].padStart(3, "0");
    return RISE_FOLLOWER_NAMES[id] || `Follower ${id}`;
  }

  return "";
}

function getRiseCategory(fileKey, sourcePath) {
  const key = String(fileKey || "").toLowerCase();

  // Folder inside the game's message data, e.g. "Message/Quest".
  const folder = String(sourcePath || "")
    .replace(/^[a-z]{2}\//i, "")
    .split("/")
    .slice(0, -1)
    .join("/")
    .toLowerCase();

  if (folder.startsWith("message npc")) return "Dialogues";
  if (folder === "message/event") return "Dialogues";

  if (folder === "message/servant") {
    if (key.startsWith("servantprofile")) return "NPCs";
    if (key.startsWith("servantstatus")) return "UI";
    return "Dialogues";
  }

  if (folder === "message/quest") return "Quests";
  if (folder.startsWith("message/tag")) return "Monsters";

  if (folder.startsWith("message/hunternote")) {
    if (key.startsWith("hn_monsterlist")) return "Monsters";
    if (key.startsWith("environmentcreature")) return "References";
    return "Tutorials";
  }

  if (folder === "message/guildcard") return "References";
  if (folder === "message/dlc") return "References";

  // Facilities, menus, system, network, trial and PC version text.
  return "UI";
}

/* ---------------------------------------------------------
   Monster Hunter World (world_en_dump.txt / world_jp_dump.txt)
   World files are recognized by their ".gmd" extension and
   categorized by file name and by the game folder in their
   SOURCE PATH.
   --------------------------------------------------------- */

function isWorldFile(filename) {
  return /\.gmd\.txt$/i.test(String(filename || "")) || /\.gmd$/i.test(String(filename || ""));
}

// NPC names from World's chr_names file (N002_NPC_NAME = "The Handler"…),
// for the NPC dialogue files npc002 etc. Titles shared by several
// characters get their number added so each keeps their own dialogue.
const WORLD_NPC_NAMES = {
  "001": "Commander",
  "002": "The Handler",
  "003": "Field Team Leader",
  "004": "Provisions Manager",
  "005": "Analytics Director",
  "006": "Tech Chief",
  "007": "Provisions Stockpile",
  "009": "Chief Ecologist",
  "010": "Chief Botanist",
  "011": "Elder Melder",
  "012": "Second Fleet Master",
  "014": "Armory",
  "015": "Meowscular Chef",
  "016": "Housekeeper (016)",
  "017": "The Huntsman",
  "018": "The Tracker",
  "019": "Admiral",
  "020": "The Seeker",
  "021": "Third Fleet Master",
  "022": "Third Fleet Provisions",
  "023": "Lynian Expert",
  "024": "First Wyverian (024)",
  "025": "Excitable A-Lister",
  "026": "Serious Handler",
  "032": "Captain",
  "033": "Housekeeper (033)",
  "034": "Housekeeper (034)",
  "035": "Housekeeper (035)",
  "036": "First Wyverian (036)",
  "037": "Piscine Researcher",
  "038": "Endemic Life Researcher",
  "039": "Lynian Researcher",
  "040": "First Wyverian (040)",
  "102": "Feisty Fiver",
  "103": "Gentle Fourth",
  "104": "Eager Fourth",
  "105": "Cool Fiver",
  "106": "Fun Fourth",
  "107": "Forceful Fiver",
  "108": "Timid Fiver",
  "109": "Sisterly Fourth",
  "111": "Research Hunter",
  "112": "Smart Biologist",
  "113": "Impatient Biologist",
  "114": "Laid-back Botanist",
  "116": "Fiver Bro",
  "117": "Soup Felyne",
  "118": "Oven Felyne",
  "121": "Softspoken Fourth",
  "123": "Hotblooded Fourth",
  "124": "Easygoing Fiver",
  "125": "Airship Engineer",
  "130": "Cheerful Scholar",
  "131": "Shy Scholar",
  "134": "Event Manager (134)",
  "170": "Geralt of Rivia",
  "251": "Apple Enthusiast",
  "252": "Engaged Fiver",
  "253": "Fish Aficionado",
  "254": "Hide Expert",
  "255": "Occupied Fiver",
  "256": "Busy Fiver",
  "257": "Commission Member (257)",
  "258": "Commission Member (258)",
  "259": "Third Fleet Felyne",
  "301": "Hub Lass",
  "302": "Arena Lass",
  "303": "Hub Provisions",
  "304": "Event Manager (304)",
  "305": "Hopeful Felyne",
  "307": "Feeder Felyne",
  "610": "Smithy Apprentice",
  "701": "Grammeowster Chef",
  "702": "Seliana Stockpiler",
  "703": "Seliana Melder",
  "704": "Seliana Sailor",
  "706": "Seliana Armory",
  "707": "Housekeeper (707)",
  "708": "Pub Event Manager",
  "709": "Pub Arena Manager",
  "710": "Pub Lass",
  "711": "Pub Stockpiler",
  "712": "Tundra Wyverian",
  "713": "Pub Resource Manager",
  "714": "Pub Sailor",
  "715": "Housekeeper (715)",
  "730": "Helpful Felyne",
  "731": "Busybody Felyne",
  "732": "Busybody Fiver",
  "741": "Ambitious Fourth",
  "743": "Reliable Fiver",
  "749": "Studious Biologist",
  "754": "Dual-blading Hunter",
  "755": "Felyne Server",
  "756": "Felyne Waiter",
  "757": "Bowgunner Hunter",
  "758": "Commission Member (758)",
  "759": "Foot Soaking Fiver",
  "760": "Soaker Dude",
  "761": "Bathing Bambina",
  "762": "Lone Soaker",
  "763": "Sauna Dude",
  "764": "Motivated Fourth",
  "765": "Curious Fiver",
  "766": "Fussy Fourth",
  "767": "Overzealous Fifth",
  "781": "Young Smithy",
  "782": "Vice Chief Ecologist",
  "785": "General",
  "792": "Smithy Vendor",
  "793": "Third Fleet Resources"
};

function getWorldFolder(sourcePath) {
  // "en/text (common)/steam/item_eng.gmd" -> "text (common)/steam"
  return String(sourcePath || "")
    .replace(/^[a-z]{2}\//i, "")
    .split("/")
    .slice(0, -1)
    .join("/")
    .toLowerCase();
}

// NPC and cutscene files sit in numbered subfolders ("text (npc)/text (108)").
function isInWorldFolder(sourcePath, folder) {
  const path = getWorldFolder(sourcePath);
  return path === folder || path.startsWith(`${folder}/`);
}

function getWorldSpeaker(fileKey, sourcePath) {
  if (!isInWorldFolder(sourcePath, "text (npc)")) return "";

  const npc = String(fileKey || "").toLowerCase().match(/^npc(\d+)$/);
  if (!npc) return "";

  const id = npc[1].padStart(3, "0");
  return WORLD_NPC_NAMES[id] || `NPC ${id}`;
}

const WORLD_CATEGORY_FILES = {
  Weapons: [
    "sword", "l_sword", "w_sword", "tachi", "hammer", "whistle", "lance",
    "g_lance", "s_axe", "c_axe", "rod", "rod_insect", "bow", "lbg", "hbg",
    "wep_series", "bowgun_parts", "insect_series", "customparts",
    "limit_break", "new_limit_break", "ew_limit_break"
  ],
  Equipment: [
    "armor", "armor_series", "charm", "deco", "slinger",
    "ot_armor", "ot_weapon", "ot_series", "ot_tool"
  ],
  Items: ["item", "food", "kitchen_menu"],
  Skills: ["skill", "skill_pt", "a_skill", "catskill", "music_skill"],
  Monsters: ["em_names", "em_info", "em_parts", "captureem"],
  NPCs: ["chr_names", "cat_names"],
  Quests: [
    "l_quest", "l_mission", "l_delivery", "l_orders", "ot_quest",
    "bounty_support", "storytarget"
  ],
  Tutorials: [
    "tutorial", "tutorial_button", "tutorial_fsm", "tutorial_que",
    "panel_tutorial", "panel_tutorial_cat", "panel_tutorial_ex",
    "loadtips", "loadtipscategory", "loadtipssubcategory", "loadstory",
    "cm_help_text", "cm_help_text_ara", "cm_facility_tutorial",
    "weapontutorial", "buttonguide"
  ],
  Dialogues: ["photo_npc_talk_text"],
  References: [
    "animal_names", "ec_info", "gmk_names", "other_names",
    "title_news", "topicmessage", "cm_dlc_category", "cm_dlc_product",
    "dlc_common", "dlc_consume_data", "dlc_package_data", "dlc_package_header"
  ]
};

function getWorldCategory(fileKey, sourcePath) {
  const key = String(fileKey || "").toLowerCase();
  const folder = getWorldFolder(sourcePath);

  // Dialogue: NPC files, cutscenes and talk boards, and quest conversations.
  if (isInWorldFolder(sourcePath, "text (npc)")) return "Dialogues";
  if (isInWorldFolder(sourcePath, "text (event)")) return "Dialogues";
  if (isInWorldFolder(sourcePath, "text (quest)")) {
    return /^q\d/.test(key) ? "Quests" : "Dialogues";
  }

  // Quest names, objectives and descriptions (q00851…).
  if (folder === "text (common)/quest") return "Quests";

  // Tracks and traces (tr_em… are monster tracks).
  if (folder === "text (common)/trace") {
    return key.startsWith("tr_em") ? "Monsters" : "References";
  }

  for (const [category, keys] of Object.entries(WORLD_CATEGORY_FILES)) {
    if (keys.includes(key)) return category;
  }

  if (/^ou_/.test(key)) return "Weapons";             // layered weapon names
  if (/^ot_s_auto/.test(key)) return "Dialogues";     // Palico chatter
  if (/^gc_/.test(key)) return "References";          // Guild Card titles, poses
  if (/^treasure_/.test(key)) return "References";

  // Menus, system messages, chat and other interface text.
  return "UI";
}

function isOldVersionFile(filename) {
  return /\s+\(\d+\)\.23\.txt$/i.test(String(filename || ""));
}

function parseWildsSection(block, language = "en") {
  const title = getHeaderValue(block, "TITLE");
  const sourcePath = getHeaderValue(block, "SOURCE PATH");
  const size = getHeaderValue(block, "SIZE");
  const modified = getHeaderValue(block, "MODIFIED");
  const hash = getHeaderValue(block, "HASH");

  if (!title && !sourcePath) return null;

  const versionMatch = String(title || sourcePath).match(/\s+\((\d+)\)\.23\.txt$/i);
  let isOldVersion = Boolean(versionMatch);
  let versionNumber = versionMatch ? Number(versionMatch[1]) : 0;

  // Monster Hunter World files ("item.gmd.txt", archived: "item (2).gmd.txt").
  const isWorld = isWorldFile(title || sourcePath);

  if (isWorld) {
    const worldVersion = String(title || sourcePath).match(/\s+\((\d+)\)\.gmd\.txt$/i);
    isOldVersion = Boolean(worldVersion);
    versionNumber = worldVersion ? Number(worldVersion[1]) : 0;
  }

  let body = "";

  const hashMatch = block.match(/^HASH:.*$/mi);

  if (hashMatch) {
    const afterHash = block.slice(hashMatch.index + hashMatch[0].length);
    const separatorIndex = afterHash.indexOf(WILDS_SECTION_SEPARATOR);

    body =
      separatorIndex !== -1
        ? afterHash.slice(separatorIndex + WILDS_SECTION_SEPARATOR.length).trim()
        : afterHash.trim();
  }

  const strings = parseWildsStrings(body);

  const fileKey = normalizeWildsFileKey(title || sourcePath);
  const family = getWildsFileFamily(fileKey);
  let category = getWildsCategory(fileKey, family);
  const dialogueInfo = getWildsDialogueInfo(fileKey, strings);

  // Files named "NPC### (Name).txt" (currently only in 4u_dump.txt) carry
  // their display name right in the filename. Surface that name and treat
  // the file as dialogue, without touching dialogueId/NPC_MAP, which are
  // Wilds-specific.
  const npcParenMatch = String(title || "").match(/^NPC\d+\s*\(([^)]+)\)/i);
  let displayName = npcParenMatch ? npcParenMatch[1].trim() : "";

  let isDialogue = dialogueInfo.isDialogue;

  if (displayName) {
    category = "Dialogues";
    isDialogue = true;
  }

  // Monster Hunter World files get their own categories and speakers.
  if (isWorld) {
    category = getWorldCategory(fileKey, sourcePath);

    const speaker = getWorldSpeaker(fileKey, sourcePath);

    if (speaker) {
      displayName = speaker;
      isDialogue = true;
    }
  }

  // Monster Hunter Rise files get their own categories and speakers.
  if (isRiseFile(title || sourcePath)) {
    category = getRiseCategory(fileKey, sourcePath);

    const speaker = getRiseSpeaker(fileKey);

    if (speaker) {
      displayName = speaker;
      isDialogue = true;
    }
  }

  return {
    language,
    title,
    sourcePath,
    fileKey,
    family,
    category,
    size,
    modified,
    hash,
    strings,
    rawBody: body,

    isOldVersion,
    versionNumber,

    displayName,

    dialogueId: dialogueInfo.dialogueId,
    dialogueType: dialogueInfo.dialogueType,
    dialogueFamily: dialogueInfo.dialogueFamily,
    rejectedIds: dialogueInfo.rejectedIds,
    isDialogue,

    ...(isWorld ? { game: "world" } : {})
  };
}

function getHeaderValue(block, label) {
  const regex = new RegExp(`^${label}:\\s*(.*?)\\s*$`, "mi");
  const match = String(block || "").match(regex);
  return match ? match[1].trim() : "";
}

function parseWildsStrings(body) {
  const lines = String(body || "").split("\n");
  const entries = [];
  let visibleIndex = 0;
  let sawTaggedLine = false;

  lines.forEach((line, sourceIndex) => {
    if (!line.startsWith("<string>")) return;

    sawTaggedLine = true;

    const raw = line.replace(/^<string>/, "");
    const rejectedId = extractRejectedId(raw);
    const text = cleanWildsText(raw);

    if (isInternalDialogueLabel(text, rejectedId)) {
      return;
    }

    entries.push({
      index: sourceIndex,
      id: String(visibleIndex).padStart(4, "0"),
      raw,
      text,
      rejectedId,
      isRejected: Boolean(rejectedId)
    });

    visibleIndex++;
  });

  // Some dumps (e.g. 4u_dump.txt) don't use the <string>-per-line format at
  // all -- they're plain paragraph text separated by blank lines. Only kick
  // in when a section had zero tagged lines, so gu/tri/wilds dumps (which
  // always use <string> tags) are completely unaffected.
  if (!sawTaggedLine) {
    return parseWildsPlainParagraphs(body);
  }

  return entries;
}

function parseWildsPlainParagraphs(body) {
  const normalized = String(body || "").trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);

  return paragraphs.map((paragraph, index) => ({
    index,
    id: String(index).padStart(4, "0"),
    raw: paragraph,
    text: paragraph,
    rejectedId: "",
    isRejected: false
  }));
}

function isInternalDialogueLabel(text, rejectedId) {
  const cleanText = String(text || "").trim();
  const cleanId = String(rejectedId || "").trim();

  if (!cleanText || !cleanId) return false;

  return cleanText === cleanId;
}

function cleanWildsText(value) {
  return String(value || "")
    .replace(/<COLOR[^>]*>#Rejected#<\/COLOR>\s*/gi, "")
    .replace(/<lf>/gi, "\n")
    .replace(/<PLNAME>/g, "{Player}")
    .replace(/<LSNR\s+\{([^}]+)\}\{([^}]+)\}>/g, "{$1/$2}")
    .trim();
}

function extractRejectedId(value) {
  const match = String(value || "").match(
    /#Rejected#<\/COLOR>\s*([A-Za-z0-9_]+(?:_[A-Za-z0-9]+)*)/i
  );

  return match ? match[1].trim() : "";
}

function normalizeWildsFileKey(filename) {
  return String(filename || "")
    .split("/")
    .pop()
    .replace(/\.txt$/i, "")
    .replace(/\s+\(\d+\)(?=\.23$)/i, "")
    .replace(/\.23$/i, "")
    .replace(/\.539100710$/i, "") // Monster Hunter Rise file version
    .replace(/\.gmd$/i, "") // Monster Hunter World text file
    .replace(/\.msg$/i, "")
    .replace(/\s+\(\d+\)$/i, "")
    .toLowerCase()
    .trim();
}

function getWildsFileFamily(fileKey) {
  const key = String(fileKey || "").toLowerCase();

  if (/^dia_npc\d+_\d+_\d+_/.test(key)) return "dia_npc";
  if (/^dia_npcgossip_/.test(key)) return "dia_npcgossip";
  if (/^dia_stch/.test(key)) return "dia_stch";
  if (/^dia_otomo/.test(key)) return "dia_otomo";
  if (/^dia_pl/.test(key)) return "dia_pl";
  if (/^dia_trial/.test(key)) return "dia_trial";
  if (/^npcname/.test(key)) return "npcname";
  if (/^npccryptoname/.test(key)) return "npccryptoname";

  const namedFamily = key.match(/^([a-z][a-z0-9_]*?)(?:_\d+)?$/i);
  if (namedFamily) return namedFamily[1];

  if (/^\d+-\d+$/.test(key)) return "numeric";

  return key || "unknown";
}

function getWildsDialogueInfo(fileKey, strings = []) {
  const key = String(fileKey || "").toLowerCase();

  const rejectedIds = strings
    .map(entry => entry.rejectedId)
    .filter(Boolean);

  let dialogueId = "";
  let dialogueType = "";
  let dialogueFamily = "";
  let isDialogue = false;

  const npcMatch = key.match(/^(dia_npc\d+_\d+_\d+)_(.+)$/i);

  if (npcMatch) {
    dialogueFamily = "dia_npc";
    dialogueId = npcMatch[1]
      .replace(/^dia_/i, "")
      .toUpperCase();
    dialogueType = npcMatch[2];
    isDialogue = true;
  }

  const gossipMatch = key.match(/^(dia_npcgossip)_(.+)$/i);

  if (gossipMatch) {
    dialogueFamily = "dia_npcgossip";
    dialogueId = gossipMatch[2].toUpperCase();
    dialogueType = "gossip";
    isDialogue = true;
  }

  const storyMatch = key.match(/^(dia_stch.+)$/i);

  if (storyMatch) {
    dialogueFamily = "dia_stch";
    dialogueId = storyMatch[1].toUpperCase();
    dialogueType = "story";
    isDialogue = true;
  }

  if (/^dia_otomo/i.test(key)) {
    dialogueFamily = "dia_otomo";
    dialogueId = key.toUpperCase();
    dialogueType = "palico";
    isDialogue = true;
  }

  if (/^dia_pl/i.test(key)) {
    dialogueFamily = "dia_pl";
    dialogueId = key.toUpperCase();
    dialogueType = "player";
    isDialogue = true;
  }

  if (!isDialogue && rejectedIds.length) {
    const first = rejectedIds[0];

    if (/^Dia_NPC\d+_\d+_\d+/i.test(first)) {
      const match = first.match(/Dia_(NPC\d+_\d+_\d+)_([^_]+)/i);
      dialogueFamily = "dia_npc";
      dialogueId = match ? match[1].toUpperCase() : "";
      dialogueType = match ? match[2].toLowerCase() : "";
      isDialogue = true;
    } else if (/^Dia_NpcGossip/i.test(first)) {
      dialogueFamily = "dia_npcgossip";
      dialogueId = first;
      dialogueType = "gossip";
      isDialogue = true;
    } else if (/^Dia_stCh/i.test(first)) {
      dialogueFamily = "dia_stch";
      dialogueId = first;
      dialogueType = "story";
      isDialogue = true;
    }
  }

  return {
    dialogueId,
    dialogueType,
    dialogueFamily,
    rejectedIds,
    isDialogue
  };
}

function getWildsCategory(fileKey, family) {
  const key = String(fileKey || "").toLowerCase();
  const fam = String(family || "").toLowerCase();

  if (fam.startsWith("dia_")) return "Dialogues";
  if (fam === "npcname" || fam === "npccryptoname" || fam === "npc") return "NPCs";

  if ([
    "greatsword",
    "longsword",
    "sword",
    "shortsword",
    "twinsword",
    "tachi",
    "hammer",
    "whistle",
    "lance",
    "gunlance",
    "slashaxe",
    "chargeaxe",
    "rod",
    "rodinsect",
    "bow",
    "heavybowgun",
    "lightbowgun",
    "weaponintroduction",
    "weaponseries",
    "weapontutorial"
  ].includes(fam)) {
    return "Weapons";
  }

  if ([
    "armor",
    "armorseries",
    "outerarmor",
    "otomoarmor",
    "otomoequipseries",
    "otomoouterarmor",
    "otomoweapon",
    "otarmordata",
    "otweapondata",
    "accessory",
    "accessorydata",
    "amulet",
    "charm",
    "artianbonus",
    "artianparts",
    "artianperformance",
    "seikretequip"
  ].includes(fam)) {
    return "Equipment";
  }

  if (fam.includes("skill")) return "Skills";
  if (fam === "item" || fam.includes("item")) return "Items";
  if (fam.startsWith("enemy")) return "Monsters";
  if (fam === "mission" || fam === "bounty" || fam === "free") return "Quests";
  if (fam.includes("tutorial") || fam === "tips") return "Tutorials";
  if (fam.startsWith("ref")) return "References";
  if (fam.includes("gui") || fam === "showtext" || fam === "manual") return "UI";
  if (fam === "chatlog" || fam === "gesture" || fam === "pose" || fam === "stamp" || fam === "nameplate") return "Social";
  if (fam === "facility" || fam === "meallobby") return "Facilities";
  if (fam === "staffroll" || fam === "trophyachievement" || fam === "medal") return "System";
  if (fam === "numeric") return "Unknown / Numeric";

  return titleCaseFamily(fam);
}

function titleCaseFamily(value) {
  return String(value || "Unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

const SIMPLE_NAME_TEXT_PAIR_FILES = new Set([
  "amulet",
  "armor",
  "mealskill",
  "facility",
  "paneltutorial",

  // MHGU (GUDump) Palico equipment
  "otarmordata",
  "otweapondata",

  "whistle",
  "twinsword",
  "tachi",
  "slashaxe",
  "shortsword",
  "longsword",
  "rod",
  "lightbowgun",
  "lance",
  "heavybowgun",
  "hammer",
  "gunlance",
  "chargeaxe",
  "bow",
  
  "item"
]);

const REVERSED_NAME_TEXT_PAIR_FILES = new Set([
  "otomoarmor"
]);

function buildWildsEntries(sections, npcMap = {}) {
  const entries = [];

  for (const section of sections) {
    // Monster Hunter World files share names like "item", "armor", "skill"
    // or "bow" with Wilds files but have a different layout, so the
    // Wilds-specific handling below is skipped for them: each World line
    // becomes its own entry.
    const useWildsFileRules = section.game !== "world";

    if (useWildsFileRules) {
    if (section.fileKey === "enemytext") {
  entries.push(...buildEnemyTextEntries(section));
  continue;
}
    
    if (section.fileKey === "accessory") {
  entries.push(...buildAccessoryEntries(section));
  continue;
}

if (section.fileKey === "skill") {
  continue;
}

if (section.fileKey === "armorseries") {
  continue;
}

if (section.fileKey === "skillcommon") {
  entries.push(...buildSkillCommonEntries(section));
  continue;
}

if (REVERSED_NAME_TEXT_PAIR_FILES.has(section.fileKey)) {
  entries.push(...buildReversedNameTextPairEntries(section));
  continue;
}

if (SIMPLE_NAME_TEXT_PAIR_FILES.has(section.fileKey)) {
  entries.push(...buildSimpleNameTextPairEntries(section));
  continue;
}
    }

    for (const item of section.strings) {
      if (!item.raw && !item.text) continue;

      const name =
        section.displayName ||
        (section.dialogueId && npcMap[section.dialogueId]
          ? npcMap[section.dialogueId]
          : "");

      entries.push({
        uid: `${section.fileKey}:${item.id}`,
        language: section.language,
        id: item.id,
        sourceFile: section.title,
        sourcePath: section.sourcePath,
        fileKey: section.fileKey,
        family: section.family,
        category: section.category,

        dialogueId: section.dialogueId,
        dialogueType: section.dialogueType,
        dialogueFamily: section.dialogueFamily,
        speaker: name,
        isDialogue: section.isDialogue,

        rejectedId: item.rejectedId,
        isRejected: item.isRejected,

        raw: item.raw,
        text: item.text
      });
    }
  }

  return entries;
}

function buildEnemyTextEntries(section) {
  if (typeof ENEMY_TEXT_ID_MAP === "undefined") {
    return section.strings.map(item => makeNormalWildsEntry(section, item, ""));
  }

  const byMonster = new Map();

  for (const item of section.strings) {
    const id = String(item.id).padStart(4, "0");
    const monster = ENEMY_TEXT_ID_MAP[id];

    if (!monster) continue;

    if (!byMonster.has(monster)) {
      byMonster.set(monster, []);
    }

    byMonster.get(monster).push(item);
  }

  const entries = [];

  for (const [monster, items] of byMonster.entries()) {
    entries.push(makeMergedEnemyTextEntry({
      section,
      monster,
      items
    }));
  }

  return entries;
}

function getEnemyTextGroupName(label) {
  return String(label || "")
    .replace(/^Arch-tempered\s+/i, "")
    .replace(/^Tempered\s+/i, "")
    .replace(/^Frenzied\s+/i, "")
    .trim();
}

function makeMergedEnemyTextEntry({ section, monster, items }) {
  const sorted = [...items].sort((a, b) => Number(a.id) - Number(b.id));

  const ids = sorted.map(item => String(item.id).padStart(4, "0"));
  const startId = ids[0] || "0000";
  const endId = ids[ids.length - 1] || startId;

  const nameLines = [];
  const bodyLines = [];

  for (const item of sorted) {
    const id = String(item.id).padStart(4, "0");
    const text = item.text || item.raw || "";

    if (!text.trim()) continue;

    if (text.trim() === monster || /^Tempered\s+/i.test(text) || /^Frenzied\s+/i.test(text) || /^Arch-tempered\s+/i.test(text)) {
      if (!nameLines.includes(text.trim())) {
        nameLines.push(text.trim());
      }
      continue;
    }

    bodyLines.push(`[${id}] ${text}`);
  }

  const variants = nameLines.filter(name => name !== monster);

  const textParts = [];

  if (variants.length) {
    textParts.push(`Variants:\n${variants.join("\n")}`);
  }

  if (bodyLines.length) {
    textParts.push(bodyLines.join("\n\n"));
  }

  return {
    uid: `${section.fileKey}:${startId}`,
    language: section.language,
    id: ids.length > 1 ? `${startId}–${endId}` : startId,
    sourceFile: section.title,
    sourcePath: section.sourcePath,
    fileKey: section.fileKey,
    family: section.family,
    category: "Monsters",

    dialogueId: "",
    dialogueType: "",
    dialogueFamily: "",
    speaker: "",
    isDialogue: false,

    rejectedId: "",
    isRejected: false,

    name: monster,
    raw: textParts.join("\n\n"),
    text: textParts.join("\n\n")
  };
}

function makeNormalWildsEntry(section, item, name = "") {
  return {
    uid: `${section.fileKey}:${item.id}`,
    language: section.language,
    id: item.id,
    sourceFile: section.title,
    sourcePath: section.sourcePath,
    fileKey: section.fileKey,
    family: section.family,
    category: section.category,

    dialogueId: section.dialogueId,
    dialogueType: section.dialogueType,
    dialogueFamily: section.dialogueFamily,
    speaker: name,
    isDialogue: section.isDialogue,

    rejectedId: item.rejectedId,
    isRejected: item.isRejected,

    raw: item.raw,
    text: item.text
  };
}

function buildAccessoryEntries(section) {
  const entries = [];
  const byNumber = new Map();

  for (const item of section.strings) {
    byNumber.set(Number(item.id), item);
  }

  for (let id = 0; id <= 525; id += 2) {
    const desc = byNumber.get(id);
    const name = byNumber.get(id + 1);

    if (!desc && !name) continue;

    entries.push(makeMergedAccessoryEntry(section, id, name, desc));
  }

  const maxId = Math.max(...[...byNumber.keys()]);

  for (let id = 526; id <= maxId; id += 2) {
    const name = byNumber.get(id);
    const desc = byNumber.get(id + 1);

    if (!desc && !name) continue;

    entries.push(makeMergedAccessoryEntry(section, id, name, desc));
  }

  return entries;
}

function buildSkillCommonEntries(section) {
  return buildSimpleNameTextPairEntries(section);
}

function buildReversedNameTextPairEntries(section) {
  const entries = [];
  const byNumber = new Map();

  for (const item of section.strings) {
    byNumber.set(Number(item.id), item);
  }

  const maxId = Math.max(...byNumber.keys());

  for (let id = 0; id <= maxId; id += 2) {
    const desc = byNumber.get(id);
    const name = byNumber.get(id + 1);

    if (!name && !desc) continue;

    entries.push(makeMergedNameTextEntry(section, id, name, desc));
  }

  return entries;
}

function buildSimpleNameTextPairEntries(section) {
  const entries = [];
  const byNumber = new Map();

  for (const item of section.strings) {
    byNumber.set(Number(item.id), item);
  }

  const maxId = Math.max(...[...byNumber.keys()]);

  for (let id = 0; id <= maxId; id += 2) {
    const name = byNumber.get(id);
    const desc = byNumber.get(id + 1);

    if (!name && !desc) continue;

    entries.push(makeMergedNameTextEntry(section, id, name, desc));
  }

  return entries;
}

function makeMergedNameTextEntry(section, id, nameItem, descItem) {
  const name = nameItem?.text || "";
  const desc = descItem?.text || "";

  return {
    uid: `${section.fileKey}:${String(id).padStart(4, "0")}`,
    language: section.language,
    id: `${String(id).padStart(4, "0")} + ${String(id + 1).padStart(4, "0")}`,
    sourceFile: section.title,
    sourcePath: section.sourcePath,
    fileKey: section.fileKey,
    family: section.family,
    category: section.category,

    dialogueId: "",
    dialogueType: "",
    dialogueFamily: "",
    speaker: "",
    isDialogue: false,

    rejectedId: "",
    isRejected: false,

    name,
    raw: desc,
    text: desc
  };
}

function makeMergedAccessoryEntry(section, id, nameItem, descItem) {
  const name = nameItem?.text || "";
  const desc = descItem?.text || "";

  return {
    uid: `${section.fileKey}:${String(id).padStart(4, "0")}`,
    language: section.language,
    id: `${String(id).padStart(4, "0")} + ${String(id + 1).padStart(4, "0")}`,
    sourceFile: section.title,
    sourcePath: section.sourcePath,
    fileKey: section.fileKey,
    family: section.family,
    category: section.category,

    dialogueId: "",
    dialogueType: "",
    dialogueFamily: "",
    speaker: "",
    isDialogue: false,

    rejectedId: "",
    isRejected: false,

    name,
    raw: desc,
    text: desc
  };
}

function groupWildsDialogues(entries) {
  const groups = new Map();

  for (const entry of entries) {
    if (!entry.isDialogue) continue;

    const key =
      entry.dialogueId ||
      entry.rejectedId ||
      entry.fileKey;

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(entry);
  }

  return groups;
}
