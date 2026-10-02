// parse-worker.js
// Parses a game's dump text off the main thread, so the page stays smooth
// on a first visit (or after a dump changes). It runs exactly the same
// parser functions the page would; app.js finishes the (light) rest.

// diff.js looks up its page elements when it loads; a worker has no page.
self.window = self;
self.document = {
  querySelector: () => null,
  querySelectorAll: () => []
};

importScripts("./categories.js", "./npc-data.js", "./parser.js", "./diff.js");

self.onmessage = event => {
  const { id, enRaw, jpRaw, keepFileKeys } = event.data;

  try {
    const enAllSections = parseWildsDump(enRaw, "en");
    const jpAllSections = jpRaw ? parseWildsDump(jpRaw, "jp") : [];

    const enSections = enAllSections.filter(section => !section.isOldVersion);
    const jpSections = jpAllSections.filter(section => !section.isOldVersion);

    const npcMap = typeof NPC_MAP !== "undefined" ? NPC_MAP : {};

    self.postMessage({
      id,
      ok: true,
      enEntries: buildWildsEntries(enSections, npcMap),
      jpEntries: buildWildsEntries(jpSections, npcMap),
      diffData: buildDiffData(enAllSections),
      // Only the few sections the page still needs (Wilds armor series and
      // reference tables), instead of all of them.
      keptSections: enSections.filter(section => keepFileKeys.includes(section.fileKey))
    });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error && error.stack || error) });
  }
};
