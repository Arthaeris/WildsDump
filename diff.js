// diff.js
// Version diff between archived dump copies ("name (2).23.txt") and the
// current version of each file.

const diffView = document.querySelector("#diffView");
const diffContent = document.querySelector("#diffContent");

let DIFF_DATA = [];
let currentDiffFile = "";

// Builds serializable diff data from ALL parsed sections (incl. old versions).
function buildDiffData(allSections) {
  const byKey = new Map();

  for (const section of allSections) {
    if (!byKey.has(section.fileKey)) {
      byKey.set(section.fileKey, { current: null, old: [] });
    }

    const group = byKey.get(section.fileKey);

    if (section.isOldVersion) {
      group.old.push(section);
    } else if (!group.current) {
      group.current = section;
    }
  }

  const files = [];

  for (const [fileKey, group] of byKey.entries()) {
    if (!group.current || !group.old.length) continue;

    // Highest copy number = assumed most recent archived state.
    group.old.sort((a, b) => b.versionNumber - a.versionNumber);

    const previous = group.old[0];
    const changes = diffSectionStrings(previous, group.current);

    if (!changes.length) continue;

    files.push({
      fileKey,
      category: group.current.category || "Unknown",
      title: group.current.title,
      oldTitle: previous.title,
      archivedCopies: group.old.length,
      added: changes.filter(change => change.status === "added").length,
      removed: changes.filter(change => change.status === "removed").length,
      changes
    });
  }

  files.sort((a, b) => b.changes.length - a.changes.length);

  return files;
}

// Multiset diff on string contents. Robust against index shifts caused by
// inserted lines (IDs are positional in the dumps).
function diffSectionStrings(oldSection, newSection) {
  const countTexts = section => {
    const map = new Map();

    for (const item of section.strings || []) {
      const text = String(item.text || item.raw || "").trim();
      if (!text) continue;

      if (!map.has(text)) {
        map.set(text, { count: 0, ids: [] });
      }

      const bucket = map.get(text);
      bucket.count += 1;
      bucket.ids.push(item.id);
    }

    return map;
  };

  const oldTexts = countTexts(oldSection);
  const newTexts = countTexts(newSection);
  const changes = [];

  for (const [text, info] of oldTexts.entries()) {
    const newCount = newTexts.get(text)?.count || 0;

    for (let i = 0; i < info.count - newCount; i++) {
      changes.push({ status: "removed", id: info.ids[i] || "", text });
    }
  }

  for (const [text, info] of newTexts.entries()) {
    const oldCount = oldTexts.get(text)?.count || 0;

    for (let i = 0; i < info.count - oldCount; i++) {
      changes.push({ status: "added", id: info.ids[i] || "", text });
    }
  }

  changes.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  return changes;
}

function showVersionDiff(addToHistory = true, fileKey = "") {
  if (addToHistory) {
    pushViewHistory(captureCurrentView());
  }

  currentDiffFile = String(fileKey || "");

  diffContent.innerHTML = currentDiffFile
    ? renderDiffFileDetail(currentDiffFile)
    : renderDiffFileList();

  showOnly(diffView);
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderDiffFileList() {
  if (!DIFF_DATA.length) {
    return `
      <div class="empty">
        No version differences found.<br>
        The dump contains no archived file copies, or they are identical to the
        current versions.
      </div>
    `;
  }

  const totalAdded = DIFF_DATA.reduce((sum, file) => sum + file.added, 0);
  const totalRemoved = DIFF_DATA.reduce((sum, file) => sum + file.removed, 0);

  return `
    <article class="entry detail-card diff-summary">
      <div class="json-grid">
        <div class="json-fact"><span>Changed files</span><strong>${DIFF_DATA.length}</strong></div>
        <div class="json-fact"><span>Added strings</span><strong class="diff-added-text">+${totalAdded}</strong></div>
        <div class="json-fact"><span>Removed strings</span><strong class="diff-removed-text">−${totalRemoved}</strong></div>
      </div>
      <p class="size-note">
        Compares each file's newest archived copy ("name (n).23.txt") with its
        current version.
      </p>
    </article>

    ${DIFF_DATA.map(file => `
      <button class="npc-item diff-file-item" type="button" data-diff-file="${escapeAttribute(file.fileKey)}">
        <span>${escapeHtml(file.fileKey)}</span>
        <small>
          ${escapeHtml(file.category)}
          · <span class="diff-added-text">+${file.added}</span>
          · <span class="diff-removed-text">−${file.removed}</span>
          · ${file.archivedCopies} archived ${file.archivedCopies === 1 ? "copy" : "copies"}
        </small>
      </button>
    `).join("")}
  `;
}

function renderDiffFileDetail(fileKey) {
  const file = DIFF_DATA.find(entry => entry.fileKey === fileKey);

  if (!file) {
    return `<div class="empty">No diff data for this file.</div>`;
  }

  return `
    <article class="entry detail-card diff-summary">
      <div class="entry-header">
        <div class="entry-name">${escapeHtml(file.fileKey)}</div>
      </div>

      <div class="entry-section">
        ${escapeHtml(file.category)}
        · <span class="diff-added-text">+${file.added}</span>
        · <span class="diff-removed-text">−${file.removed}</span>
      </div>

      <p class="size-note">
        ${escapeHtml(file.oldTitle)} → ${escapeHtml(file.title)}
      </p>
    </article>

    ${file.changes.map(change => `
      <article class="entry diff-change diff-change-${escapeAttribute(change.status)}">
        <div class="entry-actions">
          <span class="tag-badge diff-badge-${escapeAttribute(change.status)}">
            ${change.status === "added" ? "+ Added" : "− Removed"}
          </span>
        </div>

        <div class="entry-header">
          <div class="entry-id">[${escapeHtml(change.id)}]</div>
        </div>

        <div class="entry-text diff-change-text">${formatEntryText(change.text, { linkify: true })}</div>
      </article>
    `).join("")}
  `;
}
