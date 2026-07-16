// details.js
// Entity detail pages, monster size comparison and weapon tree rendering.

const detailView = document.querySelector("#detailView");
const detailTitle = document.querySelector("#detailTitle");
const detailContent = document.querySelector("#detailContent");

const sizeView = document.querySelector("#sizeView");
const sizeList = document.querySelector("#sizeList");

let currentDetail = null;

const DETAIL_TYPE_LABELS = {
  monster: "Monster",
  monsterText: "Monster",
  item: "Item",
  skill: "Skill",
  weapon: "Weapon",
  armorset: "Armor Set",
  armorpiece: "Armor Piece",
  accessory: "Decoration"
};

function openJsonPanels(html) {
  return String(html || "").replaceAll(
    '<details class="json-panel',
    '<details open class="json-panel'
  );
}

function detailSectionTitle(text) {
  return `<h3 class="detail-section-title">${escapeHtml(text)}</h3>`;
}

function detailCard(inner) {
  return `<article class="entry detail-card">${inner}</article>`;
}

function pillRowHtml(links) {
  if (!links.length) return "";
  return `<div class="pill-row">${links.join("")}</div>`;
}

function entityPill(type, key, label, suffix = "") {
  return `<span class="data-pill entity-pill">${entityLinkHtml(type, key, label)}${
    suffix ? `<small>${escapeHtml(suffix)}</small>` : ""
  }</span>`;
}

// --- entity resolution ------------------------------------------------------

function findDumpEntriesByName(name, preferredCategory = "") {
  const needle = String(name || "").toLowerCase();
  if (!needle) return [];

  const matches = entries.filter(
    entry => String(entry.name || "").toLowerCase() === needle
  );

  if (preferredCategory) {
    matches.sort((a, b) => {
      const aPref = a.category === preferredCategory ? 0 : 1;
      const bPref = b.category === preferredCategory ? 0 : 1;
      return aPref - bPref;
    });
  }

  return matches;
}

function makeFakeDetailEntry(name, categoryLabel, jsonFields) {
  return {
    uid: `detail:${name}`,
    id: "",
    name,
    raw: "",
    text: "",
    nameJp: "",
    rawJp: "",
    textJp: "",
    fileKey: "",
    family: "",
    category: categoryLabel,
    sourceFile: "",
    isDialogue: false,
    isRejected: false,
    rejectedId: "",
    dialogueId: "",
    dialogueType: "",
    ...jsonFields
  };
}

// --- main entry point -------------------------------------------------------

