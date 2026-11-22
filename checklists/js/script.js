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
  const KANTO_LINK = { region: "Kanto", url: "https://bulbapedia.bulbagarden.net/wiki/Kanto" };
  const JOHTO_LINK = { region: "Johto", url: "https://bulbapedia.bulbagarden.net/wiki/Johto" };
  const HOENN_LINK = { region: "Hoenn", url: "https://bulbapedia.bulbagarden.net/wiki/Hoenn" };
  const SINNOH_LINK = { region: "Sinnoh", url: "https://bulbapedia.bulbagarden.net/wiki/Sinnoh" };
  const UNOVA_LINK = { region: "Unova", url: "https://bulbapedia.bulbagarden.net/wiki/Unova" };
  const ALOLA_LINK = { region: "Alola", url: "https://bulbapedia.bulbagarden.net/wiki/Alola" };
  const MAP_GAMES = {
    goldsilver: JOHTO_LINK,
    crystal: JOHTO_LINK,
    redblue: KANTO_LINK,
    legendsarceus: { region: "Hisui", url: "https://bulbapedia.bulbagarden.net/wiki/Hisui" },
    scarletviolet: { region: "Paldea", url: "https://bulbapedia.bulbagarden.net/wiki/Paldea" },
    swordshield: { region: "Galar", url: "https://bulbapedia.bulbagarden.net/wiki/Galar" },
    letsgopikachueevee: KANTO_LINK,
    blackwhite: UNOVA_LINK,
    xy: { region: "Kalos", url: "https://bulbapedia.bulbagarden.net/wiki/Kalos" },
    heartgoldsoulsilver: JOHTO_LINK,
    black2white2: UNOVA_LINK,
    diamondpearl: SINNOH_LINK,
    brilliantdiamondshiningpearl: SINNOH_LINK,
    platinum: SINNOH_LINK,
    emerald: HOENN_LINK,
    sunmoon: ALOLA_LINK,
    ultrasunultramoon: ALOLA_LINK,
    omegarubyalphasapphire: HOENN_LINK,
    rubysapphire: HOENN_LINK,
    yellow: KANTO_LINK,
    fireredleafgreen: KANTO_LINK,
  };

  // Schematic maps with pins. Positions are percentages of the picture and only as accurate as the guides they came from.
  const KANTO_PLACES = {
    "Power Plant": { x: 81.2, y: 35.8 },
    "Victory Road": { x: 14.5, y: 35.8 },
    "Seafoam Islands": { x: 39.6, y: 91.3 },
    "Cerulean Cave": { x: 64.3, y: 30.2 },
    "Saffron City": { x: 64.3, y: 47.0 },
    "Celadon City": { x: 52.0, y: 47.0 },
    "Mt. Moon": { x: 43.5, y: 30.2 },
    "Pewter City": { x: 22.7, y: 35.8 },
    "Route 2": { x: 22.7, y: 47.0 },
    "Route 5": { x: 64.3, y: 38.5 },
    "Route 11": { x: 72.4, y: 63.9 },
    "Route 18": { x: 43.5, y: 79.2 },
    "Cerulean City": { x: 64.3, y: 30.2 },
    "Vermilion City": { x: 64.3, y: 63.9 },
    "Cinnabar Island": { x: 22.7, y: 91.3 },
    "Route 24": { x: 66.7, y: 24.0 },
  };

  const RBY_PLACES = {
    "Power Plant": { x: 82.5, y: 20.6 },
    "Victory Road": { x: 12.5, y: 26.5 },
    "Seafoam Islands": { x: 37.5, y: 91.2 },
    "Cerulean Cave": { x: 62.5, y: 14.7 },
    "Saffron City": { x: 62.5, y: 32.4 },
    "Celadon City": { x: 47.5, y: 32.4 },
    "Mt. Moon": { x: 42.5, y: 14.7 },
    "Pewter City": { x: 22.5, y: 20.6 },
    "Route 2": { x: 22.5, y: 34.9, w: 5, h: 20.6 },
    "Route 5": { x: 62.5, y: 23.5, w: 5, h: 11.8 },
    "Route 11": { x: 72.5, y: 55.9, w: 15, h: 5.9 },
    "Route 18": { x: 62.5, y: 79.4, w: 15, h: 5.9 },
    "Cerulean City": { x: 62.5, y: 14.7 },
    "Vermilion City": { x: 62.5, y: 55.9 },
    "Cinnabar Island": { x: 22.5, y: 91.2 },
    "Route 24": { x: 62.5, y: 5.9, w: 5, h: 11.8 },
  };

  const GSC_JOHTO_PLACES = {
    "New Bark Town": { x: 91.7, y: 69.2 },
    "Cherrygrove City": { x: 63.9, y: 69.2 },
    "Violet City": { x: 51.4, y: 35.8 },
    "Ecruteak City": { x: 41.7, y: 22.5 },
    "Mahogany Town": { x: 69.4, y: 22.5 },
    "Blackthorn City": { x: 85.4, y: 22.5 },
    "Goldenrod City": { x: 30.6, y: 62.5 },
    "Olivine City": { x: 19.4, y: 35.8 },
    "Cianwood City": { x: 8.3, y: 69.2 },
    "Azalea Town": { x: 41.7, y: 90 },
    "Lake of Rage": { x: 68.8, y: 10 },
    "Mt. Mortar": { x: 52.8, y: 22.5 },
    "Union Cave": { x: 52.8, y: 89.2 },
    "Whirl Islands": { x: 13.2, y: 63.3 },
    "Mt. Silver": { x: 96.5, y: 43.3 },
    "Ruins of Alph": { x: 47.2, y: 50 },
    "Route 35": { x: 30.6, y: 35.8 },
    "Dragon's Den": { x: 85.4, y: 15.8 },
  };

  const GSC_KANTO_PLACES = {
    "Power Plant": { x: 86.1, y: 36.7 },
    "Pewter City": { x: 30.6, y: 30 },
    "Route 14": { x: 38.9, y: 75 },
  };

  const HOENN_PLACES = {
    "Route 110": { x: 29.6, y: 52.2, w: 3.1, h: 15.1 },
    "Ever Grande City": { x: 88.7, y: 55.3, w: 3.1, h: 10.1 },
    "Rustboro City": { x: 3.9, y: 40.9, w: 3.1, h: 8.8 },
    "Petalburg City": { x: 7.8, y: 56.6, w: 3.1, h: 5.0 },
    "Verdanturf Town": { x: 17.1, y: 42.1, w: 3.1, h: 5.0 },
    "Oldale Town": { x: 17.1, y: 57.9, w: 3.1, h: 5.0 },
    "Littleroot Town": { x: 17.1, y: 67.9, w: 3.1, h: 5.0 },
    "Fallarbor Town": { x: 13.6, y: 12.6, w: 3.1, h: 5.0 },
    "Lavaridge Town": { x: 20.2, y: 27.0, w: 3.1, h: 5.0 },
    "Mauville City": { x: 31.1, y: 42.1, w: 6.2, h: 5.0 },
    "Slateport City": { x: 29.6, y: 64.8, w: 3.1, h: 12.6 },
    "Fortree City": { x: 42.0, y: 12.6, w: 3.1, h: 5.0 },
    "Lilycove City": { x: 63.0, y: 27.7, w: 6.2, h: 5.0 },
    "Mossdeep City": { x: 80.9, y: 36.5, w: 6.2, h: 5.0 },
    "Sootopolis City": { x: 70.0, y: 47.8, w: 3.1, h: 5.0 },
    "Pacifidlog Town": { x: 57.6, y: 61.6, w: 3.1, h: 5.0 },
    "Dewford Town": { x: 10.9, y: 81.8, w: 3.1, h: 5.0 },
    "Route 111 desert": { x: 31.9, y: 28.9, w: 4.7, h: 5.0 },
    "Weather Institute": { x: 40.9, y: 18.9, w: 3.1, h: 5.0 },
    "Island Cave": { x: 7.8, y: 70.4, w: 3.1, h: 5.0 },
    "Ancient Tomb": { x: 48.6, y: 17.6, w: 3.1, h: 5.0 },
    "Sky Pillar": { x: 53.7, y: 61.6, w: 3.1, h: 5.0 },
    "Marine Cave": { x: 77.8, y: 61.6, w: 3.1, h: 5.0 },
    "Terra Cave": { x: 15.6, y: 20.1, w: 3.1, h: 5.0 },
  };

  const SINNOH_PLACES = {
    "Snowpoint City": { x: 37.0, y: 6.0, w: 2.8, h: 9.5 },
    "Lake Acuity": { x: 32.4, y: 7.1, w: 3.7, h: 4.8 },
    "Survival Area": { x: 66.2, y: 20.8, w: 2.8, h: 3.6 },
    "Fight Area": { x: 65.3, y: 32.7, w: 6.5, h: 4.2 },
    "Resort Area": { x: 83.3, y: 36.9, w: 2.8, h: 3.6 },
    "Eterna City": { x: 32.9, y: 47.6, w: 6.5, h: 8.3 },
    "Celestic Town": { x: 48.1, y: 45.8, w: 3.2, h: 4.2 },
    "Pokémon League": { x: 86.1, y: 50.0, w: 2.8, h: 3.6 },
    "Floaroma Town": { x: 18.5, y: 59.5, w: 3.2, h: 8.3 },
    "Solaceon Town": { x: 57.9, y: 62.5, w: 6.5, h: 4.2 },
    "Hearthome City": { x: 49.1, y: 68.5, w: 6.5, h: 8.3 },
    "Veilstone City": { x: 71.8, y: 56.0, w: 6.5, h: 8.3 },
    "Pastoria City": { x: 62.0, y: 85.7, w: 6.5, h: 8.3 },
    "Sunyshore City": { x: 88.0, y: 76.8, w: 6.5, h: 8.3 },
    "Jubilife City": { x: 16.7, y: 76.8, w: 6.5, h: 8.3 },
    "Oreburgh Town": { x: 31.5, y: 76.8, w: 6.5, h: 8.3 },
    "Canalave City": { x: 5.6, y: 72.6, w: 3.7, h: 9.5 },
    "Twinleaf Town": { x: 12.0, y: 91.7, w: 3.2, h: 4.2 },
    "Sandgem Town": { x: 18.5, y: 87.5, w: 3.2, h: 4.2 },
    "Lake Verity": { x: 6.9, y: 84.5, w: 4.6, h: 4.8 },
    "Lake Valor": { x: 71.8, y: 75.6, w: 4.6, h: 4.8 },
    "Mt. Coronet": { x: 48.6, y: 56.5, w: 6.5, h: 11.9 },
    "Route 214": { x: 63.4, y: 52.4, w: 11.1, h: 3.6 },
  };

  const UNOVA_PLACES = {
    "Mistralton City": { x: 15.6, y: 39.3, w: 4.7, h: 7.1 },
    "Icirrus City": { x: 28.9, y: 25.6, w: 4.7, h: 7.1 },
    "Opelucid City": { x: 51.6, y: 25.6, w: 4.7, h: 7.1 },
    "Lacunosa Town": { x: 74.2, y: 25.6, w: 4.7, h: 7.1 },
    "Undella Town": { x: 87.5, y: 39.3, w: 4.7, h: 7.1 },
    "Driftveil City": { x: 28.9, y: 53.6, w: 4.7, h: 7.1 },
    "Nimbasa City": { x: 51.6, y: 53.6, w: 4.7, h: 7.1 },
    "Black City": { x: 74.2, y: 53.6, w: 4.7, h: 7.1 },
    "Castelia City": { x: 51.6, y: 77.4, w: 4.7, h: 7.1 },
    "Nacrene City": { x: 79.3, y: 69.6, w: 4.7, h: 7.1 },
    "Striaton City": { x: 88.7, y: 69.6, w: 4.7, h: 7.1 },
    "Accumula Town": { x: 90.6, y: 82.1, w: 4.7, h: 7.1 },
    "Nuvema Town": { x: 91.0, y: 94.0, w: 4.7, h: 7.1 },
    "Pokémon League": { x: 66.4, y: 8.9, w: 4.7, h: 7.1 },
    "Victory Road": { x: 63.7, y: 14.3, w: 3.1, h: 4.8 },
    "Dragonspiral Tower": { x: 25.8, y: 17.9, w: 3.1, h: 4.8 },
    "Celestial Tower": { x: 21.1, y: 29.2, w: 3.1, h: 4.8 },
    "Mistralton Cave": { x: 27.0, y: 44.0, w: 3.1, h: 4.8 },
    "Giant Chasm": { x: 77.3, y: 17.9, w: 3.1, h: 4.8 },
    Entralink: { x: 51.6, y: 39.9, w: 3.1, h: 4.8 },
    "Relic Castle": { x: 44.9, y: 61.9, w: 3.1, h: 4.8 },
    "Pinwheel Forest": { x: 75.4, y: 74.4, w: 3.1, h: 4.8 },
    Dreamyard: { x: 93.4, y: 69.6, w: 3.1, h: 4.8 },
    "Abundant Shrine": { x: 77.0, y: 45.2, w: 3.1, h: 4.8 },
    "Poké Transfer Lab": { x: 69.1, y: 50.0, w: 3.1, h: 4.8 },
    "Liberty Garden": { x: 28.5, y: 85.7, w: 3.1, h: 4.8 },
    "Route 7": { x: 22.3, y: 32.7, w: 3.1, h: 4.8 },
    "Route 15": { x: 70.3, y: 53.6, w: 3.9, h: 3.0 },
    "Marvelous Bridge": { x: 62.5, y: 53.6, w: 7.8, h: 3.0 },
    "Route 18": { x: 83.6, y: 94.0, w: 8.6, h: 2.4 },
  };

  const UNOVA2_PLACES = {
    "Mistralton City": { x: 15.6, y: 39.3, w: 4.7, h: 7.1 },
    "Icirrus City": { x: 28.9, y: 25.6, w: 4.7, h: 7.1 },
    "Opelucid City": { x: 51.6, y: 25.6, w: 4.7, h: 7.1 },
    "Lacunosa Town": { x: 74.2, y: 25.6, w: 4.7, h: 7.1 },
    "Undella Town": { x: 87.5, y: 39.3, w: 4.7, h: 7.1 },
    "Humilau City": { x: 91.8, y: 21.4, w: 4.7, h: 7.1 },
    "Lentimas Town": { x: 72.7, y: 39.3, w: 4.7, h: 7.1 },
    "Driftveil City": { x: 28.9, y: 53.6, w: 4.7, h: 7.1 },
    "Nimbasa City": { x: 51.6, y: 53.6, w: 4.7, h: 7.1 },
    "Black City": { x: 74.2, y: 53.6, w: 4.7, h: 7.1 },
    "Castelia City": { x: 51.6, y: 77.4, w: 4.7, h: 7.1 },
    "Nacrene City": { x: 79.3, y: 69.6, w: 4.7, h: 7.1 },
    "Striaton City": { x: 88.7, y: 69.6, w: 4.7, h: 7.1 },
    "Accumula Town": { x: 90.6, y: 82.1, w: 4.7, h: 7.1 },
    "Nuvema Town": { x: 91.0, y: 94.0, w: 4.7, h: 7.1 },
    "Pokémon League": { x: 66.4, y: 8.9, w: 4.7, h: 7.1 },
    "Virbank City": { x: 27.0, y: 75.6, w: 4.7, h: 7.1 },
    "Floccesy Town": { x: 12.5, y: 75.6, w: 4.7, h: 7.1 },
    "Aspertia City": { x: 5.1, y: 89.9, w: 4.7, h: 7.1 },
    "Pokémon World Tournament": { x: 30.1, y: 61.3, w: 3.1, h: 4.8 },
    "Pokéstar Studios": { x: 25.0, y: 68.5, w: 3.1, h: 4.8 },
    "Dragonspiral Tower": { x: 25.8, y: 17.9, w: 3.1, h: 4.8 },
    "Celestial Tower": { x: 21.1, y: 29.2, w: 3.1, h: 4.8 },
    "Mistralton Cave": { x: 25.0, y: 42.3, w: 3.1, h: 4.8 },
    "Giant Chasm": { x: 81.2, y: 21.4, w: 3.1, h: 4.8 },
    Entralink: { x: 51.6, y: 39.9, w: 3.1, h: 4.8 },
    "Strange House": { x: 77.3, y: 34.5, w: 3.1, h: 4.8 },
    "Reversal Mountain": { x: 80.5, y: 39.3, w: 3.1, h: 4.8 },
    "Twist Mountain": { x: 28.1, y: 32.7, w: 3.1, h: 4.8 },
    "Clay Tunnel": { x: 28.1, y: 45.8, w: 3.1, h: 4.8 },
    "Chargestone Cave": { x: 16.4, y: 47.6, w: 3.1, h: 4.8 },
    "Relic Castle": { x: 44.9, y: 61.9, w: 3.1, h: 4.8 },
    "Pinwheel Forest": { x: 75.4, y: 74.4, w: 3.1, h: 4.8 },
    "Wellspring Cave": { x: 84.0, y: 64.9, w: 3.1, h: 4.8 },
    Dreamyard: { x: 93.4, y: 69.6, w: 3.1, h: 4.8 },
    "Abundant Shrine": { x: 77.0, y: 45.8, w: 3.1, h: 4.8 },
    "P2 Laboratory": { x: 83.6, y: 89.9, w: 3.1, h: 4.8 },
    "Route 7": { x: 22.3, y: 32.7, w: 3.1, h: 4.8 },
    "Route 6": { x: 22.3, y: 46.4, w: 3.1, h: 4.8 },
    "Route 13": { x: 80.9, y: 32.1, w: 3.1, h: 4.8 },
    "Route 11": { x: 56.6, y: 25.6, w: 7.8, h: 3.0 },
    "Route 15": { x: 70.3, y: 53.6, w: 3.9, h: 3.0 },
    "Marvelous Bridge": { x: 62.5, y: 53.6, w: 7.8, h: 3.0 },
    "Route 22": { x: 85.5, y: 21.4, w: 10.9, h: 2.4 },
    "Route 23": { x: 76.2, y: 15.5, w: 1.6, h: 11.9 },
    "Route 2": { x: 90.6, y: 76.2, w: 1.6, h: 7.1 },
    "Route 4": { x: 51.6, y: 65.5, w: 1.6, h: 16.7 },
  };

  const HGSS_PLACES = {
    "Ecruteak City": { x: 24.5, y: 33.0, w: 5.0, h: 11.3 },
    "Burned Tower": { x: 23.2, y: 30.6, w: 1.7, h: 4.3 },
    "Tin Tower": { x: 25.5, y: 30.6, w: 1.7, h: 4.3 },
    "Mahogany Town": { x: 34.4, y: 36.2, w: 2.5, h: 6.3 },
    "Blackthorn City": { x: 44.5, y: 33.3, w: 5.0, h: 12.6 },
    "Violet City": { x: 31.2, y: 49.7, w: 4.8, h: 11.9 },
    "Sprout Tower": { x: 32.2, y: 47.5, w: 1.5, h: 3.8 },
    "Olivine City": { x: 17.8, y: 50.3, w: 5.0, h: 11.3 },
    "Goldenrod City": { x: 21.0, y: 66.7, w: 7.0, h: 11.9 },
    "Cianwood City": { x: 10.0, y: 65.4, w: 2.4, h: 10.3 },
    "Whirl Islands": { x: 14.4, y: 69.6, w: 1.7, h: 4.3 },
    "Azalea Town": { x: 26.2, y: 86.8, w: 4.5, h: 6.9 },
    "Ilex Forest": { x: 23.2, y: 86.8, w: 1.7, h: 4.3 },
    "Slowpoke Well": { x: 27.8, y: 86.8, w: 1.7, h: 4.3 },
    "Union Cave": { x: 30.0, y: 80.5, w: 1.7, h: 4.3 },
    "Ruins of Alph": { x: 27.8, y: 56.0, w: 2.5, h: 12.6 },
    "National Park": { x: 22.2, y: 44.7, w: 2.5, h: 6.3 },
    "Cherrygrove City": { x: 35.5, y: 75.2, w: 5.0, h: 6.3 },
    "New Bark Town": { x: 45.5, y: 75.2, w: 2.5, h: 6.3 },
    "Dark Cave": { x: 36.8, y: 53.1, w: 1.7, h: 4.3 },
    "Mt. Mortar": { x: 30.0, y: 36.5, w: 1.7, h: 4.3 },
    "Lake of Rage": { x: 34.4, y: 16.7, w: 7.5, h: 12.6 },
    "Mt. Silver": { x: 54.4, y: 53.2, w: 1.8, h: 4.5 },
    "Indigo Plateau": { x: 61.1, y: 49.7, w: 1.7, h: 16.4 },
    "Viridian City": { x: 68.9, y: 49.1, w: 5.0, h: 12.6 },
    "Pewter City": { x: 71.1, y: 22.0, w: 5.0, h: 12.6 },
    "Cerulean City": { x: 88.9, y: 28.3, w: 5.0, h: 12.6 },
    "Saffron City": { x: 88.9, y: 44.7, w: 5.0, h: 12.6 },
    "Celadon City": { x: 82.2, y: 50.1, w: 5.0, h: 12.6 },
    "Vermilion City": { x: 88.9, y: 61.6, w: 5.0, h: 12.6 },
    "Lavender Town": { x: 96.6, y: 47.5, w: 2.5, h: 6.3 },
    "Fuchsia City": { x: 82.2, y: 78.0, w: 4.8, h: 11.3 },
    "Pallet Town": { x: 70.0, y: 69.2, w: 2.5, h: 6.3 },
    "Cinnabar Island": { x: 70.0, y: 91.8, w: 2.5, h: 6.3 },
    "Mt. Moon": { x: 78.9, y: 24.9, w: 1.7, h: 4.3 },
    "Diglett's Cave": { x: 70.0, y: 30.8, w: 1.5, h: 3.8 },
    "Cerulean Cave": { x: 87.8, y: 25.2, w: 1.7, h: 4.3 },
    "Rock Tunnel": { x: 96.6, y: 30.6, w: 1.7, h: 4.3 },
    "Power Plant": { x: 96.6, y: 36.5, w: 1.7, h: 4.3 },
    "Seafoam Islands": { x: 76.6, y: 92.5, w: 1.7, h: 4.3 },
    "Route 47": { x: 5.5, y: 69.2, w: 5.8, h: 15.7 },
    "Route 25": { x: 93.5, y: 13.6, w: 7.5, h: 3.8 },
    "Route 35": { x: 23.1, y: 55.3, w: 1.0, h: 12.6 },
  };

  const KALOS_PLACES = {
    "Lumiose City": { x: 51.6, y: 36.7, w: 8.1, h: 12.4 },
    "Laverre City": { x: 51.6, y: 11.4, w: 4.4, h: 6.7 },
    "Coumarine City": { x: 34.4, y: 29.5, w: 4.4, h: 6.7 },
    "Shalour City": { x: 14.4, y: 35.7, w: 4.4, h: 6.7 },
    "Geosenge Town": { x: 9.1, y: 47.6, w: 4.4, h: 6.7 },
    "Cyllage City": { x: 17.2, y: 57.1, w: 4.4, h: 6.7 },
    "Ambrette Town": { x: 22.5, y: 75.2, w: 4.4, h: 6.7 },
    "Camphrier Town": { x: 40.9, y: 57.6, w: 4.4, h: 6.7 },
    "Santalune City": { x: 61.6, y: 56.2, w: 4.4, h: 6.7 },
    "Aquacorde Town": { x: 66.2, y: 73.8, w: 4.4, h: 6.7 },
    "Vaniville Town": { x: 66.2, y: 85.7, w: 4.4, h: 6.7 },
    "Dendemille Town": { x: 68.4, y: 29.5, w: 4.4, h: 6.7 },
    "Anistar City": { x: 87.8, y: 38.1, w: 4.4, h: 6.7 },
    "Couriway Town": { x: 92.8, y: 45.7, w: 4.4, h: 6.7 },
    "Snowbelle City": { x: 84.4, y: 55.2, w: 4.4, h: 6.7 },
    "Pokémon League": { x: 73.4, y: 42.9, w: 4.4, h: 6.7 },
    "Kiloude City": { x: 75.0, y: 92.4, w: 4.4, h: 6.7 },
    "Reflection Cave": { x: 12.2, y: 39.5, w: 3.1, h: 4.8 },
    "Glittering Cave": { x: 36.2, y: 75.2, w: 3.1, h: 4.8 },
    "Parfum Palace": { x: 29.4, y: 44.8, w: 3.1, h: 4.8 },
    "Sea Spirit's Den": { x: 24.7, y: 18.1, w: 3.1, h: 4.8 },
    "Santalune Forest": { x: 66.2, y: 63.3, w: 3.1, h: 4.8 },
    "Victory Road": { x: 73.4, y: 54.8, w: 3.1, h: 4.8 },
    "Pokémon Village": { x: 80.6, y: 75.2, w: 3.1, h: 4.8 },
    "Frost Cavern": { x: 72.5, y: 22.4, w: 3.1, h: 4.8 },
    "Terminus Cave": { x: 95.9, y: 37.6, w: 3.1, h: 4.8 },
    "Lost Hotel": { x: 59.4, y: 25.2, w: 3.1, h: 4.8 },
    "Poké Ball Factory": { x: 51.6, y: 5.2, w: 3.1, h: 4.8 },
    "Route 12": { x: 24.4, y: 32.4, w: 3.8, h: 5.7 },
    "Route 7": { x: 30.6, y: 57.1, w: 15.6, h: 1.9 },
    "Route 5": { x: 46.2, y: 47.6, w: 3.1, h: 4.8 },
    "Route 16": { x: 60.0, y: 33.3, w: 3.1, h: 4.8 },
  };

  const ORAS_PLACES = {
    "Fallarbor Town": { x: 13.3, y: 11.7, w: 4.0, h: 6.1 },
    "Fortree City": { x: 44.1, y: 11.7, w: 4.0, h: 6.1 },
    "Lilycove City": { x: 70.0, y: 27.4, w: 7.5, h: 6.1 },
    "Mossdeep City": { x: 87.1, y: 35.9, w: 7.5, h: 6.1 },
    "Pokémon League": { x: 95.7, y: 52.5, w: 4.0, h: 6.1 },
    "Ever Grande City": { x: 95.7, y: 64.5, w: 4.0, h: 6.1 },
    "Sootopolis City": { x: 77.0, y: 55.7, w: 4.0, h: 6.1 },
    "Pacifidlog Town": { x: 64.7, y: 69.5, w: 4.0, h: 6.1 },
    "Slateport City": { x: 30.4, y: 72.3, w: 3.8, h: 11.7 },
    "Mauville City": { x: 32.1, y: 43.2, w: 7.5, h: 6.1 },
    "Lavaridge Town": { x: 20.4, y: 32.7, w: 4.0, h: 6.1 },
    "Rustboro City": { x: 2.9, y: 40.8, w: 3.8, h: 11.7 },
    "Verdanturf Town": { x: 16.7, y: 43.2, w: 4.0, h: 6.1 },
    "Petalburg City": { x: 6.4, y: 64.2, w: 4.0, h: 6.1 },
    "Oldale Town": { x: 16.6, y: 64.2, w: 4.0, h: 6.1 },
    "Littleroot Town": { x: 16.6, y: 74.7, w: 4.0, h: 6.1 },
    "Dewford Town": { x: 9.9, y: 90.5, w: 4.0, h: 6.1 },
    "Meteor Falls": { x: 4.6, y: 21.9, w: 3.5, h: 5.4 },
    "Mt. Chimney": { x: 22.1, y: 21.6, w: 3.5, h: 5.4 },
    "Jagged Pass": { x: 22.1, y: 27.1, w: 3.5, h: 5.4 },
    "Fiery Path": { x: 25.5, y: 27.1, w: 3.5, h: 5.4 },
    "Rusturf Tunnel": { x: 16.6, y: 37.3, w: 3.5, h: 5.4 },
    "Petalburg Woods": { x: 1.9, y: 52.7, w: 3.5, h: 5.4 },
    "Granite Cave": { x: 5.9, y: 90.4, w: 3.5, h: 5.4 },
    "Safari Zone": { x: 56.3, y: 21.9, w: 3.5, h: 5.4 },
    "Shoal Cave": { x: 91.3, y: 28.4, w: 3.5, h: 5.4 },
    "Mt. Pyre": { x: 60.5, y: 36.5, w: 3.5, h: 5.4 },
    "New Mauville": { x: 33.9, y: 49.0, w: 3.5, h: 5.4 },
    "Cave of Origin": { x: 71.9, y: 48.2, w: 3.5, h: 5.4 },
    "Sky Pillar": { x: 72.5, y: 63.9, w: 3.5, h: 5.4 },
    "Sea Mauville": { x: 25.1, y: 84.9, w: 3.5, h: 5.4 },
    "Battle Resort": { x: 80.1, y: 80.3, w: 3.5, h: 5.4 },
    "Scorched Slab": { x: 49.8, y: 11.9, w: 3.5, h: 5.4 },
    "Route 105": { x: 2.9, y: 74.7, w: 3.4, h: 15.2 },
    "Route 110": { x: 30.4, y: 57.2, w: 3.2, h: 18.7 },
    "Route 111": { x: 30.4, y: 25.1, w: 3.2, h: 30.3 },
    "Route 114": { x: 8.4, y: 17.5, w: 3.4, h: 14.0 },
    "Route 118": { x: 39.2, y: 43.2, w: 6.5, h: 5.4 },
    "Route 119": { x: 41.1, y: 24.5, w: 3.2, h: 30.3 },
    "Route 120": { x: 47.6, y: 19.3, w: 3.8, h: 19.8 },
    "Route 123": { x: 49.8, y: 43.2, w: 26.6, h: 5.4 },
    "Route 124": { x: 83.7, y: 29.8, w: 9.9, h: 19.8 },
    "Route 127": { x: 88.9, y: 51.1, w: 9.9, h: 19.8 },
  };

  const ALOLA_PLACES = {
    "Mahalo Trail": { x: 31.2, y: 18.5, w: 2.0, h: 3.3 },
    "Mount Lanakila": { x: 83.4, y: 79.2, w: 2.0, h: 3.3 },
    "Poni Grove": { x: 19.0, y: 55.9, w: 2.0, h: 3.3 },
    "Ancient Poni Path": { x: 14.3, y: 50.9, w: 2.0, h: 3.3 },
    "Hau'oli City": { x: 28.0, y: 27.8, w: 2.5, h: 4.2 },
    "Iki Town": { x: 32.5, y: 20.8, w: 2.0, h: 3.3 },
    "Verdant Cavern": { x: 28.7, y: 15.8, w: 2.0, h: 3.3 },
    "Melemele Meadow": { x: 33.0, y: 13.3, w: 2.0, h: 3.3 },
    "Ten Carat Hill": { x: 40.4, y: 31.4, w: 2.0, h: 3.3 },
    "Ruins of Conflict": { x: 32.5, y: 13.7, w: 1.8, h: 2.9 },
    "Route 1": { x: 37.3, y: 24.5, w: 1.8, h: 2.9 },
    "Route 2": { x: 25.6, y: 20.5, w: 1.8, h: 2.9 },
    "Heahea City": { x: 58.9, y: 36.9, w: 2.2, h: 3.8 },
    "Paniola Town": { x: 63.1, y: 28.5, w: 2.2, h: 3.8 },
    "Konikoni City": { x: 55.8, y: 42.6, w: 2.2, h: 3.8 },
    "Royal Avenue": { x: 68.6, y: 29.1, w: 2.0, h: 3.3 },
    "Lush Jungle": { x: 66.7, y: 15.6, w: 2.0, h: 3.3 },
    "Wela Volcano Park": { x: 69.0, y: 19.3, w: 2.0, h: 3.3 },
    "Route 5": { x: 65.1, y: 20.2, w: 1.8, h: 2.9 },
    "Diglett's Tunnel": { x: 59.3, y: 44.5, w: 2.0, h: 3.3 },
    "Paniola Ranch": { x: 64.1, y: 25.0, w: 2.0, h: 3.3 },
    "Memorial Hill": { x: 62.3, y: 47.5, w: 2.0, h: 3.3 },
    "Ruins of Life": { x: 62.9, y: 42.9, w: 1.8, h: 2.9 },
    "Route 8": { x: 66.3, y: 10.4, w: 1.8, h: 2.9 },
    "Seafolk Village": { x: 9.5, y: 54.4, w: 2.2, h: 3.8 },
    "Battle Tree": { x: 14.0, y: 35.4, w: 2.0, h: 3.3 },
    "Altar of the Sunne/Moone": { x: 12.4, y: 38.4, w: 2.0, h: 3.3 },
    "Resolution Cave": { x: 16.9, y: 40.5, w: 2.0, h: 3.3 },
    "Poni Meadow": { x: 16.3, y: 45.2, w: 2.0, h: 3.3 },
    "Vast Poni Canyon": { x: 14.2, y: 47.4, w: 2.0, h: 3.3 },
    "Ruins of Hope": { x: 17.7, y: 53.1, w: 1.8, h: 2.9 },
    "Poni Gauntlet": { x: 19.0, y: 38.5, w: 1.8, h: 2.9 },
    "Malie City": { x: 87.4, y: 61.7, w: 2.2, h: 3.8 },
    "Po Town": { x: 79.8, y: 54.3, w: 2.2, h: 3.8 },
    "Tapu Village": { x: 83.4, y: 82.1, w: 2.2, h: 3.8 },
    "Mount Hokulani": { x: 82.6, y: 62.1, w: 2.0, h: 3.3 },
    "Lake of the Sunne/Moone": { x: 80.2, y: 66.9, w: 2.0, h: 3.3 },
    "Haina Desert": { x: 85.6, y: 78.1, w: 2.0, h: 3.3 },
    "Blush Mountain": { x: 92.5, y: 75.5, w: 2.0, h: 3.3 },
    "Route 12": { x: 92.5, y: 70.1, w: 1.8, h: 2.9 },
    "Route 13": { x: 88.4, y: 80.6, w: 1.8, h: 2.9 },
    "Route 16": { x: 77.9, y: 70.4, w: 1.8, h: 2.9 },
    "Route 17": { x: 80.3, y: 57.9, w: 1.8, h: 2.9 },
    "Ruins of Abundance": { x: 86.8, y: 69.1, w: 1.8, h: 2.9 },
    "Malie Garden": { x: 89.0, y: 61.7, w: 2.0, h: 3.3 },
    "Aether House": { x: 80.9, y: 78.9, w: 1.8, h: 2.9 },
    "Thrifty Megamart": { x: 84.5, y: 83.8, w: 1.8, h: 2.9 },
    "Aether Paradise": { x: 39.5, y: 60.4, w: 5.5, h: 7.5 },
    "Exeggutor Island": { x: 7.5, y: 52.9, w: 3.0, h: 4.2 },
  };

  const LETSGO_PLACES = {
    "Indigo Plateau": { x: 7.8, y: 16.2, w: 3.1, h: 5.5 },
    "Pewter City": { x: 14.0, y: 22.1, w: 3.1, h: 5.5 },
    "Victory Road": { x: 7.8, y: 27.7, w: 2.7, h: 4.7 },
    "Diglett's Cave": { x: 17.1, y: 27.7, w: 2.7, h: 4.7 },
    "Viridian Forest": { x: 14.0, y: 33.2, w: 2.7, h: 4.7 },
    "Viridian City": { x: 14.0, y: 49.8, w: 3.1, h: 5.5 },
    "Pallet Town": { x: 14.0, y: 66.4, w: 3.1, h: 5.5 },
    "Cinnabar Island": { x: 14.0, y: 88.5, w: 3.1, h: 5.5 },
    "Seafoam Islands": { x: 23.3, y: 88.5, w: 2.7, h: 4.7 },
    "Fuchsia City": { x: 32.7, y: 77.5, w: 3.1, h: 5.5 },
    "Mt. Moon": { x: 26.4, y: 16.6, w: 2.7, h: 4.7 },
    "Cerulean City": { x: 38.9, y: 16.6, w: 3.1, h: 5.5 },
    "Celadon City": { x: 29.6, y: 33.2, w: 3.1, h: 5.5 },
    "Saffron City": { x: 38.9, y: 33.2, w: 3.1, h: 5.5 },
    "Lavender Town": { x: 51.6, y: 33.2, w: 3.1, h: 5.5 },
    "Rock Tunnel": { x: 51.6, y: 22.1, w: 2.7, h: 4.7 },
    "Power Plant": { x: 54.7, y: 27.7, w: 2.7, h: 4.7 },
    "Vermilion City": { x: 38.9, y: 55.3, w: 3.1, h: 5.5 },
    "Route 24": { x: 38.9, y: 9.5, w: 1.3, h: 7.9 },
    "Route 25": { x: 43.3, y: 5.1, w: 8.0, h: 2.4 },
    "Route 4": { x: 32.9, y: 16.6, w: 10.0, h: 2.4 },
    "Route 17": { x: 20.4, y: 55.3, w: 1.3, h: 39.5 },
  };

  const GALAR_PLACES = {
    Wyndon: { x: 26.8, y: 12.4, w: 3.0, h: 1.5 },
    Ballonlea: { x: 10.4, y: 24.2, w: 3.0, h: 1.5 },
    "Stow-on-Side": { x: 12.8, y: 31.2, w: 3.0, h: 1.5 },
    Hammerlocke: { x: 27.0, y: 34.6, w: 3.0, h: 1.5 },
    Circhester: { x: 44.5, y: 26.4, w: 3.0, h: 1.5 },
    Spikemuth: { x: 48.6, y: 34.7, w: 3.0, h: 1.5 },
    Turffield: { x: 12.5, y: 40.6, w: 3.0, h: 1.5 },
    Hulbury: { x: 39.5, y: 40.5, w: 3.0, h: 1.5 },
    Motostoke: { x: 26.2, y: 45.9, w: 3.0, h: 1.5 },
    Wedgehurst: { x: 28.2, y: 63.0, w: 3.0, h: 1.5 },
    Postwick: { x: 28.2, y: 67.8, w: 3.0, h: 1.5 },
    "Meetup Spot": { x: 25.0, y: 57.7, w: 1.9, h: 1.0 },
    "Slumbering Weald": { x: 17.6, y: 67.4, w: 1.9, h: 1.0 },
    "Glimwood Tangle": { x: 12.8, y: 25.8, w: 1.9, h: 1.0 },
    "Galar Mine": { x: 9.0, y: 43.9, w: 1.9, h: 1.0 },
    "Galar Mine No. 2": { x: 40.3, y: 43.5, w: 1.9, h: 1.0 },
    "Route 2": { x: 33.0, y: 61.8, w: 1.9, h: 1.0 },
    "Route 4": { x: 9.2, y: 41.1, w: 1.9, h: 1.0 },
    "Route 5": { x: 20.1, y: 40.5, w: 1.9, h: 1.0 },
    "Route 6": { x: 15.6, y: 32.8, w: 1.9, h: 1.0 },
    "Route 10": { x: 27.1, y: 23.1, w: 1.9, h: 1.0 },
    "Lake of Outrage": { x: 20.4, y: 36.9, w: 1.9, h: 1.0 },
    "Hammerlocke Hills": { x: 30.8, y: 36.5, w: 1.9, h: 1.0 },
    "Giant's Cap": { x: 22.5, y: 38.5, w: 1.9, h: 1.0 },
    "Dusty Bowl": { x: 26.3, y: 38.5, w: 1.9, h: 1.0 },
    "Giant's Mirror": { x: 31.4, y: 38.5, w: 1.9, h: 1.0 },
    "Stony Wilderness": { x: 31.2, y: 39.9, w: 1.9, h: 1.0 },
    "Bridge Field": { x: 32.4, y: 43.4, w: 1.9, h: 1.0 },
    "Watchtower Ruins": { x: 20.1, y: 50.3, w: 1.9, h: 1.0 },
    "East Lake Axewell": { x: 26.1, y: 50.3, w: 1.9, h: 1.0 },
    "West Lake Axewell": { x: 17.8, y: 52.6, w: 1.9, h: 1.0 },
    "Giant's Seat": { x: 33.7, y: 54.3, w: 1.9, h: 1.0 },
    "Dappled Grove": { x: 18.3, y: 55.8, w: 1.9, h: 1.0 },
    "Rolling Fields": { x: 22.0, y: 55.3, w: 1.9, h: 1.0 },
  };

  const BDSP_PLACES = {
    "Snowpoint City": { x: 43.2, y: 10.4, w: 2.0, h: 9.0 },
    "Lake Acuity": { x: 40.0, y: 8.7, w: 2.4, h: 4.2 },
    "Eterna City": { x: 40.6, y: 49.1, w: 5.2, h: 9.0 },
    "Celestic Town": { x: 49.0, y: 48.4, w: 2.4, h: 4.2 },
    "Floaroma Town": { x: 30.0, y: 59.5, w: 2.0, h: 9.7 },
    "Canalave City": { x: 20.6, y: 69.2, w: 2.0, h: 9.0 },
    "Jubilife City": { x: 29.0, y: 72.7, w: 5.2, h: 9.0 },
    "Oreburgh City": { x: 38.6, y: 72.7, w: 5.2, h: 9.0 },
    "Hearthome City": { x: 50.0, y: 66.4, w: 5.2, h: 9.0 },
    "Solaceon Town": { x: 57.4, y: 61.6, w: 5.2, h: 3.5 },
    "Veilstone City": { x: 67.0, y: 56.4, w: 5.2, h: 9.0 },
    "Pastoria City": { x: 61.0, y: 83.0, w: 5.2, h: 9.0 },
    "Sunyshore City": { x: 76.4, y: 72.7, w: 5.2, h: 9.0 },
    "Sandgem Town": { x: 30.0, y: 83.7, w: 2.0, h: 3.5 },
    "Twinleaf Town": { x: 24.4, y: 87.2, w: 2.0, h: 3.5 },
    "Lake Verity": { x: 21.6, y: 82.0, w: 2.4, h: 3.5 },
    "Fight Area": { x: 61.2, y: 38.1, w: 5.2, h: 4.2 },
    "Survival Area": { x: 62.2, y: 28.7, w: 2.0, h: 3.5 },
    "Resort Area": { x: 72.0, y: 41.9, w: 5.2, h: 4.2 },
    "Pokémon League": { x: 75.4, y: 48.1, w: 2.0, h: 3.5 },
    "Victory Road": { x: 75.4, y: 51.2, w: 2.0, h: 3.5 },
    "Stark Mountain": { x: 68.0, y: 18.7, w: 2.0, h: 3.5 },
    "Flower Paradise": { x: 79.2, y: 18.3, w: 2.0, h: 3.5 },
    "Iron Island": { x: 26.2, y: 45.0, w: 2.0, h: 3.5 },
    "Fullmoon Island": { x: 24.4, y: 22.1, w: 2.0, h: 3.5 },
    "Newmoon Island": { x: 30.0, y: 22.1, w: 2.0, h: 3.5 },
    "Mt. Coronet": { x: 43.4, y: 51.9, w: 3.6, h: 10.4 },
    "Route 214": { x: 70.0, y: 66.8, w: 4.4, h: 5.5 },
    "Lake Valor": { x: 65.0, y: 73.4, w: 2.4, h: 4.2 },
    "Ramanas Park": { x: 37.6, y: 90.7, w: 2.0, h: 3.5 },
  };

  const PALDEA_PLACES = {
    "Area Zero": { x: 48.1, y: 57.5, w: 18.6, h: 17.1 },
    Mesagoza: { x: 48.4, y: 73.2, w: 8.8, h: 7.8 },
    "Socarrat Trail": { x: 24.8, y: 36.2, w: 26.9, h: 20.7 },
    "West Province": { x: 23.3, y: 59.5, w: 23.3, h: 26.9 },
    "South Province": { x: 48.1, y: 84.9, w: 31.1, h: 11.4 },
  };

  const SEVII_PLACES = {
    "Mt. Ember": { x: 14.6, y: 10.0 },
    "Trainer Tower": { x: 27.0, y: 82.0 },
    "Tanoby Ruins": { x: 43.6, y: 93.1 },
    "Navel Rock": { x: 65.8, y: 68.8 },
    "Birth Island": { x: 81.0, y: 94.4 },
    "Five Island": { x: 76.8, y: 80.2 },
  };

  const JOHTO_PLACES = {
    "New Bark Town": { x: 91.6, y: 71.8 },
    "Cherrygrove City": { x: 64.0, y: 71.8 },
    "Violet City": { x: 52.6, y: 40.4 },
    "Ecruteak City": { x: 41.3, y: 27.6 },
    "Mahogany Town": { x: 69.2, y: 27.6 },
    "Blackthorn City": { x: 86.2, y: 27.6 },
    "Goldenrod City": { x: 30.2, y: 65.3 },
    "Olivine City": { x: 19.1, y: 40.4 },
    "Cianwood City": { x: 7.7, y: 71.8 },
    "Azalea Town": { x: 41.6, y: 90.4 },
    "Lake of Rage": { x: 69.2, y: 14.9 },
    "Mt. Mortar": { x: 52.6, y: 27.6 },
    "Union Cave": { x: 52.6, y: 90.4 },
    "Whirl Islands": { x: 13.6, y: 65.5 },
    "Mt. Silver": { x: 97.2, y: 46.3 },
    "Ruins of Alph": { x: 46.9, y: 52.7 },
    "Route 35": { x: 30.2, y: 52.2 },
  };

  const PIN_MAPS = {
    redblue: {
      image: "maps/kanto-rby.png",
      title: "Kanto",
      places: RBY_PLACES,
      pins: {
        zapdos: ["Power Plant", "Power Plant, on the east side near Rock Tunnel"],
        moltres: ["Victory Road", "Victory Road, near the Indigo Plateau"],
        articuno: ["Seafoam Islands", "Seafoam Islands, between Fuchsia City and Cinnabar Island"],
        mewtwo: ["Cerulean Cave", "Cerulean Cave, near Cerulean City"],
        lapras: ["Saffron City", "Silph Co., Saffron City"],
        eevee: ["Celadon City", "Celadon Mansion roof, Celadon City"],
        omanyte: ["Mt. Moon", "Mt. Moon"],
        aerodactyl: ["Pewter City", "Old Amber is in the Pewter City museum"],
        hitmonlee: ["Saffron City", "Fighting Dojo, Saffron City"],
        hitmonchan: ["Saffron City", "Fighting Dojo, Saffron City"],
        kabuto: ["Mt. Moon", "Mt. Moon"],
        "abra-mr-mime": ["Route 2", "Route 2, outside Diglett's Cave"],
        "nidoran-m-f": ["Route 5", "Route 5, underground path north exit"],
        "nidorino-nidorina": ["Route 11", "Route 11, inside the gatehouse"],
        "slowbro-lickitung": ["Route 18", "Route 18, inside the gatehouse"],
        "poliwhirl-jynx": ["Cerulean City", "Cerulean City, house next to the Pokémon Center"],
        "spearow-farfetchd": ["Vermilion City", "Vermilion City"],
        "ponyta-seel": ["Cinnabar Island", "Cinnabar Island, inside the Cinnabar Lab"],
        "raichu-electrode": ["Cinnabar Island", "Cinnabar Island, inside the Cinnabar Lab"],
        "venonat-tangela": ["Cinnabar Island", "Cinnabar Island, inside the Cinnabar Lab"],
      },
    },
    yellow: {
      image: "maps/kanto-rby.png",
      title: "Kanto",
      places: RBY_PLACES,
      pins: {
        zapdos: ["Power Plant", "Power Plant, on the east side near Rock Tunnel"],
        moltres: ["Victory Road", "Victory Road, near the Indigo Plateau"],
        articuno: ["Seafoam Islands", "Seafoam Islands, between Fuchsia City and Cinnabar Island"],
        mewtwo: ["Cerulean Cave", "Cerulean Cave, near Cerulean City"],
        lapras: ["Saffron City", "Silph Co., Saffron City"],
        eevee: ["Celadon City", "Celadon Mansion roof, Celadon City"],
        omanyte: ["Mt. Moon", "Mt. Moon"],
        aerodactyl: ["Pewter City", "Old Amber is in the Pewter City museum"],
        hitmonlee: ["Saffron City", "Fighting Dojo, Saffron City"],
        hitmonchan: ["Saffron City", "Fighting Dojo, Saffron City"],
        kabuto: ["Mt. Moon", "Mt. Moon"],
        bulbasaur: ["Cerulean City", "Cerulean City, from a girl if your Pikachu is happy"],
        charmender: ["Route 24", "Route 24, from a trainer on the plateau"],
        squirtle: ["Vermilion City", "Vermilion City, from Officer Jenny after the Thunder Badge"],
        "clefairy-mrmime": ["Route 2", "Route 2, outside Diglett's Cave"],
        "cubone-machoke": ["Route 5", "Route 5, underground path north exit"],
        "lickitung-dugtrio": ["Route 11", "Route 11, inside the gatehouse"],
        "tangela-parasect": ["Route 18", "Route 18, inside the gatehouse"],
        "golduck-rhydon": ["Cinnabar Island", "Cinnabar Island, by the Pokémon Center"],
        "growlithe-dewgong": ["Cinnabar Island", "Cinnabar Island, by the Pokémon Center"],
        "kangaskhan-muk": ["Cinnabar Island", "Cinnabar Island, inside the laboratory"],
      },
    },
    fireredleafgreen: {
      image: "maps/kanto.png",
      title: "Kanto",
      places: KANTO_PLACES,
      alt: {
        sevii: { image: "maps/sevii.png", title: "Sevii Islands", places: SEVII_PLACES },
        birthisland: { image: "maps/birthisland.png", title: "Birth Island", places: { "Birth Island": { x: 80.7, y: 84.7, w: 6.5, h: 8.7 } } },
        navelrock: { image: "maps/navelrock.png", title: "Navel Rock", places: { "Navel Rock": { x: 47.9, y: 57.6, w: 6.5, h: 8.7 } } },
      },
      pins: {
        moltres: ["Mt. Ember", "Mt. Ember, on One Island", "sevii"],
        lugia: ["Navel Rock", "Navel Rock (needs the MysticTicket).", "navelrock"],
        "ho-oh": ["Navel Rock", "Navel Rock (needs the MysticTicket).", "navelrock"],
        deoxys: ["Birth Island", "Birth Island (needs the AuroraTicket)", "birthisland"],
        togepi: ["Five Island", "Water Labyrinth, Five Island", "sevii"],
        unownA: ["Tanoby Ruins", "Tanoby Ruins, Monean Chamber.", "sevii"],
        unownB: ["Tanoby Ruins", "Tanoby Ruins, Rixy Chamber.", "sevii"],
        unownC: ["Tanoby Ruins", "Tanoby Ruins, Liptoo Chamber.", "sevii"],
        unownD: ["Tanoby Ruins", "Tanoby Ruins, Liptoo Chamber.", "sevii"],
        unownE: ["Tanoby Ruins", "Tanoby Ruins, Weepth Chamber.", "sevii"],
        unownF: ["Tanoby Ruins", "Tanoby Ruins, Scufib Chamber.", "sevii"],
        unownG: ["Tanoby Ruins", "Tanoby Ruins, Scufib Chamber.", "sevii"],
        unownH: ["Tanoby Ruins", "Tanoby Ruins, Liptoo Chamber.", "sevii"],
        unownI: ["Tanoby Ruins", "Tanoby Ruins, Weepth Chamber.", "sevii"],
        unownJ: ["Tanoby Ruins", "Tanoby Ruins, Dilford Chamber.", "sevii"],
        unownK: ["Tanoby Ruins", "Tanoby Ruins, Scufib Chamber.", "sevii"],
        unownL: ["Tanoby Ruins", "Tanoby Ruins, Dilford Chamber.", "sevii"],
        unownM: ["Tanoby Ruins", "Tanoby Ruins, Rixy Chamber.", "sevii"],
        unownN: ["Tanoby Ruins", "Tanoby Ruins, Weepth Chamber.", "sevii"],
        unownO: ["Tanoby Ruins", "Tanoby Ruins, Liptoo Chamber.", "sevii"],
        unownP: ["Tanoby Ruins", "Tanoby Ruins, Dilford Chamber.", "sevii"],
        unownQ: ["Tanoby Ruins", "Tanoby Ruins, Dilford Chamber.", "sevii"],
        unownR: ["Tanoby Ruins", "Tanoby Ruins, Dilford Chamber.", "sevii"],
        unownS: ["Tanoby Ruins", "Tanoby Ruins, Weepth Chamber.", "sevii"],
        unownT: ["Tanoby Ruins", "Tanoby Ruins, Scufib Chamber.", "sevii"],
        unownU: ["Tanoby Ruins", "Tanoby Ruins, Liptoo Chamber.", "sevii"],
        unownV: ["Tanoby Ruins", "Tanoby Ruins, Rixy Chamber.", "sevii"],
        unownW: ["Tanoby Ruins", "Tanoby Ruins, Rixy Chamber.", "sevii"],
        unownX: ["Tanoby Ruins", "Tanoby Ruins, Rixy Chamber.", "sevii"],
        unownY: ["Tanoby Ruins", "Tanoby Ruins, Scufib Chamber.", "sevii"],
        unownZ: ["Tanoby Ruins", "Tanoby Ruins, Viapois Chamber.", "sevii"],
        "unown?": ["Tanoby Ruins", "Tanoby Ruins, Monean Chamber.", "sevii"],
        "unown!": ["Tanoby Ruins", "Tanoby Ruins, Viapois Chamber.", "sevii"],
        "trainertower-single": ["Trainer Tower", "Trainer Tower, Seven Island", "sevii"],
        "trainertower-souble": ["Trainer Tower", "Trainer Tower, Seven Island", "sevii"],
        "trainertower-mixed": ["Trainer Tower", "Trainer Tower, Seven Island", "sevii"],
        "trainertower-knockout": ["Trainer Tower", "Trainer Tower, Seven Island", "sevii"],
        zapdos: ["Power Plant", "Power Plant, on the east side near Rock Tunnel"],
        articuno: ["Seafoam Islands", "Seafoam Islands, between Fuchsia City and Cinnabar Island"],
        mewtwo: ["Cerulean Cave", "Cerulean Cave, near Cerulean City"],
        lapras: ["Saffron City", "Silph Co., Saffron City"],
        eevee: ["Celadon City", "Celadon Mansion roof, Celadon City"],
        omanyte: ["Mt. Moon", "Mt. Moon (you may only choose one fossil)"],
        aerodactyl: ["Pewter City", "Old Amber is in the Pewter City museum"],
        "hitmonchan-hitmonlee": ["Saffron City", "Fighting Dojo, Saffron City"],
        abra: ["Route 2", "Route 2"],
        nidoran: ["Route 5", "Route 5"],
        nidorino: ["Route 11", "Route 11"],
        golduck: ["Route 18", "Route 18"],
        poliwhirl: ["Cerulean City", "Cerulean City"],
        spearow: ["Vermilion City", "Vermilion City"],
        ponyta: ["Cinnabar Island", "Cinnabar Island"],
        raichu: ["Cinnabar Island", "Cinnabar Island"],
        venonat: ["Cinnabar Island", "Cinnabar Island"],
      },
    },
    emerald: {
      image: "maps/hoenn.png",
      title: "Hoenn",
      places: HOENN_PLACES,
      alt: {
        navelrock: { image: "maps/navelrock.png", title: "Navel Rock", places: { "Navel Rock": { x: 47.9, y: 57.6, w: 6.5, h: 8.7 } } },
        birthisland: { image: "maps/birthisland.png", title: "Birth Island", places: { "Birth Island": { x: 80.7, y: 84.7, w: 6.5, h: 8.7 } } },
      },
      pins: {
        chamber1: ["Route 110", "Trick House, Route 110"],
        chamber2: ["Route 110", "Trick House, Route 110"],
        chamber3: ["Route 110", "Trick House, Route 110"],
        chamber4: ["Route 110", "Trick House, Route 110"],
        chamber5: ["Route 110", "Trick House, Route 110"],
        chamber6: ["Route 110", "Trick House, Route 110"],
        chamber7: ["Route 110", "Trick House, Route 110"],
        chamber8: ["Route 110", "Trick House, Route 110"],
        "defeat-champion": ["Ever Grande City", "Pokémon League, Ever Grande City"],
        lugia: ["Navel Rock", "Navel Rock (needs the MysticTicket)", "navelrock"],
        "ho-oh": ["Navel Rock", "Navel Rock (needs the MysticTicket)", "navelrock"],
        deoxys: ["Birth Island", "Birth Island (needs the AuroraTicket)", "birthisland"],
        kyogre: ["Marine Cave", "Marine Cave, Route 127"],
        groudon: ["Terra Cave", "Terra Cave, Route 114"],
        rayquaza: ["Sky Pillar", "Sky Pillar, near Pacifidlog Town"],
        regirock: ["Route 111 desert", "Desert Tomb, Route 111 desert"],
        regice: ["Island Cave", "Island Cave, Route 105"],
        registeel: ["Ancient Tomb", "Ancient Tomb, Route 120"],
        lileep: ["Route 111 desert", "Route 111, Mirage Tower (only one can be chosen)"],
        anorith: ["Route 111 desert", "Route 111, Mirage Tower (only one can be chosen)"],
        castform: ["Weather Institute", "Weather Institute, Route 119"],
        wynaut: ["Lavaridge Town", "Lavaridge Town"],
        beldum: ["Lavaridge Town", "Lavaridge Town, after defeating the Champion"],
        diploma: ["Lilycove City", "Cove Lily Motel, Lilycove City"],
        "seedot-ralts": ["Rustboro City", "Rustboro City"],
        "volbeat-plusle": ["Fortree City", "Fortree City"],
        "bagon-horsea": ["Pacifidlog Town", "Pacifidlog Town"],
        "johto-starter": ["Littleroot Town", "Professor Birch's lab, Littleroot Town"],
      },
    },
    rubysapphire: {
      image: "maps/hoenn.png",
      title: "Hoenn",
      places: HOENN_PLACES,
      pins: {
        chamber1: ["Route 110", "Trick House, Route 110"],
        chamber2: ["Route 110", "Trick House, Route 110"],
        chamber3: ["Route 110", "Trick House, Route 110"],
        chamber4: ["Route 110", "Trick House, Route 110"],
        chamber5: ["Route 110", "Trick House, Route 110"],
        chamber6: ["Route 110", "Trick House, Route 110"],
        chamber7: ["Route 110", "Trick House, Route 110"],
        chamber8: ["Route 110", "Trick House, Route 110"],
        "pokemon-league-champion": ["Ever Grande City", "Pokémon League, Ever Grande City"],
        kyogre: ["Sootopolis City", "Cave of Origin, Sootopolis City"],
        groudon: ["Sootopolis City", "Cave of Origin, Sootopolis City"],
        rayquaza: ["Sky Pillar", "Sky Pillar, near Pacifidlog Town"],
        regirock: ["Route 111 desert", "Desert Tomb, Route 111 desert"],
        regice: ["Island Cave", "Island Cave, Route 105"],
        registeel: ["Ancient Tomb", "Ancient Tomb, Route 120"],
        lileep: ["Route 111 desert", "Route 111, Mirage Tower (only one can be chosen)"],
        anorith: ["Route 111 desert", "Route 111, Mirage Tower (only one can be chosen)"],
        castform: ["Weather Institute", "Weather Institute, Route 119"],
        wynaut: ["Lavaridge Town", "Lavaridge Town"],
        beldum: ["Lavaridge Town", "Lavaridge Town, after defeating the Champion"],
        diploma: ["Lilycove City", "Cove Lily Motel, Lilycove City"],
        slakoth: ["Rustboro City", "Rustboro City"],
        pikachu: ["Fortree City", "Fortree City"],
        bellossum: ["Pacifidlog Town", "Pacifidlog Town"],
      },
    },
    diamondpearl: {
      image: "maps/sinnoh.png",
      title: "Sinnoh",
      places: SINNOH_PLACES,
      pins: {
        dialga: ["Mt. Coronet", "Spear Pillar, top of Mt. Coronet"],
        palkia: ["Mt. Coronet", "Spear Pillar, top of Mt. Coronet"],
        arceus: ["Mt. Coronet", "Spear Pillar, Mt. Coronet"],
        uxie: ["Lake Acuity", "Lake Acuity"],
        azelf: ["Lake Valor", "Lake Valor"],
        mesprit: ["Lake Verity", "Lake Verity"],
        cresselia: ["Canalave City", "Canalave City"],
        darkrai: ["Canalave City", "Canalave City, in the previously locked motel"],
        regigigas: ["Snowpoint City", "Snowpoint Temple, Snowpoint City"],
        eevee: ["Hearthome City", "Bebe's house, Hearthome City"],
        happiny: ["Hearthome City", "Hearthome City, west gate"],
        diploma: ["Lake Valor", "Hotel Grand Lake, Valor Lakefront"],
        "breeding-centre": ["Solaceon Town", "Daycare, Solaceon Town"],
        counter: ["Veilstone City", "Veilstone Department Store"],
        "coin-toss": ["Lake Valor", "Hotel Grand Lake, Valor Lakefront"],
        calendar: ["Sunyshore City", "Sunyshore City"],
        roulette: ["Sunyshore City", "Sunyshore City"],
        "drawing-board": ["Sunyshore City", "Sunyshore City"],
        "analog-clock": ["Celestic Town", "Celestic Town"],
        "happiness-checker": ["Eterna City", "Pokémon Center, Eterna City"],
        "gym-statue": ["Hearthome City", "Mr. Goods, Hearthome City"],
        globe: ["Hearthome City", "Mr. Goods, Hearthome City"],
        "blue-crystal": ["Hearthome City", "Mr. Goods, Hearthome City"],
        "pink-crystal": ["Hearthome City", "Mr. Goods, Hearthome City"],
        "red-crystal": ["Hearthome City", "Mr. Goods, Hearthome City"],
        "yellow-crystal": ["Hearthome City", "Mr. Goods, Hearthome City"],
        giratina: ["Route 214", "East of Route 214"],
        "trade-machop-abra": ["Oreburgh Town", "Oreburgh Town"],
        "trade-buizel-chatot": ["Eterna City", "Eterna Condominiums"],
        "trade-medicham-haunter": ["Snowpoint City", "Snowpoint City"],
        "defeat-champion": ["Pokémon League", "Sinnoh Pokémon League"],
      },
    },
    platinum: {
      image: "maps/sinnoh.png",
      title: "Sinnoh",
      places: SINNOH_PLACES,
      pins: {
        dialga: ["Mt. Coronet", "Spear Pillar, top of Mt. Coronet"],
        palkia: ["Mt. Coronet", "Spear Pillar, top of Mt. Coronet"],
        arceus: ["Mt. Coronet", "Spear Pillar, Mt. Coronet"],
        uxie: ["Lake Acuity", "Lake Acuity"],
        azelf: ["Lake Valor", "Lake Valor"],
        mesprit: ["Lake Verity", "Lake Verity"],
        cresselia: ["Canalave City", "Canalave City"],
        darkrai: ["Canalave City", "Canalave City, in the previously locked motel"],
        regigigas: ["Snowpoint City", "Snowpoint Temple, Snowpoint City"],
        eevee: ["Hearthome City", "Bebe's house, Hearthome City"],
        happiny: ["Hearthome City", "Hearthome City, west gate"],
        diploma: ["Lake Valor", "Hotel Grand Lake, Valor Lakefront"],
        "breeding-centre": ["Solaceon Town", "Daycare, Solaceon Town"],
        counter: ["Veilstone City", "Veilstone Department Store"],
        "coin-toss": ["Lake Valor", "Hotel Grand Lake, Valor Lakefront"],
        calendar: ["Sunyshore City", "Sunyshore City"],
        roulette: ["Sunyshore City", "Sunyshore City"],
        "drawing-board": ["Sunyshore City", "Sunyshore City"],
        "analog-clock": ["Celestic Town", "Celestic Town"],
        "happiness-checker": ["Eterna City", "Pokémon Center, Eterna City"],
        "gym-statue": ["Hearthome City", "Mr. Goods, Hearthome City"],
        globe: ["Hearthome City", "Mr. Goods, Hearthome City"],
        "blue-crystal": ["Hearthome City", "Mr. Goods, Hearthome City"],
        "pink-crystal": ["Hearthome City", "Mr. Goods, Hearthome City"],
        "red-crystal": ["Hearthome City", "Mr. Goods, Hearthome City"],
        "yellow-crystal": ["Hearthome City", "Mr. Goods, Hearthome City"],
        togepi: ["Eterna City", "Eterna City"],
        porygon: ["Veilstone City", "Veilstone City"],
        "machop-abra": ["Oreburgh Town", "Oreburgh Town"],
        "buizel-chatot": ["Eterna City", "Eterna Condominiums"],
        "medicham-haunter": ["Snowpoint City", "Snowpoint City"],
        "pokemon-league": ["Pokémon League", "Sinnoh Pokémon League"],
        "bronze-trophy": ["Hearthome City", "Mr. Goods, Hearthome City"],
        "silver-trophy": ["Hearthome City", "Mr. Goods, Hearthome City"],
        "gold-trophy": ["Hearthome City", "Mr. Goods, Hearthome City"],
      },
    },
    blackwhite: {
      image: "maps/unova.png",
      title: "Unova",
      places: UNOVA_PLACES,
      pins: {
        diploma: ["Castelia City", "Game Freak building, Castelia City"],
        reshiram: ["Dragonspiral Tower", "Dragonspiral Tower / N's Castle, after the Elite Four"],
        zekrom: ["Dragonspiral Tower", "Dragonspiral Tower / N's Castle, after the Elite Four"],
        kyurem: ["Giant Chasm", "Giant Chasm, north of Route 13"],
        victini: ["Liberty Garden", "Liberty Garden (Liberty Island)"],
        cobalion: ["Mistralton Cave", "Mistralton Cave, off Route 6 (needs Surf)"],
        terrakion: ["Victory Road", "Victory Road"],
        virizion: ["Pinwheel Forest", "Pinwheel Forest"],
        torandus: ["Route 7", "Roams Unova. Go to Route 10, then Route 7"],
        thundurus: ["Route 7", "Roams Unova. Go to Route 10, then Route 7"],
        landorus: ["Abundant Shrine", "Abundant Shrine"],
        pans: ["Dreamyard", "Dreamyard, Striaton City"],
        "tirtouga-archen": ["Relic Castle", "Relic Castle"],
        larvesta: ["Route 18", "Route 18"],
        zorua: ["Poké Transfer Lab", "Poké Transfer Lab (transfer Celebi)"],
        magikarp: ["Marvelous Bridge", "Marvelous Bridge"],
        "petilil-cottonee": ["Nacrene City", "Nacrene City"],
        "minccino-basculin": ["Driftveil City", "Driftveil City"],
        "boldore-emolga": ["Route 7", "Route 7"],
        "ditto-rotom": ["Route 15", "Route 15"],
        cinccino: ["Undella Town", "Undella Town"],
        musicalitems: ["Opelucid City", "Opelucid City"],
        musicalgoods: ["Nimbasa City", "Musical Theater, Nimbasa City"],
        entralink: ["Entralink", "Entralink, centre of Unova"],
        eliterank: ["Nimbasa City", "Nimbasa City"],
        leaguechampion: ["Pokémon League", "Pokémon League"],
        elitefour: ["Pokémon League", "Pokémon League"],
        "beatrival-cheren": ["Victory Road", "Victory Road"],
        "beatrival-bianca": ["Nuvema Town", "Juniper's Lab, Nuvema Town"],
        cynthia: ["Undella Town", "Cynthia's House, Undella Town"],
        morimoto: ["Castelia City", "Game Freak building, Castelia City"],
        richesfamily: ["Undella Town", "Riches' Villa, Undella Town"],
        battlesubway: ["Nimbasa City", "Battle Subway, Nimbasa City"],
        "battlesubway-single": ["Nimbasa City", "Battle Subway, Nimbasa City"],
        "battlesubway-double": ["Nimbasa City", "Battle Subway, Nimbasa City"],
        "battlesubway-multi": ["Nimbasa City", "Battle Subway, Nimbasa City"],
        "battlesubway-singlesuper": ["Nimbasa City", "Battle Subway, Nimbasa City"],
        "battlesubway-doublesuper": ["Nimbasa City", "Battle Subway, Nimbasa City"],
        "battlesubway-multisuper": ["Nimbasa City", "Battle Subway, Nimbasa City"],
      },
    },
    black2white2: {
      image: "maps/unova2.png",
      title: "Unova",
      places: UNOVA2_PLACES,
      pins: {
        diploma: ["Castelia City", "Game Freak building, Castelia City"],
        reshiram: ["Dragonspiral Tower", "Dragonspiral Tower, after the Elite Four"],
        zekrom: ["Dragonspiral Tower", "Dragonspiral Tower, after the Elite Four"],
        kyurem: ["Giant Chasm", "Giant Chasm"],
        victini: ["Route 11", "Route 11"],
        cobalion: ["Route 13", "Route 13"],
        terrakion: ["Route 22", "Route 22"],
        virizion: ["Pinwheel Forest", "Pinwheel Forest"],
        torandus: ["Route 7", "Roams Unova. Go to Route 10, then Route 7"],
        thundurus: ["Route 7", "Roams Unova. Go to Route 10, then Route 7"],
        landorus: ["Abundant Shrine", "Abundant Shrine"],
        "latios-latias": ["Dreamyard", "Dreamyard"],
        uxie: ["Nacrene City", "Nacrene Museum, Nacrene City"],
        mesprit: ["Celestial Tower", "Celestial Tower"],
        azelf: ["Route 23", "Route 23"],
        regirock: ["Clay Tunnel", "Clay Tunnel, Underground Ruins"],
        regigigas: ["Twist Mountain", "Twist Mountain basement"],
        cresselia: ["Strange House", "Strange House, near Lentimas Town"],
        heatran: ["Reversal Mountain", "Reversal Mountain"],
        zorua: ["Driftveil City", "Driftveil City"],
        eevee: ["Castelia City", "Castelia City"],
        deerling: ["Route 6", "Route 6"],
        happiny: ["Route 6", "Route 6"],
        "gible-dratini": ["Floccesy Town", "Floccesy Town"],
        "tirtouga-archen": ["Nacrene City", "Nacrene Museum, Nacrene City"],
        magikarp: ["Marvelous Bridge", "Marvelous Bridge"],
        boldore: ["Chargestone Cave", "Chargestone Cave"],
        ferroseed: ["Chargestone Cave", "Chargestone Cave"],
        joltik: ["Chargestone Cave", "Chargestone Cave"],
        klink: ["Chargestone Cave", "Chargestone Cave"],
        pidove: ["Pinwheel Forest", "Pinwheel Forest"],
        purrloin: ["Route 2", "Route 2"],
        timburr: ["Pinwheel Forest", "Pinwheel Forest"],
        tympole: ["Pinwheel Forest", "Pinwheel Forest"],
        woobat: ["Wellspring Cave", "Wellspring Cave"],
        "n-zorua": ["Driftveil City", "Driftveil City"],
        "petilil-cottonee": ["Route 4", "Route 4"],
        "emolga-gigalith": ["Route 7", "Route 7"],
        "mantine-tangela": ["Humilau City", "Humilau City"],
        "ditto-rotom": ["Route 15", "Route 15"],
        "excadrill-ambipom": ["Accumula Town", "Accumula Town"],
        "hippowdon-alakazam": ["Accumula Town", "Accumula Town"],
        "various-trades": ["Nimbasa City", "Nimbasa City"],
        "beatrival-hugh": ["Driftveil City", "Driftveil City"],
        "defeat-benga": ["Black City", "Black City / White Forest"],
        "defeat-colress": ["P2 Laboratory", "P2 Laboratory"],
        eliterank: ["Nimbasa City", "Nimbasa City"],
        leaguechampion: ["Pokémon League", "Pokémon League"],
        pokestarstudio: ["Pokéstar Studios", "Pokéstar Studios, Nimbasa City"],
        worldtournament: ["Pokémon World Tournament", "Pokémon World Tournament, Driftveil City"],
        "battlesubway-single": ["Nimbasa City", "Battle Subway, Nimbasa City"],
        "battlesubway-double": ["Nimbasa City", "Battle Subway, Nimbasa City"],
        "battlesubway-multi": ["Nimbasa City", "Battle Subway, Nimbasa City"],
        "battlesubway-singlesuper": ["Nimbasa City", "Battle Subway, Nimbasa City"],
        "battlesubway-doublesuper": ["Nimbasa City", "Battle Subway, Nimbasa City"],
        "battlesubway-multisuper": ["Nimbasa City", "Battle Subway, Nimbasa City"],
      },
    },
    heartgoldsoulsilver: {
      image: "maps/johtokanto.png",
      title: "Johto and Kanto",
      places: HGSS_PLACES,
      pins: {
        diploma: ["Celadon City", "Celadon Condominiums, Celadon City"],
        "ho-oh": ["Tin Tower", "Tin Tower, Ecruteak City (with the Rainbow Wing)"],
        lugia: ["Whirl Islands", "Whirl Islands (with the Silver Wing)"],
        suicune: ["Route 25", "Hill next to Bill's house, Route 25"],
        articuno: ["Seafoam Islands", "Seafoam Islands"],
        zapdos: ["Power Plant", "Just outside the Power Plant, Route 10"],
        moltres: ["Mt. Silver", "Silver Cave, Mt. Silver"],
        mewtwo: ["Cerulean Cave", "Cerulean Cave"],
        kyogre: ["Route 47", "Cliff Cave, Route 47"],
        groudon: ["Route 47", "Cliff Cave, Route 47"],
        rayquaza: ["Route 47", "Cliff Cave, Route 47"],
        eevee: ["Goldenrod City", "Bill's house, Goldenrod City"],
        spearow: ["Route 35", "Gate north of Goldenrod City"],
        egg: ["Violet City", "Violet City, with the Secret Code"],
        shuckle: ["Cianwood City", "Cianwood City"],
        tentacool: ["Cianwood City", "Cianwood City"],
        tyrogue: ["Mt. Mortar", "Mt. Mortar, basement"],
        onix: ["Violet City", "House in Violet City"],
        machop: ["Goldenrod City", "Goldenrod Department Store"],
        dodrio: ["Blackthorn City", "East-most house, Blackthorn City"],
        xatu: ["Pewter City", "Pokémon Center, Pewter City"],
        magneton: ["Power Plant", "Power Plant, Route 10"],
        pikachu: ["Saffron City", "Magnet Train station, Saffron City"],
        rhyhorn: ["Diglett's Cave", "Entrance of Diglett's Cave"],
        togepi: ["Violet City", "Violet City"],
        leaguechampion: ["Indigo Plateau", "Indigo Plateau"],
        elitefour: ["Indigo Plateau", "Indigo Plateau"],
        beatred: ["Mt. Silver", "Top of Mt. Silver"],
        beatrival: ["Indigo Plateau", "Indigo Plateau"],
        pichu: ["Ilex Forest", "Celebi's Shrine, Ilex Forest"],
        jirachi: ["Ilex Forest", "Celebi's Shrine, Ilex Forest"],
        celebi: ["Ilex Forest", "Celebi's Shrine, Ilex Forest"],
      },
    },
    xy: {
      image: "maps/kalos.png",
      title: "Kalos",
      places: KALOS_PLACES,
      pins: {
        "pokedex-diploma": ["Coumarine City", "Hotel Coumarine, Coumarine City"],
        "national-diploma": ["Coumarine City", "Hotel Coumarine, Coumarine City"],
        zygarde: ["Terminus Cave", "Terminus Cave"],
        mewtwo: ["Pokémon Village", "Cave in Pokémon Village"],
        "bunnelby-farfetchd": ["Santalune City", "Santalune City"],
        "jigglypuff-bisharp": ["Snowbelle City", "Snowbelle City"],
        "any-kalosstarters": ["Vaniville Town", "Vaniville Town"],
        "any-ralts": ["Lumiose City", "Café, Southern Boulevard, Lumiose City"],
        "luvdisc-steelix": ["Cyllage City", "Cyllage City"],
        "kanto-starters": ["Lumiose City", "Professor Sycamore's Lab, Lumiose City"],
        lucario: ["Shalour City", "Tower of Mastery, Shalour City"],
        lapras: ["Route 12", "Route 12"],
        leaguechampion: ["Pokémon League", "Pokémon League"],
        "attack-power": ["Route 5", "Route 5 gate, Lumiose City"],
        "defense-power": ["Route 5", "Route 5 gate, Lumiose City"],
        "special-attack-power": ["Camphrier Town", "Camphrier Town"],
        "special-defense-power": ["Ambrette Town", "Ambrette Town"],
        "accuracy-power": ["Dendemille Town", "Dendemille Town"],
        "speed-power": ["Geosenge Town", "Geosenge Town"],
        "exp-point-power": ["Anistar City", "Anistar City"],
        "prize-money-power": ["Cyllage City", "Cyllage City"],
        "befriending-power": ["Coumarine City", "Coumarine City"],
        "encounter-power": ["Laverre City", "Laverre City"],
        "stealth-power": ["Couriway Town", "Couriway Town"],
        "pp-restoring-power": ["Snowbelle City", "Snowbelle City"],
        "critical-power": ["Shalour City", "Shalour City"],
        "hatching-power": ["Lumiose City", "Café Introversion, Lumiose City"],
        "aquacorde-town": ["Aquacorde Town", "Aquacorde Town"],
        "lumiose-city": ["Lumiose City", "Lumiose City"],
        parfumpalace: ["Parfum Palace", "Parfum Palace"],
        "route-7": ["Route 7", "Route 7"],
        "geosenge-town": ["Geosenge Town", "Geosenge Town"],
        "shalour-town": ["Shalour City", "Shalour City"],
        "azure-bay": ["Route 12", "Azure Bay, on Route 12"],
        frostcavern: ["Frost Cavern", "Frost Cavern"],
        "anistar-city": ["Anistar City", "Anistar City"],
        "couriway-town": ["Couriway Town", "Couriway Town"],
        "snowbelle-city": ["Snowbelle City", "Snowbelle City"],
        pokemonleague: ["Pokémon League", "Pokémon League"],
        "defeat-rival": ["Kiloude City", "Kiloude City"],
        looker: ["Lumiose City", "Lumiose City"],
        venusaurite: ["Lumiose City", "Lumiose City"],
        charizarditex: ["Lumiose City", "Lumiose City"],
        charizarditey: ["Lumiose City", "Lumiose City"],
        blastoisinite: ["Lumiose City", "Lumiose City"],
        alakazite: ["Reflection Cave", "Reflection Cave B3F"],
        gengarite: ["Laverre City", "Laverre City"],
        kangaskhanite: ["Glittering Cave", "Glittering Cave"],
        pinsirite: ["Santalune Forest", "Santalune Forest"],
        heracronite: ["Santalune Forest", "Santalune Forest"],
        gyaradosite: ["Couriway Town", "Couriway Town"],
        aerodactylite: ["Ambrette Town", "Ambrette Town"],
        ampharosite: ["Route 12", "Azure Bay, on Route 12"],
        garchompite: ["Victory Road", "Victory Road"],
        houndoominite: ["Route 16", "Route 16"],
        manectite: ["Route 16", "Route 16"],
        gardevoirite: ["Lumiose City", "Café, Southern Boulevard, Lumiose City"],
        medichamite: ["Laverre City", "Laverre City"],
        absolite: ["Kiloude City", "Kiloude City"],
        scizorite: ["Frost Cavern", "Frost Cavern"],
        abomasite: ["Frost Cavern", "Frost Cavern"],
        masterrank: ["Lumiose City", "Lumiose City"],
        "duke-duchess": ["Lumiose City", "Lumiose City"],
      },
    },
    omegarubyalphasapphire: {
      image: "maps/hoenn-oras.png",
      title: "Hoenn",
      places: ORAS_PLACES,
      pins: {
        "pokedex-diploma": ["Lilycove City", "Cove Lily Motel, Lilycove City"],
        "national-diploma": ["Lilycove City", "Cove Lily Motel, Lilycove City"],
        "timetravel-diploma": ["Lilycove City", "Cove Lily Motel, Lilycove City"],
        groudon: ["Cave of Origin", "Cave of Origin"],
        kyogre: ["Cave of Origin", "Cave of Origin"],
        "latias-latios": ["Route 118", "Route 118"],
        rayquaza: ["Sky Pillar", "Sky Pillar"],
        regirock: ["Route 111", "Desert Tomb, Route 111"],
        regice: ["Route 105", "Island Cave, Route 105"],
        registeel: ["Route 120", "Ancient Tomb, Route 120"],
        regigigas: ["Route 105", "Island Cave, Route 105"],
        "ho-oh-lugia": ["Sea Mauville", "Sea Mauville"],
        heatran: ["Scorched Slab", "Scorched Slab"],
        "johto-starters": ["Littleroot Town", "Littleroot Town"],
        "unova-starters": ["Littleroot Town", "Littleroot Town"],
        "sinnoh-starters": ["Littleroot Town", "Littleroot Town"],
        "camerupt-sharpedo": ["Battle Resort", "Battle Resort"],
        wynaut: ["Lavaridge Town", "Lavaridge Town"],
        castform: ["Route 119", "Weather Institute, Route 119"],
        togepi: ["Lavaridge Town", "Lavaridge Town"],
        beldum: ["Mossdeep City", "Mossdeep City"],
        "slakoth-makuhita": ["Rustboro City", "Rustboro City"],
        "spinda-skitty": ["Fortree City", "Fortree City"],
        "bellossom-corsola": ["Pacifidlog Town", "Pacifidlog Town"],
        leaguechampion: ["Pokémon League", "Pokémon League"],
        battlemaison: ["Battle Resort", "Battle Maison, Battle Resort"],
        "defeat-rival": ["Battle Resort", "Battle Resort"],
        "elitefour-rematch": ["Pokémon League", "Pokémon League"],
        machbike: ["Route 111", "Desert, Route 111"],
        acrobike: ["Route 119", "Route 119"],
        bikeshow: ["Mauville City", "Rydel's Cycles, Mauville City"],
        trickhouse: ["Route 110", "Trick House, Route 110"],
        "wattson-quest": ["New Mauville", "New Mauville"],
        venusaurite: ["Route 119", "Route 119"],
        charizarditex: ["Fiery Path", "Fiery Path"],
        charizarditey: ["Scorched Slab", "Scorched Slab"],
        beedrilite: ["Sea Mauville", "Sea Mauville"],
        pidgeotite: ["Rustboro City", "Rustboro City"],
        slowbronite: ["Shoal Cave", "Shoal Cave"],
        kangaskhanite: ["Pacifidlog Town", "Pacifidlog Town"],
        gyaradosite: ["Route 123", "Route 123"],
        aerodactylite: ["Meteor Falls", "Meteor Falls"],
        manectite: ["Route 110", "Cycling Road, Route 110"],
        absolite: ["Safari Zone", "Safari Zone"],
        ampharosite: ["New Mauville", "New Mauville"],
        steelixite: ["Granite Cave", "Granite Cave"],
        scizorite: ["Petalburg Woods", "Petalburg Woods"],
        heracronite: ["Route 127", "Route 127"],
        houndoominite: ["Lavaridge Town", "Lavaridge Town"],
        tyranitarite: ["Jagged Pass", "Jagged Pass"],
        sceptilite: ["Route 120", "Route 120"],
        blazikenite: ["Route 120", "Route 120"],
        swampertite: ["Route 120", "Route 120"],
        gardevoirite: ["Verdanturf Town", "Verdanturf Town"],
        sablenite: ["Sootopolis City", "Sootopolis City"],
        medichamite: ["Mt. Pyre", "Mt. Pyre"],
        salamencite: ["Meteor Falls", "Meteor Falls"],
        metagrossite: ["Pokémon League", "Pokémon League"],
        mawileite: ["Verdanturf Town", "Verdanturf Town"],
        glalitite: ["Shoal Cave", "Shoal Cave basement"],
        altarianite: ["Lilycove City", "Lilycove City"],
        banetteite: ["Mt. Pyre", "Mt. Pyre"],
        latiasite: ["Littleroot Town", "Littleroot Town"],
        lopunnite: ["Mauville City", "Mauville Hills, Mauville City"],
        aggronite: ["Rusturf Tunnel", "Rusturf Tunnel"],
        abomasite: ["Route 123", "Berry Garden, Route 123"],
        galladite: ["Meteor Falls", "Professor Cozmo, Meteor Falls"],
        audinite: ["Battle Resort", "Battle Resort"],
        gengarite: ["Battle Resort", "Battle Resort"],
        pinsirite: ["Route 124", "Route 124"],
        "attack-power": ["Mauville City", "Pokémon Center, Mauville City"],
        "accuracy-power": ["Mauville City", "Pokémon Center, Mauville City"],
        "speed-power": ["Mauville City", "Pokémon Center, Mauville City"],
        "exp-point-power": ["Mauville City", "Pokémon Center, Mauville City"],
        "prize-money-power": ["Mauville City", "Pokémon Center, Mauville City"],
        "befriending-power": ["Mauville City", "Pokémon Center, Mauville City"],
        "encounter-power": ["Mauville City", "Pokémon Center, Mauville City"],
        "stealth-power": ["Mauville City", "Pokémon Center, Mauville City"],
        "pp-restoring-power": ["Mauville City", "Pokémon Center, Mauville City"],
        "bargain-power": ["Mauville City", "Pokémon Center, Mauville City"],
        "critical-power": ["Mauville City", "Pokémon Center, Mauville City"],
        "hatching-power": ["Mauville City", "Mauville Hills, Mauville City"],
        "battlemaison-single": ["Battle Resort", "Battle Maison, Battle Resort"],
        "battlemaison-double": ["Battle Resort", "Battle Maison, Battle Resort"],
        "battlemaison-triple": ["Battle Resort", "Battle Maison, Battle Resort"],
        "battlemaison-rotation": ["Battle Resort", "Battle Maison, Battle Resort"],
        "battlemaison-multi": ["Battle Resort", "Battle Maison, Battle Resort"],
        "battlemaison-singlesuper": ["Battle Resort", "Battle Maison, Battle Resort"],
        "battlemaison-doublesuper": ["Battle Resort", "Battle Maison, Battle Resort"],
        "battlemaison-triplesuper": ["Battle Resort", "Battle Maison, Battle Resort"],
        "battlemaison-rotationsuper": ["Battle Resort", "Battle Maison, Battle Resort"],
        "battlemaison-multisuper": ["Battle Resort", "Battle Maison, Battle Resort"],
      },
    },
    sunmoon: {
      image: "maps/alola.png",
      title: "Alola",
      places: ALOLA_PLACES,
      pins: {
        "minior-red": ["Mount Hokulani", "Mount Hokulani"],
        "minior-orange": ["Mount Hokulani", "Mount Hokulani"],
        "minior-yellow": ["Mount Hokulani", "Mount Hokulani"],
        "minior-green": ["Mount Hokulani", "Mount Hokulani"],
        "minior-blue": ["Mount Hokulani", "Mount Hokulani"],
        "minior-indigo": ["Mount Hokulani", "Mount Hokulani"],
        "minior-violet": ["Mount Hokulani", "Mount Hokulani"],
        "minior-black": ["Mount Hokulani", "Mount Hokulani"],
        solgaleo: ["Altar of the Sunne/Moone", "Altar of the Sunne (Sun)"],
        lunala: ["Altar of the Sunne/Moone", "Altar of the Moone (Moon)"],
        cosmog: ["Lake of the Sunne/Moone", "Lake of the Sunne/Moone"],
        necrozma: ["Ten Carat Hill", "Ten Carat Hill"],
        tapukoko: ["Ruins of Conflict", "Ruins of Conflict"],
        tapulele: ["Ruins of Life", "Ruins of Life"],
        tapubulu: ["Ruins of Abundance", "Ruins of Abundance"],
        tapufini: ["Ruins of Hope", "Ruins of Hope"],
        zygarde: ["Route 16", "Route 16"],
        "celesteela-kartana": ["Route 13", "Route 13, Route 17 and Malie Garden"],
        "buzzwole-pheromosa": ["Route 2", "Route 2, Melemele Meadow, Verdant Cavern"],
        nihilego: ["Diglett's Tunnel", "Route 8, Diglett's Tunnel, Wela Volcano Park"],
        xurkitree: ["Lush Jungle", "Route 8, Lush Jungle, Memorial Hill"],
        guzzlord: ["Resolution Cave", "Seafolk Village, Resolution Cave"],
        eevee: ["Paniola Ranch", "Paniola Ranch"],
        porygon: ["Aether House", "Aether House"],
        aerodactyl: ["Seafolk Village", "Seafolk Village"],
        typenull: ["Aether Paradise", "Aether Paradise"],
        rattata: ["Route 1", "Routes 1, 2 and 3, Kalae Bay, Verdant Cavern"],
        sandshrew: ["Tapu Village", "Tapu Village, Mount Lanakila"],
        vulpix: ["Tapu Village", "Tapu Village, Mount Lanakila"],
        diglett: ["Diglett's Tunnel", "Diglett's Tunnel"],
        dugtrio: ["Haina Desert", "Haina Desert"],
        meowth: ["Hau'oli City", "Hau'oli City"],
        geodude: ["Route 12", "Route 12, Blush Mountain"],
        graveler: ["Route 17", "Route 17"],
        grimer: ["Hau'oli City", "Hau'oli City"],
        exeggutor: ["Exeggutor Island", "Exeggutor Island"],
        "zubat-poliwhirl": ["Konikoni City", "Konikoni City"],
        "spearow-machop": ["Route 2", "Route 2"],
        "haunter-golem": ["Tapu Village", "Tapu Village"],
        "pancham-happini": ["Malie City", "Malie City"],
        "bewear-talonflame": ["Poni Gauntlet", "Poni Gauntlet"],
        "lillipup-bouncee": ["Route 5", "Route 5"],
        "granbull-steenee": ["Seafolk Village", "Seafolk Village"],
        "melemele-trial": ["Verdant Cavern", "Verdant Cavern"],
        "akala-trial": ["Lush Jungle", "Lush Jungle"],
        "ulaula-trial": ["Thrifty Megamart", "Thrifty Megamart"],
        "poni-trial": ["Vast Poni Canyon", "Vast Poni Canyon"],
        "eevee-quest": ["Royal Avenue", "Thrifty Megamart, Royal Avenue"],
        alakazite: ["Poni Gauntlet", "Ancient Poni Path, or Battle Tree"],
        "single-battle": ["Battle Tree", "Battle Tree"],
        "double-battle": ["Battle Tree", "Battle Tree"],
        "multi-battle": ["Battle Tree", "Battle Tree"],
        slowbronite: ["Battle Tree", "Battle Tree"],
        gengarite: ["Battle Tree", "Battle Tree"],
        kangaskhanite: ["Battle Tree", "Battle Tree"],
        pinsirite: ["Battle Tree", "Battle Tree"],
        gyaradosite: ["Battle Tree", "Battle Tree"],
        aerodactylite: ["Battle Tree", "Battle Tree"],
        sharpedonite: ["Battle Tree", "Battle Tree"],
        scizorite: ["Battle Tree", "Battle Tree"],
        venusaurite: ["Battle Tree", "Battle Tree"],
        charizarditex: ["Battle Tree", "Battle Tree"],
        charizarditey: ["Battle Tree", "Battle Tree"],
        blastoisinite: ["Battle Tree", "Battle Tree"],
      },
    },
    ultrasunultramoon: {
      image: "maps/alola-usum.png",
      title: "Alola",
      places: ALOLA_PLACES,
      pins: {
        "minior-red": ["Mount Hokulani", "Mount Hokulani"],
        "minior-orange": ["Mount Hokulani", "Mount Hokulani"],
        "minior-yellow": ["Mount Hokulani", "Mount Hokulani"],
        "minior-green": ["Mount Hokulani", "Mount Hokulani"],
        "minior-blue": ["Mount Hokulani", "Mount Hokulani"],
        "minior-indigo": ["Mount Hokulani", "Mount Hokulani"],
        "minior-violet": ["Mount Hokulani", "Mount Hokulani"],
        "minior-black": ["Mount Hokulani", "Mount Hokulani"],
        solgaleo: ["Mahalo Trail", "Mahalo Trail (Ultra Sun)"],
        lunala: ["Mahalo Trail", "Mahalo Trail (Ultra Moon)"],
        cosmog: ["Lake of the Sunne/Moone", "Lake of the Sunne/Moone"],
        necrozma: ["Mount Lanakila", "Mount Lanakila"],
        tapukoko: ["Ruins of Conflict", "Ruins of Conflict"],
        tapulele: ["Ruins of Life", "Ruins of Life"],
        tapubulu: ["Ruins of Abundance", "Ruins of Abundance"],
        tapufini: ["Ruins of Hope", "Ruins of Hope"],
        articuno: ["Mahalo Trail", "Mahalo Trail"],
        zapdos: ["Mahalo Trail", "Mahalo Trail"],
        moltres: ["Mahalo Trail", "Mahalo Trail"],
        mewtwo: ["Mahalo Trail", "Mahalo Trail"],
        "raikou-entei": ["Mahalo Trail", "Mahalo Trail"],
        suicune: ["Mahalo Trail", "Mahalo Trail"],
        "lugia-ho-oh": ["Mahalo Trail", "Mahalo Trail"],
        regirock: ["Mahalo Trail", "Mahalo Trail"],
        regice: ["Mahalo Trail", "Mahalo Trail"],
        registeel: ["Mahalo Trail", "Mahalo Trail"],
        "latias-latios": ["Mahalo Trail", "Mahalo Trail"],
        "groudon-kyogre": ["Mahalo Trail", "Mahalo Trail"],
        rayquaza: ["Mahalo Trail", "Mahalo Trail"],
        uxie: ["Mahalo Trail", "Mahalo Trail"],
        mesprit: ["Mahalo Trail", "Mahalo Trail"],
        azelf: ["Mahalo Trail", "Mahalo Trail"],
        "dialga-palkia": ["Mahalo Trail", "Mahalo Trail"],
        "heatran-regigigas": ["Mahalo Trail", "Mahalo Trail"],
        giratina: ["Mahalo Trail", "Mahalo Trail"],
        cresselia: ["Mahalo Trail", "Mahalo Trail"],
        cobalion: ["Mahalo Trail", "Mahalo Trail"],
        terrakion: ["Mahalo Trail", "Mahalo Trail"],
        virizion: ["Mahalo Trail", "Mahalo Trail"],
        "tornadus-thundurus": ["Mahalo Trail", "Mahalo Trail"],
        "reshiram-zekrom": ["Mahalo Trail", "Mahalo Trail"],
        kyurem: ["Mahalo Trail", "Mahalo Trail"],
        "xerneas-yveltal": ["Mahalo Trail", "Mahalo Trail"],
        "stakataka-blacephalon": ["Poni Grove", "Poni Grove"],
        eevee: ["Paniola Ranch", "Paniola Ranch"],
        porygon: ["Aether House", "Aether House"],
        aerodactyl: ["Seafolk Village", "Seafolk Village"],
        pikachu: ["Heahea City", "Heahea City"],
        typenull: ["Aether Paradise", "Aether Paradise"],
        magearna: ["Aether Paradise", "Aether Paradise"],
        ashhatpikachu: ["Aether Paradise", "Aether Paradise"],
        rattata: ["Route 1", "Routes 1, 2 and 3, Kalae Bay, Verdant Cavern"],
        sandshrew: ["Tapu Village", "Tapu Village, Mount Lanakila"],
        vulpix: ["Tapu Village", "Tapu Village, Mount Lanakila"],
        diglett: ["Diglett's Tunnel", "Diglett's Tunnel"],
        dugtrio: ["Haina Desert", "Haina Desert"],
        meowth: ["Hau'oli City", "Hau'oli City"],
        geodude: ["Route 12", "Route 12, Blush Mountain"],
        graveler: ["Route 17", "Route 17"],
        grimer: ["Hau'oli City", "Hau'oli City"],
        exeggutor: ["Exeggutor Island", "Exeggutor Island"],
        "tentacool-barboach": ["Royal Avenue", "Royal Avenue"],
        "spearow-hawlucha": ["Route 2", "Route 2"],
        "trumbeak-arbok": ["Route 8", "Route 8"],
        "phantump-trevenant": ["Tapu Village", "Tapu Village"],
        "bewear-tauros": ["Poni Gauntlet", "Poni Gauntlet"],
        "lillipup-noibat": ["Route 5", "Route 5"],
        "granbull-shellos": ["Seafolk Village", "Seafolk Village"],
        alakazite: ["Ancient Poni Path", "Ancient Poni Path, or Battle Tree"],
        "totem-gumshoos-raticate": ["Paniola Ranch", "Paniola Ranch"],
        "totem-marowak-araquanid": ["Paniola Ranch", "Paniola Ranch"],
        "totem-turantis-salazzle": ["Paniola Ranch", "Paniola Ranch"],
        "totem-vikavolt-togedemaru": ["Paniola Ranch", "Paniola Ranch"],
        "totem-ribombee-kommo-o": ["Paniola Ranch", "Paniola Ranch"],
        "totem-mimikyu": ["Paniola Ranch", "Paniola Ranch"],
        "battletree-single": ["Battle Tree", "Battle Tree"],
        "battletree-double": ["Battle Tree", "Battle Tree"],
        "battletree-multi": ["Battle Tree", "Battle Tree"],
        "battletree-singlesuper": ["Battle Tree", "Battle Tree"],
        "battletree-doublesuper": ["Battle Tree", "Battle Tree"],
        "battletree-multisuper": ["Battle Tree", "Battle Tree"],
        "battleroyal-super": ["Royal Avenue", "Battle Royal Dome, Royal Avenue"],
        "battleroyal-hyper": ["Royal Avenue", "Battle Royal Dome, Royal Avenue"],
        "battleroyal-master": ["Royal Avenue", "Battle Royal Dome, Royal Avenue"],
        venusaurite: ["Battle Tree", "Battle Tree"],
        charizarditex: ["Battle Tree", "Battle Tree"],
        charizarditey: ["Battle Tree", "Battle Tree"],
        blastoisinite: ["Battle Tree", "Battle Tree"],
        slowbronite: ["Battle Tree", "Battle Tree"],
        gengarite: ["Battle Tree", "Battle Tree"],
        kangaskhanite: ["Battle Tree", "Battle Tree"],
        pinsirite: ["Battle Tree", "Battle Tree"],
        gyaradosite: ["Battle Tree", "Battle Tree"],
        aerodactylite: ["Battle Tree", "Battle Tree"],
        sharpedonite: ["Battle Tree", "Battle Tree"],
        scizorite: ["Battle Tree", "Battle Tree"],
        sablenite: ["Battle Tree", "Battle Tree"],
        absolite: ["Battle Tree", "Battle Tree"],
        glalitite: ["Battle Tree", "Battle Tree"],
        salamencite: ["Battle Tree", "Battle Tree"],
        metagrossite: ["Battle Tree", "Battle Tree"],
        garchompite: ["Battle Tree", "Battle Tree"],
        lucarionite: ["Battle Tree", "Battle Tree"],
      },
    },
    letsgopikachueevee: {
      image: "maps/letsgo.png",
      title: "Kanto",
      places: LETSGO_PLACES,
      pins: {
        articuno: ["Seafoam Islands", "Seafoam Islands"],
        moltres: ["Victory Road", "Victory Road"],
        zapdos: ["Power Plant", "Power Plant"],
        mewtwo: ["Cerulean City", "Cerulean Cave, near Cerulean City"],
        "persian-arcanine": ["Vermilion City", "Vermilion City"],
        "hitmonlee-hitmonchan": ["Saffron City", "Saffron City"],
        "omanyte-kabuto": ["Cinnabar Island", "Cinnabar Island"],
        bulbasaur: ["Cerulean City", "Cerulean City"],
        charmender: ["Route 24", "Route 24"],
        squirtle: ["Vermilion City", "Vermilion City"],
        lapras: ["Saffron City", "Silph Co., Saffron City"],
        magikarp: ["Route 4", "Route 4"],
        porygon: ["Saffron City", "Saffron City"],
        aerodactyl: ["Cinnabar Island", "Cinnabar Island"],
        "grimer-meowth": ["Cinnabar Island", "Cinnabar Island"],
        "sandshrew-vulpix": ["Celadon City", "Celadon City"],
        rattata: ["Cerulean City", "Cerulean City"],
        geodude: ["Vermilion City", "Vermilion City"],
        diglett: ["Lavender Town", "Lavender Town"],
        raichu: ["Saffron City", "Saffron City"],
        marowak: ["Fuchsia City", "Fuchsia City"],
        exeggutor: ["Indigo Plateau", "Indigo Plateau"],
        "shiny-charm": ["Celadon City", "Celadon Condominiums"],
        morimoto: ["Celadon City", "Celadon Condominiums"],
        red: ["Indigo Plateau", "Indigo Plateau"],
        "rematch-elitefour": ["Indigo Plateau", "Indigo Plateau"],
        archer: ["Celadon City", "Team Rocket Hideout, Celadon City"],
        "jessie-james": ["Route 17", "Route 17"],
        mina: ["Vermilion City", "Vermilion City"],
        green: ["Cerulean City", "Cerulean Cave, near Cerulean City"],
        "rematch-green": ["Cerulean City", "Cerulean City"],
      },
    },
    swordshield: {
      image: "maps/galar.png",
      title: "Galar",
      places: GALAR_PLACES,
      pins: {
        eternatus: ["Hammerlocke", "Energy Plant, Hammerlocke"],
        zacian: ["Hammerlocke", "Energy Plant, Hammerlocke"],
        zamazenta: ["Hammerlocke", "Energy Plant, Hammerlocke"],
        "gigantamax-pikachu-eevee": ["Meetup Spot", "Meetup Spot"],
        "gigantamax-pikachu": ["Meetup Spot", "Meetup Spot"],
        "gigantamax-eevee": ["Meetup Spot", "Meetup Spot"],
        charmander: ["Postwick", "Postwick"],
        toxel: ["Route 5", "Route 5"],
        typenull: ["Wyndon", "Battle Tower, Wyndon"],
        dino: ["Route 6", "Route 6"],
        "galarian-ponyta": ["Glimwood Tangle", "Glimwood Tangle"],
        "galarian-weezing": ["Slumbering Weald", "Slumbering Weald"],
        "galarian-zigzagoon": ["Route 2", "Routes 2 and 3"],
        "galarian-linoone": ["Giant's Cap", "Giant's Cap"],
        "galarian-farfetchd": ["Route 5", "Route 5"],
        "galarian-meowth": ["Route 4", "Route 4"],
        "galarian-stunfisk": ["Galar Mine No. 2", "Galar Mine No. 2"],
        "galarian-corsola": ["Giant's Mirror", "Giant's Mirror"],
        "galarian-yamask": ["Route 6", "Route 6"],
        "galarian-mrmime": ["Route 10", "Route 10"],
        "galarian-darumaka": ["Route 10", "Route 10"],
        "throh-sawk": ["Circhester", "Circhester"],
        "hatenna-impidimp": ["Stow-on-Side", "Stow-on-Side"],
        "kantonian-mrmime": ["Spikemuth", "Spikemuth"],
        "kantonian-meowth": ["Turffield", "Turffield"],
        yamask: ["Ballonlea", "Ballonlea"],
        cottonnee: ["Hulbury", "Hulbury"],
        skwovet: ["Motostoke", "Motostoke"],
        togepi: ["Hammerlocke", "Hammerlocke"],
        duraludon: ["Wyndon", "Wyndon"],
        "gigantamax-charizard": ["Lake of Outrage", "Lake of Outrage"],
        "gigantamax-butterfree": ["Rolling Fields", "Rolling Fields"],
        "gigantamax-meowth": ["Stony Wilderness", "Stony Wilderness"],
        "gigantamax-machamp": ["Stony Wilderness", "Stony Wilderness"],
        "gigantamax-gengar": ["Stony Wilderness", "Stony Wilderness"],
        "gigantamax-kingler": ["West Lake Axewell", "West Lake Axewell"],
        "gigantamax-lapras": ["Giant's Seat", "Giant's Seat"],
        "gigantamax-garbodor": ["East Lake Axewell", "East Lake Axewell"],
        "gigantamax-corviknight": ["Giant's Cap", "Giant's Cap"],
        "gigantamax-orbeetle": ["Bridge Field", "Bridge Field"],
        "gigantamax-drednaw": ["Giant's Cap", "Giant's Cap"],
        "gigantamax-coalossal": ["Giant's Seat", "Giant's Seat"],
        "gigantamax-flapple": ["Dappled Grove", "Dappled Grove"],
        "gigantamax-appletun": ["Dappled Grove", "Dappled Grove"],
        "gigantamax-sandaconda": ["Dusty Bowl", "Dusty Bowl"],
        "gigantamax-centiskorch": ["Stony Wilderness", "Stony Wilderness"],
        "gigantamax-hatterene": ["Bridge Field", "Bridge Field"],
        "gigantamax-grimsnarl": ["Dusty Bowl", "Dusty Bowl"],
        "gigantamax-alcremie": ["Bridge Field", "Bridge Field"],
        "gigantamax-copperajah": ["Stony Wilderness", "Stony Wilderness"],
        "gigantamax-duraludon": ["Giant's Seat", "Giant's Seat"],
        "shiny-charm": ["Circhester", "Hotel Ionia, Circhester"],
        "oval-charm": ["Circhester", "Hotel Ionia, Circhester"],
        "catching-charm": ["Circhester", "Hotel Ionia, Circhester"],
        "sidequest-minccino": ["Motostoke", "Motostoke"],
        "sidequest-letter": ["Hammerlocke", "Hammerlocke"],
        "sidequest-riddle": ["Turffield", "Turffield"],
        "sidequest-applinaway": ["Hammerlocke", "Hammerlocke"],
        "sidequest-fieryspirit": ["Ballonlea", "Ballonlea"],
        "currydex-goldenutensils": ["Hammerlocke Hills", "Camping Guru, Hammerlocke Hills"],
        "leaguecard-hop": ["Motostoke", "Motostoke"],
        "leaguecard-marnie": ["Ballonlea", "Ballonlea Stadium"],
        "leaguecard-milo": ["Turffield", "Turffield"],
        "leaguecard-nessa": ["Hulbury", "Hulbury"],
        "leaguecard-kabu": ["Motostoke", "Motostoke"],
        "leaguecard-bea": ["Stow-on-Side", "Stow-on-Side"],
        "leaguecard-allister": ["Stow-on-Side", "Stow-on-Side"],
        "leaguecard-opal": ["Route 6", "Route 6"],
        "leaguecard-hop-rare": ["Slumbering Weald", "Slumbering Weald"],
        "leaguecard-marnie-rare": ["Spikemuth", "Spikemuth"],
        "leaguecard-milo-rare": ["Turffield", "Turffield Stadium"],
        "leaguecard-nessa-rare": ["Hulbury", "Hulbury Stadium"],
        "leaguecard-kabu-rare": ["Motostoke", "Motostoke Stadium"],
        "leaguecard-bea-rare": ["Stow-on-Side", "Stow-on-Side Stadium"],
        "leaguecard-allister-rare": ["Stow-on-Side", "Stow-on-Side Stadium"],
        "leaguecard-opal-rare": ["Ballonlea", "Ballonlea Stadium"],
        "leaguecard-gordie": ["Circhester", "Circhester Stadium"],
        "leaguecard-melony": ["Circhester", "Circhester Stadium"],
        "leaguecard-piers": ["Spikemuth", "Spikemuth"],
        "leaguecard-raihan": ["Hammerlocke", "Hammerlocke"],
        "leaguecard-leon-rare": ["Motostoke", "Motostoke"],
        "leaguecard-ballguy": ["Motostoke", "Motostoke"],
        "leaguecard-gordie-rare": ["Circhester", "Circhester Stadium"],
        "leaguecard-melony-rare": ["Circhester", "Circhester Stadium"],
        "leaguecard-piers-rare": ["Wyndon", "Tower Summit, Wyndon"],
        "leaguecard-raihan-rare": ["Hammerlocke", "Hammerlocke Stadium"],
        "leaguecard-rose": ["Hulbury", "Hulbury"],
        "leaguecard-bede": ["Galar Mine No. 2", "Galar Mine No. 2"],
        "leaguecard-rose-rare": ["Galar Mine", "Galar Mine"],
        "leaguecard-bede-rare": ["Ballonlea", "Ballonlea Stadium"],
      },
    },
    brilliantdiamondshiningpearl: {
      image: "maps/sinnoh-bdsp.png",
      title: "Sinnoh",
      places: BDSP_PLACES,
      pins: {
        dialga: ["Mt. Coronet", "Spear Pillar, Mt. Coronet"],
        palkia: ["Mt. Coronet", "Spear Pillar, Mt. Coronet"],
        uxie: ["Lake Acuity", "Lake Acuity"],
        mesprit: ["Lake Verity", "Lake Verity"],
        azelf: ["Lake Valor", "Lake Valor"],
        heatran: ["Stark Mountain", "Stark Mountain"],
        regigigas: ["Snowpoint City", "Snowpoint Temple, Snowpoint City"],
        giratina: ["Route 214", "Turnback Cave, Route 214"],
        cresselia: ["Fullmoon Island", "Fullmoon Island"],
        shaymin: ["Flower Paradise", "Flower Paradise"],
        darkrai: ["Newmoon Island", "Newmoon Island"],
        mew: ["Floaroma Town", "Floaroma Town"],
        jirachi: ["Floaroma Town", "Floaroma Town"],
        happiny: ["Hearthome City", "Hearthome City"],
        riolu: ["Iron Island", "Iron Island"],
        eevee: ["Hearthome City", "Hearthome City"],
        "abra-machop": ["Oreburgh City", "Oreburgh City"],
        "chatot-buizel": ["Eterna City", "Eterna City"],
        "haunter-medicham": ["Snowpoint City", "Snowpoint City"],
        leaguechampion: ["Pokémon League", "Pokémon League"],
        friendshipchecker: ["Eterna City", "Pokémon Center, Eterna City"],
        eggmonitor: ["Solaceon Town", "Nursery, Solaceon Town"],
        pokemonhistory: ["Solaceon Town", "Solaceon Town"],
        counter: ["Veilstone City", "Department Store, Veilstone City"],
        analogwatch: ["Celestic Town", "Celestic Town"],
        markingmap: ["Jubilife City", "Jubilife City"],
        chaincounter: ["Ramanas Park", "Ramanas Park"],
        kitchentimer: ["Ramanas Park", "Ramanas Park"],
        colorchanger: ["Ramanas Park", "Ramanas Park"],
        cointoss: ["Lake Valor", "Hotel Grand Lake, Valor Lakefront"],
        calendar: ["Sunyshore City", "Sunyshore City"],
        dotartist: ["Sunyshore City", "Sunyshore City"],
        spinner: ["Sunyshore City", "Sunyshore City"],
        "shiny-charm": ["Lake Valor", "Valor Lakefront"],
        "oval-charm": ["Lake Valor", "Valor Lakefront"],
        "catching-charm": ["Lake Valor", "Hotel Grand Lake"],
        "soul-dew": ["Ramanas Park", "Ramanas Park"],
        "griseous-orb": ["Ramanas Park", "Ramanas Park"],
        "ds-sounds": ["Lake Valor", "Hotel Grand Lake"],
        pokeradar: ["Sandgem Town", "Sandgem Town"],
      },
    },
    scarletviolet: {
      image: "maps/paldea.png",
      title: "Paldea",
      places: PALDEA_PLACES,
      pins: {
        miraidon: ["Area Zero", "Area Zero"],
        koraidon: ["Area Zero", "Area Zero"],
        tinglu: ["Socarrat Trail", "Socarrat Trail, around Casseroya Lake. The stakes are spread around the lake, so this area is approximate"],
        chienpao: ["West Province", "West Province. The stakes are spread around the province, so this area is approximate"],
        wochien: ["South Province", "South Province. The stakes are spread around the province, so this area is approximate"],
        meowth: ["Mesagoza", "Naranja/Uva Academy, Mesagoza"],
        "shiny-charm": ["Mesagoza", "Biology Lab, Naranja/Uva Academy"],
      },
    },
    legendsarceus: {
      image: "maps/arceus-jubilife.png",
      title: "Jubilife Village",
      places: { "Galaxy Hall": { x: 51.1, y: 6.9, w: 6.8, h: 6.9 } },
      alt: {
        cobalt: { image: "maps/arceus-cobalt.png", title: "Cobalt Coastlands", places: { "Spring Path": { x: 15.5, y: 22.8, w: 6.8, h: 6.8 }, "Firespit Island": { x: 85.9, y: 14.8, w: 6.8, h: 6.8 } } },
        crimson: { image: "maps/arceus-crimson.png", title: "Crimson Mirelands", places: { "Lake Valor": { x: 74.0, y: 28.6, w: 6.8, h: 6.8 }, "Scarlet Bog": { x: 56.9, y: 59.5, w: 6.8, h: 6.8 } } },
        obsidian: {
          image: "maps/arceus-obsidian.png",
          title: "Obsidian Fieldlands",
          places: { "Lake Verity": { x: 10.7, y: 45.2, w: 6.8, h: 7.0 }, "Ramanas Island": { x: 29.5, y: 87.1, w: 6.8, h: 7.0 }, "Floaro Gardens": { x: 14.8, y: 16.9, w: 6.8, h: 7.0 } },
        },
        alabaster: {
          image: "maps/arceus-alabaster.png",
          title: "Alabaster Icelands",
          places: { "Lake Acuity": { x: 47.6, y: 11.8, w: 6.1, h: 6.1 }, "Snowpoint Temple": { x: 69.5, y: 4.0, w: 6.1, h: 6.1 }, "Bonechill Wastes": { x: 57.0, y: 67.3, w: 6.1, h: 6.1 } },
        },
        coronet: {
          image: "maps/arceus-coronet.png",
          title: "Coronet Highlands",
          places: { "Temple of Sinnoh": { x: 23.6, y: 17.4, w: 6.1, h: 6.8 }, "Moonview Arena": { x: 19.4, y: 46.3, w: 6.1, h: 6.8 }, "Clamberclaw Cliffs": { x: 69.1, y: 50.7, w: 6.1, h: 6.8 } },
        },
      },
      pins: {
        "shiny-charm": ["Galaxy Hall", "Galaxy Hall 1F, Jubilife Village"],
        dialga: ["Temple of Sinnoh", "Temple of Sinnoh", "coronet"],
        palkia: ["Temple of Sinnoh", "Temple of Sinnoh", "coronet"],
        arceus: ["Temple of Sinnoh", "Temple of Sinnoh", "coronet"],
        cressela: ["Moonview Arena", "Moonview Arena", "coronet"],
        darkrai: ["Clamberclaw Cliffs", "Clamberclaw Cliffs", "coronet"],
        uxie: ["Lake Acuity", "Lake Acuity", "alabaster"],
        regigigas: ["Snowpoint Temple", "Snowpoint Temple", "alabaster"],
        tornadus: ["Bonechill Wastes", "Bonechill Wastes", "alabaster"],
        mesprit: ["Lake Verity", "Lake Verity", "obsidian"],
        landorus: ["Ramanas Island", "Ramanas Island", "obsidian"],
        shaymin: ["Floaro Gardens", "Floaro Gardens", "obsidian"],
        azelf: ["Lake Valor", "Lake Valor", "crimson"],
        enamorus: ["Scarlet Bog", "Scarlet Bog", "crimson"],
        heatran: ["Firespit Island", "Firespit Island", "cobalt"],
        giratina: ["Spring Path", "Spring Path", "cobalt"],
      },
    },
    goldsilver: {
      image: "maps/johto-gsc.png",
      title: "Johto",
      places: GSC_JOHTO_PLACES,
      alt: { kanto: { image: "maps/kanto-gsc.png", title: "Kanto", places: GSC_KANTO_PLACES } },
      pins: {
        lugia: ["Whirl Islands", "Whirl Islands (with the Silver Wing)"],
        "ho-oh": ["Ecruteak City", "Tin Tower, Ecruteak City (with the Rainbow Wing)"],
        spearow: ["Route 35", "Route 35 south gate"],
        eevee: ["Goldenrod City", "Bill's house, Goldenrod City"],
        togepi: ["Violet City", "Pokémon Center, Violet City"],
        shuckle: ["Cianwood City", "Cianwood City"],
        tyrogue: ["Mt. Mortar", "Mt. Mortar, basement 1F"],
        "bellsprout-onix": ["Violet City", "House in Violet City"],
        "drowzee-machop": ["Goldenrod City", "Goldenrod Department Store"],
        "krabby-voltorb": ["Olivine City", "Olivine City"],
        "dragonair-rhydon": ["Blackthorn City", "Blackthorn City"],
        "gloom-rapidash": ["Pewter City", "Pewter City", "kanto"],
        "chansey-aerodactyl": ["Route 14", "Route 14", "kanto"],
        defeatred: ["Mt. Silver", "Mt. Silver, after getting all 16 badges"],
        a: ["Ruins of Alph", "Ruins of Alph, northeast chamber"],
        b: ["Ruins of Alph", "Ruins of Alph, northeast chamber"],
        c: ["Ruins of Alph", "Ruins of Alph, northeast chamber"],
        d: ["Ruins of Alph", "Ruins of Alph, northeast chamber"],
        e: ["Ruins of Alph", "Ruins of Alph, northeast chamber"],
        f: ["Ruins of Alph", "Ruins of Alph, northeast chamber"],
        g: ["Ruins of Alph", "Ruins of Alph, northeast chamber"],
        h: ["Ruins of Alph", "Ruins of Alph, northeast chamber"],
        i: ["Ruins of Alph", "Ruins of Alph, northeast chamber"],
        j: ["Ruins of Alph", "Ruins of Alph, northeast chamber"],
        k: ["Ruins of Alph", "Ruins of Alph, northeast chamber"],
        l: ["Ruins of Alph", "Ruins of Alph, southwest chamber"],
        m: ["Ruins of Alph", "Ruins of Alph, southwest chamber"],
        n: ["Ruins of Alph", "Ruins of Alph, southwest chamber"],
        o: ["Ruins of Alph", "Ruins of Alph, southwest chamber"],
        p: ["Ruins of Alph", "Ruins of Alph, southwest chamber"],
        q: ["Ruins of Alph", "Ruins of Alph, southwest chamber"],
        r: ["Ruins of Alph", "Ruins of Alph, southwest chamber"],
        s: ["Ruins of Alph", "Ruins of Alph, southeast chamber"],
        t: ["Ruins of Alph", "Ruins of Alph, southeast chamber"],
        u: ["Ruins of Alph", "Ruins of Alph, southeast chamber"],
        v: ["Ruins of Alph", "Ruins of Alph, southeast chamber"],
        w: ["Ruins of Alph", "Ruins of Alph, southeast chamber"],
        x: ["Ruins of Alph", "Ruins of Alph, northwest chamber"],
        y: ["Ruins of Alph", "Ruins of Alph, northwest chamber"],
        z: ["Ruins of Alph", "Ruins of Alph, northwest chamber"],
      },
    },
    crystal: {
      image: "maps/johto-gsc.png",
      title: "Johto",
      places: GSC_JOHTO_PLACES,
      alt: { kanto: { image: "maps/kanto-gsc.png", title: "Kanto", places: GSC_KANTO_PLACES } },
      pins: {
        lugia: ["Whirl Islands", "Whirl Islands (with the Silver Wing)"],
        "ho-oh": ["Ecruteak City", "Tin Tower, Ecruteak City (with the Rainbow Wing)"],
        spearow: ["Route 35", "Route 35 south gate"],
        eevee: ["Goldenrod City", "Bill's house, Goldenrod City"],
        togepi: ["Violet City", "Pokémon Center, Violet City"],
        shuckle: ["Cianwood City", "Cianwood City"],
        tyrogue: ["Mt. Mortar", "Mt. Mortar, basement 1F"],
        bellsprout: ["Violet City", "House in Violet City"],
        abra: ["Goldenrod City", "Goldenrod Department Store"],
        krabby: ["Olivine City", "Olivine City"],
        dragonair: ["Blackthorn City", "Blackthorn City"],
        dratini: ["Dragon's Den", "Dragon's Den, after Clair's test"],
        dugtrio: ["Power Plant", "Power Plant", "kanto"],
        haunter: ["Pewter City", "Pewter City", "kanto"],
        chansey: ["Route 14", "Route 14", "kanto"],
        defeatred: ["Mt. Silver", "Mt. Silver, after getting all 16 badges"],
        a: ["Ruins of Alph", "Ruins of Alph, northeast chamber"],
        b: ["Ruins of Alph", "Ruins of Alph, northeast chamber"],
        c: ["Ruins of Alph", "Ruins of Alph, northeast chamber"],
        d: ["Ruins of Alph", "Ruins of Alph, northeast chamber"],
        e: ["Ruins of Alph", "Ruins of Alph, northeast chamber"],
        f: ["Ruins of Alph", "Ruins of Alph, northeast chamber"],
        g: ["Ruins of Alph", "Ruins of Alph, northeast chamber"],
        h: ["Ruins of Alph", "Ruins of Alph, northeast chamber"],
        i: ["Ruins of Alph", "Ruins of Alph, northeast chamber"],
        j: ["Ruins of Alph", "Ruins of Alph, northeast chamber"],
        k: ["Ruins of Alph", "Ruins of Alph, northeast chamber"],
        l: ["Ruins of Alph", "Ruins of Alph, southwest chamber"],
        m: ["Ruins of Alph", "Ruins of Alph, southwest chamber"],
        n: ["Ruins of Alph", "Ruins of Alph, southwest chamber"],
        o: ["Ruins of Alph", "Ruins of Alph, southwest chamber"],
        p: ["Ruins of Alph", "Ruins of Alph, southwest chamber"],
        q: ["Ruins of Alph", "Ruins of Alph, southwest chamber"],
        r: ["Ruins of Alph", "Ruins of Alph, southwest chamber"],
        s: ["Ruins of Alph", "Ruins of Alph, southeast chamber"],
        t: ["Ruins of Alph", "Ruins of Alph, southeast chamber"],
        u: ["Ruins of Alph", "Ruins of Alph, southeast chamber"],
        v: ["Ruins of Alph", "Ruins of Alph, southeast chamber"],
        w: ["Ruins of Alph", "Ruins of Alph, southeast chamber"],
        x: ["Ruins of Alph", "Ruins of Alph, northwest chamber"],
        y: ["Ruins of Alph", "Ruins of Alph, northwest chamber"],
        z: ["Ruins of Alph", "Ruins of Alph, northwest chamber"],
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
    let pin = cfg && cfg.pins[id.replace(`${game}-checkbox-`, "")];
    let map = cfg;
    if (pin && Array.isArray(pin)) {
      if (pin[2] && cfg.alt && cfg.alt[pin[2]]) map = cfg.alt[pin[2]];
      pin = { ...map.places[pin[0]], place: pin[1] };
    }
    if (!pin) return "";
    return (
      `<h3>Map</h3><div class="pdex-map"><img alt="${map.title}" src="${map.image}" /><span class="pdex-blink" style="left:${pin.x}%;top:${pin.y}%;width:${pin.w || 5}%;${pin.h ? `height:${pin.h}%` : "aspect-ratio:1"}"></span></div>` +
      `<p class="pdex-map-note"><b>${pin.place}.</b><br />The flashing area shows where guides describe it, not an exact spot.</p>`
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
