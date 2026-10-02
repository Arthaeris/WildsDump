// cache.js
// IndexedDB cache for the parsed dump data. Parsing ~30 MB of text takes
// several seconds; the parsed result is cached keyed by dump sizes so
// subsequent visits skip parsing entirely.

const WILDS_CACHE_VERSION = "wd4";
const WILDS_CACHE_DB = "wildsdump-cache";
const WILDS_CACHE_STORE = "parsed";

// Cache slots that are kept: one per game.
const WILDS_CACHE_GAME_KEYS = ["wilds", "rise", "world", "gu", "fu", "tri", "remote-versions"];

function openWildsCacheDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WILDS_CACHE_DB, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(WILDS_CACHE_STORE)) {
        db.createObjectStore(WILDS_CACHE_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function wildsCacheGet(key) {
  try {
    const db = await openWildsCacheDb();

    return await new Promise((resolve, reject) => {
      const tx = db.transaction(WILDS_CACHE_STORE, "readonly");
      const request = tx.objectStore(WILDS_CACHE_STORE).get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

async function wildsCachePut(key, value) {
  try {
    const db = await openWildsCacheDb();

    await new Promise((resolve, reject) => {
      const tx = db.transaction(WILDS_CACHE_STORE, "readwrite");
      const store = tx.objectStore(WILDS_CACHE_STORE);

      // One cache slot per game - remove legacy keys only. (This list used to
      // name only wilds/gu/tri, so Rise, World and 4U evicted each other.)
      const keysRequest = store.getAllKeys();

      keysRequest.onsuccess = () => {
        for (const existing of keysRequest.result || []) {
          if (!WILDS_CACHE_GAME_KEYS.includes(existing)) {
            store.delete(existing);
          }
        }

        store.put(value, key);
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Cache is a pure optimization - ignore failures (private mode etc.).
  }
}

function makeWildsCacheKey(enRaw, jpRaw) {
  return `${WILDS_CACHE_VERSION}:${enRaw.length}:${jpRaw.length}`;
}

// Strips derived fields (JSON refs, search blobs) so entries are small and
// structured-cloneable. They are re-derived after loading from cache.
function stripEntryForCache(entry) {
  const cleaned = {};

  for (const [key, value] of Object.entries(entry)) {
    if (key.startsWith("json") || key.startsWith("search")) continue;
    cleaned[key] = value;
  }

  return cleaned;
}

// The server's version tag of each game's dump files, as of the cached
// data. A small record of its own, so remembering a version never means
// rewriting a whole cached game.
async function wildsVersionGet(game) {
  const versions = await wildsCacheGet("remote-versions");
  return versions && typeof versions === "object" ? versions[game] || "" : "";
}

async function wildsVersionPut(game, version) {
  if (!version) return;

  try {
    const versions = (await wildsCacheGet("remote-versions")) || {};
    versions[game] = version;

    const db = await openWildsCacheDb();

    await new Promise((resolve, reject) => {
      const tx = db.transaction(WILDS_CACHE_STORE, "readwrite");
      tx.objectStore(WILDS_CACHE_STORE).put(versions, "remote-versions");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // A pure optimization - ignore failures.
  }
}