function showEntityDetail(type, key, addToHistory = true) {
  if (type === "npc") {
    showDialogueByDisplayName(String(key));
    return;
  }

  if (addToHistory) {
    pushViewHistory(captureCurrentView());
  }

  currentDetail = { type: String(type), key: String(key) };

  let model = null;

  try {
    model = resolveEntityDetail(String(type), String(key));
  } catch (error) {
    console.error(error);
  }

  if (!model) {
    detailTitle.textContent = "Not found";
    detailContent.innerHTML = `<div class="empty">No data found for this entry.</div>`;
    showOnly(detailView);
    closeMenu();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  detailTitle.textContent = model.title;

  const shownUids = new Set((model.primaryEntries || []).map(entry => entry.uid));

  const primaryHtml = (model.primaryEntries || [])
    .slice(0, 3)
    .map(entry => openJsonPanels(renderEntry(entry)))
    .join("");

  const mentions = findMentionEntries(model.mentionName, shownUids);

  detailContent.innerHTML = `
    <div class="detail-meta">
      <span class="tag-badge">${escapeHtml(DETAIL_TYPE_LABELS[type] || type)}</span>
      ${model.subtitle ? `<span class="detail-subtitle">${escapeHtml(model.subtitle)}</span>` : ""}
      ${model.headerExtra || ""}
    </div>

    ${primaryHtml}
    ${model.sectionsHtml || ""}

    ${
      model.mentionName
        ? `
          ${detailSectionTitle(`Mentions in game text (${mentions.length})`)}
          <section id="detailMentions" class="results"></section>
        `
        : ""
    }
  `;

  if (model.mentionName) {
    currentHighlightTerms = [model.mentionName];

    renderEntryList({
      target: detailContent.querySelector("#detailMentions"),
      items: mentions,
      emptyText: "No mentions found."
    });
  }

  showOnly(detailView);
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function findMentionEntries(name, excludeUids = new Set()) {
  const needle = String(name || "").toLowerCase();
  if (needle.length < 3) return [];

  const matches = [];

  for (const entry of entries) {
    if (excludeUids.has(entry.uid)) continue;
    if (!entry.searchTextLower.includes(needle)) continue;
    matches.push(entry);
  }

  matches.sort((a, b) => {
    const aDia = a.isDialogue ? 0 : 1;
    const bDia = b.isDialogue ? 0 : 1;
    return aDia - bDia;
  });

  return matches;
}

function resolveEntityDetail(type, key) {
  if (type === "item") return resolveItemDetail(key);
  if (type === "skill") return resolveSkillDetail(key);
  if (type === "monster") return resolveMonsterDetail(key);
  if (type === "monsterText") return resolveMonsterTextDetail(key);
  if (type === "weapon") return resolveWeaponDetail(key);
  if (type === "armorset") return resolveArmorSetDetail(key);
  if (type === "armorpiece") return resolveArmorPieceDetail(key);
  if (type === "accessory") return resolveAccessoryDetail(key);
  return null;
}

// --- item -------------------------------------------------------------------

function resolveItemDetail(key) {
  const item = JSON_INDEX.itemByGameId.get(String(key));
  if (!item) return null;

  const name = getJsonName(item, "en");
  const primaryEntries = findDumpEntriesByName(name, "Items");

  if (!primaryEntries.length) {
    primaryEntries.push(
      attachJsonMetadata(addSearchFieldsSafe(makeFakeDetailEntry(name, "Items", {})))
    );
  }

  const sections = [];

  // Dropped by which monsters
  const sources = REVERSE_INDEX.itemSources.get(String(item.game_id)) || [];

  if (sources.length) {
    const byMonster = new Map();

    for (const source of sources) {
      const monsterName = getJsonName(source.monster, "en");

      if (!byMonster.has(monsterName)) {
        byMonster.set(monsterName, { monster: source.monster, drops: [] });
      }

      byMonster.get(monsterName).drops.push(source);
    }

    const rows = [...byMonster.values()].map(({ monster, drops }) => {
      const dropText = drops
        .map(drop =>
          `${titleCaseFamily(drop.kind)} (${titleCaseFamily(drop.rank)}) ${drop.chance}%`
        )
        .join(" · ");

      return `
        <div class="source-row">
          ${entityLinkHtml("monster", monster.game_id, getJsonName(monster, "en"))}
          <small>${escapeHtml(dropText)}</small>
        </div>
      `;
    });

    sections.push(
      detailSectionTitle("Dropped by"),
      detailCard(rows.join(""))
    );
  }

  // Used in
  const usage = REVERSE_INDEX.itemUsage.get(String(item.game_id));

  if (usage) {
    const blocks = [];

    if (usage.weapons.length) {
      blocks.push(`
        <div class="json-block">
          <span>Weapons (${usage.weapons.length})</span>
          ${pillRowHtml(usage.weapons.map(weapon =>
            entityPill(
              "weapon",
              `${weapon.weapon_file}:${weapon.game_id}`,
              getJsonName(weapon, "en"),
              getWeaponTypeLabel(weapon.weapon_file)
            )
          ))}
        </div>
      `);
    }

    if (usage.armorPieces.length) {
      const seenSets = new Map();

      for (const { set } of usage.armorPieces) {
        seenSets.set(getJsonName(set, "en"), set);
      }

      blocks.push(`
        <div class="json-block">
          <span>Armor (${seenSets.size} sets)</span>
          ${pillRowHtml([...seenSets.entries()].map(([setName]) =>
            entityPill("armorset", setName.toLowerCase(), setName)
          ))}
        </div>
      `);
    }

    if (usage.craftsInto.length) {
      const seen = new Map();

      for (const crafted of usage.craftsInto) {
        seen.set(String(crafted.game_id), crafted);
      }

      blocks.push(`
        <div class="json-block">
          <span>Crafts into</span>
          ${pillRowHtml([...seen.values()].map(crafted =>
            entityPill("item", crafted.game_id, getJsonName(crafted, "en"))
          ))}
        </div>
      `);
    }

    if (usage.amuletRanks.length) {
      blocks.push(`
        <div class="json-block">
          <span>Charms</span>
          ${pillRowHtml(usage.amuletRanks.map(rank =>
            `<span class="data-pill">${escapeHtml(getJsonName(rank, "en") || "Charm")}</span>`
          ))}
        </div>
      `);
    }

    if (blocks.length) {
      sections.push(
        detailSectionTitle("Used in"),
        detailCard(blocks.join(""))
      );
    }
  }

  return {
    title: name,
    subtitle: getJsonName(item, "ja"),
    mentionName: name,
    primaryEntries,
    sectionsHtml: sections.join("")
  };
}

// --- skill ------------------------------------------------------------------

function resolveSkillDetail(key) {
  const skill = JSON_INDEX.skillByGameId.get(String(key));
  if (!skill) return null;

  const name = getJsonName(skill, "en");
  const primaryEntries = findDumpEntriesByName(name, "Skills");

  if (!primaryEntries.length) {
    primaryEntries.push(
      attachJsonMetadata(addSearchFieldsSafe(makeFakeDetailEntry(name, "Skills", {})))
    );
  }

  const sections = [];
  const sources = REVERSE_INDEX.skillSources.get(String(skill.game_id));

  if (sources) {
    const blocks = [];

    if (sources.accessories.length) {
      blocks.push(`
        <div class="json-block">
          <span>Decorations</span>
          ${pillRowHtml(sources.accessories.map(accessory =>
            entityPill("accessory", accessory.game_id, getJsonName(accessory, "en"))
          ))}
        </div>
      `);
    }

    if (sources.armorPieces.length) {
      blocks.push(`
        <div class="json-block">
          <span>Armor (${sources.armorPieces.length} pieces)</span>
          ${pillRowHtml(sources.armorPieces.map(({ piece, set }) =>
            entityPill(
              "armorpiece",
              getJsonName(piece, "en").toLowerCase(),
              getJsonName(piece, "en"),
              getJsonName(set, "en")
            )
          ))}
        </div>
      `);
    }

    if (sources.weapons.length) {
      blocks.push(`
        <div class="json-block">
          <span>Weapons (${sources.weapons.length})</span>
          ${pillRowHtml(sources.weapons.map(weapon =>
            entityPill(
              "weapon",
              `${weapon.weapon_file}:${weapon.game_id}`,
              getJsonName(weapon, "en"),
              getWeaponTypeLabel(weapon.weapon_file)
            )
          ))}
        </div>
      `);
    }

    if (sources.amulets.length) {
      blocks.push(`
        <div class="json-block">
          <span>Charms</span>
          ${pillRowHtml(sources.amulets.map(rank =>
            `<span class="data-pill">${escapeHtml(getJsonName(rank, "en") || "Charm")}</span>`
          ))}
        </div>
      `);
    }

    if (blocks.length) {
      sections.push(
        detailSectionTitle("Available on"),
        detailCard(blocks.join(""))
      );
    }
  }

  return {
    title: name,
    subtitle: getJsonName(skill, "ja"),
    mentionName: name,
    primaryEntries,
    sectionsHtml: sections.join("")
  };
}

// --- monster ----------------------------------------------------------------

function resolveMonsterDetail(key) {
  const monster = JSON_EXTRA_INDEX.monsterByGameId.get(String(key));
  if (!monster) return null;

  const name = getJsonName(monster, "en");

  const primaryEntries = [];
  const monsterGroup = monsterGroups.get(name);

  if (monsterGroup?.length) {
    primaryEntries.push(monsterGroup[0]);
  } else {
    primaryEntries.push(...findDumpEntriesByName(name, "Monsters").slice(0, 1));
  }

  if (!primaryEntries.length) {
    primaryEntries.push(
      attachJsonMetadata(addSearchFieldsSafe(makeFakeDetailEntry(name, "Monsters", {})))
    );
  }

  const sections = [];

  // Lore / descriptions
  const loreBlocks = [
    monster.descriptions?.en ? ["Description", monster.descriptions.en] : null,
    monster.features?.en ? ["Features", monster.features.en] : null,
    monster.tips?.en ? ["Hunting tips", monster.tips.en] : null
  ].filter(Boolean);

  if (loreBlocks.length) {
    sections.push(
      detailSectionTitle("Hunter's Notes"),
      detailCard(loreBlocks.map(([label, text]) => `
        <div class="json-block">
          <span>${escapeHtml(label)}</span>
          <p>${formatEntryText(text, { linkify: true })}</p>
        </div>
      `).join(""))
    );
  }

  // Locations
  if (monster.locations?.length) {
    sections.push(
      detailSectionTitle("Locations"),
      detailCard(pillRowHtml(monster.locations.map(id =>
        `<span class="data-pill">${escapeHtml(getStageNameById(id))}</span>`
      )))
    );
  }

  // Size + comparison
  if (monster.size?.base) {
    sections.push(
      detailSectionTitle("Size"),
      detailCard(renderMonsterSizeBlock(monster))
    );
  }

  // Variants
  if (monster.variants?.length) {
    sections.push(
      detailSectionTitle("Variants"),
      detailCard(pillRowHtml(monster.variants.map(variant =>
        `<span class="data-pill">${escapeHtml(getJsonName(variant, "en"))}</span>`
      )))
    );
  }

  // Rewards
  if (monster.rewards?.length) {
    sections.push(
      detailSectionTitle("Rewards / Materials"),
      detailCard(renderMonsterRewardsTable(monster))
    );
  }

  // Equipment crafted from this monster
  const equipment = getMonsterEquipment(monster);

  if (equipment.weapons.size || equipment.armorSets.size) {
    const blocks = [];

    if (equipment.armorSets.size) {
      blocks.push(`
        <div class="json-block">
          <span>Armor sets (${equipment.armorSets.size})</span>
          ${pillRowHtml([...equipment.armorSets.keys()].map(setName =>
            entityPill("armorset", setName.toLowerCase(), setName)
          ))}
        </div>
      `);
    }

    if (equipment.weapons.size) {
      blocks.push(`
        <div class="json-block">
          <span>Weapons (${equipment.weapons.size})</span>
          ${pillRowHtml([...equipment.weapons.values()].map(weapon =>
            entityPill(
              "weapon",
              `${weapon.weapon_file}:${weapon.game_id}`,
              getJsonName(weapon, "en"),
              getWeaponTypeLabel(weapon.weapon_file)
            )
          ))}
        </div>
      `);
    }

    sections.push(
      detailSectionTitle("Equipment from this monster"),
      detailCard(blocks.join(""))
    );
  }

  return {
    title: name,
    subtitle: getJsonName(monster, "ja"),
    mentionName: name,
    primaryEntries,
    sectionsHtml: sections.join("")
  };
}

function resolveMonsterTextDetail(key) {
  const group = monsterGroups.get(String(key));
  if (!group?.length) return null;

  return {
    title: String(key),
    subtitle: "",
    mentionName: String(key),
    primaryEntries: [group[0]],
    sectionsHtml: ""
  };
}

function renderMonsterRewardsTable(monster) {
  const rewards = [...(monster.rewards || [])].sort((a, b) => {
    const rankOrder = rank => (rank === "low" ? 0 : rank === "high" ? 1 : 2);

    return (
      rankOrder(a.rank) - rankOrder(b.rank) ||
      String(a.kind).localeCompare(String(b.kind)) ||
      Number(b.chance) - Number(a.chance)
    );
  });

  return `
    <div class="monster-table-wrap">
      <table class="rewards-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Rank</th>
            <th>Source</th>
            <th>×</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          ${rewards.map(reward => `
            <tr>
              <td>${entityLinkHtml("item", reward.item_id, getJsonItemNameById(reward.item_id))}</td>
              <td>${escapeHtml(titleCaseFamily(reward.rank || ""))}</td>
              <td>${escapeHtml(titleCaseFamily(reward.kind || ""))}</td>
              <td>${escapeHtml(reward.amount ?? 1)}</td>
              <td>${escapeHtml(reward.chance ?? "—")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function getMonsterEquipment(monster) {
  const weapons = new Map();
  const armorSets = new Map();

  for (const reward of monster.rewards || []) {
    const usage = REVERSE_INDEX.itemUsage.get(String(reward.item_id));
    if (!usage) continue;

    for (const weapon of usage.weapons) {
      weapons.set(`${weapon.weapon_file}:${weapon.game_id}`, weapon);
    }

    for (const { set } of usage.armorPieces) {
      armorSets.set(getJsonName(set, "en"), set);
    }
  }

  return { weapons, armorSets };
}

// --- size comparison ---------------------------------------------------------

function getSizedMonsters() {
  return (JSON_DATA.largemonsters || [])
    .filter(monster => monster.size?.base)
    .sort((a, b) => b.size.base - a.size.base);
}

function renderMonsterSizeBlock(monster) {
  const sized = getSizedMonsters();
  const max = sized[0]?.size?.base || monster.size.base;

  return `
    ${renderSizeBarRow(monster, max, true)}

    <div class="json-grid">
      <div class="json-fact"><span>Base</span><strong>${formatMonsterSize(monster.size.base)}</strong></div>
      ${monster.size.mini ? `<div class="json-fact"><span>Mini crown</span><strong>${formatMonsterSize(monster.size.mini)}</strong></div>` : ""}
      ${monster.size.silver ? `<div class="json-fact"><span>Silver crown</span><strong>${formatMonsterSize(monster.size.silver)}</strong></div>` : ""}
      ${monster.size.gold ? `<div class="json-fact"><span>Gold crown</span><strong>${formatMonsterSize(monster.size.gold)}</strong></div>` : ""}
    </div>

    <p class="size-note">
      <button class="entity-link" type="button" data-show-size-comparison>Compare all monster sizes →</button>
    </p>
  `;
}

function formatMonsterSize(value) {
  const number = Number(value || 0);
  if (!number) return "—";
  return `${(number / 100).toFixed(2)} m`;
}

function renderSizeBarRow(monster, max, highlight = false) {
  const base = monster.size?.base || 0;
  const gold = monster.size?.gold || 0;

  const basePct = Math.max(1.5, (base / max) * 100);
  const goldPct = gold ? Math.max(basePct, (gold / max) * 100) : 0;

  return `
    <div class="size-row ${highlight ? "size-row-current" : ""}">
      <div class="size-row-label">
        ${entityLinkHtml("monster", monster.game_id, getJsonName(monster, "en"))}
        <small>${formatMonsterSize(base)}</small>
      </div>

      <div class="size-bar-track">
        ${goldPct ? `<span class="size-bar size-bar-gold" style="width:${goldPct}%"></span>` : ""}
        <span class="size-bar" style="width:${basePct}%"></span>
      </div>
    </div>
  `;
}

function showSizeComparison(addToHistory = true) {
  if (addToHistory) {
    pushViewHistory(captureCurrentView());
  }

  const sized = getSizedMonsters();
  const max = sized[0]?.size?.base || 1;

  sizeList.innerHTML = `
    ${detailCard(`
      <p class="size-note">
        Base size per monster (converted from in-game units, ≈ meters).
        The lighter bar behind shows the gold-crown maximum.
      </p>
    `)}

    <article class="entry detail-card size-compare-card">
      ${sized.map(monster => renderSizeBarRow(monster, max)).join("")}
    </article>
  `;

  showOnly(sizeView);
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// --- weapon ------------------------------------------------------------------

function resolveWeaponDetail(key) {
  const weapon = JSON_INDEX.weaponByTypeAndGameId.get(String(key));
  if (!weapon) return null;

  const name = getJsonName(weapon, "en");
  const primaryEntries = findDumpEntriesByName(name, "Weapons")
    .filter(entry => entry.jsonWeapon)
    .slice(0, 1);

  if (!primaryEntries.length) {
    primaryEntries.push(
      attachJsonMetadata(addSearchFieldsSafe(
        makeFakeDetailEntry(name, "Weapons", { jsonWeapon: weapon })
      ))
    );
  }

  const sections = [
    detailSectionTitle(`${getWeaponTypeLabel(weapon.weapon_file)} tree`),
    detailCard(renderWeaponSeriesTree(weapon))
  ];

  return {
    title: name,
    subtitle: getJsonName(weapon, "ja"),
    mentionName: name,
    headerExtra: typeof compareAddButtonHtml === "function"
      ? compareAddButtonHtml("weapon", key, name)
      : "",
    primaryEntries,
    sectionsHtml: sections.join("")
  };
}

function buildWeaponForest(file) {
  const weapons = (JSON_DATA[file] || []).map(weapon => ({
    ...weapon,
    weapon_file: file
  }));

  const byId = new Map(weapons.map(weapon => [String(weapon.game_id), weapon]));
  const children = new Map();
  const roots = [];

  for (const weapon of weapons) {
    const previousId = weapon.crafting?.previous_id;

    if (
      previousId === undefined ||
      previousId === null ||
      !byId.has(String(previousId))
    ) {
      roots.push(weapon);
      continue;
    }

    const parentKey = String(previousId);

    if (!children.has(parentKey)) {
      children.set(parentKey, []);
    }

    children.get(parentKey).push(weapon);
  }

  const sortNodes = list =>
    list.sort((a, b) =>
      Number(a.crafting?.row ?? 0) - Number(b.crafting?.row ?? 0) ||
      Number(a.crafting?.column ?? 0) - Number(b.crafting?.column ?? 0) ||
      Number(a.game_id) - Number(b.game_id)
    );

  sortNodes(roots);

  for (const list of children.values()) {
    sortNodes(list);
  }

  return { byId, children, roots };
}

function renderWeaponTreeNodeHtml(weapon, forest, currentId = "") {
  const kids = forest.children.get(String(weapon.game_id)) || [];
  const isCurrent = String(weapon.game_id) === String(currentId);

  const specials = renderWeaponSpecialsText(weapon);

  return `
    <li>
      <div class="wtree-node ${isCurrent ? "wtree-node-current" : ""}">
        ${entityLinkHtml(
          "weapon",
          `${weapon.weapon_file}:${weapon.game_id}`,
          getJsonName(weapon, "en")
        )}
        <small>
          R${escapeHtml(weapon.rarity ?? "?")}
          · ${escapeHtml(weapon.attack_raw ?? "?")} atk
          ${specials ? ` · ${escapeHtml(specials)}` : ""}
        </small>
      </div>

      ${
        kids.length
          ? `<ul class="wtree">${
              kids.map(kid => renderWeaponTreeNodeHtml(kid, forest, currentId)).join("")
            }</ul>`
          : ""
      }
    </li>
  `;
}

function renderWeaponSeriesTree(weapon) {
  const forest = buildWeaponForest(weapon.weapon_file);

  // Walk up to the root of this weapon's line.
  let root = weapon;
  const seen = new Set();

  while (true) {
    const previousId = root.crafting?.previous_id;

    if (previousId === undefined || previousId === null) break;

    const parent = forest.byId.get(String(previousId));

    if (!parent || seen.has(String(parent.game_id))) break;

    seen.add(String(parent.game_id));
    root = parent;
  }

  return `
    <ul class="wtree wtree-root">
      ${renderWeaponTreeNodeHtml(root, forest, weapon.game_id)}
    </ul>
  `;
}

function renderWeaponTypeTreeHtml(file) {
  const forest = buildWeaponForest(file);

  if (!forest.roots.length) {
    return `<div class="empty">No tree data for this weapon type.</div>`;
  }

  return `
    <article class="entry detail-card">
      <ul class="wtree wtree-root">
        ${forest.roots.map(root => renderWeaponTreeNodeHtml(root, forest)).join("")}
      </ul>
    </article>
  `;
}

// --- armor -------------------------------------------------------------------

function enrichArmorPiece(piece, set) {
  return {
    ...piece,
    armor_set: set,
    armor_set_name: getJsonName(set, "en"),
    armor_set_bonus: set.set_bonus,
    armor_group_bonus: set.group_bonus
  };
}

function resolveArmorSetDetail(key) {
  const set = JSON_INDEX.armorSetByName.get(String(key).toLowerCase());
  if (!set) return null;

  const name = getJsonName(set, "en");
  const pieces = set.pieces || [];

  // Aggregate skills across pieces.
  const skillTotals = new Map();

  for (const piece of pieces) {
    for (const [skillId, level] of Object.entries(piece.skills || {})) {
      skillTotals.set(skillId, (skillTotals.get(skillId) || 0) + Number(level));
    }
  }

  // Aggregate materials.
  const materialTotals = new Map();
  let totalZenny = 0;

  for (const piece of pieces) {
    totalZenny += Number(piece.crafting?.price || 0);

    for (const [itemId, amount] of Object.entries(piece.crafting?.inputs || {})) {
      materialTotals.set(itemId, (materialTotals.get(itemId) || 0) + Number(amount));
    }
  }

  const defense = pieces.reduce(
    (sum, piece) => ({
      base: sum.base + Number(piece.defense?.base || 0),
      max: sum.max + Number(piece.defense?.max || 0)
    }),
    { base: 0, max: 0 }
  );

  const overview = `
    <div class="json-grid">
      <div class="json-fact"><span>Rarity</span><strong>${renderRarityText(set.rarity) || "—"}</strong></div>
      <div class="json-fact"><span>Pieces</span><strong>${pieces.length}</strong></div>
      <div class="json-fact"><span>Total defense</span><strong>${defense.base} → ${defense.max}</strong></div>
      ${totalZenny ? `<div class="json-fact"><span>Total cost</span><strong>${totalZenny.toLocaleString()}z</strong></div>` : ""}
    </div>

    ${
      skillTotals.size
        ? `
          <div class="json-block">
            <span>Skills (full set)</span>
            ${pillRowHtml([...skillTotals.entries()].map(([skillId, level]) =>
              entityPill("skill", skillId, getJsonSkillNameById(skillId), `Lv ${level}`)
            ))}
          </div>
        `
        : ""
    }

    ${renderArmorBonusText("Set Bonus", set.set_bonus)}
    ${renderArmorBonusText("Group Bonus", set.group_bonus)}

    ${
      materialTotals.size
        ? `
          <div class="json-block">
            <span>Total materials</span>
            ${pillRowHtml([...materialTotals.entries()].map(([itemId, amount]) =>
              entityPill("item", itemId, getJsonItemNameById(itemId), `×${amount}`)
            ))}
          </div>
        `
        : ""
    }
  `;

  const pieceEntries = pieces.map(piece => {
    const pieceName = getJsonName(piece, "en");
    const match = findDumpEntriesByName(pieceName, "Equipment")
      .filter(entry => entry.jsonArmorPiece)[0];

    return match || attachJsonMetadata(addSearchFieldsSafe(
      makeFakeDetailEntry(pieceName, "Equipment", {
        jsonArmorPiece: enrichArmorPiece(piece, set)
      })
    ));
  });

  const sections = [
    detailSectionTitle("Set overview"),
    detailCard(overview),
    detailSectionTitle(`Pieces (${pieceEntries.length})`),
    pieceEntries.map(entry => renderEntry(entry)).join("")
  ];

  return {
    title: name,
    subtitle: getJsonName(set, "ja"),
    mentionName: name,
    headerExtra: typeof compareAddButtonHtml === "function"
      ? compareAddButtonHtml("armorset", name.toLowerCase(), name)
      : "",
    primaryEntries: [],
    sectionsHtml: sections.join("")
  };
}

function resolveArmorPieceDetail(key) {
  const piece = JSON_INDEX.armorPieceByName.get(String(key).toLowerCase());
  if (!piece) return null;

  const name = getJsonName(piece, "en");
  const setName = piece.armor_set_name || getJsonName(piece.armor_set, "en");

  const primaryEntries = findDumpEntriesByName(name, "Equipment")
    .filter(entry => entry.jsonArmorPiece)
    .slice(0, 1);

  if (!primaryEntries.length) {
    primaryEntries.push(
      attachJsonMetadata(addSearchFieldsSafe(
        makeFakeDetailEntry(name, "Equipment", { jsonArmorPiece: piece })
      ))
    );
  }

  const sections = setName
    ? [
        detailSectionTitle("Part of set"),
        detailCard(pillRowHtml([
          entityPill("armorset", setName.toLowerCase(), setName)
        ]))
      ]
    : [];

  return {
    title: name,
    subtitle: getJsonName(piece, "ja"),
    mentionName: name,
    primaryEntries,
    sectionsHtml: sections.join("")
  };
}

// --- accessory (decoration) --------------------------------------------------

function resolveAccessoryDetail(key) {
  const accessory = JSON_EXTRA_INDEX.accessoryByGameId.get(String(key));
  if (!accessory) return null;

  const name = getJsonName(accessory, "en");
  const primaryEntries = findDumpEntriesByName(name, "Equipment").slice(0, 1);

  const skills = Object.entries(accessory.skills || {});

  const info = `
    <div class="json-grid">
      <div class="json-fact"><span>Rarity</span><strong>${renderRarityText(accessory.rarity) || "—"}</strong></div>
      ${accessory.level ? `<div class="json-fact"><span>Slot level</span><strong>${accessory.level}</strong></div>` : ""}
      ${accessory.price ? `<div class="json-fact"><span>Price</span><strong>${Number(accessory.price).toLocaleString()}z</strong></div>` : ""}
      ${accessory.allowed_on ? `<div class="json-fact"><span>Fits</span><strong>${escapeHtml(titleCaseFamily(accessory.allowed_on))}</strong></div>` : ""}
    </div>

    ${
      accessory.descriptions?.en
        ? `<div class="json-block"><span>Description</span><p>${formatEntryText(accessory.descriptions.en, { linkify: true })}</p></div>`
        : ""
    }

    ${
      skills.length
        ? `
          <div class="json-block">
            <span>Skills</span>
            ${pillRowHtml(skills.map(([skillId, level]) =>
              entityPill("skill", skillId, getJsonSkillNameById(skillId), `Lv ${level}`)
            ))}
          </div>
        `
        : ""
    }
  `;

  return {
    title: name,
    subtitle: getJsonName(accessory, "ja"),
    mentionName: name,
    primaryEntries,
    sectionsHtml: [detailSectionTitle("Decoration data"), detailCard(info)].join("")
  };
}

// --- helpers ------------------------------------------------------------------

// addSearchFields needs presentation helpers; wrap so fake entries never throw.
function addSearchFieldsSafe(entry) {
  try {
    return addSearchFields(entry);
  } catch {
    return { ...entry, searchText: "", searchTextLower: "", searchNameLower: "" };
  }
}
