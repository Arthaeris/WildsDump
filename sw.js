// sw.js
// Offline support. Network first: online, every request goes to the
// network as usual (so updates show up right away), and a copy of the app
// files is kept for when there is no connection.
//
// The dump files (…dump….txt) are not kept here: the app already stores
// each game's processed text in IndexedDB, and uses that when offline.

const APP_CACHE = "wildsdump-app-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./parser.js",
  "./categories.js",
  "./npc-data.js",
  "./cache.js",
  "./entities.js",
  "./details.js",
  "./compare.js",
  "./diff.js",
  "./wilds-json-data.js",
  "./parse-worker.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => Promise.all(APP_SHELL.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== APP_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isDumpFile(url) {
  return /dump[^/]*\.txt$/i.test(url.pathname);
}

async function networkFirst(request) {
  const cache = await caches.open(APP_CACHE);

  try {
    const response = await fetch(request);

    if (response.ok && response.type === "basic") {
      cache.put(request, response.clone()).catch(() => {});
    }

    return response;
  } catch (error) {
    const cached =
      (await cache.match(request, { ignoreSearch: true })) ||
      (request.mode === "navigate" ? await cache.match("./index.html") : null);

    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;

  // Only plain same-origin GET requests; HEAD (version checks), dumps and
  // everything else go straight to the network as before.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isDumpFile(url)) return;

  event.respondWith(networkFirst(request));
});
