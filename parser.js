// parser.js
// WildsDump parser for appended Monster Hunter Wilds .txt dumps

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

  if (isOldVersionFile(title || sourcePath)) return null;

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
  const category = getWildsCategory(fileKey, family);
  const dialogueInfo = getWildsDialogueInfo(fileKey, strings);

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

    dialogueId: dialogueInfo.dialogueId,
    dialogueType: dialogueInfo.dialogueType,
    dialogueFamily: dialogueInfo.dialogueFamily,
    rejectedIds: dialogueInfo.rejectedIds,
    isDialogue: dialogueInfo.isDialogue
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

  lines.forEach((line, sourceIndex) => {
    if (!line.startsWith("<string>")) return;

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

  return entries;
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
    .replace(/\.23$/i, "")
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

function buildWildsEntries(sections, npcMap = {}) {
  const entries = [];

  for (const section of sections) {
    if (section.fileKey === "accessory") {
      entries.push(...buildAccessoryEntries(section));
      continue;
    }

    for (const item of section.strings) {
      if (!item.raw && !item.text) continue;

      const name =
        section.dialogueId && npcMap[section.dialogueId]
          ? npcMap[section.dialogueId]
          : "";

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
