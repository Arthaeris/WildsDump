// compare.js
// Compare mode for weapons and armor sets (2-3 entries, persisted).

const compareView = document.querySelector("#compareView");
const compareContent = document.querySelector("#compareContent");
const compareTray = document.querySelector("#compareTray");

const COMPARE_STORAGE_KEY = "wd_compare";
const COMPARE_MAX = 3;

let compareList = loadCompareList();

function loadCompareList() {
  try {
    const raw = JSON.parse(localStorage.getItem(COMPARE_STORAGE_KEY) || "[]");

    if (!Array.isArray(raw)) return [];

    return raw
      .filter(item => item && item.type && item.key)
      .slice(0, COMPARE_MAX);
  } catch {
    return [];
  }
}

function saveCompareList() {
  try {
    localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(compareList));
  } catch {
    // Storage unavailable - compare still works for the session.
  }
}

function resolveCompareItem(item) {
  if (item.type === "weapon") {
    const weapon = JSON_INDEX.weaponByTypeAndGameId.get(String(item.key));
    return weapon
      ? { ...item, name: getJsonName(weapon, "en"), data: weapon }
      : null;
  }

  if (item.type === "armorset") {
    const set = JSON_INDEX.armorSetByName.get(String(item.key).toLowerCase());
    return set
      ? { ...item, name: getJsonName(set, "en"), data: set }
      : null;
  }

  return null;
}

function isInCompare(type, key) {
  return compareList.some(item => item.type === type && String(item.key) === String(key));
}

function compareAddButtonHtml(type, key, name) {
  const active = isInCompare(type, key);

  return `
    <button
      class="secondary compare-add-btn ${active ? "active" : ""}"
      type="button"
      data-compare-add="${escapeAttribute(`${type}|${key}`)}"
      data-compare-name="${escapeAttribute(name)}"
    >
      ${active ? "✓ In comparison" : "⇄ Compare"}
    </button>
  `;
}

function toggleCompareItem(type, key) {
  if (isInCompare(type, key)) {
    compareList = compareList.filter(
      item => !(item.type === type && String(item.key) === String(key))
    );
  } else {
    // Only one entity type at a time - switching type resets the tray.
    if (compareList.length && compareList[0].type !== type) {
      compareList = [];
    }

    if (compareList.length >= COMPARE_MAX) {
      compareList = compareList.slice(1);
    }

    compareList.push({ type, key: String(key) });
  }

  saveCompareList();
  renderCompareTray();
  updateCompareButtons();
}

function updateCompareButtons() {
  document.querySelectorAll("[data-compare-add]").forEach(button => {
    const [type, ...rest] = button.dataset.compareAdd.split("|");
    const active = isInCompare(type, rest.join("|"));

    button.classList.toggle("active", active);
    button.textContent = active ? "✓ In comparison" : "⇄ Compare";
  });
}

function renderCompareTray() {
  if (!compareTray) return;

  const resolved = compareList.map(resolveCompareItem).filter(Boolean);

  if (!resolved.length) {
    compareTray.hidden = true;
    compareTray.innerHTML = "";
    return;
  }

  compareTray.hidden = false;

  compareTray.innerHTML = `
    <div class="compare-tray-chips">
      ${resolved.map(item => `
        <span class="data-pill compare-chip">
          ${escapeHtml(item.name)}
          <button
            class="compare-chip-remove"
            type="button"
            data-compare-remove="${escapeAttribute(`${item.type}|${item.key}`)}"
            aria-label="Remove from comparison"
          >✕</button>
        </span>
      `).join("")}
    </div>

    <div class="compare-tray-actions">
      <button type="button" data-compare-open ${resolved.length < 2 ? "disabled" : ""}>
        Compare (${resolved.length})
      </button>
      <button class="secondary" type="button" data-compare-clear>Clear</button>
    </div>
  `;
}

