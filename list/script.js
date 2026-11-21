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
  document.querySelectorAll(".gen-item[data-game]").forEach((item) => {
    item.classList.toggle("hidden", currentStatus !== null && getStatus(item.dataset.game) !== currentStatus);
  });
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
  document.querySelectorAll(".gen-item[data-game]").forEach((item) => {
    const gameId = item.dataset.game;
    const status = getStatus(gameId);
    const show = (name, on) => {
      const badge = document.getElementById(`${name}Badge_${gameId}`);
      if (badge) badge.style.display = on ? "inline" : "none";
    };
    show("inProgress", status === "inprogress");
    show("completed", status === "completed");
  });
});
