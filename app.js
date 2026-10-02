// app.js
// WildsDump / GUDump UI

const GAME_CONFIG = {
  wilds: {
    title: "WildsDump",
    tagline:
      "Search Monster Hunter Wilds text, dialogue, items, weapons, quests, tutorials, UI text, and NPC-related files.",
    // Updated dump (converted from the game's text files). To go back to
    // the previous version, use "./en_dump.txt" and "./jp_dump.txt".
    en: "./en_dump_new.txt",
    jp: "./jp_dump_new.txt",
    hasJson: true
  },
  gu: {
    title: "GUDump",
    tagline:
      "Search Monster Hunter Generations Ultimate text: items, weapons, armor, quests, Palico gear, and NPC dialogue.",
    en: "./gu_dump.txt",
    jp: "",
    hasJson: false
  },
  tri: {
    title: "TriDump",
    tagline:
      "Search Monster Hunter Tri text: item names and descriptions.",
    en: "./tri_dump.txt",
    jp: "",
    hasJson: false
  },
  fu: {
  title: "4UDump",
  tagline: "Search Monster Hunter 4 Ultimate text: NPC dialogue and other in-game text. The paragraphs are being manually separated via context, so deviations from in-game paragraphs are possible and likely.",
  en: "./4u_dump.txt",
  jp: "",
  hasJson: false
  },
  rise: {
    title: "RiseDump",
    tagline:
      "Search Monster Hunter Rise and Sunbreak text: NPC and follower dialogue, cutscenes, quests, Hunter's Notes, achievements, DLC and menus. NPCs are numbered (NPC 001…) until their names are mapped.",
    en: "./rise_en_dump.txt",
    jp: "./rise_jp_dump.txt",
    hasJson: false
  },
  world: {
    title: "WorldDump",
    tagline:
      "Search Monster Hunter World and Iceborne text: items, weapons, armor, skills, decorations, monsters, quests, NPC dialogue, cutscenes, tutorials and menus.",
    en: "./world_en_dump.txt",
    jp: "./world_jp_dump.txt",
    hasJson: false
  },
  // Combined mode: every game above, loaded together (see loadAllDumps).
  all: {
    title: "MonsterHunterDump",
    tagline:
      "Search all six games at once: Wilds, Rise, World, Generations Ultimate, 4 Ultimate and Tri. Results are grouped by game, newest first.",
    combined: true,
    hasJson: false
  }
};

// Newest to oldest. Tapping the title moves to the next (older) game and
// wraps from the last back to the first; the dropdown lists them in this order.
const GAME_ORDER = ["wilds", "rise", "world", "gu", "fu", "tri"];

// Full names, shown under each title in the dump dropdown.
const GAME_FULL_NAMES = {
  wilds: "Monster Hunter Wilds",
  rise: "Monster Hunter Rise: Sunbreak",
  world: "Monster Hunter: World – Iceborne",
  gu: "Monster Hunter Generations Ultimate",
  fu: "Monster Hunter 4 Ultimate",
  tri: "Monster Hunter Tri",
  all: "All games combined"
};

// Short names for the game badges on cards in the combined mode.
const GAME_SHORT_NAMES = {
  wilds: "Wilds",
  rise: "Rise",
  world: "World",
  gu: "GU",
  fu: "4U",
  tri: "Tri"
};

let ACTIVE_GAME = "wilds";

try {
  const savedGame = localStorage.getItem("wd_game");
  if (GAME_CONFIG[savedGame]) ACTIVE_GAME = savedGame;
} catch {}

// A shared link (#g=...) decides the game, overriding the saved one.
const initialRoute = parseRouteHash(location.hash);

if (initialRoute.g && GAME_CONFIG[initialRoute.g]) {
  ACTIVE_GAME = initialRoute.g;

  try {
    localStorage.setItem("wd_game", ACTIVE_GAME);
  } catch {}
}

// Lets the stylesheet pick this game's accent color.
document.documentElement.dataset.game = ACTIVE_GAME;

// Combined mode: all games loaded and searched together.
const IS_COMBINED = Boolean(GAME_CONFIG[ACTIVE_GAME]?.combined);

// The single game to return to when leaving the combined mode.
function getLastSingleGame() {
  try {
    const saved = localStorage.getItem("wd_last_game");
    if (GAME_ORDER.includes(saved)) return saved;
  } catch {}
  return GAME_ORDER[0];
}

if (!IS_COMBINED) {
  try {
    localStorage.setItem("wd_last_game", ACTIVE_GAME);
  } catch {}
}

const PAGE_SIZE = 80;
const WORD_PAGE_SIZE = 150;

const search = document.querySelector("#search");
const results = document.querySelector("#results");
const count = document.querySelector("#count");
const searchFilters = document.querySelector("#searchFilters");
const cardControls = document.querySelector("#cardControls");
const copySearchResultsBtn = document.querySelector("#copySearchResultsBtn");

const helpView = document.querySelector("#helpView");
const acrossView = document.querySelector("#acrossView");
const acrossContent = document.querySelector("#acrossContent");
let currentAcrossName = "";
const helpBtn = document.querySelector("#helpBtn");
const backFromHelpBtn = document.querySelector("#backFromHelpBtn");

const floatingSearch = document.querySelector("#floatingSearch");
const floatingSearchInput = document.querySelector("#floatingSearchInput");
const floatingSearchToggle = document.querySelector("#floatingSearchToggle");

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

const ARMOR_SERIES_BY_ID = new Map();

const backFromCategoryBtn = document.querySelector("#backFromCategoryBtn");
const backFromNpcBtn = document.querySelector("#backFromNpcBtn");
const backFromDialogueBtn = document.querySelector("#backFromDialogueBtn");
const backFromWordIndexBtn = document.querySelector("#backFromWordIndexBtn");

let sections = [];
let entries = [];
let categories = new Map();

// Caches the sorted "browse everything, no search query" entry order per
// category filter, so render() doesn't have to re-sort the entire entry
// list (up to ~200k for Wilds) on every keystroke/filter click when there's
// no active search. Cleared whenever `entries` is rebuilt (game switch,
// initial load).
let noSearchOrderCache = new Map();
let npcGroups = new Map();
let monsterGroups = new Map();
let activeMonsterKey = "";
let wordFrequency = [];

let activeWeaponTypeFilter = "All";

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

let currentHighlightTerms = [];
let activeWeaponDisplay = "cards";
let npcShowUnmappedOnly = false;

function openMenu() {
  menu.classList.add("open");
  menuOverlay.classList.add("open");
}

function closeMenu() {
  menu.classList.remove("open");
  menuOverlay.classList.remove("open");
}

function getAllViews() {
  return [
    searchView,
    categoryView,
    npcView,
    monsterView,
    dialogueView,
    wordIndexView,
    helpView,
    acrossView,
    typeof detailView !== "undefined" ? detailView : null,
    typeof compareView !== "undefined" ? compareView : null,
    typeof diffView !== "undefined" ? diffView : null,
    typeof sizeView !== "undefined" ? sizeView : null
  ].filter(Boolean);
}

function showOnly(view) {
  for (const candidate of getAllViews()) {
    candidate.hidden = candidate !== view;
  }

  resetMatchNavigation();
  scheduleUrlSync();
}

function pushViewHistory(view) {
  if (!view) return;
  viewHistory.push(view);

  // A real navigation: the address bar gets a new history entry, so the
  // browser's back gesture returns here.
  pendingUrlPush = true;
  scheduleUrlSync();
}

function captureCurrentView() {
  if (!searchView.hidden) return { type: "home" };
  if (!categoryView.hidden) return { type: "category", category: categoryTitle.textContent };
  if (!npcView.hidden) return { type: "npcIndex" };
  if (!monsterView.hidden) return { type: "monsterIndex" };
  if (!dialogueView.hidden) return { type: "dialogue", key: currentDialogueKey };
  if (!wordIndexView.hidden) return { type: "wordIndex" };
  if (!helpView.hidden) return { type: "help" };
  if (acrossView && !acrossView.hidden) return { type: "across", key: currentAcrossName };

  if (typeof detailView !== "undefined" && !detailView.hidden) {
    return { type: "detail", entityType: currentDetail?.type, key: currentDetail?.key };
  }

  if (typeof compareView !== "undefined" && !compareView.hidden) return { type: "compare" };
  if (typeof diffView !== "undefined" && !diffView.hidden) return { type: "diff", file: currentDiffFile };
  if (typeof sizeView !== "undefined" && !sizeView.hidden) return { type: "sizeCompare" };

  return { type: "home" };
}

// Shows a previously captured view state (see captureCurrentView) without
// adding a new history entry.
function showViewState(state) {
  if (!state || state.type === "home") {
    showHome(false);
    return;
  }

  if (state.type === "category") showCategory(state.category, false);
  if (state.type === "npcIndex") showNpcIndex(false);
  if (state.type === "monsterIndex") showMonsterIndex(false);
  if (state.type === "wordIndex") showWordIndex(false);
  if (state.type === "help") showHelp(false);
  if (state.type === "across") showAcross(state.key, false);

  if (state.type === "dialogue") {
    if (npcGroups.has(state.key) || monsterGroups.has(state.key)) {
      showDialogue(state.key, false);
    } else {
      showDialogueByDisplayName(state.key, false);
    }
  }

  if (state.type === "detail") showEntityDetail(state.entityType, state.key, false);
  if (state.type === "compare") showCompareView(false);
  if (state.type === "diff") showVersionDiff(false, state.file);
  if (state.type === "sizeCompare") showSizeComparison(false);
}

function goBack() {
  // When the app has added browser history entries, go back through the
  // browser so the in-app Back button and the back gesture stay in sync.
  if (routingReady && navDepth > 0) {
    history.back();
    return;
  }

  showViewState(viewHistory.pop());
}

/* ---------------------------------------------------------
   Across games (combined mode): one name in every game
   --------------------------------------------------------- */

const ACROSS_CATEGORIES = new Set(["Items", "Equipment", "Weapons", "Skills", "Monsters"]);

// World marks armor variants with icon tags ("Fatalis<ICON ALPHA>+");
// written out, they match the other games ("Rathalos Helm α").
function cleanAcrossName(value) {
  return String(value || "")
    .replace(/<ICON ALPHA>/gi, " α")
    .replace(/<ICON BETA>/gi, " β")
    .replace(/<ICON GAMMA>/gi, " γ")
    .replace(/<[^<>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const normalizeAcrossName = value => cleanAcrossName(value).toLowerCase();

// The name a card stands for, if it's a name card (item, weapon, skill…):
// its name, or a short one-line text that is just a name (World).
function getAcrossName(entry) {
  if (!ACROSS_CATEGORIES.has(entry.category)) return "";

  if (entry.name) return cleanAcrossName(entry.name);

  const text = cleanAcrossName(entry.text);
  if (!text || text.includes("\n") || text.length > 48) return "";
  if (/[.!?…:,;]$/.test(text)) return "";
  return text;
}

// A line that reads like a description rather than another name.
function looksLikeDescription(text) {
  const t = String(text || "").trim();
  return Boolean(t) && (t.includes("\n") || /[.!?…]$/.test(t) || t.length > 48);
}

function findAcrossMatches(name) {
  const target = normalizeAcrossName(name);
  const byGame = new Map(GAME_ORDER.map(key => [key, []]));
  const seen = new Set();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const list = byGame.get(entry.game);
    if (!list) continue;

    let match = null;

    if (entry.name && normalizeAcrossName(entry.name) === target) {
      match = { entry, name: entry.name, text: entry.text, nameJp: entry.nameJp, textJp: entry.textJp };
    } else if (!entry.name && !String(entry.text || "").includes("\n") && normalizeAcrossName(entry.text) === target) {
      // A name line (World): its description is the next line in the same file.
      const next = entries[i + 1];
      const hasDescription =
        next && next.game === entry.game && next.sourceFile === entry.sourceFile && looksLikeDescription(next.text);

      match = {
        entry,
        name: entry.text.trim(),
        text: hasDescription ? next.text : "",
        nameJp: entry.textJp || "",
        textJp: hasDescription ? next.textJp || "" : ""
      };
    }

    if (!match) continue;
    list.push(match);
  }

  // Prefer the real item/equipment/skill/monster files over copies of the
  // same text elsewhere (like World's help text), then drop duplicates.
  for (const [key, list] of byGame) {
    list.sort((a, b) =>
      Number(!ACROSS_CATEGORIES.has(a.entry.category)) - Number(!ACROSS_CATEGORIES.has(b.entry.category))
    );

    const unique = [];
    for (const match of list) {
      const dedupe = `${normalizeAcrossName(match.name)}|${normalizeAcrossName(match.text)}`;
      if (seen.has(`${key}|${dedupe}`)) continue;
      seen.add(`${key}|${dedupe}`);
      if (unique.length < 8) unique.push(match);
    }

    byGame.set(key, unique);
  }

  return byGame;
}

/* Differences on the Across page: each game's description compared word by
   word with the next newer game above it. Line breaks (text box widths)
   and capitalization are ignored; words that differ are highlighted. */
const DIFF_TOKEN_PATTERN = /[\p{L}\p{N}'’-]+|[^\s\p{L}\p{N}'’-]+|\s+/gu;

function tokenizeForDiff(text) {
  return String(text || "").match(DIFF_TOKEN_PATTERN) || [];
}

// Indices (into tokens) of the words that are not shared with the other text.
function findChangedTokens(tokens, otherTokens) {
  const a = [];
  const b = [];

  tokens.forEach((token, index) => {
    if (!/^\s+$/.test(token)) a.push({ index, key: token.toLowerCase() });
  });
  otherTokens.forEach(token => {
    if (!/^\s+$/.test(token)) b.push(token.toLowerCase());
  });

  // Very long texts: skip rather than slow the page down.
  if (!a.length || !b.length || a.length * b.length > 250000) return null;

  // Longest common subsequence of the words.
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = new Uint16Array(rows * cols);

  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * cols + j] = a[i].key === b[j]
        ? table[(i + 1) * cols + j + 1] + 1
        : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
    }
  }

  const changed = new Set();
  let i = 0;
  let j = 0;

  while (i < a.length) {
    if (j < b.length && a[i].key === b[j]) {
      i++;
      j++;
    } else if (j < b.length && table[i * cols + j + 1] > table[(i + 1) * cols + j]) {
      j++;
    } else {
      changed.add(a[i].index);
      i++;
    }
  }

  return changed;
}

// The text with its changed words wrapped in one highlight per run.
function renderDiffText(text, changed) {
  const tokens = tokenizeForDiff(text);
  let html = "";
  let open = false;

  tokens.forEach((token, index) => {
    const isSpace = /^\s+$/.test(token);
    const isChanged = changed.has(index);

    // A space between two changed words stays inside the highlight.
    const nextChanged = [...tokens.slice(index + 1)].findIndex(t => !/^\s+$/.test(t));
    const continues = isSpace && open && nextChanged >= 0 && changed.has(index + 1 + nextChanged);

    if (open && !isChanged && !continues) {
      html += "</mark>";
      open = false;
    }

    if (!open && isChanged) {
      html += '<mark class="diff-mark">';
      open = true;
    }

    html += isSpace
      ? (token.includes("\n") ? "<br>" : " ")
      : escapeHtml(token);
  });

  if (open) html += "</mark>";
  return html;
}

function renderAcross(name) {
  const byGame = findAcrossMatches(name);
  const found = GAME_ORDER.filter(key => byGame.get(key).length);
  const missing = GAME_ORDER.filter(key => !byGame.get(key).length);

  // Each game compares with the closest newer game above it that has a text.
  let previousText = "";
  let previousGame = "";

  const cards = found.map(key => {
    const firstText = getCleanText(byGame.get(key)[0]?.text || "", key);
    const compareText = previousText;
    const compareGame = previousGame;

    if (firstText) {
      previousText = firstText;
      previousGame = key;
    }

    const matches = byGame.get(key).map((match, matchIndex) => {
      const text = getCleanText(match.text, key);

      let textHtml = text ? formatEntryText(text, {}) : "";
      let diffNote = "";

      if (text && compareText && matchIndex === 0) {
        const changed = findChangedTokens(tokenizeForDiff(text), tokenizeForDiff(compareText));

        if (changed) {
          const compareName = escapeHtml(GAME_CONFIG[compareGame].title);
          textHtml = renderDiffText(text, changed);
          diffNote = changed.size
            ? `<div class="diff-note"><span class="diff-swatch" aria-hidden="true"></span>Differences from ${compareName}</div>`
            : `<div class="diff-note is-same">Same wording as ${compareName}</div>`;
        }
      }

      const textJp = getCleanText(match.textJp, key);
      const hasJp = Boolean(match.nameJp || textJp);

      return `
        <div class="across-match">
          <div class="across-name">${escapeHtml(cleanAcrossName(match.name))}</div>
          ${text ? `<div class="across-text">${textHtml}</div>` : ""}
          ${diffNote}
          <div class="across-meta">${escapeHtml(match.entry.category || "")} · ${escapeHtml(match.entry.sourceFile || "")}</div>
          ${hasJp ? `
            <details class="across-jp">
              <summary>Japanese</summary>
              ${match.nameJp ? `<div class="across-name">${escapeHtml(cleanAcrossName(match.nameJp))}</div>` : ""}
              ${textJp ? `<div class="across-text">${formatEntryText(textJp, {})}</div>` : ""}
            </details>
          ` : ""}
        </div>
      `;
    }).join("");

    return `
      <article class="across-card" data-game="${escapeAttribute(key)}">
        <header class="across-card-head">
          <span class="game-badge-dot" aria-hidden="true"></span>
          <span class="across-card-title">
            <strong>${escapeHtml(GAME_CONFIG[key].title)}</strong>
            <small>${escapeHtml(GAME_FULL_NAMES[key] || "")}</small>
          </span>
        </header>
        ${matches}
      </article>
    `;
  }).join("");

  return `
    <div class="across-hero">
      <span class="across-eyebrow">Across games</span>
      <p>Found in ${found.length} of ${GAME_ORDER.length} games</p>
    </div>
    <div class="across-list">${cards || '<div class="empty">Not found in any game.</div>'}</div>
    ${missing.length && found.length ? `
      <p class="across-missing">Not found in ${missing.map(key => escapeHtml(GAME_SHORT_NAMES[key])).join(", ")}.</p>
    ` : ""}
  `;
}

