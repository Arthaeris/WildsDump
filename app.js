// app.js
// WildsDump prototype UI

const EN_SOURCE = "./en_dump.txt";
const JP_SOURCE = "./jp_dump.txt";
const PAGE_SIZE = 80;
const WORD_PAGE_SIZE = 150;

const search = document.querySelector("#search");
const results = document.querySelector("#results");
const count = document.querySelector("#count");
const searchFilters = document.querySelector("#searchFilters");
const cardControls = document.querySelector("#cardControls");
const copySearchResultsBtn = document.querySelector("#copySearchResultsBtn");

const menu = document.querySelector("#menu");
const menuOverlay = document.querySelector("#menuOverlay");
const menuBtn = document.querySelector("#menuBtn");
const closeMenuBtn = document.querySelector("#closeMenuBtn");
const homeBtn = document.querySelector("#homeBtn");
const categoryList = document.querySelector("#categoryList");
const npcIndexBtn = document.querySelector("#npcIndexBtn");
const wordIndexBtn = document.querySelector("#wordIndexBtn");
const themeToggleBtn = document.querySelector("#themeToggleBtn");

const searchView = document.querySelector("#searchView");
const categoryView = document.querySelector("#categoryView");
const npcView = document.querySelector("#npcView");
const dialogueView = document.querySelector("#dialogueView");
const wordIndexView = document.querySelector("#wordIndexView");

const monsterIndexBtn = document.querySelector("#monsterIndexBtn");
const monsterView = document.querySelector("#monsterView");
const monsterList = document.querySelector("#monsterList");
const backFromMonsterBtn = document.querySelector("#backFromMonsterBtn");

const categoryTitle = document.querySelector("#categoryTitle");
const categoryResults = document.querySelector("#categoryResults");
const npcList = document.querySelector("#npcList");
const dialogueTitle = document.querySelector("#dialogueTitle");
const dialogueResults = document.querySelector("#dialogueResults");
const dialogueModeBtn = document.querySelector("#dialogueModeBtn");
const wordIndexResults = document.querySelector("#wordIndexResults");

const backFromCategoryBtn = document.querySelector("#backFromCategoryBtn");
const backFromNpcBtn = document.querySelector("#backFromNpcBtn");
const backFromDialogueBtn = document.querySelector("#backFromDialogueBtn");
const backFromWordIndexBtn = document.querySelector("#backFromWordIndexBtn");

let sections = [];
let entries = [];
let categories = new Map();
let npcGroups = new Map();
let monsterGroups = new Map();
let wordFrequency = [];

let activeTypeFilter = "All";
let defaultCardMode = "ids";
let currentSearchResults = [];
let currentSearchTokens = [];
let currentRenderTarget = results;
let currentVisibleEntries = [];
let renderedEntryCount = 0;
let isAppending = false;
let viewHistory = [];
let currentDialogueKey = "";
let dialogueDisplayMode = "cards";
let currentWordCount = 0;

function openMenu() {
  menu.classList.add("open");
  menuOverlay.classList.add("open");
}

function closeMenu() {
  menu.classList.remove("open");
  menuOverlay.classList.remove("open");
}

function showOnly(view) {
  searchView.hidden = view !== searchView;
  categoryView.hidden = view !== categoryView;
  npcView.hidden = view !== npcView;
  monsterView.hidden = view !== monsterView;
  dialogueView.hidden = view !== dialogueView;
  wordIndexView.hidden = view !== wordIndexView;
}

function pushViewHistory(view) {
  viewHistory.push(view);
}

function goBack() {
  const previous = viewHistory.pop();

  if (!previous) {
    showHome(false);
    return;
  }

  if (previous.type === "home") showHome(false);
  if (previous.type === "category") showCategory(previous.category, false);
  if (previous.type === "npcIndex") showNpcIndex(false);
  if (previous.type === "monsterIndex") showMonsterIndex(false);
  if (previous.type === "dialogue") showDialogue(previous.key, false);
  if (previous.type === "wordIndex") showWordIndex(false);
}

