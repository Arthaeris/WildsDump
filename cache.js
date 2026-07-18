// cache.js
// IndexedDB cache for the parsed dump data. Parsing ~30 MB of text takes
// several seconds; the parsed result is cached keyed by dump sizes so
// subsequent visits skip parsing entirely.

const WILDS_CACHE_VERSION = "wd4";
const WILDS_CACHE_DB = "wildsdump-cache";
const WILDS_CACHE_STORE = "parsed";

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

      // One cache slot per game ("wilds" / "gu") - remove legacy keys only.
      const keysRequest = store.getAllKeys();

      keysRequest.onsuccess = () => {
        for (const existing of keysRequest.result || []) {
          if (existing !== "wilds" && existing !== "gu" && existing !== "tri") {
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