function showAcross(name, addToHistory = true) {
  if (!acrossView || !name) return;

  if (addToHistory) {
    pushViewHistory(captureCurrentView());
  }

  currentAcrossName = name;
  document.querySelector("#acrossTitle").textContent = name;
  acrossContent.innerHTML = renderAcross(name);
  showOnly(acrossView);
  closeMenu();
  window.scrollTo({ top: 0 });
}

document.querySelector("#backFromAcrossBtn")?.addEventListener("click", () => goBack());

document.addEventListener("click", event => {
  const button = event.target.closest("[data-across]");
  if (!button) return;
  showAcross(button.dataset.across);
});

function showHelp(addToHistory = true) {
  if (addToHistory && helpView.hidden) {
    pushViewHistory(captureCurrentView());
  }

  showOnly(helpView);
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------------------------------------------------------
   Shareable links
   The address bar mirrors the current game, page, search and
   type filter, e.g. #g=fu&q=ancient&t=Items or
   #g=wilds&v=dialogue&k=NPC102_00_001.
   --------------------------------------------------------- */

let routingReady = false;
let navDepth = 0;
let pendingUrlPush = false;
let urlSyncQueued = false;

function parseRouteHash(hash) {
  const params = new URLSearchParams(String(hash || "").replace(/^#/, ""));

  return {
    g: params.get("g") || "",
    q: params.get("q") || "",
    t: params.get("t") || "All",
    e: params.get("e") || "",
    view: {
      type: params.get("v") || "home",
      category: params.get("c") || "",
      key: params.get("k") || "",
      entityType: params.get("et") || "",
      file: params.get("f") || ""
    }
  };
}

function buildRouteHash() {
  const view = captureCurrentView();
  const params = new URLSearchParams();

  params.set("g", ACTIVE_GAME);

  if (view.type === "home") {
    const q = search.value.trim();
    if (q) params.set("q", q);
    if (activeTypeFilter !== "All") params.set("t", activeTypeFilter);
  } else {
    params.set("v", view.type);
    if (view.category) params.set("c", view.category);
    if (view.key) params.set("k", view.key);
    if (view.entityType) params.set("et", view.entityType);
    if (view.file) params.set("f", view.file);
  }

  return "#" + params.toString();
}

function scheduleUrlSync() {
  if (urlSyncQueued) return;
  urlSyncQueued = true;

  // Runs after the current navigation has finished updating its state.
  queueMicrotask(flushUrlSync);
}

// Highlights the menu entry for the page you're on.
function updateMenuActive() {
  const view = captureCurrentView();

  const selectors = {
    home: "#homeBtn",
    npcIndex: "#npcIndexBtn",
    monsterIndex: "#monsterIndexBtn",
    wordIndex: "#wordIndexBtn",
    help: "#helpBtn",
    compare: "#compareViewBtn",
    diff: "#versionDiffBtn",
    sizeCompare: "#sizeCompareBtn"
  };

  let active = selectors[view.type] ? menu.querySelector(selectors[view.type]) : null;

  if (view.type === "category") {
    active = [...menu.querySelectorAll("[data-category]")]
      .find(button => button.dataset.category === view.category) || null;
  }

  menu.querySelectorAll(".is-current").forEach(el => {
    el.classList.remove("is-current");
    el.removeAttribute("aria-current");
  });

  if (active) {
    active.classList.add("is-current");
    active.setAttribute("aria-current", "page");
  }
}

// Browser tab / bookmark title: "Alma · WildsDump", "“ancient” · WildsDump".
function updateDocumentTitle() {
  const game = GAME_CONFIG[ACTIVE_GAME]?.title || "WildsDump";
  const page = getVisiblePage();
  let label = "";

  if (page === searchView) {
    const q = search.value.trim();
    if (q) label = `“${q}”`;
  } else {
    label = page?.querySelector(".view-header h2")?.textContent.trim() || "";
  }

  document.title = label ? `${label} · ${game}` : game;
}

function flushUrlSync() {
  urlSyncQueued = false;

  const push = pendingUrlPush;
  pendingUrlPush = false;

  updateMenuActive();
  updateDocumentTitle();

  if (!routingReady) return;

  const hash = buildRouteHash();
  if (hash === location.hash) return;

  try {
    if (push) {
      history.pushState({ depth: navDepth + 1 }, "", hash);
      navDepth++;
    } else {
      history.replaceState({ depth: navDepth }, "", hash);
    }
  } catch {}
}

/* Card links: tapping a card's ID badge copies a link that opens exactly
   that entry (a search for its file and ID) and highlights its card. */
function getEntryRef(entry) {
  return `${entry.sourceFile}#${entry.id}`;
}

function buildEntryLink(entry) {
  const params = new URLSearchParams();
  params.set("g", entry.game || ACTIVE_GAME);
  params.set("q", `file:"${entry.sourceFile}" id:"${entry.id}"`);
  params.set("e", getEntryRef(entry));
  return `${location.origin}${location.pathname}#${params.toString()}`;
}

function highlightLinkedEntry(ref) {
  const card = [...results.querySelectorAll(".entry[data-card-key]")]
    .find(candidate => {
      const entry = getCardEntry(candidate);
      return entry && getEntryRef(entry) === ref;
    });

  if (!card) return;

  card.classList.add("is-linked");

  requestAnimationFrame(() => {
    const rect = card.getBoundingClientRect();
    if (rect.top > window.innerHeight * 0.6) {
      window.scrollTo({ top: rect.top + window.scrollY - window.innerHeight * 0.25 });
    }
  });

  setTimeout(() => card.classList.remove("is-linked"), 4200);
}

function copyEntryLink(badge) {
  const entry = getCardEntry(badge.closest(".entry"));
  if (!entry) return;
  copyText(buildEntryLink(entry), badge, "Link copied");
}

document.addEventListener("click", event => {
  const badge = event.target.closest("[data-copy-entry-link]");
  if (badge) copyEntryLink(badge);
});

document.addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const badge = event.target.closest?.("[data-copy-entry-link]");
  if (!badge) return;
  event.preventDefault();
  copyEntryLink(badge);
});

function applySearchRoute(route) {
  const q = route.q || "";
  const t = route.t && categories.has(route.t) ? route.t : "All";

  search.value = q;
  if (floatingSearchInput) floatingSearchInput.value = q;

  activeTypeFilter = t;
  updateSearchFilterButtons();
}

// Called once after the dump has loaded: opens whatever the link points to.
function applyInitialRoute() {
  const route = initialRoute;

  if (route.view.type === "home") {
    if (route.q || route.t !== "All") {
      applySearchRoute(route);
      render();
    }

    if (route.e) highlightLinkedEntry(route.e);
  } else {
    try {
      showViewState(route.view);
    } catch (error) {
      console.error(error);
      showHome(false);
    }
  }

  routingReady = true;
  viewHistory = [];
  navDepth = 0;

  try {
    history.replaceState({ depth: 0 }, "", buildRouteHash());
  } catch {}
}

window.addEventListener("popstate", event => {
  if (!routingReady) return;

  const route = parseRouteHash(location.hash);

  // A link or history entry for another game needs that game's data.
  if (route.g && route.g !== ACTIVE_GAME && GAME_CONFIG[route.g]) {
    location.reload();
    return;
  }

  navDepth = event.state?.depth ?? 0;
  viewHistory = [];

  if (route.view.type === "home") {
    applySearchRoute(route);
  }

  showViewState(route.view);
});

function showHome(addToHistory = true) {
  if (addToHistory && searchView.hidden) {
    pushViewHistory(captureCurrentView());
  }

  showOnly(searchView);
  closeMenu();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showCategory(category, addToHistory = true) {
  if (addToHistory) {
    pushViewHistory(captureCurrentView());
  }

  categoryTitle.textContent = category;

  if (category === "Weapons") {
    activeWeaponTypeFilter = "All";
    renderWeaponCategoryResults();
    showOnly(categoryView);
    closeMenu();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  renderEntryList({
    target: categoryResults,
    items: categories.get(category) || [],
    emptyText: "No entries found.",
    highlightTerms: []
  });

  showOnly(categoryView);
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderWeaponCategoryResults() {
  currentHighlightTerms = [];

  // The upgrade tree is built from the Wilds JSON database.
  const treeAvailable = GAME_CONFIG[ACTIVE_GAME].hasJson;

  if (!treeAvailable) {
    activeWeaponDisplay = "cards";
  }

  const filterHtml = `
    <section class="weapon-type-filter">
      <button class="filter-chip" type="button" data-weapon-type-filter="All">
        All
      </button>

      ${WEAPON_TYPE_ORDER.map(type => `
        <button class="filter-chip" type="button" data-weapon-type-filter="${escapeAttribute(type)}">
          ${escapeHtml(getWeaponTypeLabel(type))}
        </button>
      `).join("")}
    </section>

    ${treeAvailable ? `
      <section class="weapon-type-filter weapon-display-toggle">
        <span class="filter-label">View</span>
        <button class="filter-chip" type="button" data-weapon-display="cards">Cards</button>
        <button class="filter-chip" type="button" data-weapon-display="tree">Upgrade tree</button>
      </section>
    ` : ""}
  `;

  let contentHtml = "";

  if (activeWeaponDisplay === "tree") {
    const types =
      activeWeaponTypeFilter === "All"
        ? WEAPON_TYPE_ORDER
        : [activeWeaponTypeFilter];

    contentHtml = types.map(type => `
      <h3 class="detail-section-title">${escapeHtml(getWeaponTypeLabel(type))}</h3>
      ${renderWeaponTypeTreeHtml(type)}
    `).join("");
  } else {
    const weaponItems = (categories.get("Weapons") || [])
      .filter(entry =>
        activeWeaponTypeFilter === "All" ||
        getEntryWeaponFile(entry) === activeWeaponTypeFilter
      );

    contentHtml = weaponItems.length
      ? weaponItems.map(renderEntry).join("")
      : `<div class="empty">No weapons found.</div>`;
  }

  categoryResults.innerHTML = `
    ${filterHtml}
    <section class="results weapon-filtered-results">
      ${contentHtml}
    </section>
  `;

  categoryResults.querySelectorAll("[data-weapon-type-filter]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.weaponTypeFilter === activeWeaponTypeFilter
    );
  });

  categoryResults.querySelectorAll("[data-weapon-display]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.weaponDisplay === activeWeaponDisplay
    );
  });
}

