var currentGen = null;

function toggleGen(generationClass) {
  var allDivs = document.querySelectorAll(".gen-row");

  // Check if the current generation is already shown
  if (currentGen === generationClass) {
    // Show all divs
    allDivs.forEach(function (div) {
      div.classList.remove("hidden");
    });
    currentGen = null;
  } else {
    // Hide all divs
    allDivs.forEach(function (div) {
      div.classList.add("hidden");
    });

    // Show only the selected generation
    var genDivs = document.querySelectorAll("." + generationClass);
    genDivs.forEach(function (div) {
      div.classList.remove("hidden");
    });

    currentGen = generationClass;
  }
  markActive("[data-gen]", "gen", currentGen);
}

function markActive(selector, attr, value) {
  document.querySelectorAll(selector).forEach((chip) => chip.classList.toggle("is-active", chip.dataset[attr] === value));
}

// toggleGen1() ... toggleGen9() are called from inline onclick handlers in index.html
for (let n = 1; n <= 9; n++) {
  window[`toggleGen${n}`] = () => toggleGen(`generation-${n}`);
}
window.toggleHome = () => toggleGen("home");

// Status filters (New = not started)
let currentStatus = null;
function toggleStatus(status) {
  currentStatus = currentStatus === status ? null : status;
  markActive("[data-status]", "status", currentStatus);
  applyItemFilters();
}

// Hides cards that do not match the status chip or search box
function applyItemFilters() {
  const query = (document.getElementById("gameSearch")?.value || "").trim().toLowerCase();
  let visible = 0;
  document.querySelectorAll(".gen-item[data-game]").forEach((item) => {
    const text =
      [...item.querySelectorAll("img")]
        .map((i) => i.alt)
        .join(" ")
        .toLowerCase() +
      " " +
      item.dataset.game;
    const show = (currentStatus === null || getStatus(item.dataset.game) === currentStatus) && (!query || text.includes(query));
    item.classList.toggle("hidden", !show);
    if (show) visible++;
  });
  document.querySelectorAll(".gen-row").forEach((row) => {
    row.classList.toggle("hidden", !row.querySelector(".gen-item:not(.hidden)") && (currentStatus !== null || query !== ""));
  });
  const empty = document.getElementById("emptyMessage");
  if (empty) empty.style.display = visible ? "none" : "block";
}
window.toggleNew = () => toggleStatus("new");
window.toggleInProgress = () => toggleStatus("inprogress");
window.toggleCompleted = () => toggleStatus("completed");

// Progress summaries are written by checklists/js/script.js as "pdex-summary-<game>"
function getStatus(gameId) {
  let summary = null;
  try {
    summary = JSON.parse(localStorage.getItem(`pdex-summary-${gameId}`));
  } catch {
    /* ignore corrupt or unavailable storage */
  }
  if (!summary || !summary.done) return "new";
  return summary.done >= summary.total ? "completed" : "inprogress";
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("gameSearch")?.addEventListener("input", applyItemFilters);

  // Section headings, taken from each row's generation badge
  let lastName = null;
  document.querySelectorAll(".gen-row").forEach((row) => {
    const name = row.querySelector(".badge span:last-child")?.textContent.trim();
    if (name && name !== lastName) row.insertAdjacentHTML("afterbegin", `<h2 class="gen-heading">${name}</h2>`);
    lastName = name;
  });
  document.querySelector(".games-container")?.insertAdjacentHTML("beforeend", '<p class="empty" id="emptyMessage">No games match your filters.</p>');

  document.querySelectorAll(".gen-item[data-game]").forEach((item) => {
    const gameId = item.dataset.game;
    const status = getStatus(gameId);
    const show = (name, on) => {
      const badge = document.getElementById(`${name}Badge_${gameId}`);
      if (badge) badge.style.display = on ? "inline" : "none";
    };
    show("inProgress", status === "inprogress");
    show("completed", status === "completed");

    // Progress bar from the summary the checklist page saved
    try {
      const sum = JSON.parse(localStorage.getItem(`pdex-summary-${gameId}`));
      if (sum && sum.done) {
        const pct = Math.round((sum.done / sum.total) * 100);
        item.querySelector("button")?.insertAdjacentHTML("beforebegin", `<div class="progress show"><span>${sum.done} / ${sum.total} (${pct}%)</span><i><b style="width:${pct}%"></b></i></div>`);
      }
    } catch {
      /* ignore */
    }
  });
});