function showHome(addToHistory = true) {
  if (addToHistory) {
    if (!categoryView.hidden) pushViewHistory({ type: "category", category: categoryTitle.textContent });
    if (!npcView.hidden) pushViewHistory({ type: "npcIndex" });
    if (!monsterView.hidden) pushViewHistory({ type: "monsterIndex" });
    if (!dialogueView.hidden) pushViewHistory({ type: "dialogue", key: currentDialogueKey });
    if (!wordIndexView.hidden) pushViewHistory({ type: "wordIndex" });
  }

  showOnly(searchView);
  closeMenu();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showCategory(category, addToHistory = true) {
  if (addToHistory) {
    if (!searchView.hidden) pushViewHistory({ type: "home" });
    if (!npcView.hidden) pushViewHistory({ type: "npcIndex" });
    if (!dialogueView.hidden) pushViewHistory({ type: "dialogue", key: currentDialogueKey });
    if (!wordIndexView.hidden) pushViewHistory({ type: "wordIndex" });
  }

  categoryTitle.textContent = category;

  renderEntryList({
    target: categoryResults,
    items: categories.get(category) || [],
    emptyText: "No entries found."
  });

  showOnly(categoryView);
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showNpcIndex(addToHistory = true) {
  if (addToHistory) {
    if (!searchView.hidden) pushViewHistory({ type: "home" });
    if (!categoryView.hidden) pushViewHistory({ type: "category", category: categoryTitle.textContent });
    if (!dialogueView.hidden) pushViewHistory({ type: "dialogue", key: currentDialogueKey });
    if (!wordIndexView.hidden) pushViewHistory({ type: "wordIndex" });
  }

  const displayGroups = new Map();

  for (const [key, group] of npcGroups.entries()) {
    const name = getDialogueGroupName(key, group);

    if (!displayGroups.has(name)) {
      displayGroups.set(name, {
        name,
        keys: [],
        entries: []
      });
    }

    const displayGroup = displayGroups.get(name);
    displayGroup.keys.push(key);
    displayGroup.entries.push(...group);
  }

  const groups = [...displayGroups.values()]
  .sort((a, b) => {
    const aMapped = isManuallyNamedNpcGroup(a);
    const bMapped = isManuallyNamedNpcGroup(b);

    if (aMapped !== bMapped) {
      return aMapped ? -1 : 1;
    }

    return a.name.localeCompare(b.name);
  });

  npcList.innerHTML = groups.map(group => {
    const types = new Set(group.entries.map(entry => entry.dialogueType).filter(Boolean));

    return `
      <button class="npc-item" type="button" data-npc-key="${escapeAttribute(group.name)}">
        <span>${escapeHtml(group.name)}</span>
        <small>${group.entries.length} lines · ${group.keys.length} files · ${types.size} types</small>
      </button>
    `;
  }).join("");

  npcList.querySelectorAll("[data-npc-key]").forEach(button => {
    button.addEventListener("click", () => {
      showDialogueByDisplayName(button.dataset.npcKey);
    });
  });

  showOnly(npcView);
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showMonsterIndex(addToHistory = true) {
  if (addToHistory) {
    if (!searchView.hidden) pushViewHistory({ type: "home" });
    if (!categoryView.hidden) pushViewHistory({ type: "category", category: categoryTitle.textContent });
    if (!npcView.hidden) pushViewHistory({ type: "npcIndex" });
    if (!dialogueView.hidden) pushViewHistory({ type: "dialogue", key: currentDialogueKey });
    if (!wordIndexView.hidden) pushViewHistory({ type: "wordIndex" });
  }

  const orderedSections = [
    "Large Monsters",
    "Small Monsters",
    "Endemic Life",
    "Aquatic Life"
  ];

  const grouped = new Map(
    orderedSections.map(name => [name, []])
  );

  for (const [name, group] of monsterGroups.entries()) {
    let section = "Endemic Life";

    for (const [groupName, names] of Object.entries(MONSTER_INDEX_GROUPS || {})) {
      if (names.has(name)) {
        section = groupName;
        break;
      }
    }

    grouped.get(section).push([name, group]);
  }

  monsterList.innerHTML = orderedSections.map(sectionName => {
    const items = grouped.get(sectionName)
      .sort((a, b) => a[0].localeCompare(b[0]));

    if (!items.length) return "";

    return `
      <h3 class="index-section-title">${escapeHtml(sectionName)}</h3>

      ${items.map(([name, group]) => `
        <button class="npc-item" type="button" data-monster-key="${escapeAttribute(name)}">
          <span>${escapeHtml(name)}</span>
          <small>${group[0]?.id || ""} · ${group.length} entry</small>
        </button>
      `).join("")}
    `;
  }).join("");

  showOnly(monsterView);
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function isManuallyNamedNpcGroup(group) {
  return group.entries.some(entry => {
    if (entry.dialogueId && NPC_MAP?.[entry.dialogueId]) return true;
    if (entry.fileKey && GOSSIP_MAP?.[entry.fileKey]) return true;
    if (entry.fileKey && DIALOGUE_MAP?.[entry.fileKey]) return true;

    return false;
  });
}

function showDialogueByDisplayName(name) {
  const combined = [];

  for (const [key, group] of npcGroups.entries()) {
    if (getDialogueGroupName(key, group) === name) {
      combined.push(...group);
    }
  }

  currentDialogueKey = name;
  dialogueTitle.textContent = name;

  dialogueModeBtn.textContent =
    dialogueDisplayMode === "cards" ? "Full Dialogue" : "Cards";

  if (dialogueDisplayMode === "full") {
    dialogueResults.innerHTML = renderFullDialogue(combined);
  } else {
    renderEntryList({
      target: dialogueResults,
      items: combined,
      emptyText: "No dialogue found."
    });
  }

  showOnly(dialogueView);
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showDialogue(key, addToHistory = true) {
  if (addToHistory) {
    if (!searchView.hidden) pushViewHistory({ type: "home" });
    if (!categoryView.hidden) pushViewHistory({ type: "category", category: categoryTitle.textContent });
    if (!npcView.hidden) pushViewHistory({ type: "npcIndex" });
    if (!wordIndexView.hidden) pushViewHistory({ type: "wordIndex" });
  }

  currentDialogueKey = key;

  let group = npcGroups.get(key);

if (!group && monsterGroups.has(key)) {
  group = monsterGroups.get(key);
}

if (!group) {
  group = [];
}
  dialogueTitle.textContent = getDialogueGroupName(key, group);

  dialogueModeBtn.textContent = dialogueDisplayMode === "cards"
    ? "Full Dialogue"
    : "Cards";

  if (dialogueDisplayMode === "full") {
    dialogueResults.innerHTML = renderFullDialogue(group);
  } else {
    renderEntryList({
      target: dialogueResults,
      items: group,
      emptyText: "No dialogue found."
    });
  }

  showOnly(dialogueView);
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showWordIndex(addToHistory = true) {
  if (addToHistory) {
    if (!searchView.hidden) pushViewHistory({ type: "home" });
    if (!categoryView.hidden) pushViewHistory({ type: "category", category: categoryTitle.textContent });
    if (!npcView.hidden) pushViewHistory({ type: "npcIndex" });
    if (!dialogueView.hidden) pushViewHistory({ type: "dialogue", key: currentDialogueKey });
  }

  currentWordCount = 0;
  wordIndexResults.innerHTML = "";
  appendNextWords();

  showOnly(wordIndexView);
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getMappedDialogueName(entry, fallbackKey = "") {
  if (!entry) return fallbackKey || "";

  // enemytext.msg
  const enemyMonster = getEnemyTextMonsterName(entry);
  if (enemyMonster) {
    return enemyMonster;
  }

  if (entry.dialogueId && NPC_MAP?.[entry.dialogueId]) {
    return NPC_MAP[entry.dialogueId];
  }

  const mapKey = String(entry.fileKey || "");

  if (GOSSIP_MAP?.[mapKey]) {
    return GOSSIP_MAP[mapKey];
  }

  if (DIALOGUE_MAP?.[mapKey]) {
    return DIALOGUE_MAP[mapKey];
  }

  if (entry.speaker) return entry.speaker;
  if (entry.dialogueId) return entry.dialogueId;

  return fallbackKey || "";
}

function getEnemyTextMonsterName(entry) {
  if (entry.fileKey !== "enemytext") return null;
  if (typeof ENEMY_TEXT_ID_MAP === "undefined") return null;

  return ENEMY_TEXT_ID_MAP[String(entry.id).padStart(4, "0")] || null;
}

function getDialogueGroupName(key, group) {
  return getMappedDialogueName(group?.[0], key);
}

function buildIndexes() {
  categories = new Map();
  npcGroups = groupWildsDialogues(entries);
  monsterGroups = new Map();

  for (const entry of entries) {
    if (!categories.has(entry.category)) {
      categories.set(entry.category, []);
    }

    categories.get(entry.category).push(entry);

    if (entry.fileKey === "enemytext" && entry.name) {
      monsterGroups.set(entry.name, [entry]);
    }
  }
}

function renderCategoryMenu() {
  const ordered = CATEGORY_ORDER.filter(category => categories.has(category));
  const extra = [...categories.keys()]
    .filter(category => !CATEGORY_ORDER.includes(category))
    .sort((a, b) => a.localeCompare(b));

  const names = [...ordered, ...extra];

  categoryList.innerHTML = names.map(name => `
    ${CATEGORY_SEPARATOR_BEFORE.has(name) ? '<div class="menu-separator"></div>' : ""}
    <button class="menu-item" type="button" data-category="${escapeAttribute(name)}">
      ${escapeHtml(name)}
    </button>
  `).join("");
}

function tokenizeSearchQuery(query) {
  const tokens = [];
  const regex = /(\w+):"([^"]+)"|(\w+):(\S+)|"([^"]+)"|(\S+)/g;
  let match;

  while ((match = regex.exec(query))) {
    if (match[1]) {
      tokens.push({ operator: match[1].toLowerCase(), value: match[2], exact: true });
    } else if (match[3]) {
      tokens.push({ operator: match[3].toLowerCase(), value: match[4], exact: false });
    } else if (match[5]) {
      tokens.push({ operator: "text", value: match[5], exact: true });
    } else if (match[6] && !match[6].endsWith(":")) {
      tokens.push({ operator: "text", value: match[6], exact: false });
    }
  }

  return tokens.filter(token => token.value && token.value.trim());
}

function searchIncludes(value, needle, exact = false) {
  const haystack = String(value || "");
  const q = String(needle || "").toLowerCase();

  if (!q) return true;

  if (exact) {
    return haystack.includes(q);
  }

  const parts = q.split(/\s+/).filter(Boolean);

  for (const part of parts) {
    if (!haystack.includes(part)) {
      return false;
    }
  }

  return true;
}

function getSearchBlob(entry) {
  return entry.searchText || "";
}

function entryMatchesSearchToken(entry, token) {
  const op = token.operator;
  const value = token.value;

  if (op === "text") {
    return searchIncludes(entry.searchTextLower, value, token.exact);
  }

  if (op === "name") {
    return searchIncludes(entry.searchNameLower, value, token.exact);
  }

  if (op === "id") {
    return searchIncludes(
      [entry.id, entry.rejectedId].filter(Boolean).join("\n").toLowerCase(),
      value,
      token.exact
    );
  }

  if (op === "file") {
    return searchIncludes(
      [entry.sourceFile, entry.fileKey].filter(Boolean).join("\n").toLowerCase(),
      value,
      token.exact
    );
  }

  if (op === "category") {
    return searchIncludes(String(entry.category || "").toLowerCase(), value, token.exact);
  }

  if (op === "family") {
    return searchIncludes(String(entry.family || "").toLowerCase(), value, token.exact);
  }

  if (op === "npc" || op === "speaker") {
    return searchIncludes(
      [entry.speaker, entry.dialogueId].filter(Boolean).join("\n").toLowerCase(),
      value,
      token.exact
    );
  }

  if (op === "dialogue") {
    return entry.isDialogue && searchIncludes(entry.searchTextLower, value, token.exact);
  }

  return searchIncludes(entry.searchTextLower, value, token.exact);
}

function entryMatchesSearch(entry, tokens) {
  return tokens.every(token => entryMatchesSearchToken(entry, token));
}

function matchesActiveFilter(entry) {
  return activeTypeFilter === "All" || entry.category === activeTypeFilter;
}

function getSearchRelevance(entry, tokens) {
  if (!tokens.length) return 0;

  let score = 0;

  for (const token of tokens) {
    const q = String(token.value || "").toLowerCase();
    if (!q) continue;

    if (String(entry.speaker || "").toLowerCase() === q) score += 1000;
    if (String(entry.dialogueId || "").toLowerCase() === q) score += 900;

    if (entry.searchNameLower?.startsWith(q)) score += 850;
    else if (entry.searchNameLower?.includes(q)) score += 750;

    if (String(entry.fileKey || "").toLowerCase().includes(q)) score += 350;
    if (String(entry.category || "").toLowerCase().includes(q)) score += 250;

    if (entry.searchTextLower?.includes(q)) score += 50;
  }

  return score;
}

function render() {
  const tokens = tokenizeSearchQuery(search.value.trim());
  currentSearchTokens = tokens;

  const visible = [];

  for (const entry of entries) {
    if (!matchesActiveFilter(entry)) continue;
    if (!entryMatchesSearch(entry, tokens)) continue;

    visible.push({
      entry,
      score: getSearchRelevance(entry, tokens)
    });
  }

  visible.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }

    return (
      String(a.entry.sourceFile).localeCompare(String(b.entry.sourceFile)) ||
      Number(a.entry.id) - Number(b.entry.id)
    );
  });

  currentSearchResults = visible.map(item => item.entry);

  count.textContent =
    `${currentSearchResults.length} ${currentSearchResults.length === 1 ? "entry" : "entries"}`;

  renderEntryList({
    target: results,
    items: currentSearchResults,
    emptyText: "No entries found."
  });
}

function renderEntryList({ target, items, emptyText }) {
  currentRenderTarget = target;
  currentVisibleEntries = items;
  renderedEntryCount = 0;

  if (!items.length) {
    target.innerHTML = `<div class="empty">${escapeHtml(emptyText)}</div>`;
    return;
  }

  target.innerHTML = "";
  appendNextEntries();
}

function appendNextEntries() {
  if (isAppending) return;
  if (!currentRenderTarget) return;
  if (renderedEntryCount >= currentVisibleEntries.length) return;

  isAppending = true;

  const nextItems = currentVisibleEntries.slice(
    renderedEntryCount,
    renderedEntryCount + PAGE_SIZE
  );

  currentRenderTarget.insertAdjacentHTML(
    "beforeend",
    nextItems.map(renderEntry).join("")
  );

  renderedEntryCount += nextItems.length;
  isAppending = false;
}

function renderEntry(entry) {
  const meta = [
    entry.category,
    entry.family,
    entry.dialogueId,
    entry.dialogueType,
    entry.sourceFile
  ].filter(Boolean);

  const en = getEntryPresentation(entry, "en");
  const jp = getEntryPresentation(entry, "jp");

  const hasJp = Boolean(entry.textJp || entry.rawJp || entry.nameJp);
  const jsonMeta = renderJsonItemMeta(entry);

  return `
    <article
      class="entry"
      data-mode="${escapeAttribute(defaultCardMode)}"
      data-lang="en"

      data-name-en="${escapeAttribute(en.name)}"
      data-name-jp="${escapeAttribute(jp.name)}"

      data-text-ids-en="${escapeAttribute(en.textIds)}"
      data-text-ids-jp="${escapeAttribute(jp.textIds)}"

      data-text-clean-en="${escapeAttribute(en.textClean)}"
      data-text-clean-jp="${escapeAttribute(jp.textClean)}"

      data-text-code-en="${escapeAttribute(en.visualCode)}"
      data-text-code-jp="${escapeAttribute(jp.visualCode)}"

      data-copy-ids="${escapeAttribute(en.copyIds)}"
      data-copy-clean="${escapeAttribute(en.copyClean)}"
      data-copy-code="${escapeAttribute(en.copyCode)}"

      data-copy-ids-en="${escapeAttribute(en.copyIds)}"
      data-copy-clean-en="${escapeAttribute(en.copyClean)}"
      data-copy-code-en="${escapeAttribute(en.copyCode)}"

      data-copy-ids-jp="${escapeAttribute(jp.copyIds)}"
      data-copy-clean-jp="${escapeAttribute(jp.copyClean)}"
      data-copy-code-jp="${escapeAttribute(jp.copyCode)}"
    >
      <div class="entry-actions">
        ${entry.isRejected ? '<span class="tag-badge">Rejected ID</span>' : ""}
        ${entry.isDialogue ? '<span class="tag-badge">Dialogue</span>' : ""}
        ${hasJp ? '<button class="lang-btn" type="button" data-lang-toggle>JP</button>' : ""}
        <button class="copy-btn" type="button">Copy</button>
      </div>

      <div class="entry-section">${escapeHtml(meta.join(" · "))}</div>
      ${jsonMeta}

      <div class="entry-header">
        ${
          entry.isDialogue && en.name
            ? `
              <button
                class="entry-name entry-name-link"
                type="button"
                data-dialogue-key="${escapeAttribute(entry.dialogueId || entry.rejectedId || entry.fileKey)}"
              >
                <span class="entry-name-content">${escapeHtml(en.name)}</span>
              </button>
            `
            : en.name
              ? `<div class="entry-name entry-name-content">${escapeHtml(en.name)}</div>`
              : ""
        }

        <div class="entry-id">${escapeHtml(en.headerId)}</div>
      </div>

      ${
        entry.rejectedId
          ? `<div class="entry-rejected">${escapeHtml(entry.rejectedId)}</div>`
          : ""
      }

      <div class="entry-text entry-text-ids">${formatEntryText(en.textIds)}</div>
      <div class="entry-text entry-text-clean">${formatEntryText(en.textClean)}</div>
      <div class="entry-text entry-text-code">${formatEntryText(en.visualCode)}</div>
    </article>
  `;
}

function renderJsonItemMeta(entry) {
  const item = entry.jsonItem;
  if (!item) return "";

  const lines = [];

  const main = [
    item.kind,
    item.rarity ? `Rarity ${item.rarity}` : "",
    item.max_count ? `Max ${item.max_count}` : "",
    item.buy_price ? `Buy ${item.buy_price}z` : "",
    item.sell_price ? `Sell ${item.sell_price}z` : "",
    item.icon ? `Icon ${item.icon}` : "",
    item.icon_color ? item.icon_color : ""
  ].filter(Boolean);

  if (main.length) lines.push(main.join(" · "));

  if (item.descriptions?.ja) {
    lines.push(`JP: ${item.descriptions.ja.replace(/\r\n/g, "\n")}`);
  }

  if (item.recipes?.length) {
    const recipes = item.recipes.map(recipe => {
      const inputs = (recipe.inputs || []).join(" + ");
      return `${recipe.amount || 1}x from ${inputs}`;
    });

    lines.push(`Recipes: ${recipes.join(" / ")}`);
  }

  if (item.out_box !== undefined) {
    lines.push(`Out box: ${item.out_box ? "Yes" : "No"}`);
  }

  if (item.foundry !== null && item.foundry !== undefined) {
    lines.push(`Foundry: ${JSON.stringify(item.foundry)}`);
  }

  return `
    <div class="entry-section json-meta">
      ${formatEntryText(lines.join("\n"))}
    </div>
  `;
}

function updateEntryLanguage(card, lang) {
  card.dataset.lang = lang;

  const suffix = lang === "jp" ? "Jp" : "En";
  const dataSuffix = lang === "jp" ? "jp" : "en";

  const name = card.dataset[`name${suffix}`] || "";
  const textIds = card.dataset[`textIds${suffix}`] || "";
  const textClean = card.dataset[`textClean${suffix}`] || "";
  const textCode = card.dataset[`textCode${suffix}`] || "";

  const nameEl = card.querySelector(".entry-name-content");
  const idsEl = card.querySelector(".entry-text-ids");
  const cleanEl = card.querySelector(".entry-text-clean");
  const codeEl = card.querySelector(".entry-text-code");
  const langBtn = card.querySelector("[data-lang-toggle]");

  if (nameEl) nameEl.textContent = name;
  if (idsEl) idsEl.innerHTML = formatEntryText(textIds);
  if (cleanEl) cleanEl.innerHTML = formatEntryText(textClean);
  if (codeEl) codeEl.innerHTML = formatEntryText(textCode);

  card.dataset.copyIds = card.dataset[`copyIds${suffix}`] || "";
  card.dataset.copyClean = card.dataset[`copyClean${suffix}`] || "";
  card.dataset.copyCode = card.dataset[`copyCode${suffix}`] || "";

  if (langBtn) {
    langBtn.textContent = lang === "jp" ? "EN" : "JP";
  }
}

function renderFullDialogue(group) {
  if (!group.length) {
    return '<div class="empty">No dialogue found.</div>';
  }

  const title = getDialogueGroupName(currentDialogueKey, group);

  const byType = new Map();

  for (const entry of group) {
    const type = entry.dialogueType || "unknown";

    if (!byType.has(type)) {
      byType.set(type, []);
    }

    byType.get(type).push(entry);
  }

  return [...byType.entries()].map(([type, items]) => {
    const textWithIds = items.map(getCopyTextWithIds).join("\n");
    const textClean = getCleanText(textWithIds);
    const textCode = "```\n" + textClean + "\n```";

    return `
      <article
        class="entry full-dialogue-entry"
        data-mode="${escapeAttribute(defaultCardMode)}"
        data-copy-ids="${escapeAttribute(textWithIds)}"
        data-copy-clean="${escapeAttribute(textClean)}"
        data-copy-code="${escapeAttribute(textCode)}"
      >
        <div class="entry-actions">
          <button class="copy-btn" type="button">Copy</button>
        </div>

        <div class="entry-section">Dialogues · ${escapeHtml(type)} · ${items.length} lines</div>

        <div class="entry-header">
          <div class="entry-name">${escapeHtml(title)}</div>
        </div>

        <div class="entry-text entry-text-ids">${formatEntryText(textWithIds)}</div>
        <div class="entry-text entry-text-clean">${formatEntryText(textClean)}</div>
        <div class="entry-text entry-text-code">${formatEntryText(textCode)}</div>
      </article>
    `;
  }).join("");
}

function getCopyTextWithIds(entry) {
  const label = entry.rejectedId || entry.id;
  return `[${label}] ${entry.text || entry.raw || ""}`.trim();
}

function getCleanText(value) {
  return String(value || "")
    .replace(/\[(\d{4}(?:\s*\+\s*\d{4})?)\]\s*/g, "")
    .split("\n")
    .map(line => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatEntryText(value) {
  return escapeHtml(value)
    .replace(/\n---\n/g, "<hr>")
    .replace(/\n/g, "<br>");
}

function buildWordFrequencyIndex() {
  const counts = new Map();

  for (const entry of entries) {
    const words = String(entry.text || "")
      .toLowerCase()
      .replace(/['’]s\b/g, "")
      .match(/[a-z][a-z'-]*/g) || [];

    for (const word of words) {
      if (word.length < 2) continue;
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }

  wordFrequency = [...counts.entries()]
    .map(([word, amount]) => ({ word, amount }))
    .sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return a.word.localeCompare(b.word);
    });
}

function appendNextWords() {
  if (wordIndexView.hidden) return;
  if (currentWordCount >= wordFrequency.length) return;

  const next = wordFrequency.slice(
    currentWordCount,
    currentWordCount + WORD_PAGE_SIZE
  );

  wordIndexResults.insertAdjacentHTML(
    "beforeend",
    next.map(item => `
      <button class="word-index-item" type="button" data-word-search="${escapeAttribute(item.word)}">
        <span class="reference-link">${escapeHtml(item.word)}</span>
        <span>${escapeHtml(item.amount)}</span>
      </button>
    `).join("")
  );

  currentWordCount += next.length;
}

function updateSearchFilterButtons() {
  searchFilters.querySelectorAll("[data-clear-filters]").forEach(button => {
    button.classList.toggle("active", activeTypeFilter === "All");
  });

  searchFilters.querySelectorAll("[data-type-filter]").forEach(button => {
    button.classList.toggle("active", button.dataset.typeFilter === activeTypeFilter);
  });
}

function handleScroll() {
  const distance =
    document.documentElement.scrollHeight -
    window.innerHeight -
    window.scrollY;

  if (distance > 900) return;

  if (!wordIndexView.hidden) {
    appendNextWords();
  } else {
    appendNextEntries();
  }
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);

    if (button) {
      const old = button.textContent;
      button.textContent = "Copied";
      setTimeout(() => button.textContent = old, 900);
    }
  } catch {
    if (button) {
      const old = button.textContent;
      button.textContent = "Failed";
      setTimeout(() => button.textContent = old, 900);
    }
  }
}

function getCardCopyText(card) {
  const mode = card.dataset.mode || "ids";

  if (mode === "clean") return decodeHtml(card.dataset.copyClean || "");
  if (mode === "code") return decodeHtml(card.dataset.copyCode || "");

  return decodeHtml(card.dataset.copyIds || "");
}

function mergeLocalizedEntries(enEntries, jpEntries) {
  const jpByUid = new Map(jpEntries.map(entry => [entry.uid, entry]));
  const usedJp = new Set();

  const merged = enEntries.map(enEntry => {
    const jpEntry = jpByUid.get(enEntry.uid);

    if (jpEntry) {
      usedJp.add(jpEntry.uid);
    }

    return {
      ...enEntry,
      nameJp: jpEntry?.name || "",
      rawJp: jpEntry?.raw || "",
      textJp: jpEntry?.text || ""
    };
  });

  for (const jpEntry of jpEntries) {
    if (usedJp.has(jpEntry.uid)) continue;

    merged.push({
      ...jpEntry,
      name: "",
      raw: "",
      text: "",
      nameJp: jpEntry.name || "",
      rawJp: jpEntry.raw || "",
      textJp: jpEntry.text || ""
    });
  }

  return merged;
}

function getEntryPresentation(entry, lang = "en") {
  const isJp = lang === "jp";

  const name = isJp && entry.nameJp
    ? entry.nameJp
    : entry.name || (
      entry.isDialogue
        ? getMappedDialogueName(entry, entry.dialogueId || entry.fileKey)
        : ""
    );

  const baseText = isJp
    ? (entry.textJp || entry.rawJp || entry.text || entry.raw || "")
    : (entry.text || entry.raw || entry.textJp || entry.rawJp || "");

  const hasName = Boolean(name && (entry.name || entry.nameJp));
  const headerId = `[${entry.id}]`;
  const alreadyHasId = /^\[[^\]]+\]/.test(baseText);

  const textIds = hasName
    ? baseText
    : alreadyHasId
      ? baseText
      : `[${entry.rejectedId || entry.id}] ${baseText}`.trim();

  const textClean = getCleanText(baseText);

  const copyClean = hasName
    ? `${name}\n\n${textClean}`.trim()
    : textClean;

  const copyIds = hasName
    ? `${name} ${headerId}\n\n${textClean}`.trim()
    : textIds;

  const copyCode = "```\n" + copyClean + "\n```";

  const visualCode = hasName
    ? "```\n" + textClean + "\n```"
    : copyCode;

  return {
    lang,
    name,
    headerId,
    textIds,
    textClean,
    visualCode,
    copyIds,
    copyClean,
    copyCode
  };
}

function attachJsonMetadata(entry) {
  const name = String(entry.name || "").toLowerCase();
  const jsonItem = name ? JSON_INDEX.itemByName.get(name) : null;

  return {
    ...entry,
    jsonItem: jsonItem || null
  };
}

function addSearchFields(entry) {
  const en = getEntryPresentation(entry, "en");
  const jp = getEntryPresentation(entry, "jp");

  const searchText = [
    en.name,
    jp.name,
    entry.name,
    entry.nameJp,
    entry.text,
    entry.textJp,
    entry.raw,
    entry.rawJp,
    entry.category,
    entry.family,
    entry.fileKey,
    entry.sourceFile,
    entry.id,
    entry.rejectedId
  ].filter(Boolean).join("\n");

  return {
    ...entry,

    searchNameEn: en.name || entry.name || "",
    searchNameJp: jp.name || entry.nameJp || "",

    searchText,
    searchTextLower: searchText.toLowerCase(),

    searchNameLower: [
      en.name,
      jp.name,
      entry.name,
      entry.nameJp
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase()
  };
}

async function loadDump() {
  results.innerHTML = '<div class="empty">Loading Wilds text dumps…</div>';

  try {
    const [enResponse, jpResponse] = await Promise.all([
      fetch(EN_SOURCE),
      fetch(JP_SOURCE)
    ]);

    if (!enResponse.ok) throw new Error(`Could not load ${EN_SOURCE}`);
    if (!jpResponse.ok) throw new Error(`Could not load ${JP_SOURCE}`);

    const [enRaw, jpRaw] = await Promise.all([
      enResponse.text(),
      jpResponse.text()
    ]);

    const enSections = parseWildsDump(enRaw, "en");
    const jpSections = parseWildsDump(jpRaw, "jp");

    const enEntries = buildWildsEntries(enSections, typeof NPC_MAP !== "undefined" ? NPC_MAP : {});
    const jpEntries = buildWildsEntries(jpSections, typeof NPC_MAP !== "undefined" ? NPC_MAP : {});

    sections = enSections;
    entries = mergeLocalizedEntries(enEntries, jpEntries)
  .map(attachJsonMetadata)
  .map(addSearchFields);

    buildIndexes();
    buildWordFrequencyIndex();
    renderCategoryMenu();
    render();
  } catch (error) {
    console.error(error);

    count.textContent = "0 entries";
    results.innerHTML = `
      <div class="empty">
        Could not load the Wilds text dumps.<br>
        Make sure these files exist:<br>
        <code>en_dump.txt</code><br>
        <code>jp_dump.txt</code>
      </div>
    `;
  }
}

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }

  themeToggleBtn.textContent =
    theme === "light"
      ? "Theme: Light"
      : theme === "dark"
        ? "Theme: Dark"
        : "Theme: System";
}

function getSavedTheme() {
  return localStorage.getItem("wildsDumpTheme") || "system";
}

function cycleTheme() {
  const current = getSavedTheme();

  const next =
    current === "system"
      ? "dark"
      : current === "dark"
        ? "light"
        : "system";

  localStorage.setItem("wildsDumpTheme", next);
  applyTheme(next);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function decodeHtml(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

let searchTimer = null;

search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(render, 120);
});

searchFilters.addEventListener("click", event => {
  const clearButton = event.target.closest("[data-clear-filters]");
  const typeButton = event.target.closest("[data-type-filter]");

  if (clearButton) {
    activeTypeFilter = "All";
  } else if (typeButton) {
    activeTypeFilter =
      activeTypeFilter === typeButton.dataset.typeFilter
        ? "All"
        : typeButton.dataset.typeFilter;
  } else {
    return;
  }

  updateSearchFilterButtons();
  render();
});

cardControls.addEventListener("click", event => {
  const modeButton = event.target.closest("[data-card-mode]");
  if (!modeButton) return;

  defaultCardMode = modeButton.dataset.cardMode;

  cardControls.querySelectorAll("[data-card-mode]").forEach(button => {
    button.classList.toggle("active", button.dataset.cardMode === defaultCardMode);
  });

  document.querySelectorAll(".entry").forEach(card => {
    card.dataset.mode = defaultCardMode;
  });
});

copySearchResultsBtn.addEventListener("click", () => {
  const text = currentSearchResults
    .map(entry => "```\n" + getCleanText(entry.text) + "\n```")
    .filter(Boolean)
    .join("\n\n");

  copyText(text, copySearchResultsBtn);
});

document.addEventListener("click", event => {
  const categoryButton = event.target.closest("[data-category]");
  if (categoryButton) {
    showCategory(categoryButton.dataset.category);
    return;
  }

  const npcButton = event.target.closest("[data-npc-key]");
if (npcButton) {
  showDialogueByDisplayName(npcButton.dataset.npcKey);
  return;
}

  const dialogueButton = event.target.closest("[data-dialogue-key]");
  if (dialogueButton) {
    showDialogue(dialogueButton.dataset.dialogueKey);
    return;
  }
  
  const langButton = event.target.closest("[data-lang-toggle]");
if (langButton) {
  const card = langButton.closest(".entry");
  if (!card) return;

  const nextLang = card.dataset.lang === "jp" ? "en" : "jp";
  updateEntryLanguage(card, nextLang);
  return;
}

const monsterButton = event.target.closest("[data-monster-key]");
if (monsterButton) {
  showDialogue(monsterButton.dataset.monsterKey);
  return;
}

  const copyButton = event.target.closest(".copy-btn");
  if (copyButton) {
    const card = copyButton.closest(".entry");
    if (!card) return;

    copyText(getCardCopyText(card), copyButton);
    return;
  }

  const wordButton = event.target.closest("[data-word-search]");
  if (wordButton) {
    search.value = wordButton.dataset.wordSearch;
    showHome();
    render();
    return;
  }

  const card = event.target.closest(".entry");
  if (card && window.matchMedia("(hover: none)").matches) {
    if (window.getSelection()?.toString()) return;

    const current = card.dataset.mode || "ids";
    card.dataset.mode =
      current === "ids"
        ? "clean"
        : current === "clean"
          ? "code"
          : "ids";
  }
});

menuBtn.addEventListener("click", openMenu);
closeMenuBtn.addEventListener("click", closeMenu);
menuOverlay.addEventListener("click", closeMenu);

homeBtn.addEventListener("click", () => showHome());
npcIndexBtn.addEventListener("click", () => showNpcIndex());
monsterIndexBtn.addEventListener("click", () => showMonsterIndex());
wordIndexBtn.addEventListener("click", () => showWordIndex());
themeToggleBtn.addEventListener("click", cycleTheme);

backFromCategoryBtn.addEventListener("click", goBack);
backFromNpcBtn.addEventListener("click", goBack);
backFromMonsterBtn.addEventListener("click", goBack);
backFromDialogueBtn.addEventListener("click", goBack);
backFromWordIndexBtn.addEventListener("click", goBack);

dialogueModeBtn.addEventListener("click", () => {
  dialogueDisplayMode =
    dialogueDisplayMode === "cards"
      ? "full"
      : "cards";

  if (npcGroups.has(currentDialogueKey) || monsterGroups.has(currentDialogueKey)) {
  showDialogue(currentDialogueKey, false);
} else {
  showDialogueByDisplayName(currentDialogueKey);
}
});

window.addEventListener("scroll", handleScroll, { passive: true });

(async () => {
  applyTheme(getSavedTheme());

  await loadJsonDatabase();
  buildJsonIndexes();

  await loadDump();
})();