function showNpcIndex(addToHistory = true) {
  if (addToHistory) {
    pushViewHistory(captureCurrentView());
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

  // --- mapping coverage stats ---
  const mappedGroups = groups.filter(isManuallyNamedNpcGroup);
  const totalLines = groups.reduce((sum, group) => sum + group.entries.length, 0);
  const mappedLines = mappedGroups.reduce((sum, group) => sum + group.entries.length, 0);

  const groupPct = groups.length
    ? Math.round((mappedGroups.length / groups.length) * 100)
    : 0;

  const linePct = totalLines
    ? Math.round((mappedLines / totalLines) * 100)
    : 0;

  const visibleGroups = npcShowUnmappedOnly
    ? groups.filter(group => !isManuallyNamedNpcGroup(group))
        .sort((a, b) => b.entries.length - a.entries.length)
    : groups;

  const statsHtml = `
    <article class="entry detail-card npc-coverage">
      <div class="entry-section">NPC mapping coverage</div>

      <div class="json-grid">
        <div class="json-fact">
          <span>Named groups</span>
          <strong>${mappedGroups.length} / ${groups.length} (${groupPct}%)</strong>
        </div>
        <div class="json-fact">
          <span>Lines covered</span>
          <strong>${mappedLines.toLocaleString()} / ${totalLines.toLocaleString()} (${linePct}%)</strong>
        </div>
      </div>

      <div class="coverage-bar-track">
        <span class="coverage-bar" style="width:${groupPct}%"></span>
      </div>

      <div class="pill-row">
        <button
          class="filter-chip ${npcShowUnmappedOnly ? "active" : ""}"
          type="button"
          data-npc-unmapped-toggle
        >
          ${npcShowUnmappedOnly ? "Showing unmapped only" : "Show unmapped only"}
        </button>
      </div>
    </article>
  `;

  npcList.innerHTML = statsHtml + visibleGroups.map(group => {
    const types = new Set(group.entries.map(entry => entry.dialogueType).filter(Boolean));
    const mapped = isManuallyNamedNpcGroup(group);

    return `
      <button class="npc-item ${mapped ? "" : "npc-item-unmapped"}" type="button" data-npc-key="${escapeAttribute(group.name)}">
        <span>${escapeHtml(group.name)} ${mapped ? "" : "· ⚠ unmapped"}</span>
        <small>${plural(group.entries.length, "line")} · ${plural(group.keys.length, "file")} · ${plural(types.size, "type")}</small>
      </button>
    `;
  }).join("");

  showOnly(npcView);
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showMonsterIndex(addToHistory = true) {
  if (addToHistory) {
    pushViewHistory(captureCurrentView());
  }

  activeMonsterKey = "";

  renderMonsterIndex();

  showOnly(monsterView);
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderMonsterIndex() {
  currentHighlightTerms = [];

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

    const activeGroup = activeMonsterKey
      ? monsterGroups.get(activeMonsterKey)
      : null;

    return `
      <section class="monster-index-section">
        <div class="monster-section-header">
          <h3>${escapeHtml(sectionName)}</h3>
          <span>${items.length}</span>
        </div>

        <div class="monster-chip-row">
          ${items.map(([name]) => `
            <button
              class="monster-chip ${name === activeMonsterKey ? "active" : ""}"
              type="button"
              data-monster-chip="${escapeAttribute(name)}"
            >
              ${escapeHtml(name)}
            </button>
          `).join("")}
        </div>

        ${
          activeGroup && items.some(([name]) => name === activeMonsterKey)
            ? `
              <div class="monster-inline-card results">
                ${renderEntry(activeGroup[0])}
              </div>
            `
            : ""
        }
      </section>
    `;
  }).join("");
}

function isManuallyNamedNpcGroup(group) {
  return group.entries.some(entry => {
    if (entry.speaker) return true;
    if (entry.dialogueId && NPC_MAP?.[entry.dialogueId]) return true;
    if (entry.fileKey && GOSSIP_MAP?.[entry.fileKey]) return true;
    if (entry.fileKey && DIALOGUE_MAP?.[entry.fileKey]) return true;

    return false;
  });
}

function showDialogueByDisplayName(name, addToHistory = true) {
  if (addToHistory && !(dialogueView && !dialogueView.hidden && currentDialogueKey === name)) {
    pushViewHistory(captureCurrentView());
  }

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
    currentHighlightTerms = [];
    dialogueResults.innerHTML = renderFullDialogue(combined);
  } else {
    renderEntryList({
      target: dialogueResults,
      items: combined,
      emptyText: "No dialogue found.",
      highlightTerms: []
    });
  }

  showOnly(dialogueView);
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showDialogue(key, addToHistory = true) {
  if (addToHistory) {
    pushViewHistory(captureCurrentView());
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
    currentHighlightTerms = [];
    dialogueResults.innerHTML = renderFullDialogue(group);
  } else {
    renderEntryList({
      target: dialogueResults,
      items: group,
      emptyText: "No dialogue found.",
      highlightTerms: []
    });
  }

  showOnly(dialogueView);
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showWordIndex(addToHistory = true) {
  if (addToHistory) {
    pushViewHistory(captureCurrentView());
  }

  // Word frequency index is built lazily on first open (it is expensive).
  if (!wordFrequency.length) {
    wordIndexResults.innerHTML = '<div class="empty">Building word index…</div>';
    buildWordFrequencyIndex();
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
  // Only curated categories from CATEGORY_ORDER - auto-generated leftover
  // families (title-cased file names) are intentionally not listed.
  const names = CATEGORY_ORDER.filter(category => categories.has(category));

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

/* When a search only adds to the previous one ("rath" -> "rathalos", or an
   extra word), its matches are a subset of the previous matches, so only
   those need checking. Each part of the old search must still be there:
   same operator, and a value that contains the old one. Results are
   identical to a full search; anything else does a full search. */
let lastSearchMatch = null; // { tokens, source, matched }

function isSearchRefinement(previousTokens, tokens) {
  return previousTokens.every(previous => {
    const oldValue = previous.value.toLowerCase();
    const oldHasSpace = /\s/.test(oldValue);

    return tokens.some(token =>
      token.operator === previous.operator &&
      token.value.toLowerCase().includes(oldValue) &&
      // A phrase with spaces is only implied by a phrase containing it.
      (!oldHasSpace || (previous.exact && token.exact))
    );
  });
}

function getSearchMatches(tokens) {
  const source =
    lastSearchMatch &&
    lastSearchMatch.source === entries &&
    isSearchRefinement(lastSearchMatch.tokens, tokens)
      ? lastSearchMatch.matched
      : entries;

  const matched = [];

  for (const entry of source) {
    if (entryMatchesSearch(entry, tokens)) matched.push(entry);
  }

  lastSearchMatch = { tokens, source: entries, matched };
  return matched;
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
  if (IS_COMBINED) return renderCombined();

  const tokens = tokenizeSearchQuery(search.value.trim());
  currentSearchTokens = tokens;

  let orderedEntries;

  if (!tokens.length) {
    // No active search: the relevance score is 0 for every entry, so the
    // full sort below always falls through to the same sourceFile/id
    // comparator. Cache that result per category filter instead of
    // re-running a full sort (up to ~200k entries for Wilds) on every
    // render() call.
    if (!noSearchOrderCache.has(activeTypeFilter)) {
      const defaultOrder = entries.filter(matchesActiveFilter);

      defaultOrder.sort((a, b) =>
        String(a.sourceFile).localeCompare(String(b.sourceFile)) ||
        Number(a.id) - Number(b.id)
      );

      noSearchOrderCache.set(activeTypeFilter, defaultOrder);
    }

    orderedEntries = noSearchOrderCache.get(activeTypeFilter);
    updateFilterChipCounts(null);
  } else {
    const visible = [];
    const categoryCounts = new Map();

    for (const entry of getSearchMatches(tokens)) {
      // Counted before the type filter, so each chip shows how many
      // results it would give for this search.
      categoryCounts.set(entry.category, (categoryCounts.get(entry.category) || 0) + 1);

      if (!matchesActiveFilter(entry)) continue;

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

    orderedEntries = visible.map(item => item.entry);
    updateFilterChipCounts(categoryCounts);
  }

  currentSearchResults = orderedEntries;

  // "Copy all results" only makes sense while actually searching.
  copySearchResultsBtn.hidden = !(tokens.length && orderedEntries.length);

  count.textContent =
    `${currentSearchResults.length} ${currentSearchResults.length === 1 ? "entry" : "entries"}`;

  renderEntryList({
    target: results,
    items: currentSearchResults,
    emptyText: "No entries found.",
    highlightTerms: tokens
      .filter(token => token.operator === "text" || token.operator === "name")
      .map(token => token.value)
  });

  resetMatchNavigation();
  scheduleUrlSync();
}

// Shows how many search results each Type chip has (and the total on
// "All"), greying out chips with none. Pass null to clear the counts.
function updateFilterChipCounts(counts) {
  let total = 0;
  if (counts) for (const n of counts.values()) total += n;

  searchFilters.querySelectorAll("[data-type-filter], [data-clear-filters]").forEach(button => {
    let badge = button.querySelector(".chip-count");

    if (!counts) {
      badge?.remove();
      button.classList.remove("is-empty");
      return;
    }

    const n = button.hasAttribute("data-clear-filters")
      ? total
      : counts.get(button.dataset.typeFilter) || 0;

    if (!badge) {
      badge = document.createElement("span");
      badge.className = "chip-count";
      button.append(badge);
    }

    badge.textContent = n.toLocaleString();
    button.classList.toggle("is-empty", n === 0);
  });
}

/* ---------------------------------------------------------
   Combined mode: rendering
   --------------------------------------------------------- */

const activeGameFilters = new Set(); // empty = all games
let combinedExpanded = null;         // null = default (first section open)
const combinedShown = {};            // game -> number of cards rendered

function getGameFilterRow() {
  return document.querySelector("#gameFilters");
}

function matchesGameFilter(entry) {
  return !activeGameFilters.size || activeGameFilters.has(entry.game);
}

function renderGameFilterRow(counts) {
  const row = getGameFilterRow();
  if (!row) return;

  row.hidden = false;
  row.innerHTML = GAME_ORDER.map(key => {
    const n = counts ? counts.get(key) || 0 : null;
    const active = activeGameFilters.has(key);

    return `
      <button
        class="game-chip${active ? " active" : ""}${counts && !n ? " is-empty" : ""}"
        type="button"
        data-game="${escapeAttribute(key)}"
        data-game-filter="${escapeAttribute(key)}"
        aria-pressed="${active}"
      >
        <span class="game-badge-dot" aria-hidden="true"></span>
        <span>${escapeHtml(GAME_SHORT_NAMES[key])}</span>
        ${counts ? `<span class="chip-count">${n.toLocaleString()}</span>` : ""}
      </button>
    `;
  }).join("");
}

function renderCombinedStart() {
  const tiles = GAME_ORDER.map(key => {
    const state = combinedLoadState[key];
    const n = combinedEntryCounts[key];
    const label =
      state === "done" ? `${n.toLocaleString()} entries` :
      state === "error" ? "Could not load" : "Loading…";

    return `
      <div class="game-tile" data-game="${escapeAttribute(key)}">
        <span class="game-badge-dot" aria-hidden="true"></span>
        <span class="game-tile-text">
          <strong>${escapeHtml(GAME_CONFIG[key].title)}</strong>
          <small>${escapeHtml(label)}</small>
        </span>
      </div>
    `;
  }).join("");

  return `
    <div class="combined-start">
      <h3>Search across all six games</h3>
      <p>Type a word, name or phrase above. Results are grouped by game, newest first.</p>
      <div class="game-tiles">${tiles}</div>
    </div>
  `;
}

function renderGameSectionCards(key, list, from, to) {
  let html = "";

  for (const entry of list.slice(from, to)) {
    try {
      html += renderEntry(entry);
    } catch (error) {
      console.error(error);
    }
  }

  return html;
}

function renderCombined() {
  const tokens = tokenizeSearchQuery(search.value.trim());
  currentSearchTokens = tokens;

  // Grouped sections page themselves; the infinite scroll stays idle.
  currentRenderTarget = null;
  currentVisibleEntries = [];
  renderedEntryCount = 0;
  currentHighlightTerms = tokens
    .filter(token => token.operator === "text" || token.operator === "name")
    .map(token => token.value);

  if (!tokens.length) {
    combinedGroupSizes.clear();
    currentSearchResults = [];
    copySearchResultsBtn.hidden = true;
    updateFilterChipCounts(null);
    renderGameFilterRow(null);

    const loaded = GAME_ORDER.filter(key => combinedLoadState[key] === "done").length;
    count.textContent = `${loaded} of ${GAME_ORDER.length} games`;
    results.innerHTML = renderCombinedStart();

    resetMatchNavigation();
    scheduleUrlSync();
    return;
  }

  const groups = new Map(GAME_ORDER.map(key => [key, []]));
  const categoryCounts = new Map();
  const gameCounts = new Map();

  for (const entry of getSearchMatches(tokens)) {
    // Type chips count within the selected games; game chips within the
    // selected type, so each shows what selecting it would give.
    if (matchesGameFilter(entry)) {
      categoryCounts.set(entry.category, (categoryCounts.get(entry.category) || 0) + 1);
    }

    if (matchesActiveFilter(entry)) {
      gameCounts.set(entry.game, (gameCounts.get(entry.game) || 0) + 1);
    }

    if (!matchesActiveFilter(entry) || !matchesGameFilter(entry)) continue;

    groups.get(entry.game)?.push({ entry, score: getSearchRelevance(entry, tokens) });
  }

  const ordered = new Map();

  for (const [key, list] of groups) {
    list.sort((a, b) =>
      b.score - a.score ||
      String(a.entry.sourceFile).localeCompare(String(b.entry.sourceFile)) ||
      Number(a.entry.id) - Number(b.entry.id)
    );
    if (list.length) ordered.set(key, list.map(item => item.entry));
  }

  currentSearchResults = [...ordered.values()].flat();
  copySearchResultsBtn.hidden = !currentSearchResults.length;

  updateFilterChipCounts(categoryCounts);
  renderGameFilterRow(gameCounts);

  const total = currentSearchResults.length;
  count.textContent =
    `${total.toLocaleString()} ${total === 1 ? "entry" : "entries"} in ${ordered.size} ${ordered.size === 1 ? "game" : "games"}`;

  if (!total) {
    combinedGroupSizes.clear();
    results.innerHTML = `<div class="empty">No entries found in any game.</div>`;
    resetMatchNavigation();
    scheduleUrlSync();
    return;
  }

  combinedGroupSizes.clear();
  for (const [key, list] of ordered) combinedGroupSizes.set(key, list.length);

  const firstWithResults = [...ordered.keys()][0];

  // If none of the sections you opened have results for this search,
  // open the first one that does (your choices stay remembered).
  const keepChoices = combinedExpanded && [...ordered.keys()].some(key => combinedExpanded.has(key));

  const sectionsBar = ordered.size > 1
    ? `
      <div class="combined-bar">
        <button class="sections-toggle" type="button" data-sections-toggle data-action="open">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9l5-5 5 5"/><path d="M7 15l5 5 5-5"/></svg>
          <span data-sections-label>Open all</span>
        </button>
      </div>
    `
    : "";

  results.innerHTML = sectionsBar + [...ordered.entries()].map(([key, list]) => {
    const open = keepChoices
      ? combinedExpanded.has(key)
      : key === firstWithResults;
    const shown = open ? Math.min(list.length, PAGE_SIZE) : 0;
    combinedShown[key] = shown;

    return `
      <section class="game-section${open ? " is-open" : ""}" data-game="${escapeAttribute(key)}">
        <button class="game-section-header" type="button" data-game-section="${escapeAttribute(key)}" aria-expanded="${open}">
          <span class="game-badge-dot" aria-hidden="true"></span>
          <span class="game-section-title">
            <strong>${escapeHtml(GAME_CONFIG[key].title)}</strong>
            <small>${escapeHtml(GAME_FULL_NAMES[key] || "")}</small>
          </span>
          <span class="game-section-count">${list.length.toLocaleString()}</span>
          <svg class="game-section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="game-section-body">
          ${open ? renderGameSectionCards(key, list, 0, shown) : ""}
          ${open && shown < list.length ? renderShowMoreButton(key, list.length - shown) : ""}
        </div>
      </section>
    `;
  }).join("");

  updateSectionsToggle();
  updateStuckHeaders();
  resetMatchNavigation();
  scheduleUrlSync();
}

function renderShowMoreButton(key, left) {
  return `
    <button class="game-show-more" type="button" data-game-more="${escapeAttribute(key)}">
      Show ${Math.min(left, PAGE_SIZE).toLocaleString()} more
      <small>${left.toLocaleString()} left</small>
    </button>
  `;
}

function getCombinedGroup(key) {
  return currentSearchResults.filter(entry => entry.game === key);
}

// Sizes of the game groups in the current results (for "more to load").
const combinedGroupSizes = new Map();

function getGameSection(key) {
  return results.querySelector(`.game-section[data-game="${CSS.escape(key)}"]`);
}

function rememberOpenSections() {
  if (combinedExpanded === null) {
    combinedExpanded = new Set(
      [...results.querySelectorAll(".game-section.is-open")].map(el => el.dataset.game)
    );
  }
}

function openGameSection(key) {
  const section = getGameSection(key);
  if (!section || section.classList.contains("is-open")) return;

  rememberOpenSections();
  combinedExpanded.add(key);

  const list = getCombinedGroup(key);
  const shown = Math.min(list.length, PAGE_SIZE);
  combinedShown[key] = shown;

  section.classList.add("is-open");
  section.querySelector(".game-section-header").setAttribute("aria-expanded", "true");
  section.querySelector(".game-section-body").innerHTML =
    renderGameSectionCards(key, list, 0, shown) +
    (shown < list.length ? renderShowMoreButton(key, list.length - shown) : "");

  updateSectionsToggle();
}

function closeGameSection(key) {
  const section = getGameSection(key);
  if (!section || !section.classList.contains("is-open")) return;

  rememberOpenSections();
  combinedExpanded.delete(key);
  combinedShown[key] = 0;

  // If its header was pinned, scroll back to where the section starts, so
  // closing doesn't leave the page somewhere further down.
  const header = section.querySelector(".game-section-header");
  const wasStuck = header.classList.contains("is-stuck");

  section.classList.remove("is-open");
  header.classList.remove("is-stuck");
  header.setAttribute("aria-expanded", "false");
  section.querySelector(".game-section-body").innerHTML = "";

  if (wasStuck) {
    const top = section.getBoundingClientRect().top + window.scrollY - getStickyTop() - 8;
    window.scrollTo({ top: Math.max(0, top) });
  }

  updateSectionsToggle();
}

function showMoreInSection(key) {
  const section = getGameSection(key);
  const more = section?.querySelector("[data-game-more]");
  if (!more) return false;

  const list = getCombinedGroup(key);
  const from = combinedShown[key] || 0;
  const to = Math.min(list.length, from + PAGE_SIZE);
  combinedShown[key] = to;

  more.insertAdjacentHTML("beforebegin", renderGameSectionCards(key, list, from, to));

  if (to < list.length) {
    more.outerHTML = renderShowMoreButton(key, list.length - to);
  } else {
    more.remove();
  }

  return true;
}

// Match jumping: is there anything not yet on screen?
function combinedHasMore() {
  if (searchView.hidden || !currentSearchTokens.length) return false;

  for (const [key, size] of combinedGroupSizes) {
    if ((combinedShown[key] || 0) < size) return true;
  }

  return false;
}

// Match jumping: continue the open section, or open the next game.
function combinedLoadNext() {
  for (const [key, size] of combinedGroupSizes) {
    if ((combinedShown[key] || 0) >= size) continue;

    const section = getGameSection(key);
    if (!section) continue;

    if (section.classList.contains("is-open")) {
      showMoreInSection(key);
    } else {
      openGameSection(key);
    }

    return true;
  }

  return false;
}

function loadMoreForMatches() {
  if (IS_COMBINED) combinedLoadNext();
  else appendNextEntries();
}

// "Open all" / "Close all"
function updateSectionsToggle() {
  const button = results.querySelector("[data-sections-toggle]");
  if (!button) return;

  const sections = [...results.querySelectorAll(".game-section")];
  const allOpen = sections.every(section => section.classList.contains("is-open"));

  button.dataset.action = allOpen ? "close" : "open";
  button.querySelector("[data-sections-label]").textContent = allOpen ? "Close all" : "Open all";
  button.setAttribute("aria-label", allOpen ? "Close all games" : "Open all games");
}

document.addEventListener("click", event => {
  if (!IS_COMBINED) return;

  const header = event.target.closest("[data-game-section]");
  if (header) {
    const key = header.dataset.gameSection;
    if (header.closest(".game-section").classList.contains("is-open")) closeGameSection(key);
    else openGameSection(key);
    return;
  }

  const more = event.target.closest("[data-game-more]");
  if (more) {
    showMoreInSection(more.dataset.gameMore);
    return;
  }

  const toggle = event.target.closest("[data-sections-toggle]");
  if (toggle) {
    const keys = [...results.querySelectorAll(".game-section")].map(el => el.dataset.game);
    if (toggle.dataset.action === "close") keys.forEach(closeGameSection);
    else keys.forEach(openGameSection);
    updateStuckHeaders();
    return;
  }

  const chip = event.target.closest("[data-game-filter]");
  if (chip) {
    // A long press already handled it (see below).
    if (chipLongPressHandled) {
      chipLongPressHandled = false;
      return;
    }

    const key = chip.dataset.gameFilter;
    if (activeGameFilters.has(key)) activeGameFilters.delete(key);
    else activeGameFilters.add(key);
    render();
  }
});

// Long press on a Games chip: only that game (again: all games).
let chipPressTimer = null;
let chipPressStart = null;
let chipLongPressHandled = false;

document.addEventListener("pointerdown", event => {
  if (!IS_COMBINED) return;
  const chip = event.target.closest("[data-game-filter]");
  if (!chip) return;

  chipLongPressHandled = false;
  chipPressStart = { x: event.clientX, y: event.clientY };
  clearTimeout(chipPressTimer);
  chip.classList.add("is-pressing");

  chipPressTimer = setTimeout(() => {
    chip.classList.remove("is-pressing");
    chipLongPressHandled = true;

    const key = chip.dataset.gameFilter;
    const isSolo = activeGameFilters.size === 1 && activeGameFilters.has(key);

    activeGameFilters.clear();
    if (!isSolo) activeGameFilters.add(key);

    navigator.vibrate?.(12);
    showToast(isSolo ? "All games" : `Only ${GAME_SHORT_NAMES[key]}`);
    render();
  }, 480);
});

function cancelChipPress() {
  clearTimeout(chipPressTimer);
  chipPressTimer = null;
  document.querySelectorAll(".game-chip.is-pressing").forEach(chip => chip.classList.remove("is-pressing"));
}

document.addEventListener("pointerup", cancelChipPress);
document.addEventListener("pointercancel", cancelChipPress);
document.addEventListener("pointermove", event => {
  if (!chipPressTimer || !chipPressStart) return;
  if (Math.hypot(event.clientX - chipPressStart.x, event.clientY - chipPressStart.y) > 10) cancelChipPress();
});

// Sticky section headers: compact glass form while pinned.
function getStickyTop() {
  const header = results.querySelector(".game-section-header");
  return header ? parseFloat(getComputedStyle(header).top) || 0 : 0;
}

let stuckFrame = 0;

function updateStuckHeaders() {
  if (!IS_COMBINED) return;

  const top = getStickyTop();

  results.querySelectorAll(".game-section").forEach(section => {
    const header = section.querySelector(".game-section-header");
    const sectionRect = section.getBoundingClientRect();
    const stuck =
      section.classList.contains("is-open") &&
      sectionRect.top < top - 1 &&
      sectionRect.bottom > top + header.offsetHeight + 24;

    header.classList.toggle("is-stuck", stuck);
  });
}

window.addEventListener("scroll", () => {
  if (!IS_COMBINED || stuckFrame) return;
  stuckFrame = requestAnimationFrame(() => {
    stuckFrame = 0;
    updateStuckHeaders();
  });
}, { passive: true });

/* Loading progress panel (combined mode) */

function renderLoadProgress() {
  const panel = document.querySelector("#loadProgress");
  if (!panel) return;

  const done = GAME_ORDER.filter(key => ["done", "error"].includes(combinedLoadState[key])).length;
  const total = GAME_ORDER.length;

  panel.hidden = false;
  panel.innerHTML = `
    <div class="load-progress-head">
      <strong>Loading all games</strong>
      <span>${done} / ${total}</span>
    </div>
    <div class="load-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}">
      <span style="width: ${(done / total) * 100}%"></span>
    </div>
    <div class="load-rows">
      ${GAME_ORDER.map(key => `
        <div class="load-row is-${combinedLoadState[key] || "waiting"}" data-game="${escapeAttribute(key)}">
          <span class="game-badge-dot" aria-hidden="true"></span>
          <span class="load-row-name">${escapeHtml(GAME_SHORT_NAMES[key])}</span>
          <span class="load-row-state" aria-hidden="true"></span>
        </div>
      `).join("")}
    </div>
    <p class="load-progress-note">The first time takes a while; after that, games load from the cache.</p>
  `;
}

function finishLoadProgress() {
  const panel = document.querySelector("#loadProgress");
  if (!panel) return;

  renderLoadProgress();
  panel.classList.add("is-finished");
  setTimeout(() => {
    panel.hidden = true;
    panel.classList.remove("is-finished");
  }, 900);
}

function renderEntryList({ target, items, emptyText, highlightTerms }) {
  if (highlightTerms !== undefined) {
    currentHighlightTerms = highlightTerms;
  }

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

  let html = "";

  for (const entry of nextItems) {
    try {
      html += renderEntry(entry);
    } catch (e) {
      html += `
        <article class="entry">
          <div class="entry-header">
            <div class="entry-name">
              ❌ Render failed
            </div>
          </div>

          <div class="entry-text">
            ID: ${escapeHtml(entry.id || "")}<br>
            Name: ${escapeHtml(entry.name || "")}<br>
            File: ${escapeHtml(entry.fileKey || "")}<br>
            Category: ${escapeHtml(entry.category || "")}<br><br>

            Error:<br>
            ${escapeHtml(e.message)}
          </div>
        </article>
      `;
    }
  }

  currentRenderTarget.insertAdjacentHTML("beforeend", html);

  renderedEntryCount += nextItems.length;
  isAppending = false;

  updateMatchNav();
}

// Builds the small line above a card's title: the category as a colored
// chip, followed by the remaining details in lighter text. Parts that just
// repeat the start of the filename (e.g. "item" before "item.msg.23.txt")
// or repeat an earlier part are dropped.
// "1 file", "2 files"
function plural(count, singular, pluralForm = `${singular}s`) {
  return `${Number(count).toLocaleString()} ${count === 1 ? singular : pluralForm}`;
}

function renderMetaLine(category, parts, game = "") {
  const cleaned = [];
  const seen = new Set();
  const sourceFile = String(parts[parts.length - 1] || "").toLowerCase();

  parts.forEach((part, index) => {
    const value = String(part || "").trim();
    if (!value) return;

    const lower = value.toLowerCase();
    if (seen.has(lower)) return;

    // Skip parts the category already says, e.g. "numeric" after
    // "Unknown / Numeric", or "dialogue" after "Dialogues".
    const categoryWords = String(category || "").toLowerCase().split(/[^a-z0-9]+/);
    if (categoryWords.includes(lower) || categoryWords.includes(`${lower}s`)) return;

    const isLast = index === parts.length - 1;
    if (!isLast && sourceFile && sourceFile.startsWith(lower)) return;

    seen.add(lower);
    cleaned.push(value);
  });

  const chip = category
    ? `<span class="meta-chip" data-cat="${escapeAttribute(category)}">${escapeHtml(category)}</span>`
    : "";

  // Kept to one line (shortened with "…"); tapping it shows the full text.
  const restText = cleaned.join(" · ");
  const rest = cleaned.length
    ? `<span class="meta-rest" title="${escapeAttribute(restText)}">${escapeHtml(restText)}</span>`
    : "";

  // Combined mode: which game the card comes from.
  const gameBadge = IS_COMBINED && GAME_SHORT_NAMES[game]
    ? `<span class="game-badge" data-game="${escapeAttribute(game)}"><span class="game-badge-dot" aria-hidden="true"></span>${escapeHtml(GAME_SHORT_NAMES[game])}</span>`
    : "";

  return `<div class="entry-section">${gameBadge}${chip}${rest}</div>`;
}

// The ID badge shows "0010 + 0011" instead of "[0010 + 0011]"; copied text
// still uses the bracketed form.
function stripIdBrackets(value) {
  return String(value || "").replace(/^\[|\]$/g, "").trim();
}

// In the IDs format, the text of untitled entries starts with the same ID
// the badge already shows ("[0009] An Ancient…"). Drop that repeat from the
// displayed text only; copied text keeps it.
function withoutRepeatedId(textIds, headerId) {
  const text = String(textIds || "");
  if (!headerId || !text.startsWith(headerId)) return text;

  const rest = text.slice(headerId.length);
  if (rest && !/^\s/.test(rest)) return text;

  return rest.replace(/^[ \t]+/, "");
}

/* Cards keep a small key to their entry instead of every text variant as
   hidden attributes; the language switch and Copy build the same strings
   from the entry when tapped. */
const cardKeyByEntry = new WeakMap();
const entryByCardKey = new Map();
let cardKeyCounter = 0;

function getCardKey(entry) {
  let key = cardKeyByEntry.get(entry);

  if (!key) {
    key = String(++cardKeyCounter);
    cardKeyByEntry.set(entry, key);
    entryByCardKey.set(key, entry);
  }

  return key;
}

function getCardEntry(card) {
  const key = card?.dataset?.cardKey;
  return key ? entryByCardKey.get(key) || null : null;
}

// Exactly the texts the card's hidden attributes used to hold.
function getCardLanguageData(entry, lang) {
  const view = getEntryPresentation(entry, lang);

  return {
    name: view.name,
    textIds: withoutRepeatedId(view.textIds, view.headerId),
    textClean: view.textClean,
    textCode: view.visualCode,
    copyIds: view.copyIds,
    copyClean: view.copyClean,
    copyCode: view.copyCode
  };
}

function renderEntry(entry) {
  const metaHtml = renderMetaLine(entry.category, [
    entry.family,
    entry.dialogueId,
    entry.dialogueType,
    entry.sourceFile
  ], entry.game);

  // The Japanese version (and the copy texts) are built when needed, from
  // the entry itself - see getCardLanguageData.
  const en = getEntryPresentation(entry, "en");

  const hasJp = Boolean(entry.textJp || entry.rawJp || entry.nameJp);
  const jsonMeta =
  renderJsonMonsterMeta(entry) ||
  renderJsonItemMeta(entry) ||
  renderJsonAmuletMeta(entry) ||
  renderJsonSkillMeta(entry) ||
  renderJsonArmorMeta(entry) ||
  renderJsonWeaponMeta(entry);

  return `
    <article
      class="entry"
      ${IS_COMBINED && entry.game ? `data-game="${escapeAttribute(entry.game)}"` : ""}
      data-mode="${escapeAttribute(defaultCardMode)}"
      data-lang="en"
      data-card-key="${getCardKey(entry)}"
    >
      <div class="entry-actions">
        ${entry.isRejected ? '<span class="tag-badge">Rejected ID</span>' : ""}
        ${entry.isDialogue ? '<span class="tag-badge">Dialogue</span>' : ""}
        ${hasJp ? '<button class="lang-btn" type="button" data-lang-toggle>JP</button>' : ""}
        <button class="copy-btn" type="button">Copy</button>
      </div>

      ${metaHtml}

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

        <div class="entry-id" role="button" tabindex="0" data-copy-entry-link title="Copy link to this entry">${escapeHtml(stripIdBrackets(en.headerId))}</div>
      </div>

      ${
        entry.rejectedId
          ? `<div class="entry-rejected">${escapeHtml(entry.rejectedId)}</div>`
          : ""
      }

      <div class="entry-text entry-text-ids">${formatEntryText(withoutRepeatedId(en.textIds, en.headerId), { linkify: true, highlightTerms: currentHighlightTerms })}</div>
      <div class="entry-text entry-text-clean">${formatEntryText(en.textClean, { linkify: true, highlightTerms: currentHighlightTerms })}</div>
      <div class="entry-text entry-text-code">${formatEntryText(en.visualCode, { highlightTerms: currentHighlightTerms })}</div>
      
      ${jsonMeta}
      ${IS_COMBINED && getAcrossName(entry) ? `
        <button class="across-link" type="button" data-across="${escapeAttribute(getAcrossName(entry))}">
          <span class="across-link-dots" aria-hidden="true"></span>
          Compare across games
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
        </button>
      ` : ""}
    </article>
  `;
}

function getJsonSpeciesName(kind) {
  const species = JSON_INDEX.speciesByKind.get(kind);
  return getJsonName(species, "en") || titleCaseFamily(kind);
}

function getJsonPartName(partKey) {
  const part = JSON_INDEX.partNameByKey.get(partKey);
  return getJsonName(part, "en") || titleCaseFamily(partKey);
}

function getHitzoneClass(value, extraClass = "") {
  const classes = [extraClass].filter(Boolean);

  if (Number(value) >= 45) {
    classes.push("monster-hz-high");
  }

  return classes.join(" ");
}

function renderHitzoneCell(value, extraClass = "") {
  return `
    <td class="${escapeAttribute(getHitzoneClass(value, extraClass))}">
      ${formatHitzone(value)}
    </td>
  `;
}

function renderEssenceCell(value) {
  const essence = value ? String(value).toLowerCase() : "none";

  return `
    <td>
      <span class="monster-essence monster-essence-${escapeAttribute(essence)}">
        ${escapeHtml(value || "—")}
      </span>
    </td>
  `;
}

function formatHitzone(value) {
  if (value === undefined || value === null) return "—";
  return Math.round(Number(value) * 100);
}

function formatMonsterLevel(level) {
  return level ? "★".repeat(Number(level)) : "—";
}

function formatMonsterTrait(trait) {
  const name =
    trait.element ||
    trait.status ||
    trait.effect ||
    trait.kind ||
    "";

  const condition = trait.condition ? ` (${trait.condition})` : "";
  const level = trait.level ? ` ${formatMonsterLevel(trait.level)}` : "";

  return `${titleCaseFamily(name)}${level}${condition}`.trim();
}

function getJsonItemNameById(id) {
  const item = JSON_INDEX.itemByGameId.get(String(id));
  return getJsonName(item, "en") || `item ${id}`;
}

function renderJsonItemMeta(entry) {
  const item = entry.jsonItem;
  if (!item) return "";

  const recipeHtml = (item.recipes || [])
    .map(recipe => {
      const rawInputs = recipe.inputs || [];

      const inputPairs = Array.isArray(rawInputs)
        ? rawInputs.map(id => [id, 1])
        : typeof rawInputs === "object"
          ? Object.entries(rawInputs)
          : [];

      const inputs = inputPairs.map(([id, amount]) =>
        `${escapeHtml(amount)}× ${entityLinkHtml("item", id, getJsonItemNameById(id))}`
      );

      return `${escapeHtml(recipe.amount || 1)}× from ${inputs.join(" + ")}`;
    })
    .join(" / ");

  const facts = [
    item.kind ? ["Type", item.kind] : null,
    item.rarity ? ["Rarity", item.rarity] : null,
    item.max_count ? ["Max", item.max_count] : null,
    item.buy_price ? ["Buy", `${item.buy_price}z`] : null,
    item.sell_price ? ["Sell", `${item.sell_price}z`] : null,
    item.icon ? ["Icon", item.icon] : null,
    item.icon_color ? ["Color", item.icon_color] : null,
    item.out_box !== undefined ? ["Out box", item.out_box ? "Yes" : "No"] : null
  ].filter(Boolean);

  return `
    <details class="json-panel">
      <summary>Item data</summary>

      <div class="json-grid">
        ${facts.map(([label, value]) => `
          <div class="json-fact">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </div>
        `).join("")}
      </div>

      ${recipeHtml ? `
        <div class="json-block">
          <span>Recipes</span>
          <p>${recipeHtml}</p>
        </div>
      ` : ""}
    </details>
  `;
}

function renderJsonAmuletMeta(entry) {
  const amulet = entry.jsonAmulet;
  if (!amulet) return "";

  const recipeHtml = Object.entries(amulet.recipe?.inputs || {})
    .map(([id, amount]) =>
      `${escapeHtml(amount)}× ${entityLinkHtml("item", id, getJsonItemNameById(id))}`
    )
    .join(" / ");

  const skillHtml = Object.entries(amulet.skills || {})
    .map(([id, level]) =>
      `${entityLinkHtml("skill", id, getJsonSkillNameById(id))} Lv ${escapeHtml(level)}`
    )
    .join(" / ");

  const facts = [
    ["Rarity", amulet.rarity],
    ["Level", amulet.level],
    ["Price", `${amulet.price}z`],
    ["Random", amulet.is_random ? "Yes" : "No"]
  ].filter(([, value]) => value !== undefined && value !== "");

  return `
    <details class="json-panel">
      <summary>Amulet data</summary>

      <div class="json-grid">
        ${facts.map(([label, value]) => `
          <div class="json-fact">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </div>
        `).join("")}
      </div>

      ${skillHtml ? `
        <div class="json-block">
          <span>Skills</span>
          <p>${skillHtml}</p>
        </div>
      ` : ""}

      ${recipeHtml ? `
        <div class="json-block">
          <span>Recipe</span>
          <p>${recipeHtml}</p>
        </div>
      ` : ""}
    </details>
  `;
}

function renderJsonSkillMeta(entry) {
  const skill = entry.jsonSkill;
  if (!skill) return "";

  const ranks = skill.ranks || [];

  const facts = [
    skill.kind ? ["Type", skill.kind] : null,
    ranks.length ? ["Levels", ranks.length] : null,
    skill.icon ? ["Icon", skill.icon] : null,
    skill.icon_id !== undefined ? ["Icon ID", skill.icon_id] : null,
    skill.game_id !== undefined ? ["Game ID", skill.game_id] : null
  ].filter(Boolean);

  return `
    <details class="json-panel">
      <summary>Skill data</summary>

      <div class="json-grid">
        ${facts.map(([label, value]) => `
          <div class="json-fact">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </div>
        `).join("")}
      </div>

      ${
        ranks.length
          ? `
            <div class="json-block">
              <span>Levels</span>
              ${ranks.map(rank => `
                <p>
                  <strong>Lv ${escapeHtml(rank.level)}</strong>
                  ${
                    rank.names?.en
                      ? ` · ${escapeHtml(rank.names.en)}`
                      : ""
                  }
                  ${
                    rank.set_pieces_required
                      ? ` · ${escapeHtml(rank.set_pieces_required)} pieces`
                      : ""
                  }
                  <br>
                  ${formatEntryText(rank.descriptions?.en || "", { linkify: true })}
                </p>
              `).join("")}
            </div>
          `
          : ""
      }
    </details>
  `;
}

function getJsonWeaponNameById(id, weaponFile = "") {
  const weapon =
    weaponFile
      ? JSON_INDEX.weaponByTypeAndGameId.get(`${weaponFile}:${id}`)
      : JSON_INDEX.weaponByGameId.get(String(id));

  return weapon
    ? getJsonName(weapon, "en")
    : "";
}

function getJsonSkillNameById(id) {
  const skill = JSON_INDEX.skillByGameId.get(String(id));
  return getJsonName(skill, "en") || `Skill ${id}`;
}

function getJsonWeaponSeriesNameById(id) {
  const series = JSON_INDEX.weaponSeriesByGameId.get(String(id));
  return getJsonName(series, "en") || "";
}

function getLinkedCraftingItems(inputs = {}) {
  return Object.entries(inputs).map(([id, amount]) => ({
    id,
    amount,
    name: getJsonItemNameById(id)
  }));
}

function getLinkedWeaponSkills(skills = {}) {
  return Object.entries(skills).map(([id, level]) => ({
    id,
    level,
    name: getJsonSkillNameById(id)
  }));
}

const WEAPON_TYPE_ORDER = [
  "greatsword",
  "longsword",
  "swordshield",
  "dualblades",
  "hammer",
  "huntinghorn",
  "lance",
  "gunlance",
  "switchaxe",
  "chargeblade",
  "insectglaive",
  "bow",
  "lightbowgun",
  "heavybowgun"
];

function getEntryWeaponFile(entry) {
  const file =
    entry.jsonWeapon?.weapon_file ||
    entry.fileKey ||
    "";

  return WEAPON_FILE_ALIASES[file] || file;
}

const WEAPON_TYPE_LABELS = {
  greatsword: "Great Sword",
  longsword: "Long Sword",
  swordshield: "Sword & Shield",
  dualblades: "Dual Blades",
  hammer: "Hammer",
  huntinghorn: "Hunting Horn",
  lance: "Lance",
  gunlance: "Gunlance",
  switchaxe: "Switch Axe",
  chargeblade: "Charge Blade",
  insectglaive: "Insect Glaive",
  bow: "Bow",
  lightbowgun: "Light Bowgun",
  heavybowgun: "Heavy Bowgun"
};

const WEAPON_FILE_ALIASES = {
  longsword: "greatsword",
  sword: "greatsword",
  greatsword: "greatsword",

  tachi: "longsword",
  shortsword: "swordshield",
  twinsword: "dualblades",
  whistle: "huntinghorn",
  slashaxe: "switchaxe",
  chargeaxe: "chargeblade",
  rod: "insectglaive"
};

function getWeaponTypeLabel(file) {
  return WEAPON_TYPE_LABELS[file] || titleCaseFamily(file);
}

function renderJsonWeaponMeta(entry) {
  const weapon = entry.jsonWeapon;
  if (!weapon) return "";

  const crafting = weapon.crafting || {};
  const seriesName = getJsonWeaponSeriesNameById(weapon.series_id);

  const skills = getLinkedWeaponSkills(weapon.skills);
  const recipeItems = getLinkedCraftingItems(crafting.inputs);

  const previousRef =
    crafting.previous_id !== undefined && crafting.previous_id !== null
      ? {
          key: `${weapon.weapon_file}:${crafting.previous_id}`,
          name: getJsonWeaponNameById(crafting.previous_id, weapon.weapon_file)
        }
      : null;

  const branchRefs = (crafting.branches || [])
    .map(id => ({
      key: `${weapon.weapon_file}:${id}`,
      name: getJsonWeaponNameById(id, weapon.weapon_file)
    }))
    .filter(ref => ref.name);

  const specialsText = renderWeaponSpecialsText(weapon);
  const sharpnessText = renderWeaponSharpnessText(weapon);
  const weaponSpecificText = renderWeaponSpecificText(weapon);

  const facts = [
  ["Weapon Type", getWeaponTypeLabel(weapon.weapon_file)],
  ["Rarity", renderRarityText(weapon.rarity)],
  ["Raw Attack", weapon.attack_raw],
  ["Affinity", weapon.affinity !== undefined ? `${weapon.affinity}%` : ""],
  ["Defense", weapon.defense],
  ["Slots", renderWeaponSlotsText(weapon.slots)],
  ["Tree", seriesName],
  ["Game ID", weapon.game_id]
].filter(([, value]) => value !== undefined && value !== "");

  return `
    <details class="json-panel">
      <summary>Weapon data</summary>

      <div class="json-grid">
        ${facts.map(([label, value]) => `
          <div class="json-fact">
            <span>${escapeHtml(label)}</span>
            <strong>${label === "Rarity" ? value : escapeHtml(value)}</strong>
          </div>
        `).join("")}
      </div>

      ${specialsText ? `
        <div class="json-block">
          <span>Raw Element / Status</span>
          <p>${escapeHtml(specialsText)}</p>
        </div>
      ` : ""}

      ${sharpnessText ? `
        <div class="json-block">
          <span>Sharpness</span>
          ${renderWeaponSharpnessBar(weapon)}
        </div>
      ` : ""}

      ${weaponSpecificText ? `
        <div class="json-block">
          <span>Weapon-specific</span>
          <p>${escapeHtml(weaponSpecificText)}</p>
        </div>
      ` : ""}

      ${skills.length ? `
  <div class="json-block">
    <span>Skills</span>
    ${renderSkillPills(skills)}
  </div>
` : ""}

${recipeItems.length || crafting.zenny_cost ? `
  <div class="json-block">
    <span>Crafting</span>
    ${renderCraftingBlock(crafting, recipeItems)}
  </div>
` : ""}

${previousRef || branchRefs.length ? `
  <div class="json-block">
    <span>Upgrade tree</span>
    ${renderWeaponTreeFlow(previousRef, entry.name, branchRefs, crafting)}
  </div>
` : ""}
    </details>
  `;
}

function renderJsonArmorMeta(entry) {
  const armor = entry.jsonArmorPiece;
  if (!armor) return "";

  const set = armor.armor_set || {};
  const upgrade = JSON_INDEX.armorUpgradeByRarity.get(String(set.rarity));
  const maxUpgrade = upgrade?.steps?.at(-1);

  const seriesName =
    ARMOR_SERIES_BY_ID.get(String(set.game_id)) ||
    ARMOR_SERIES_BY_ID.get(String(set.id)) ||
    armor.armor_set_name ||
    "";

  const skills = Object.entries(armor.skills || {}).map(([id, level]) => ({
    id,
    level,
    name: getJsonSkillNameById(id)
  }));

  const recipeItems = Object.entries(armor.crafting?.inputs || {}).map(([id, amount]) => ({
    id,
    amount,
    name: getJsonItemNameById(id)
  }));

  const pieceName = titleCaseFamily(armor.kind || "");

  const resistances = armor.resistances || {};
  const resistanceText = [
    `🔥 ${formatSignedNumber(resistances.fire)}`,
    `💧 ${formatSignedNumber(resistances.water)}`,
    `⚡ ${formatSignedNumber(resistances.thunder)}`,
    `❄️ ${formatSignedNumber(resistances.ice)}`,
    `🐉 ${formatSignedNumber(resistances.dragon)}`
  ].join("   ");

  const setBonusText = renderArmorBonusText("Set Bonus", armor.armor_set_bonus);
  const groupBonusText = renderArmorBonusText("Group Bonus", armor.armor_group_bonus);

  const setLinkName = armor.armor_set_name || seriesName;

  const seriesHtml =
    setLinkName && JSON_INDEX.armorSetByName.has(String(setLinkName).toLowerCase())
      ? entityLinkHtml("armorset", String(setLinkName).toLowerCase(), seriesName)
      : seriesName
        ? escapeHtml(seriesName)
        : "";

  const facts = [
    seriesHtml ? ["Set", seriesHtml] : null,
    ["Piece", pieceName],
    ["Rarity", renderRarityText(set.rarity)],
    ["Defense", `${armor.defense?.base ?? "?"} → ${armor.defense?.max ?? "?"}`],
    ["Slots", renderWeaponSlotsText(armor.slots)]
  ].filter(Boolean).filter(([, value]) => value !== undefined && value !== "");

  return `
    <details class="json-panel">
      <summary>Armor data</summary>

      <div class="json-grid">
        ${facts.map(([label, value]) => `
          <div class="json-fact">
            <span>${escapeHtml(label)}</span>
            <strong>${label === "Rarity" || label === "Set" ? value : escapeHtml(value)}</strong>
          </div>
        `).join("")}
      </div>

      <div class="json-block">
        <span>Resistances</span>
        <p>${escapeHtml(resistanceText)}</p>
      </div>

      ${skills.length ? `
        <div class="json-block">
          <span>Skills</span>
          ${renderSkillPills(skills)}
        </div>
      ` : ""}

      ${recipeItems.length || armor.crafting?.price ? `
        <div class="json-block">
          <span>Crafting</span>
          ${renderCraftingBlock(
            { zenny_cost: armor.crafting?.price },
            recipeItems
          )}
        </div>
      ` : ""}

      ${maxUpgrade ? `
        <div class="json-block">
          <span>Upgrade</span>
          <p>Max Lv ${escapeHtml(maxUpgrade.level)}</p>
        </div>
      ` : ""}

      ${setBonusText}
      ${groupBonusText}
    </details>
  `;
}

function renderJsonMonsterMeta(entry) {
  const monster = entry.jsonMonster;
  if (!monster) return "";

  const species = getJsonSpeciesName(monster.species);

  const facts = [
    ["Species", species],
    ["Base Health", monster.base_health],
    monster.size?.base ? ["Base Size", Math.round(monster.size.base)] : null,
    monster.size?.mini ? ["Mini", Math.round(monster.size.mini)] : null,
    monster.size?.silver ? ["Silver", Math.round(monster.size.silver)] : null,
    monster.size?.gold ? ["Gold", Math.round(monster.size.gold)] : null,
    ["Game ID", monster.game_id]
  ].filter(Boolean).filter(([, value]) => value !== undefined && value !== "");

  const weaknesses = monster.weaknesses || [];
  const resistances = monster.resistances || [];
  const parts = monster.parts || [];

  return `
    <details class="json-panel monster-json-panel">
      <summary>Monster data</summary>

      <div class="json-grid">
        ${facts.map(([label, value]) => `
          <div class="json-fact">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </div>
        `).join("")}
      </div>

      ${weaknesses.length ? `
        <div class="json-block">
          <span>Weaknesses</span>
          <div class="pill-row">
            ${weaknesses.map(item => `
              <span class="data-pill">${escapeHtml(formatMonsterTrait(item))}</span>
            `).join("")}
          </div>
        </div>
      ` : ""}

      ${resistances.length ? `
        <div class="json-block">
          <span>Resistances / Immunities</span>
          <div class="pill-row">
            ${resistances.map(item => `
              <span class="data-pill">${escapeHtml(formatMonsterTrait(item))}</span>
            `).join("")}
          </div>
        </div>
      ` : ""}

      ${parts.length ? `
        <div class="json-block">
          <span>Parts / Hitzones</span>
          ${renderMonsterPartsTable(parts)}
        </div>
      ` : ""}
    </details>
  `;
}

function renderMonsterPartsTable(parts) {
  return `
    <div class="monster-table-wrap">
      <table class="monster-parts-table">
        <thead>
          <tr>
            <th>Part</th>
            <th>HP</th>
            <th>Essence</th>
            <th>Cut</th>
            <th>Blunt</th>
            <th>Ammo</th>
            <th>Fire</th>
            <th>Water</th>
            <th>Thunder</th>
            <th>Ice</th>
            <th>Dragon</th>
            <th>Stun</th>
          </tr>
        </thead>
        <tbody>
          ${parts.map(part => {
            const m = part.multipliers || {};

            return `
              <tr>
                <td>${escapeHtml(getJsonPartName(part.part))}</td>
                <td>${escapeHtml(part.base_health ?? "—")}</td>
                ${renderEssenceCell(part.kinsect_essence)}
                 ${renderHitzoneCell(m.slash)}
                 ${renderHitzoneCell(m.blunt)}
                 ${renderHitzoneCell(m.pierce)}
                 ${renderHitzoneCell(m.fire, "monster-el-fire")}
                 ${renderHitzoneCell(m.water, "monster-el-water")}
                 ${renderHitzoneCell(m.thunder, "monster-el-thunder")}
                 ${renderHitzoneCell(m.ice, "monster-el-ice")}
                 ${renderHitzoneCell(m.dragon, "monster-el-dragon")}
                 ${renderHitzoneCell(m.stun)}
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function formatSignedNumber(value) {
  const number = Number(value || 0);
  return number > 0 ? `+${number}` : String(number);
}

function renderArmorBonusText(label, bonus) {
  if (!bonus) return "";

  const name =
    getJsonName(bonus, "en") ||
    bonus.name ||
    bonus.skill_name ||
    "";

  const pieces = bonus.pieces || bonus.ranks || bonus.levels || [];

  const detailText = Array.isArray(pieces)
    ? pieces.map(piece => {
        const required =
          piece.pieces ||
          piece.required_pieces ||
          piece.set_pieces_required ||
          piece.level ||
          "";

        const skillId = piece.skill_id || piece.skill;
        const skillName = skillId ? getJsonSkillNameById(skillId) : "";

        const level = piece.skill_level || piece.level || "";

        return [
          required ? `${escapeHtml(required)} pieces` : "",
          skillName
            ? `${entityLinkHtml("skill", skillId, skillName)}${level ? ` Lv ${escapeHtml(level)}` : ""}`
            : ""
        ].filter(Boolean).join(" · ");
      }).filter(Boolean).join("<br>")
    : "";

  if (!name && !detailText) return "";

  return `
    <div class="json-block">
      <span>${escapeHtml(label)}</span>
      ${name ? `<p><strong>${escapeHtml(name)}</strong></p>` : ""}
      ${detailText ? `<p>${detailText}</p>` : ""}
    </div>
  `;
}

function renderRarityText(rarity) {
  const value = Number(rarity);
  if (!value) return "";

  return `<span class="rarity-pill rarity-${value}">★ ${value}</span>`;
}

function renderSkillPills(skills) {
  if (!skills.length) return "";

  return `
    <div class="pill-row">
      ${skills.map(skill => `
        <span class="data-pill entity-pill">
          ${skill.id !== undefined
            ? entityLinkHtml("skill", skill.id, skill.name)
            : escapeHtml(skill.name)}
          <small>Lv ${escapeHtml(skill.level)}</small>
        </span>
      `).join("")}
    </div>
  `;
}

function renderWeaponTreeFlow(previousRef, currentName, branchRefs, crafting) {
  if (!previousRef && !branchRefs.length) return "";

  const nodeHtml = ref =>
    ref.key
      ? entityLinkHtml("weapon", ref.key, ref.name)
      : escapeHtml(ref.name);

  return `
    <div class="tree-flow">
      ${previousRef ? `<div class="tree-node muted-node">${nodeHtml(previousRef)}</div><div class="tree-arrow">↓</div>` : ""}
      <div class="tree-node current-node">${escapeHtml(currentName)}</div>
      ${branchRefs.length ? `<div class="tree-arrow">↓</div>` : ""}
      ${branchRefs.map(ref => `<div class="tree-node branch-node">${nodeHtml(ref)}</div>`).join("")}
      ${
        crafting.column !== undefined || crafting.row !== undefined
          ? `<small>column ${escapeHtml(crafting.column)}, row ${escapeHtml(crafting.row)}</small>`
          : ""
      }
    </div>
  `;
}

function renderCraftingBlock(crafting, recipeItems) {
  if (!recipeItems.length && !crafting.zenny_cost) return "";

  return `
    <div class="crafting-list">
      ${crafting.zenny_cost ? `<div class="zenny">💰 ${escapeHtml(Number(crafting.zenny_cost).toLocaleString())}z</div>` : ""}
      ${recipeItems.map(item => `
        <div class="material-row">
          <span>${escapeHtml(item.amount)}×</span>
          <strong>${entityLinkHtml("item", item.id, item.name)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderWeaponSharpnessBar(weapon) {
  const sharpness = weapon.sharpness;
  if (!sharpness) return "";

  const colors = ["red", "orange", "yellow", "green", "blue", "white", "purple"];

  const active = colors
    .map(color => ({ color, value: Number(sharpness[color] || 0) }))
    .filter(item => item.value > 0);

  if (!active.length) return "";

  return `
    <div class="sharpness-wrap">
      <div class="sharpness-bar">
        ${active.map(item => `
          <span
            class="sharpness-segment sharpness-${item.color}"
            style="--sharpness-width:${item.value}"
          ></span>
        `).join("")}
      </div>

      <div class="sharpness-values">
        ${active.map(item => `
          <span style="--sharpness-width:${item.value}">
            ${escapeHtml(item.value)}
          </span>
        `).join("")}
      </div>
    </div>
  `;
}

function renderWeaponSlotsText(slots = []) {
  if (!Array.isArray(slots) || !slots.length) return "";
  return slots.filter(Boolean).map(slot => `Lv${slot}`).join(" / ");
}

function renderWeaponSpecialsText(weapon) {
  const specials = weapon.specials || [];

  if (!Array.isArray(specials)) return "";

  return specials
    .map(special => {
      const type = special.element || special.status || special.kind || "";
      const amount = special.raw ?? special.value ?? special.amount ?? "";
      const hidden = special.hidden ? " hidden" : "";

      return `${titleCaseFamily(type)} ${amount}${hidden}`.trim();
    })
    .filter(Boolean)
    .join(" / ");
}

function renderWeaponSharpnessText(weapon) {
  const sharpness = weapon.sharpness;
  if (!sharpness) return "";

  return Object.entries(sharpness)
    .filter(([, value]) => Number(value) > 0)
    .map(([key, value]) => `${titleCaseFamily(key)} ${value}`)
    .join(" / ");
}

function renderWeaponSpecificText(weapon) {
  const parts = [];

  if (weapon.phial) {
    parts.push(`Phial: ${weapon.phial}`);
  }

  if (weapon.shell) {
    parts.push(`Shelling: ${weapon.shell}${weapon.shell_level ? ` Lv ${weapon.shell_level}` : ""}`);
  }

  if (weapon.coatings?.length) {
    parts.push(`Coatings: ${weapon.coatings.join(" / ")}`);
  }

  if (weapon.special_ammo) {
    parts.push(`Special Ammo: ${weapon.special_ammo}`);
  }

  if (weapon.ammo?.length) {
    const ammo = weapon.ammo
      .map(item => {
        const rapid = item.rapid ? " rapid" : "";
        return `${item.kind} Lv${item.level} x${item.capacity}${rapid}`;
      })
      .join(" / ");

    parts.push(`Ammo: ${ammo}`);
  }

  if (weapon.melody_id !== undefined) {
    const melody = JSON_INDEX.hhMelodyByGameId.get(String(weapon.melody_id));
    const melodyName = getJsonName(melody, "en") || `Melody ${weapon.melody_id}`;
    parts.push(`Melody: ${melodyName}`);
  }

  if (weapon.echo_wave_id !== undefined) {
    const wave = JSON_INDEX.hhEchoWaveByGameId.get(String(weapon.echo_wave_id));
    const waveName = getJsonName(wave, "en") || `Echo Wave ${weapon.echo_wave_id}`;
    parts.push(`Echo Wave: ${waveName}`);
  }

  if (weapon.echo_bubble_id !== undefined) {
    const bubble = JSON_INDEX.hhEchoBubbleByGameId.get(String(weapon.echo_bubble_id));
    const bubbleName = getJsonName(bubble, "en") || `Echo Bubble ${weapon.echo_bubble_id}`;
    parts.push(`Echo Bubble: ${bubbleName}`);
  }

  return parts.join(" / ");
}

function updateEntryLanguage(card, lang) {
  card.dataset.lang = lang;

  const suffix = lang === "jp" ? "Jp" : "En";

  // Entry cards build their texts from the entry; other cards still carry
  // them as attributes.
  const entry = getCardEntry(card);
  const data = entry ? getCardLanguageData(entry, lang) : null;

  const name = data ? data.name : card.dataset[`name${suffix}`] || "";
  const textIds = data ? data.textIds : card.dataset[`textIds${suffix}`] || "";
  const textClean = data ? data.textClean : card.dataset[`textClean${suffix}`] || "";
  const textCode = data ? data.textCode : card.dataset[`textCode${suffix}`] || "";

  const nameEl = card.querySelector(".entry-name-content");
  const idsEl = card.querySelector(".entry-text-ids");
  const cleanEl = card.querySelector(".entry-text-clean");
  const codeEl = card.querySelector(".entry-text-code");
  const langBtn = card.querySelector("[data-lang-toggle]");

  const textOpts = {
    linkify: lang === "en",
    highlightTerms: currentHighlightTerms
  };

  if (nameEl) nameEl.textContent = name;
  if (idsEl) idsEl.innerHTML = formatEntryText(textIds, textOpts);
  if (cleanEl) cleanEl.innerHTML = formatEntryText(textClean, textOpts);
  if (codeEl) codeEl.innerHTML = formatEntryText(textCode, { highlightTerms: currentHighlightTerms });

  if (!data) {
    card.dataset.copyIds = card.dataset[`copyIds${suffix}`] || "";
    card.dataset.copyClean = card.dataset[`copyClean${suffix}`] || "";
    card.dataset.copyCode = card.dataset[`copyCode${suffix}`] || "";
  }

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
    const textClean = getCleanText(textWithIds, items[0]?.game || ACTIVE_GAME);
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

        ${renderMetaLine("Dialogues", [type, plural(items.length, "line")])}

        <div class="entry-header">
          <div class="entry-name">${escapeHtml(title)}</div>
        </div>

        <div class="entry-text entry-text-ids">${formatEntryText(textWithIds, { linkify: true })}</div>
        <div class="entry-text entry-text-clean">${formatEntryText(textClean, { linkify: true })}</div>
        <div class="entry-text entry-text-code">${formatEntryText(textCode)}</div>
      </article>
    `;
  }).join("");
}

function getCopyTextWithIds(entry) {
  const label = entry.rejectedId || entry.id;
  return `[${label}] ${entry.text || entry.raw || ""}`.trim();
}

// Rise dialogue carries stage directions for the game (camera, voice,
// gaze, facial expression, speaker and tutorial triggers), like <CAM:2>
// or <VO:SP1>. The Clean format hides them; IDs and Code keep them.
const RISE_STAGE_DIRECTION_TAGS =
  /<\/?(?:NPC|VO|LOOK|TURN|NOFAC|FACE|CAM|SCAM|FCAM|RCAM|NOTE|OKAZU|OTTUTO|POSTACT|MR_REL|MR_OPEN|EQUIP|OWL|EMTUTO_DISP|EMTUTO_THINK)(?::[^<>]*)?>/g;

function getCleanText(value, game = ACTIVE_GAME) {
  let text = String(value || "");

  if (game === "rise") {
    text = text.replace(RISE_STAGE_DIRECTION_TAGS, "");
  }

  // World: voice cues (<NSND npc=2 voice=23>) and centering (<CNTR>) are
  // instructions for the game, hidden in Clean like Rise's stage directions.
  if (game === "world") {
    text = text.replace(/<\/?(?:NSND|CNTR)(?:\s[^<>]*)?>/g, "");
  }

  return text
    .replace(/\[(\d{4}(?:\s*\+\s*\d{4})?)\]\s*/g, "")
    .split("\n")
    .map(line => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Formats raw entry text as HTML. Options:
//   linkify        - wrap known entity names in clickable links (EN text only)
//   highlightTerms - array of search terms to <mark>
function formatEntryText(value, opts = {}) {
  // Entity links point to Wilds pages, so they are off in the combined mode.
  if (IS_COMBINED && opts.linkify) opts = { ...opts, linkify: false };

  const lines = String(value || "").split("\n");
  const parts = lines.map(line =>
    line === "---"
      ? { hr: true }
      : { html: buildEntityHtml(line, opts) }
  );

  let html = "";

  parts.forEach((part, index) => {
    if (part.hr) {
      html += "<hr>";
      return;
    }

    if (index > 0 && !parts[index - 1].hr) {
      html += "<br>";
    }

    html += part.html;
  });

  return html;
}

function buildArmorSeriesMap(sections) {
  ARMOR_SERIES_BY_ID.clear();

  const section = sections.find(section => section.fileKey === "armorseries");
  if (!section) return;

  for (const item of section.strings) {
    const id = Number(item.id);
    const name = item.text || "";

    if (!name || name === "-") continue;

    ARMOR_SERIES_BY_ID.set(String(id), name);
  }
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

// Hides type filter chips for categories that have no entries in the
// currently loaded game (e.g. Monsters/Skills/UI in GUDump).
function updateTypeFilterAvailability() {
  searchFilters.querySelectorAll("[data-type-filter]").forEach(button => {
    button.hidden = !categories.has(button.dataset.typeFilter);
  });
}

// Hides menu entries whose views would be empty for the loaded game.
function updateMenuAvailability() {
  if (npcIndexBtn) npcIndexBtn.hidden = npcGroups.size === 0;
  if (monsterIndexBtn) monsterIndexBtn.hidden = monsterGroups.size === 0;

  const diffBtn = document.querySelector("#versionDiffBtn");
  if (diffBtn) diffBtn.hidden = !DIFF_DATA.length;

  // The NPC and Monster Index belong to a single game.
  if (IS_COMBINED) {
    if (npcIndexBtn) npcIndexBtn.hidden = true;
    const monsterBtn = document.querySelector("#monsterIndexBtn");
    if (monsterBtn) monsterBtn.hidden = true;
  }

  updateMenuSectionVisibility();
}

// Hides menu sections (and their headings) when all of their buttons are
// hidden, e.g. the "Data" section in games without the Wilds database.
function updateMenuSectionVisibility() {
  menu.querySelectorAll(".menu-section").forEach(section => {
    const buttons = [...section.querySelectorAll("button")];
    if (!buttons.length) return;

    section.hidden = buttons.every(button => button.hidden);
  });
}

function updateSearchFilterButtons() {
  searchFilters.querySelectorAll("[data-clear-filters]").forEach(button => {
    button.classList.toggle("active", activeTypeFilter === "All");
  });

  searchFilters.querySelectorAll("[data-type-filter]").forEach(button => {
    button.classList.toggle("active", button.dataset.typeFilter === activeTypeFilter);
  });
}

/* ---------------------------------------------------------
   Jumping between search matches
   Walks the highlighted <mark> elements of the visible page.
   Results load in pages, so "next" past the last loaded match
   loads more pages until it finds one.
   --------------------------------------------------------- */

const MATCH_SCROLL_POSITION = 0.35; // share of the screen height from the top
const MATCH_MAX_PAGE_LOADS = 50;

let currentMatchEl = null;

function getVisiblePage() {
  return getAllViews().find(view => !view.hidden) || null;
}

function getVisibleMarks() {
  const page = getVisiblePage();
  if (!page) return [];

  // Only marks that are actually displayed (not in a hidden text format
  // or a closed section).
  return [...page.querySelectorAll("mark")]
    .filter(mark => mark.getClientRects().length > 0);
}

function hasMoreEntriesToLoad() {
  if (IS_COMBINED) return combinedHasMore();

  const page = getVisiblePage();

  return Boolean(
    page &&
    currentRenderTarget &&
    page.contains(currentRenderTarget) &&
    renderedEntryCount < currentVisibleEntries.length
  );
}

function resetMatchNavigation() {
  currentMatchEl?.classList.remove("mark-current");
  currentMatchEl = null;
  updateMatchNav();
}

function updateMatchNav() {
  const marks = getVisibleMarks();
  const more = hasMoreEntriesToLoad() ? "+" : "";

  if (currentMatchEl && !marks.includes(currentMatchEl)) {
    currentMatchEl.classList.remove("mark-current");
    currentMatchEl = null;
  }

  const index = currentMatchEl ? marks.indexOf(currentMatchEl) + 1 : 0;
  // Before jumping: "79+ matches". While jumping: "3 / 79+".
  const label = !marks.length
    ? ""
    : index
      ? `${index} / ${marks.length}${more}`
      : `${marks.length}${more} ${marks.length === 1 && !more ? "match" : "matches"}`;

  // Combined mode: matches can sit in closed sections, so the arrows stay
  // available while there is more to open.
  const combinedPending = IS_COMBINED && !marks.length && more;
  const navLabel = combinedPending ? "Matches" : label;

  document.querySelectorAll("[data-match-nav]").forEach(nav => {
    nav.hidden = marks.length === 0 && !combinedPending;
    const countEl = nav.querySelector("[data-match-count]");
    if (countEl) countEl.textContent = navLabel;
  });
}

function findStartingMatch(marks, direction) {
  const line = window.innerHeight * MATCH_SCROLL_POSITION;

  if (direction > 0) {
    const index = marks.findIndex(mark => mark.getBoundingClientRect().top > line - 4);
    return index === -1 ? marks.length : index;
  }

  for (let i = marks.length - 1; i >= 0; i--) {
    if (marks[i].getBoundingClientRect().top < line + 4) return i;
  }

  return -1;
}

function jumpToMatch(direction) {
  // Apply a search that is still waiting on the typing delay first.
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = null;
    render();
  }

  let marks = getVisibleMarks();
  let target;

  if (currentMatchEl && marks.includes(currentMatchEl)) {
    target = marks.indexOf(currentMatchEl) + direction;
  } else {
    target = findStartingMatch(marks, direction);
  }

  // Past the last loaded match: load more results until a new one appears.
  let loads = 0;

  while (target >= marks.length && hasMoreEntriesToLoad() && loads < MATCH_MAX_PAGE_LOADS) {
    loadMoreForMatches();
    marks = getVisibleMarks();
    loads++;
  }

  if (!marks.length) return;

  // Wrap around at either end.
  if (target >= marks.length) target = 0;
  if (target < 0) target = marks.length - 1;

  currentMatchEl?.classList.remove("mark-current");
  currentMatchEl = marks[target];
  currentMatchEl.classList.add("mark-current");

  const rect = currentMatchEl.getBoundingClientRect();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  window.scrollTo({
    top: rect.top + window.scrollY - window.innerHeight * MATCH_SCROLL_POSITION,
    behavior: reduceMotion ? "auto" : "smooth"
  });

  updateMatchNav();
}

// Tapping a shortened meta line shows it in full (and tapping again
// shortens it).
document.addEventListener("click", event => {
  const metaRest = event.target.closest(".meta-rest");
  if (metaRest) metaRest.classList.toggle("is-expanded");
});

document.addEventListener("click", event => {
  if (event.target.closest("[data-match-next]")) {
    jumpToMatch(1);
    return;
  }

  if (event.target.closest("[data-match-prev]")) {
    jumpToMatch(-1);
    return;
  }

  // Format/JP toggles and opening sections change which marks are shown.
  requestAnimationFrame(updateMatchNav);
});

const FLOATING_SEARCH_SCROLL_THRESHOLD = 320;

const backToTopBtn = document.querySelector("#backToTopBtn");

function updateBackToTopVisibility() {
  if (!backToTopBtn) return;

  const shouldShow = window.scrollY > Math.max(1200, window.innerHeight * 2);
  backToTopBtn.classList.toggle("is-visible", shouldShow);
}

backToTopBtn?.addEventListener("click", () => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
});

const aboutBtn = document.querySelector("#aboutBtn");

aboutBtn?.addEventListener("click", () => {
  const tagline = document.querySelector("#appTagline");
  if (!tagline) return;

  tagline.hidden = !tagline.hidden;
  aboutBtn.setAttribute("aria-expanded", String(!tagline.hidden));
  aboutBtn.classList.toggle("active", !tagline.hidden);
});

/* ---------------------------------------------------------
   Dump dropdown ("⇄ Switch dump" under the title)
   --------------------------------------------------------- */

const dumpPickerBtn = document.querySelector("#switchGameBtn");
const dumpMenu = document.querySelector("#dumpMenu");

function renderDumpMenu() {
  if (!dumpMenu) return;

  dumpMenu.innerHTML = GAME_ORDER.map(key => {
    const cfg = GAME_CONFIG[key];
    const isCurrent = key === ACTIVE_GAME;

    return `
      <button
        class="dump-option${isCurrent ? " is-current" : ""}"
        type="button"
        role="menuitemradio"
        aria-checked="${isCurrent}"
        data-game="${escapeAttribute(key)}"
      >
        <span class="dump-dot" aria-hidden="true"></span>
        <span class="dump-option-text">
          <strong>${escapeHtml(cfg.title)}</strong>
          <small>${escapeHtml(GAME_FULL_NAMES[key] || "")}</small>
        </span>
        ${isCurrent ? '<span class="dump-check" aria-hidden="true">✓</span>' : ""}
      </button>
    `;
  }).join("") + `
    <div class="dump-menu-divider" role="separator"></div>
    <button
      class="dump-option dump-option-all${IS_COMBINED ? " is-current" : ""}"
      type="button"
      role="menuitemradio"
      aria-checked="${IS_COMBINED}"
      data-game="all"
    >
      <span class="dump-dot dump-dot-all" aria-hidden="true"></span>
      <span class="dump-option-text">
        <strong>MonsterHunterDump</strong>
        <small>All games combined</small>
      </span>
      ${IS_COMBINED ? '<span class="dump-check" aria-hidden="true">✓</span>' : ""}
    </button>
  `;
}

function isDumpMenuOpen() {
  return Boolean(dumpMenu && !dumpMenu.hidden);
}

function openDumpMenu() {
  if (!dumpMenu || !dumpPickerBtn) return;

  renderDumpMenu();
  dumpMenu.hidden = false;
  dumpPickerBtn.setAttribute("aria-expanded", "true");
  dumpPickerBtn.classList.add("active");

  requestAnimationFrame(() => {
    dumpMenu.classList.add("is-open");
    (dumpMenu.querySelector(".dump-option.is-current") || dumpMenu.querySelector(".dump-option"))?.focus();
  });
}

function closeDumpMenu({ restoreFocus = false } = {}) {
  if (!isDumpMenuOpen()) return;

  dumpMenu.classList.remove("is-open");
  dumpMenu.hidden = true;
  dumpPickerBtn.setAttribute("aria-expanded", "false");
  dumpPickerBtn.classList.remove("active");

  if (restoreFocus) dumpPickerBtn.focus();
}

dumpPickerBtn?.addEventListener("click", event => {
  event.stopPropagation();

  if (isDumpMenuOpen()) {
    closeDumpMenu();
  } else {
    openDumpMenu();
  }
});

dumpMenu?.addEventListener("click", event => {
  const option = event.target.closest(".dump-option");
  if (!option) return;

  const key = option.dataset.game;

  if (key === ACTIVE_GAME) {
    closeDumpMenu({ restoreFocus: true });
    return;
  }

  switchGame(key);
});

// Arrow keys move between options, Escape closes.
dumpMenu?.addEventListener("keydown", event => {
  const options = [...dumpMenu.querySelectorAll(".dump-option")];
  const index = options.indexOf(document.activeElement);

  if (event.key === "Escape") {
    event.preventDefault();
    closeDumpMenu({ restoreFocus: true });
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    options[(index + 1) % options.length]?.focus();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    options[(index - 1 + options.length) % options.length]?.focus();
  } else if (event.key === "Home") {
    event.preventDefault();
    options[0]?.focus();
  } else if (event.key === "End") {
    event.preventDefault();
    options[options.length - 1]?.focus();
  }
});

// Tapping anywhere else closes it.
document.addEventListener("click", event => {
  if (!isDumpMenuOpen()) return;
  if (event.target.closest(".dump-picker")) return;

  closeDumpMenu();
});

function updateFloatingSearchVisibility() {
  if (!floatingSearch) return;

  const shouldShow = window.scrollY > FLOATING_SEARCH_SCROLL_THRESHOLD;

  if (shouldShow === floatingSearch.classList.contains("is-visible")) return;

  floatingSearch.classList.toggle("is-visible", shouldShow);

  if (!shouldShow) {
    collapseFloatingSearch();
  }
}

function expandFloatingSearch() {
  if (!floatingSearch) return;

  floatingSearch.classList.add("is-expanded");
  floatingSearchInput.removeAttribute("tabindex");
  requestAnimationFrame(() => floatingSearchInput.focus());
}

function collapseFloatingSearch() {
  if (!floatingSearch) return;

  floatingSearch.classList.remove("is-expanded");
  floatingSearchInput.setAttribute("tabindex", "-1");
  floatingSearchInput.blur();
}

function handleScroll() {
  updateFloatingSearchVisibility();
  updateBackToTopVisibility();

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

// Short message that slides up from the bottom of the screen.
const toast = document.querySelector("#toast");
let toastTimer = null;

function showToast(message) {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("is-visible");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1800);
}

async function copyText(text, button, message = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    showToast(message);

    if (button) {
      button.classList.add("is-copied");
      setTimeout(() => button.classList.remove("is-copied"), 900);
    }
  } catch {
    showToast("Couldn't copy");
  }
}

function getCardCopyText(card) {
  const mode = card.dataset.mode || "ids";

  const entry = getCardEntry(card);

  if (entry) {
    const data = getCardLanguageData(entry, card.dataset.lang === "jp" ? "jp" : "en");
    if (mode === "clean") return decodeHtml(data.copyClean || "");
    if (mode === "code") return decodeHtml(data.copyCode || "");
    return decodeHtml(data.copyIds || "");
  }

  if (mode === "clean") return decodeHtml(card.dataset.copyClean || "");
  if (mode === "code") return decodeHtml(card.dataset.copyCode || "");

  return decodeHtml(card.dataset.copyIds || "");
}

// World keeps unused lines in its files as placeholders: "Invalid Message"
// in English, and "Invalid Message" or filler words like "dummy", 未使用
// (unused) or 仮名称 (temporary name) in Japanese. They're removed per
// language, so real text in the other language stays visible; an entry is
// only left out when neither language has real text. The dump files keep
// every line.
const WORLD_PLACEHOLDERS_EN = new Set(["Invalid Message"]);
const WORLD_PLACEHOLDERS_JP = new Set([
  "Invalid Message", "dummy", "Dummy", "未使用", "仮名称", "欠番", "作成中", "―――"
]);

function removeWorldPlaceholders(entries) {
  const result = [];

  for (const entry of entries) {
    const cleaned = { ...entry };

    if (WORLD_PLACEHOLDERS_EN.has(String(entry.text || "").trim())) {
      cleaned.name = "";
      cleaned.raw = "";
      cleaned.text = "";
    }

    if (WORLD_PLACEHOLDERS_JP.has(String(entry.textJp || "").trim())) {
      cleaned.nameJp = "";
      cleaned.rawJp = "";
      cleaned.textJp = "";
    }

    if (!cleaned.text.trim() && !cleaned.textJp.trim()) continue;

    result.push(cleaned);
  }

  return result;
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

  const textClean = getCleanText(baseText, entry.game || ACTIVE_GAME);

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

function normalizeSkillCommonEntry(entry) {
  if (entry.fileKey !== "skillcommon") return entry;
  if (!entry.jsonSkill) return entry;

  const skill = entry.jsonSkill;
  const skillNameEn = getJsonName(skill, "en") || entry.name;
  const skillNameJp = getJsonName(skill, "ja") || entry.nameJp;

  const getSkillText = lang => {
    const direct = skill.descriptions?.[lang];
    if (direct) return direct;

    const ranks = skill.ranks || [];
    return ranks
      .map(rank => {
        const desc = rank.descriptions?.[lang] || "";
        if (!desc) return "";

        return `Lv ${rank.level}\n${desc}`;
      })
      .filter(Boolean)
      .join("\n\n");
  };

  const enText = getSkillText("en");
  const jpText = getSkillText("ja");

  return {
    ...entry,

    name: skillNameEn,
    nameJp: skillNameJp,

    raw: enText || entry.raw,
    text: enText || entry.text,

    rawJp: jpText || entry.rawJp,
    textJp: jpText || entry.textJp
  };
}

function attachJsonMetadata(entry) {
  const displayName =
  entry.name ||
  getEnemyTextMonsterName(entry) ||
  "";

const name = String(displayName).toLowerCase();
  const firstId = String(entry.id || "").split("+")[0].trim();
  const numericId = Number(firstId);

  const jsonArmorPiece = name ? JSON_INDEX.armorPieceByName.get(name) : null;
  const jsonArmorSet = name ? JSON_INDEX.armorSetByName.get(name) : null;

  const jsonMonster =
  name ? JSON_INDEX.monsterByName.get(name) : null;

  const jsonItem = name ? JSON_INDEX.itemByName.get(name) : null;

  let jsonWeapon = name ? JSON_INDEX.weaponByName.get(name) : null;

if (!jsonWeapon && name) {
  const weaponFile = WEAPON_FILE_ALIASES[entry.fileKey] || entry.fileKey;

  jsonWeapon = (JSON_DATA[weaponFile] || [])
    .map(weapon => ({ ...weapon, weapon_file: weaponFile }))
    .find(weapon => getJsonName(weapon, "en").toLowerCase() === name) || null;
}

  if (!jsonWeapon && name && entry.fileKey === "whistle") {
    jsonWeapon = (JSON_DATA.huntinghorn || [])
      .map(weapon => ({ ...weapon, weapon_file: "huntinghorn" }))
      .find(weapon => getJsonName(weapon, "en").toLowerCase() === name) || null;
  }

  let jsonAmulet = name ? JSON_INDEX.amuletByName.get(name) : null;
  if (!jsonAmulet && entry.fileKey === "amulet") {
    jsonAmulet =
      (JSON_DATA.amulet || []).find(item => Number(item.game_id) === numericId) ||
      null;
  }

  const textAsName = String(entry.text || "").trim().toLowerCase();

let jsonSkill =
  (name ? JSON_INDEX.skillByName.get(name) : null) ||
  (textAsName ? JSON_INDEX.skillByName.get(textAsName) : null);
  if (
    !jsonSkill &&
    Number.isFinite(numericId) &&
    entry.fileKey === "skillcommon"
  ) {
    jsonSkill =
      (JSON_DATA.skill || []).find(skill => Number(skill.game_id) === numericId) ||
      null;
  }

  return {
    ...entry,
    jsonItem: jsonItem || null,
    jsonAmulet: jsonAmulet || null,
    jsonSkill: jsonSkill || null,
    jsonArmorPiece: jsonArmorPiece || null,
    jsonArmorSet: jsonArmorSet || null,
    jsonMonster: jsonMonster || null,
    jsonWeapon: jsonWeapon || null
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
  entry.rejectedId,

  // Item JSON
  entry.jsonItem?.descriptions?.en,
  entry.jsonItem?.descriptions?.ja,
  entry.jsonItem?.kind,

  // Skill JSON
  entry.jsonSkill?.descriptions?.en,
  entry.jsonSkill?.descriptions?.ja,
  entry.jsonSkill?.kind,

  // Amulet JSON
  entry.jsonAmulet?.descriptions?.en,
  entry.jsonAmulet?.descriptions?.ja,

  // Weapon JSON
  entry.jsonWeapon?.weapon_file,
  entry.jsonWeapon?.rarity,
  entry.jsonWeapon?.attack,
  entry.jsonWeapon?.affinity,
  entry.jsonWeapon?.defense,
  entry.jsonWeapon?.series_id,
  
  entry.jsonMonster?.descriptions?.en,
  entry.jsonMonster?.descriptions?.ja,
  entry.jsonMonster?.features?.en,
  entry.jsonMonster?.features?.ja,
  entry.jsonMonster?.tips?.en,
  entry.jsonMonster?.tips?.ja,
  entry.jsonMonster?.species
]
  .filter(Boolean)
  .join("\n");

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

// --- <REF ...> resolution (Wilds) ---------------------------------------
// Many strings reference other files via <REF Label> tags. Two label kinds
// are exactly resolvable from the dump + JSON data:
//   Item_IT_<gameId> / Item_IT_EXP_<gameId>  -> item name / description
//   RefButton_11, RefMenu_061, ...           -> string position in ref files
// Hash-based labels (ActionGuideDataNameText_*) stay untouched.

const REF_POSITIONAL_FILES = {
  refbutton: "RefButton",
  refmenu: "RefMenu",
  refgeneral: "RefGeneral",
  refenvironment: "RefEnvironment",
  reflanguage: "RefLanguage"
};

let REF_TABLES = {};

function buildRefTables(enSections) {
  const tables = {};

  for (const fileKey of Object.keys(REF_POSITIONAL_FILES)) {
    const section = enSections.find(s => s.fileKey === fileKey);
    if (!section) continue;

    // Use the raw body so label-only (rejected) slots keep their position.
    tables[fileKey] = String(section.rawBody || "")
      .split("\n")
      .filter(line => line.startsWith("<string>"))
      .map(line => cleanWildsText(line.slice("<string>".length)));
  }

  return tables;
}

function resolveRefLabel(label) {
  const itemMatch = label.match(/^Item_IT_(EXP_)?(\d+)$/);

  if (itemMatch) {
    const item = JSON_INDEX.itemByGameId.get(itemMatch[2]);
    if (!item) return null;

    return itemMatch[1]
      ? item.descriptions?.en || null
      : getJsonName(item, "en") || null;
  }

  const positionalMatch = label.match(
    /^(RefButton|RefMenu|RefGeneral|RefEnvironment|RefLanguage)_(\d+)$/
  );

  if (positionalMatch) {
    const fileKey = positionalMatch[1].toLowerCase();
    const table = REF_TABLES[fileKey];
    const value = table?.[Number(positionalMatch[2])];

    // Label-only slots (removed strings) cannot be shown.
    if (!value || value.includes("#Rejected#") || value.startsWith(positionalMatch[1] + "_")) {
      return null;
    }

    return value;
  }

  return null;
}

function resolveRefsInText(value) {
  return String(value || "").replace(/<REF\s+([A-Za-z0-9_]+)>/g, (tag, label) => {
    const resolved = resolveRefLabel(label);
    return resolved !== null ? resolved : tag;
  });
}

function resolveWildsRefs(entry) {
  const hasRefs =
    (entry.text && entry.text.includes("<REF ")) ||
    (entry.raw && entry.raw.includes("<REF "));

  if (!hasRefs) return entry;

  return {
    ...entry,
    text: resolveRefsInText(entry.text),
    raw: resolveRefsInText(entry.raw)
  };
}

function setLoadingStatus(message) {
  results.innerHTML = `<div class="empty">${escapeHtml(message)}</div>`;
}

/* ---------------------------------------------------------
   Combined mode (MonsterHunterDump): every game loaded together
   Each game goes through exactly the same steps as in its own
   mode (and shares its cache); its entries are then tagged with
   the game. Results appear game by game as each one finishes.
   --------------------------------------------------------- */

const combinedLoadState = {};   // game -> "waiting" | "loading" | "done" | "error"
const combinedEntryCounts = {}; // game -> number of entries

/* ---------------------------------------------------------
   Loading a game's data (both modes)
   1. Ask the server whether the dump files changed (a tiny HEAD request
      for their version tag). Unchanged and cached: no download at all.
   2. Offline: use the cache.
   3. Otherwise download; if the text still matches the cache, keep it.
   4. Otherwise parse - in a background worker, so the page stays smooth
      (falls back to parsing here if workers aren't available).
   --------------------------------------------------------- */

// The few parsed sections the page still needs after parsing (Wilds armor
// series and reference tables).
function getKeptFileKeys() {
  return ["armorseries", ...Object.keys(REF_POSITIONAL_FILES)];
}

// The files' version as the server reports it (ETag, or date + size).
async function getRemoteVersion(cfg) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { key: "", offline: true };
  }

  const parts = [];

  for (const url of [cfg.en, cfg.jp].filter(Boolean)) {
    let response;

    try {
      response = await fetch(url, { method: "HEAD", cache: "no-cache" });
    } catch {
      return { key: "", offline: true };
    }

    if (!response.ok) return { key: "", offline: false };

    const etag = response.headers.get("etag");
    const modified = response.headers.get("last-modified");
    const length = response.headers.get("content-length");
    const version = etag || (modified ? `${modified}|${length || ""}` : "");

    if (!version) return { key: "", offline: false };
    parts.push(`${url}=${version}`);
  }

  return { key: `${WILDS_CACHE_VERSION}|${parts.join("|")}`, offline: false };
}

let parseWorker = null;
let parseRequestId = 0;

function parseInWorker(enRaw, jpRaw) {
  return new Promise((resolve, reject) => {
    if (typeof Worker === "undefined") {
      reject(new Error("Workers are not available"));
      return;
    }

    if (!parseWorker) parseWorker = new Worker("./parse-worker.js");

    const worker = parseWorker;
    const id = ++parseRequestId;

    const cleanup = () => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
    };

    const onMessage = event => {
      if (event.data?.id !== id) return;
      cleanup();
      if (event.data.ok) resolve(event.data);
      else reject(new Error(event.data.error));
    };

    const onError = event => {
      cleanup();
      worker.terminate();
      if (parseWorker === worker) parseWorker = null;
      reject(new Error(event.message || "Worker failed"));
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.postMessage({ id, enRaw, jpRaw, keepFileKeys: getKeptFileKeys() });
  });
}

// The same steps the worker runs, on the page itself.
function parseOnMainThread(enRaw, jpRaw) {
  const enAllSections = parseWildsDump(enRaw, "en");
  const jpAllSections = jpRaw ? parseWildsDump(jpRaw, "jp") : [];

  const enSections = enAllSections.filter(section => !section.isOldVersion);
  const jpSections = jpAllSections.filter(section => !section.isOldVersion);

  const npcMap = typeof NPC_MAP !== "undefined" ? NPC_MAP : {};
  const keep = getKeptFileKeys();

  return {
    enEntries: buildWildsEntries(enSections, npcMap),
    jpEntries: buildWildsEntries(jpSections, npcMap),
    diffData: buildDiffData(enAllSections),
    keptSections: enSections.filter(section => keep.includes(section.fileKey))
  };
}

async function parseDumpText(enRaw, jpRaw) {
  try {
    return await parseInWorker(enRaw, jpRaw);
  } catch (error) {
    console.warn("Parsing on the page instead of in the background:", error);
    await nextFrame();
    return parseOnMainThread(enRaw, jpRaw);
  }
}

// Returns { payload, needsCacheWrite, remoteKey } for one game.
async function loadGamePayload(key, onStatus = () => {}) {
  const cfg = GAME_CONFIG[key];

  onStatus("Checking cache…");
  const cached = await wildsCacheGet(key);
  const remote = await getRemoteVersion(cfg);

  if (cached && remote.offline) {
    return { payload: cached, needsCacheWrite: false, remoteKey: "" };
  }

  if (cached && remote.key && (await wildsVersionGet(key)) === remote.key) {
    return { payload: cached, needsCacheWrite: false, remoteKey: "" };
  }

  onStatus(`Loading ${cfg.title} text dumps…`);

  const enResponse = await fetch(cfg.en);
  if (!enResponse.ok) throw new Error(`Could not load ${cfg.en}`);

  let jpRaw = "";

  if (cfg.jp) {
    const jpResponse = await fetch(cfg.jp);
    if (!jpResponse.ok) throw new Error(`Could not load ${cfg.jp}`);
    jpRaw = await jpResponse.text();
  }

  const enRaw = await enResponse.text();
  const checkString = makeWildsCacheKey(enRaw, jpRaw);

  // Same text as the cache (e.g. a cache from before version tags were
  // remembered): keep it, and remember the version for next time.
  if (cached && cached.check === checkString) {
    wildsVersionPut(key, remote.key);
    return { payload: cached, needsCacheWrite: false, remoteKey: "" };
  }

  onStatus("Parsing dumps… (first load only, will be cached)");
  await nextFrame();

  const parsed = await parseDumpText(enRaw, jpRaw);

  onStatus("Building entries…");
  await nextFrame();

  buildArmorSeriesMap(parsed.keptSections);

  let merged = mergeLocalizedEntries(parsed.enEntries, parsed.jpEntries);

  if (key === "world") {
    merged = removeWorldPlaceholders(merged);
  }

  const payload = {
    check: checkString,
    entries: merged.map(stripEntryForCache),
    armorSeries: [...ARMOR_SERIES_BY_ID.entries()],
    refTables: buildRefTables(parsed.keptSections),
    diffData: parsed.diffData
  };

  return { payload, needsCacheWrite: true, remoteKey: remote.key };
}

// Writes a freshly parsed game to the cache, then remembers its version.
async function storeGamePayload(key, payload, remoteKey) {
  await wildsCachePut(key, payload);
  await wildsVersionPut(key, remoteKey);
}

async function loadAllDumps() {
  for (const key of GAME_ORDER) combinedLoadState[key] = "waiting";
  updateMenuAvailability();

  entries = [];
  DIFF_DATA = []; // Version Diff is a single-game page
  renderLoadProgress();
  render();

  let wildsArmorSeries = null;

  for (const key of GAME_ORDER) {
    const cfg = GAME_CONFIG[key];
    combinedLoadState[key] = "loading";
    renderLoadProgress();
    await nextFrame();

    try {
      const { payload, needsCacheWrite, remoteKey } = await loadGamePayload(key);

      if (cfg.hasJson) {
        wildsArmorSeries = payload.armorSeries || [];
        ARMOR_SERIES_BY_ID.clear();
        for (const [id, name] of wildsArmorSeries) ARMOR_SERIES_BY_ID.set(id, name);
        REF_TABLES = payload.refTables || {};
      }

      const gameEntries = payload.entries
        .map(entry => (cfg.hasJson ? resolveWildsRefs(entry) : entry))
        .map(entry => (cfg.hasJson ? attachJsonMetadata(entry) : entry))
        .map(normalizeSkillCommonEntry)
        .map(addSearchFields)
        // New objects, so the cached payload keeps its single-game form.
        .map(entry => ({ ...entry, game: key, uid: `${key}:${entry.uid}` }));

      entries = entries.concat(gameEntries);
      combinedEntryCounts[key] = gameEntries.length;
      combinedLoadState[key] = "done";

      if (needsCacheWrite) {
        setTimeout(() => storeGamePayload(key, payload, remoteKey), 500);
      }
    } catch (error) {
      console.error(error);
      combinedLoadState[key] = "error";
    }

    // Other games can overwrite the armor series map while parsing.
    if (wildsArmorSeries) {
      ARMOR_SERIES_BY_ID.clear();
      for (const [id, name] of wildsArmorSeries) ARMOR_SERIES_BY_ID.set(id, name);
    }

    noSearchOrderCache.clear();
    buildIndexes();
    updateTypeFilterAvailability();
    renderLoadProgress();
    render();
  }

  renderCategoryMenu();
  updateMenuAvailability();
  render();
  applyInitialRoute();
  finishLoadProgress();
}

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function loadDump() {
  if (IS_COMBINED) return loadAllDumps();

  const cfg = GAME_CONFIG[ACTIVE_GAME];

  setLoadingStatus(`Loading ${cfg.title} text dumps…`);

  try {
    const { payload, needsCacheWrite, remoteKey } = await loadGamePayload(ACTIVE_GAME, setLoadingStatus);

    ARMOR_SERIES_BY_ID.clear();

    for (const [id, name] of payload.armorSeries || []) {
      ARMOR_SERIES_BY_ID.set(id, name);
    }

    DIFF_DATA = payload.diffData || [];
    REF_TABLES = payload.refTables || {};

    setLoadingStatus("Preparing entries…");
    await nextFrame();

    entries = payload.entries
      .map(entry => (cfg.hasJson ? resolveWildsRefs(entry) : entry))
      .map(entry => (cfg.hasJson ? attachJsonMetadata(entry) : entry))
      .map(normalizeSkillCommonEntry)
      .map(addSearchFields);

    noSearchOrderCache.clear();

    buildIndexes();
    addDumpEntities(monsterGroups);
    renderCategoryMenu();
    updateTypeFilterAvailability();
    updateMenuAvailability();
    render();
    applyInitialRoute();

    if (needsCacheWrite) {
      // Persist after first paint - the cache is a pure optimization.
      setTimeout(() => storeGamePayload(ACTIVE_GAME, payload, remoteKey), 500);
    }
  } catch (error) {
    console.error(error);

    count.textContent = "0 entries";
    results.innerHTML = `
      <div class="empty">
        Could not load the ${escapeHtml(cfg.title)} text dumps.<br>
        Make sure these files exist:<br>
        <code>${escapeHtml(cfg.en.replace("./", ""))}</code>
        ${cfg.jp ? `<br><code>${escapeHtml(cfg.jp.replace("./", ""))}</code>` : ""}
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

  // Crossfade between themes where the browser supports it. The whole page
  // is captured as one image and faded, so nothing flickers mid-switch.
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (document.startViewTransition && !reduceMotion) {
    document.startViewTransition(() => applyTheme(next));
  } else {
    applyTheme(next);
  }
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
  if (floatingSearchInput) floatingSearchInput.value = search.value;

  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchTimer = null;
    render();
  }, 120);
});

search.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    jumpToMatch(event.shiftKey ? -1 : 1);
  }
});

if (floatingSearch) {
  floatingSearchToggle.addEventListener("click", () => {
    if (floatingSearch.classList.contains("is-expanded")) {
      collapseFloatingSearch();
    } else {
      expandFloatingSearch();
    }
  });

  floatingSearchInput.addEventListener("input", () => {
    search.value = floatingSearchInput.value;

    // Typing a new search while reading a dialogue/category/detail view
    // should jump back to Home so the filtered results are actually
    // visible. Only do the view-switch once (searchView.hidden guards it)
    // so it doesn't re-scroll on every subsequent keystroke.
    if (searchView.hidden) {
      pushViewHistory(captureCurrentView());
      showOnly(searchView);
      closeMenu();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    search.dispatchEvent(new Event("input"));
  });

  floatingSearchInput.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      collapseFloatingSearch();
    }

    if (event.key === "Enter") {
      event.preventDefault();
      jumpToMatch(event.shiftKey ? -1 : 1);
    }
  });

  floatingSearchInput.addEventListener("blur", () => {
    if (!floatingSearchInput.value.trim()) {
      floatingSearch.classList.remove("is-expanded");
      floatingSearchInput.setAttribute("tabindex", "-1");
    }
  });

  document.addEventListener("click", event => {
    if (!floatingSearch.classList.contains("is-expanded")) return;
    if (floatingSearch.contains(event.target)) return;
    if (!floatingSearchInput.value.trim()) {
      collapseFloatingSearch();
    }
  });
}

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

  try {
    localStorage.setItem("wd_cardMode", defaultCardMode);
  } catch {}

  cardControls.querySelectorAll("[data-card-mode]").forEach(button => {
    button.classList.toggle("active", button.dataset.cardMode === defaultCardMode);
  });

  document.querySelectorAll(".entry").forEach(card => {
    card.dataset.mode = defaultCardMode;
  });
});