function showCompareView(addToHistory = true) {
  if (addToHistory) {
    pushViewHistory(captureCurrentView());
  }

  const resolved = compareList.map(resolveCompareItem).filter(Boolean);

  if (resolved.length < 2) {
    compareContent.innerHTML = `
      <div class="empty">
        Add at least two weapons or armor sets to the comparison.<br>
        You can find the ⇄ Compare button on weapon and armor set detail pages.
      </div>
    `;
  } else if (resolved[0].type === "weapon") {
    compareContent.innerHTML = renderWeaponCompareTable(resolved);
  } else {
    compareContent.innerHTML = renderArmorSetCompareTable(resolved);
  }

  showOnly(compareView);
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// --- weapon comparison -------------------------------------------------------

function compareRow(label, cells) {
  return `
    <tr>
      <th>${escapeHtml(label)}</th>
      ${cells.map(cell => `<td>${cell}</td>`).join("")}
    </tr>
  `;
}

function renderWeaponCompareTable(items) {
  const weapons = items.map(item => item.data);

  const rows = [
    compareRow("Type", weapons.map(weapon =>
      escapeHtml(getWeaponTypeLabel(weapon.weapon_file))
    )),

    compareRow("Rarity", weapons.map(weapon =>
      renderRarityText(weapon.rarity) || "—"
    )),

    compareRow("Raw attack", weapons.map(weapon =>
      `<strong>${escapeHtml(weapon.attack_raw ?? "—")}</strong>`
    )),

    compareRow("Affinity", weapons.map(weapon =>
      weapon.affinity !== undefined ? escapeHtml(`${weapon.affinity}%`) : "—"
    )),

    compareRow("Element / Status", weapons.map(weapon =>
      escapeHtml(renderWeaponSpecialsText(weapon) || "—")
    )),

    compareRow("Defense bonus", weapons.map(weapon =>
      escapeHtml(weapon.defense ?? "—")
    )),

    compareRow("Slots", weapons.map(weapon =>
      escapeHtml(renderWeaponSlotsText(weapon.slots) || "—")
    )),

    compareRow("Sharpness", weapons.map(weapon =>
      renderWeaponSharpnessBar(weapon) || "—"
    )),

    compareRow("Skills", weapons.map(weapon => {
      const skills = getLinkedWeaponSkills(weapon.skills);
      return skills.length
        ? skills.map(skill =>
            entityPill("skill", skill.id, skill.name, `Lv ${skill.level}`)
          ).join(" ")
        : "—";
    })),

    compareRow("Series", weapons.map(weapon =>
      escapeHtml(getJsonWeaponSeriesNameById(weapon.series_id) || "—")
    )),

    compareRow("Materials", weapons.map(weapon => {
      const inputs = getLinkedCraftingItems(weapon.crafting?.inputs);
      return inputs.length
        ? inputs.map(input =>
            entityPill("item", input.id, input.name, `×${input.amount}`)
          ).join(" ")
        : "—";
    })),

    compareRow("Specifics", weapons.map(weapon =>
      escapeHtml(renderWeaponSpecificText(weapon) || "—")
    ))
  ];

  return renderCompareTableShell(items, rows);
}

// --- armor set comparison ----------------------------------------------------

function summarizeArmorSet(set) {
  const pieces = set.pieces || [];

  const totals = {
    defenseBase: 0,
    defenseMax: 0,
    resistances: { fire: 0, water: 0, thunder: 0, ice: 0, dragon: 0 },
    skills: new Map(),
    slots: []
  };

  for (const piece of pieces) {
    totals.defenseBase += Number(piece.defense?.base || 0);
    totals.defenseMax += Number(piece.defense?.max || 0);

    for (const element of Object.keys(totals.resistances)) {
      totals.resistances[element] += Number(piece.resistances?.[element] || 0);
    }

    for (const [skillId, level] of Object.entries(piece.skills || {})) {
      totals.skills.set(skillId, (totals.skills.get(skillId) || 0) + Number(level));
    }

    totals.slots.push(...(piece.slots || []).filter(Boolean));
  }

  return totals;
}

function renderArmorSetCompareTable(items) {
  const sets = items.map(item => item.data);
  const totals = sets.map(summarizeArmorSet);

  const rows = [
    compareRow("Rarity", sets.map(set => renderRarityText(set.rarity) || "—")),

    compareRow("Pieces", sets.map(set =>
      escapeHtml((set.pieces || []).length)
    )),

    compareRow("Defense (base → max)", totals.map(total =>
      `<strong>${total.defenseBase} → ${total.defenseMax}</strong>`
    )),

    compareRow("🔥 Fire", totals.map(total => formatSignedNumber(total.resistances.fire))),
    compareRow("💧 Water", totals.map(total => formatSignedNumber(total.resistances.water))),
    compareRow("⚡ Thunder", totals.map(total => formatSignedNumber(total.resistances.thunder))),
    compareRow("❄️ Ice", totals.map(total => formatSignedNumber(total.resistances.ice))),
    compareRow("🐉 Dragon", totals.map(total => formatSignedNumber(total.resistances.dragon))),

    compareRow("Slots", totals.map(total =>
      total.slots.length
        ? escapeHtml(total.slots.map(slot => `Lv${slot}`).join(" / "))
        : "—"
    )),

    compareRow("Skills", totals.map(total =>
      total.skills.size
        ? [...total.skills.entries()].map(([skillId, level]) =>
            entityPill("skill", skillId, getJsonSkillNameById(skillId), `Lv ${level}`)
          ).join(" ")
        : "—"
    )),

    compareRow("Set bonus", sets.map(set => {
      const html = renderArmorBonusText("Set Bonus", set.set_bonus);
      return html || "—";
    })),

    compareRow("Group bonus", sets.map(set => {
      const html = renderArmorBonusText("Group Bonus", set.group_bonus);
      return html || "—";
    }))
  ];

  return renderCompareTableShell(items, rows);
}

function renderCompareTableShell(items, rows) {
  const entityType = items[0].type;

  return `
    <article class="entry detail-card compare-card">
      <div class="monster-table-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              <th></th>
              ${items.map(item => `
                <th>
                  ${entityLinkHtml(entityType, item.key, item.name)}
                  <button
                    class="compare-chip-remove"
                    type="button"
                    data-compare-remove="${escapeAttribute(`${item.type}|${item.key}`)}"
                    aria-label="Remove from comparison"
                  >✕</button>
                </th>
              `).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.join("")}
          </tbody>
        </table>
      </div>
    </article>
  `;
}
