// Shared behaviour for every checklist page.
//  - saves/restores checkbox state in localStorage (key = checkbox id)
//  - progress bar + toolbar (summary, search, hide collected)
//  - collapsible sections with done/total counts, clickable tiles
//  - game theme switching (via data attributes) and confetti on 100%
(() => {
  "use strict";

  const storage = {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* storage unavailable (private mode, quota) - progress just won't persist */
      }
    },
  };

  const onReady = (fn) => (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", fn) : fn());
  const CHEVRON = '<svg class="chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l5 5 5-5"/></svg>';

  // ---------- info balloons ----------
  // Tooltips used to hang off every name label. Now a Pokemon's "where to find it" text sits behind a pin button,
  // and any other note sits behind an (i) in the tile's top-right corner. Text only shows when hovering that button.
  const PIN = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';
  const NOT_LOCATION = /evolv|breed|hatch|see a guide|event only|go to home|transfer|mystery gift|download|\bcode\b/i;
  const LOCATION =
    /\b(route|city|town|cave|forest|island|isle|lake|mount|mt\.?|tower|path|area|road|park|zone|woods|garden|ruins?|tunnel|temple|desert|beach|bay|sea|field|plains?|trail|mine|falls|hollow|valley|safari|village|league|sanctuary|chamber|cavern|bridge|harbor|lighthouse|hideout|castle|stadium|tundra|swamp|marsh|meadow|volcano|crater|canyon|plateau|peak|summit|shrine|arena|mansion|museum|factory|plant|slab|spring|river|ocean|waters?|palace|facility|frontier|wormhole|catch|found|appears?|encounter|located|roam|wild|fish|surf|grass)\b/i;

  function isLocationTip(tip) {
    if (NOT_LOCATION.test(tip)) return false;
    return tip.split(/\s+/).length <= 4 || LOCATION.test(tip);
  }

  function setupInfo() {
    document.querySelectorAll(".checkbox-item").forEach((item) => {
      const isHeading = item.querySelector(":scope > .title") !== null;
      const labels = isHeading ? [...item.querySelectorAll(".title label")] : [...item.querySelectorAll(":scope > label")];
      const isPokemon = !isHeading && item.querySelector('img[src*="/icons/pokemon/"]') !== null;
      const location = [];
      const other = [];

      labels.forEach((label) => {
        if (!isHeading && label.hasAttribute("for") && label.style.color) {
          item.style.setProperty("--ver", label.style.color);
          item.classList.add("has-ver");
          label.style.color = "";
        }
        const raw = label.getAttribute("data-tip");
        if (raw === null) return;
        label.removeAttribute("data-tip");
        label.classList.remove("lg:tooltip");
        const tip = raw.trim();
        const hasText = label.textContent.trim() !== "";
        const iconOnly = !label.hasAttribute("for");

        if (iconOnly && !hasText && tip && /^[\p{L}][\p{L}\p{N}' .:\-]*$/u.test(tip) && tip.split(/\s+/).length <= 3 && !/\.$/.test(tip)) {
          label.append(tip); // Home tiles: the "tip" is just the Pokemon's name, so show it as the caption
          return;
        }
        if (iconOnly && !hasText && label.querySelector("img.icon-small")) label.remove(); // old "more info" icon
        if (!tip || location.includes(tip) || other.includes(tip)) return;
        (isPokemon && isLocationTip(tip) ? location : other).push(tip);
      });

      const add = (kind, tips, title) => {
        if (!tips.length) return;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `info-btn ${kind}`;
        btn.dataset.tip = tips.join("\n\n");
        btn.setAttribute("aria-label", title);
        btn.innerHTML = kind === "loc" ? PIN : "i";
        item.append(btn);
      };
      // A tile with several icon-only labels is a group of Pokemon (Home regional lists): lay the icons out as a row.
      const icons = item.querySelectorAll(":scope > label:not([for])").length;
      if (icons >= 2) {
        item.classList.add("is-group");
        // one even row of icons; long lists split into two balanced rows
        item.style.setProperty("--icons", icons <= 5 ? icons : Math.ceil(icons / 2));
      }
      add("loc", location, "Where to find it");
      add("note", other, "More info");
      item.dataset.tips = [...location, ...other].join(" ");
    });

    // One shared balloon, positioned next to whichever button is hovered/focused/tapped.
    const balloon = document.createElement("div");
    balloon.className = "pdex-tip";
    balloon.setAttribute("role", "tooltip");
    document.body.append(balloon);
    let current = null;

    function show(btn) {
      current = btn;
      balloon.textContent = btn.dataset.tip;
      balloon.style.visibility = "hidden";
      balloon.classList.add("show");
      const r = btn.getBoundingClientRect();
      const b = balloon.getBoundingClientRect();
      const left = Math.min(Math.max(8, r.left + r.width / 2 - b.width / 2), window.innerWidth - b.width - 8);
      const above = r.top - b.height - 10 >= 8;
      balloon.style.left = `${left}px`;
      balloon.style.top = `${above ? r.top - b.height - 10 : r.bottom + 10}px`;
      balloon.dataset.side = above ? "top" : "bottom";
      balloon.style.setProperty("--arrow", `${r.left + r.width / 2 - left}px`);
      balloon.style.visibility = "visible";
    }
    function hide() {
      current = null;
      balloon.classList.remove("show");
    }
    const target = (e) => e.target.closest?.(".info-btn");
    document.addEventListener("mouseover", (e) => target(e) && show(target(e)));
    document.addEventListener("mouseout", (e) => target(e) && hide());
    document.addEventListener("focusin", (e) => target(e) && show(target(e)));
    document.addEventListener("focusout", (e) => target(e) && hide());
    document.addEventListener("click", (e) => {
      const btn = target(e);
      hide();
      if (btn) openDrawer(btn);
    });
    window.addEventListener("scroll", hide, { passive: true });
  }

  // ---------- side panel with the full info (opens when an info button is clicked) ----------
  let drawer = null;
  let drawerOpener = null;

  function searchLinks(name) {
    const q = encodeURIComponent(name);
    return [
      ["Bulbapedia", `https://bulbapedia.bulbagarden.net/w/index.php?search=${q}`],
      ["Serebii", `https://www.google.com/search?q=${q}+site%3Aserebii.net`],
    ];
  }

  // Games that have map links so far (the Pokemon's Bulbapedia location list, plus the region map)
  const MAP_GAMES = { redblue: { region: "Kanto", url: "https://bulbapedia.bulbagarden.net/wiki/Kanto" } };

  // Schematic maps with pins. Positions are percentages of the picture and only as accurate as the guides they came from.
  const PIN_MAPS = {
    redblue: {
      image: "maps/redblue.svg",
      title: "Kanto (schematic)",
      pins: {
        zapdos: { x: 87.5, y: 28.9, place: "Power Plant, east of Cerulean City" },
        moltres: { x: 12.1, y: 32.8, place: "Victory Road, near the Indigo Plateau" },
        articuno: { x: 39.6, y: 92.2, place: "Seafoam Islands, between Fuchsia City and Cinnabar Island" },
        mewtwo: { x: 70.4, y: 14.4, place: "Cerulean Cave, near Cerulean City" },
        hitmonlee: { x: 65.0, y: 47.2, place: "Fighting Dojo, Saffron City" },
        hitmonchan: { x: 65.0, y: 47.2, place: "Fighting Dojo, Saffron City" },
        lapras: { x: 65.0, y: 47.2, place: "Silph Co., Saffron City" },
        eevee: { x: 47.1, y: 47.2, place: "Celadon Mansion roof, Celadon City" },
        omanyte: { x: 48.3, y: 24.4, place: "Mt. Moon" },
        kabuto: { x: 48.3, y: 24.4, place: "Mt. Moon" },
        aerodactyl: { x: 31.2, y: 25.6, place: "Old Amber is in the Pewter City museum" },
        "abra-mr-mime": { x: 23.3, y: 41.7, place: "Route 2, outside Diglett's Cave" },
        "nidoran-m-f": { x: 68.8, y: 36.7, place: "Route 5, underground path north exit" },
        "nidorino-nidorina": { x: 78.8, y: 70.0, place: "Route 11, inside the gatehouse" },
        "slowbro-lickitung": { x: 48.3, y: 78.9, place: "Route 18, inside the gatehouse" },
        "poliwhirl-jynx": { x: 65.0, y: 25.6, place: "Cerulean City, house next to the Pokémon Center" },
        "spearow-farfetchd": { x: 65.0, y: 68.9, place: "Vermilion City" },
        "ponyta-seel": { x: 16.2, y: 92.8, place: "Cinnabar Island, inside the Cinnabar Lab" },
        "raichu-electrode": { x: 16.2, y: 92.8, place: "Cinnabar Island, inside the Cinnabar Lab" },
        "venonat-tangela": { x: 16.2, y: 92.8, place: "Cinnabar Island, inside the Cinnabar Lab" },
      },
    },
    thetealmask: {
      image: "maps/thetealmask.svg",
      title: "Kitakami (schematic)",
      pins: {
        okidogi: { x: 25, y: 27, place: "Paradise Barrens, north-west corner" },
        munkidori: { x: 26, y: 73, place: "Wistful Fields, by the lake in the south-west" },
        fezandipiti: { x: 79, y: 41, place: "A cliff on the east side of Oni Mountain" },
      },
    },
  };

  function pinMap(item) {
    const game = document.querySelector(".page-container")?.dataset.game;
    const cfg = PIN_MAPS[game];
    const id = item.querySelector(':scope > input[type="checkbox"]')?.id || "";
    const pin = cfg && cfg.pins[id.replace(`${game}-checkbox-`, "")];
    if (!pin) return "";
    return (
      `<h3>Map</h3><div class="pdex-map"><img alt="${cfg.title}" src="${cfg.image}" /><span class="pdex-pin" style="left:${pin.x}%;top:${pin.y}%"></span></div>` +
      `<p class="pdex-map-note"><b>${pin.place}.</b><br />Schematic map, not to scale. The pin shows the area guides describe, not an exact spot.</p>`
    );
  }

  function mapLinks(query, isPokemon) {
    const info = MAP_GAMES[document.querySelector(".page-container")?.dataset.game];
    if (!info) return "";
    const links = [];
    if (isPokemon) links.push(["Where to catch it", `https://bulbapedia.bulbagarden.net/wiki/${encodeURIComponent(query.replace(/\s+/g, "_"))}_(Pok%C3%A9mon)#Game_locations`]);
    links.push([`${info.region} map`, info.url]);
    return '<h3>Map</h3><div class="pdex-drawer-links">' + links.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${n} &#8599;</a>`).join("") + "</div>";
  }

  function openDrawer(btn) {
    const item = btn.closest(".checkbox-item");
    if (!item) return;
    const label = item.querySelector(":scope > label[for]") || item.querySelector(".title label");
    const name = (label ? label.textContent : "").replace(/\s+/g, " ").trim();
    // use only the name for lookups: drop leading verbs such as "Catch" or "Obtain"
    const query = name.replace(/^(Catch|Obtain|Get|Trade|Complete|Defeat|Find|Collect)\s+(all\s+)?(the\s+)?/i, "") || name;
    const img = item.querySelector(':scope > img[src*="/icons/"], :scope > label img');
    const sections = [...item.querySelectorAll(".info-btn")].map((b) => ({ kind: b.classList.contains("loc") ? "Where to find it" : "More info", text: b.dataset.tip }));

    if (!drawer) {
      drawer = document.createElement("aside");
      drawer.className = "pdex-drawer";
      drawer.setAttribute("role", "dialog");
      drawer.setAttribute("aria-label", "Details");
      drawer.innerHTML = '<div class="pdex-drawer-bar"><span>Details</span><button type="button" class="pdex-drawer-close" aria-label="Close details">&times;</button></div><div class="pdex-drawer-body"></div>';
      document.body.append(drawer);
      drawer.querySelector(".pdex-drawer-close").addEventListener("click", closeDrawer);
      document.addEventListener("keydown", (e) => e.key === "Escape" && drawer.classList.contains("open") && closeDrawer());
      document.addEventListener("click", (e) => {
        if (drawer.classList.contains("open") && !e.target.closest(".pdex-drawer, .info-btn")) closeDrawer();
      });
    }

    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    drawer.querySelector(".pdex-drawer-body").innerHTML =
      (img ? `<img class="pdex-drawer-img" alt="" src="${esc(img.getAttribute("src"))}" />` : "") +
      `<h2>${esc(name)}</h2>` +
      sections.map((x) => `<h3>${x.kind}</h3><p>${esc(x.text)}</p>`).join("") +
      pinMap(item) +
      mapLinks(query, !!(img && /\/icons\/pokemon\//.test(img.getAttribute("src")))) +
      `<h3>Look it up</h3><div class="pdex-drawer-links">${searchLinks(query)
        .map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${n} &#8599;</a>`)
        .join("")}</div>`;
    drawerOpener = btn;
    drawer.classList.add("open");
    document.body.classList.add("drawer-open");
    drawer.querySelector(".pdex-drawer-close").focus({ preventScroll: true });
  }

  function closeDrawer() {
    drawer.classList.remove("open");
    document.body.classList.remove("drawer-open");
  }

  onReady(() => {
    setupInfo();
    const checkboxes = [...document.querySelectorAll('input[type="checkbox"]')];
    const page = document.querySelector(".page-container");
    const progressBar = document.getElementById("progressBar");
    const game = page?.dataset.game;

    // Some pages (Home) put the section title straight into the section instead of inside a ".checkbox-item" row.
    document.querySelectorAll(".wide-panel > div > .title:first-child").forEach((title) => {
      const row = document.createElement("div");
      row.className = "checkbox-item";
      title.replaceWith(row);
      row.append(title);
      title.querySelector("label")?.classList.remove("panel-label");
    });

    // ---------- sections ----------
    // A top-level section is a direct child <div> of a ".wide-panel" whose first child is a title row.
    const sections = [...document.querySelectorAll(".wide-panel > div")]
      .map((el) => {
        const head = el.firstElementChild;
        const label = head?.matches(".checkbox-item") ? head.querySelector(":scope > .title label") : null;
        return label ? { el, head, boxes: [...el.querySelectorAll('input[type="checkbox"]')] } : null;
      })
      .filter((s) => s && s.boxes.length);

    sections.forEach((s) => {
      s.head.classList.add("section-head");
      s.head.insertAdjacentHTML("beforeend", `<span class="count"><span class="num"></span><span class="meter"><i></i></span></span><button type="button" class="mark-all">Mark all</button>${CHEVRON}`);
      s.markAll = s.head.querySelector(".mark-all");
      s.markAll.addEventListener("click", (e) => {
        e.stopPropagation();
        const target = !s.boxes.every((c) => c.checked);
        s.boxes.forEach((c) => {
          if (c.checked !== target) {
            c.checked = target;
            c.dispatchEvent(new Event("change"));
          }
        });
      });
      s.num = s.head.querySelector(".num");
      s.fill = s.head.querySelector(".meter i");
      s.head.addEventListener("click", () => s.el.classList.toggle("is-collapsed"));
    });

    // ---------- toolbar ----------
    let summaryStrong, summarySmall, summaryBar;
    if (page) {
      const toolbar = document.createElement("div");
      toolbar.className = "toolbar";
      toolbar.innerHTML = `
        <div class="summary"><strong></strong><small></small><i class="bar"><b></b></i></div>
        <input type="search" placeholder="Search this game... (press / )" aria-label="Search checklist" />
        <button type="button" data-action="hide-done" aria-pressed="false">Hide collected</button>
        <button type="button" data-action="collapse">Collapse all</button>
        <span class="toolbar-extra" style="display: contents"></span>`;
      page.prepend(toolbar);
      const extra = toolbar.querySelector(".toolbar-extra");
      if (window.pdexAuth) extra.before(window.pdexAuth.button());
      if (window.pdexTheme) extra.before(window.pdexTheme.button());
      summaryStrong = toolbar.querySelector("strong");
      summarySmall = toolbar.querySelector("small");
      summaryBar = toolbar.querySelector(".bar b");

      // "/" jumps to the search box, Escape clears it (like pokedextracker.com)
      const search = toolbar.querySelector('input[type="search"]');
      document.addEventListener("keydown", (e) => {
        const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.querySelector("dialog[open]") !== null;
        if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          search.focus();
        } else if (e.key === "Escape" && document.activeElement === search) {
          search.value = "";
          search.dispatchEvent(new Event("input"));
          search.blur();
        }
      });

      toolbar.querySelector('[data-action="hide-done"]').addEventListener("click", (e) => {
        const on = document.body.classList.toggle("hide-done");
        e.currentTarget.setAttribute("aria-pressed", on);
      });

      const collapseBtn = toolbar.querySelector('[data-action="collapse"]');
      collapseBtn.addEventListener("click", () => {
        const collapse = sections.some((s) => !s.el.classList.contains("is-collapsed"));
        sections.forEach((s) => s.el.classList.toggle("is-collapsed", collapse));
        collapseBtn.textContent = collapse ? "Expand all" : "Collapse all";
      });

      toolbar.querySelector('input[type="search"]').addEventListener("input", (e) => {
        const q = e.target.value.trim().toLowerCase();
        document.querySelectorAll(".checkbox-item:not(:has(> .title))").forEach((item) => {
          const text = (item.textContent + " " + (item.dataset.tips || "")).toLowerCase();
          item.classList.toggle("is-filtered", q !== "" && !text.includes(q));
        });
        // searching should reveal matches, so open every section
        if (q) sections.forEach((s) => s.el.classList.remove("is-collapsed"));
      });
    }

    function refresh() {
      const done = checkboxes.filter((c) => c.checked).length;
      const total = checkboxes.length;
      const pct = total ? (done / total) * 100 : 0;
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (summaryStrong) {
        summaryStrong.textContent = `${pct.toFixed(1)}% done`;
        summarySmall.textContent = `${done} collected, ${total - done} to go`;
        summaryBar.style.width = `${pct}%`;
      }
      // Summary read by the game list page to show In Progress / Completed badges.
      if (game && total) storage.set(`pdex-summary-${game}`, JSON.stringify({ done, total }));

      sections.forEach((s) => {
        const d = s.boxes.filter((c) => c.checked).length;
        s.num.textContent = `${d}/${s.boxes.length}`;
        s.fill.style.width = `${(d / s.boxes.length) * 100}%`;
        s.el.classList.toggle("is-complete", d === s.boxes.length);
        s.markAll.textContent = d === s.boxes.length ? "Clear" : "Mark all";
      });
    }

    // ---------- checkboxes ----------
    checkboxes.forEach((box) => {
      if (box.id) box.checked = storage.get(box.id) === "true";
      box.addEventListener("change", () => {
        if (box.id) storage.set(box.id, box.checked);
        refresh();
        if (window.pdexSync) window.pdexSync.changed(game);
        const items = checkboxes.filter((c) => c.closest(".checkbox-item"));
        if (box.checked && items.length && items.every((c) => c.checked) && typeof confetti === "function") confetti();
      });
    });
    refresh();

    // progress pulled from the user's account while this page is open
    document.addEventListener("pdex-synced", () => {
      checkboxes.forEach((box) => {
        if (box.id) box.checked = storage.get(box.id) === "true";
      });
      refresh();
    });

    // Clicking anywhere on a tile (not just the label) toggles it.
    document.addEventListener("click", (e) => {
      const item = e.target.closest(".checkbox-item");
      if (!item || e.target.closest("label[for], input, .section-head, .info-btn")) return;
      const box = item.querySelector(':scope > input[type="checkbox"]');
      if (box) box.click();
    });

    // Collapsible groups (TM/TR lists etc.)
    document.querySelectorAll(".collapsible").forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.classList.toggle("active");
        btn.nextElementSibling?.classList.toggle("open");
      });
    });

    // Game theme switching: <img data-theme-color="#fff" data-theme-pattern="pattern-x.png" [data-theme-icon="..."]>
    document.querySelectorAll("[data-theme-color]").forEach((logo) => {
      logo.addEventListener("click", () => {
        document.documentElement.style.setProperty("--accent", logo.dataset.themeColor);
        document.body.style.backgroundImage = `url(../images/patterns/${logo.dataset.themePattern})`;
        const icon = document.getElementById("professorIcons");
        if (icon && logo.dataset.themeIcon) icon.src = logo.dataset.themeIcon;
      });
    });
  });
})();
