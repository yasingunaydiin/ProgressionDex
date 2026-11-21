// Game list: progress from each checklist's saved summary, plus search and filters.
const cards = [...document.querySelectorAll(".card")];
const state = { status: null, gen: null, query: "" };

function summary(game) {
  try {
    const s = JSON.parse(localStorage.getItem(`pdex-summary-${game}`));
    if (s && s.total) return s;
  } catch {
    /* storage unavailable or corrupt */
  }
  return null;
}

function statusOf(game) {
  const s = summary(game);
  if (!s || !s.done) return "new";
  return s.done >= s.total ? "completed" : "inprogress";
}

function apply() {
  const q = state.query.trim().toLowerCase();
  let visible = 0;
  cards.forEach((card) => {
    const show = (!state.status || statusOf(card.dataset.game) === state.status) && (!state.gen || card.dataset.gen === state.gen) && (!q || card.dataset.name.toLowerCase().includes(q));
    card.hidden = !show;
    if (show) visible++;
  });
  document.getElementById("emptyMessage").style.display = visible ? "none" : "block";
}

// progress on every card + the summary line
const counts = { new: 0, inprogress: 0, completed: 0 };
cards.forEach((card) => {
  const status = statusOf(card.dataset.game);
  counts[status]++;
  card.dataset.status = status;
  const s = summary(card.dataset.game);
  const pct = s ? Math.round((s.done / s.total) * 100) : 0;
  card.querySelector(".meter i").style.width = `${pct}%`;
  card.querySelector(".pct").textContent = status === "new" ? "Not started" : status === "completed" ? "Completed" : `${s.done} / ${s.total} · ${pct}%`;
  card.querySelector(".status").textContent = status === "completed" ? "\u2713 Done" : status === "inprogress" ? `${pct}%` : "";
});
document.getElementById("listSummary").innerHTML = `<b>${counts.completed}</b> completed &middot; <b>${counts.inprogress}</b> in progress &middot; <b>${counts.new}</b> not started`;

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const key = chip.dataset.status ? "status" : "gen";
    const value = chip.dataset.status || chip.dataset.gen;
    state[key] = state[key] === value ? null : value;
    document.querySelectorAll(key === "status" ? "[data-status].chip" : "[data-gen].chip").forEach((c) => c.classList.toggle("is-active", (c.dataset.status || c.dataset.gen) === state[key]));
    apply();
  });
});

const search = document.getElementById("gameSearch");
search.addEventListener("input", () => {
  state.query = search.value;
  apply();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement !== search) {
    e.preventDefault();
    search.focus();
  } else if (e.key === "Escape" && document.activeElement === search) {
    search.value = "";
    state.query = "";
    apply();
    search.blur();
  }
});
