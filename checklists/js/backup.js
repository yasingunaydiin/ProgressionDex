// Export / import saved progress as a JSON file so it survives clearing browser data.
(() => {
  "use strict";
  const isProgressKey = (key) => /-checkbox-/.test(key) || key.startsWith("pdex-summary-");

  function exportProgress() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (isProgressKey(key)) data[key] = localStorage.getItem(key);
    }
    const blob = new Blob([JSON.stringify({ app: "progressiondex", version: 1, progress: data }, null, 2)], { type: "application/json" });
    const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "progressiondex-backup.json" });
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function importProgress(file) {
    file.text().then((text) => {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        return alert("That file is not valid JSON.");
      }
      const progress = parsed && parsed.app === "progressiondex" ? parsed.progress : null;
      if (!progress || typeof progress !== "object") return alert("That file is not a Progression Dex backup.");
      const entries = Object.entries(progress).filter(([k, v]) => isProgressKey(k) && typeof v === "string");
      entries.forEach(([k, v]) => localStorage.setItem(k, v));
      alert(`Imported ${entries.length} entries.`);
      location.reload();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Sit in the checklist toolbar when there is one; otherwise float in the corner (list page).
    const host = document.querySelector(".toolbar-extra");
    const bar = host || document.createElement("div");
    if (!host) {
      bar.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:1100;display:flex;gap:8px";
      document.body.append(bar);
    }
    const make = (text, onClick) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.className = "btn btn-sm";
      b.addEventListener("click", onClick);
      return b;
    };
    const input = Object.assign(document.createElement("input"), { type: "file", accept: "application/json,.json", hidden: true });
    input.addEventListener("change", () => input.files[0] && importProgress(input.files[0]));
    bar.append(
      make("Export progress", exportProgress),
      make("Import progress", () => input.click()),
      input,
    );
  });
})();