copySearchResultsBtn.addEventListener("click", () => {
  const block = entry => "```\n" + getCleanText(entry.text, entry.game || ACTIVE_GAME) + "\n```";

  // Combined mode: grouped under a heading per game.
  const text = IS_COMBINED
    ? GAME_ORDER
        .map(key => {
          const list = currentSearchResults.filter(entry => entry.game === key);
          if (!list.length) return "";
          return `## ${GAME_CONFIG[key].title} (${list.length.toLocaleString()})\n\n` + list.map(block).join("\n\n");
        })
        .filter(Boolean)
        .join("\n\n")
    : currentSearchResults
        .map(block)
        .filter(Boolean)
        .join("\n\n");

  const n = currentSearchResults.length;
  copyText(text, copySearchResultsBtn, `Copied ${n.toLocaleString()} ${n === 1 ? "result" : "results"}`);
});

document.addEventListener("click", event => {

  const entityLink = event.target.closest("[data-entity-type]");
  if (entityLink) {
    showEntityDetail(entityLink.dataset.entityType, entityLink.dataset.entityKey);
    return;
  }

  const sizeComparisonButton = event.target.closest("[data-show-size-comparison]");
  if (sizeComparisonButton) {
    showSizeComparison();
    return;
  }

  const compareAddButton = event.target.closest("[data-compare-add]");
  if (compareAddButton) {
    const [type, ...rest] = compareAddButton.dataset.compareAdd.split("|");
    toggleCompareItem(type, rest.join("|"));
    return;
  }

  const compareRemoveButton = event.target.closest("[data-compare-remove]");
  if (compareRemoveButton) {
    const [type, ...rest] = compareRemoveButton.dataset.compareRemove.split("|");
    toggleCompareItem(type, rest.join("|"));

    if (compareView && !compareView.hidden) {
      showCompareView(false);
    }
    return;
  }

  const compareOpenButton = event.target.closest("[data-compare-open]");
  if (compareOpenButton) {
    showCompareView();
    return;
  }

  const compareClearButton = event.target.closest("[data-compare-clear]");
  if (compareClearButton) {
    compareList = [];
    saveCompareList();
    renderCompareTray();
    updateCompareButtons();

    if (compareView && !compareView.hidden) {
      showCompareView(false);
    }
    return;
  }

  const diffFileButton = event.target.closest("[data-diff-file]");
  if (diffFileButton) {
    showVersionDiff(true, diffFileButton.dataset.diffFile);
    return;
  }

  const npcUnmappedToggle = event.target.closest("[data-npc-unmapped-toggle]");
  if (npcUnmappedToggle) {
    npcShowUnmappedOnly = !npcShowUnmappedOnly;
    showNpcIndex(false);
    return;
  }

  const weaponDisplayButton = event.target.closest("[data-weapon-display]");
  if (weaponDisplayButton) {
    activeWeaponDisplay = weaponDisplayButton.dataset.weaponDisplay;
    renderWeaponCategoryResults();
    return;
  }

  const weaponTypeButton = event.target.closest("[data-weapon-type-filter]");
if (weaponTypeButton) {
  activeWeaponTypeFilter = weaponTypeButton.dataset.weaponTypeFilter;
  renderWeaponCategoryResults();
  return;
}
  
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

const monsterChip = event.target.closest("[data-monster-chip]");
if (monsterChip) {
  const key = monsterChip.dataset.monsterChip;

  activeMonsterKey =
    activeMonsterKey === key
      ? ""
      : key;

  renderMonsterIndex();
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

  if (event.target.closest(".json-panel")) return;

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
backFromHelpBtn?.addEventListener("click", goBack);
helpBtn?.addEventListener("click", () => showHelp());

for (const id of [
  "#backFromDetailBtn",
  "#backFromCompareBtn",
  "#backFromDiffBtn",
  "#backFromSizeBtn"
]) {
  document.querySelector(id)?.addEventListener("click", goBack);
}

document.querySelector("#sizeCompareBtn")?.addEventListener("click", () => showSizeComparison());
document.querySelector("#versionDiffBtn")?.addEventListener("click", () => showVersionDiff());
document.querySelector("#compareViewBtn")?.addEventListener("click", () => showCompareView());

dialogueModeBtn.addEventListener("click", () => {
  dialogueDisplayMode =
    dialogueDisplayMode === "cards"
      ? "full"
      : "cards";

  try {
    localStorage.setItem("wd_dialogueMode", dialogueDisplayMode);
  } catch {}

  if (npcGroups.has(currentDialogueKey) || monsterGroups.has(currentDialogueKey)) {
    showDialogue(currentDialogueKey, false);
  } else {
    showDialogueByDisplayName(currentDialogueKey, false);
  }
});

window.addEventListener("scroll", handleScroll, { passive: true });

function getNextGame() {
  const index = GAME_ORDER.indexOf(ACTIVE_GAME);
  return GAME_ORDER[(index + 1) % GAME_ORDER.length];
}

function applyGameChrome() {
  const cfg = GAME_CONFIG[ACTIVE_GAME];
  const otherCfg = GAME_CONFIG[getNextGame()];

  document.title = cfg.title;

  const titleEl = document.querySelector("#gameTitle");
  if (titleEl) titleEl.textContent = cfg.title;

  const taglineEl = document.querySelector("#appTagline");
  if (taglineEl) taglineEl.textContent = cfg.tagline;

  if (titleEl) {
    titleEl.title = IS_COMBINED
      ? `Tap to return to ${GAME_CONFIG[getLastSingleGame()].title}`
      : `Tap for ${otherCfg.title}`;
  }

  const allToggle = document.querySelector("#allGamesToggle");
  if (allToggle) allToggle.setAttribute("aria-checked", String(IS_COMBINED));

  renderDumpMenu();

  // Features backed by the Wilds JSON database are hidden for other games.
  if (!cfg.hasJson) {
    for (const id of ["#sizeCompareBtn", "#compareViewBtn", "#versionDiffBtn", "#monsterIndexBtn"]) {
      const el = document.querySelector(id);
      if (el) el.hidden = true;
    }
  }

  updateMenuSectionVisibility();
}

// Switches to the given game (default: the next, older one) and reloads.
function switchGame(target = getNextGame()) {
  if (!GAME_CONFIG[target]) return;

  try {
    localStorage.setItem("wd_game", target);
  } catch {}

  // Drop the current link, otherwise its #g=... would keep the old game.
  try {
    history.replaceState(null, "", location.pathname + location.search);
  } catch {}

  location.reload();
}

// Tapping the title moves on to the next (older) game.
document.querySelector("#gameTitle")?.addEventListener("click", () => {
  if (IS_COMBINED) switchGame(getLastSingleGame());
  else switchGame();
});

// Menu switch: all games on/off.
document.querySelector("#allGamesToggle")?.addEventListener("click", () => {
  switchGame(IS_COMBINED ? getLastSingleGame() : "all");
});

function restoreSavedSettings() {
  try {
    const savedCardMode = localStorage.getItem("wd_cardMode");

    if (["ids", "clean", "code"].includes(savedCardMode)) {
      defaultCardMode = savedCardMode;

      cardControls.querySelectorAll("[data-card-mode]").forEach(button => {
        button.classList.toggle("active", button.dataset.cardMode === defaultCardMode);
      });
    }

    const savedDialogueMode = localStorage.getItem("wd_dialogueMode");

    if (["cards", "full"].includes(savedDialogueMode)) {
      dialogueDisplayMode = savedDialogueMode;
    }
  } catch {}
}

// Offline support (see sw.js). Only on https or localhost, where browsers
// allow service workers; failures are harmless.
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

(async () => {
  try {
    applyTheme(getSavedTheme());
    restoreSavedSettings();
    applyGameChrome();

    // Combined mode: show the progress panel right away.
    if (IS_COMBINED) {
      for (const key of GAME_ORDER) combinedLoadState[key] = "waiting";
      renderLoadProgress();
      updateMenuAvailability();
      results.innerHTML = "";
    }

    if (GAME_CONFIG[ACTIVE_GAME].hasJson || IS_COMBINED) {
      await loadJsonDatabase();
      buildJsonIndexes();
      buildEntityIndexes();
      renderCompareTray();
    }

    await loadDump();

    // Enable UI transitions only after the first paint, so saved settings
    // (like the Format switch) don't visibly animate into place on load.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => document.documentElement.classList.add("motion-ready"));
    });
  } catch (error) {
    console.error(error);

    count.textContent = "0 entries";
    results.innerHTML = `
      <div class="empty">
        Startup failed:<br><br>
        <code>${escapeHtml(error.message || String(error))}</code>
      </div>
    `;
  }
})();
