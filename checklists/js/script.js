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
  const MAP_GAMES = { goldsilver: JOHTO_LINK, crystal: JOHTO_LINK, redblue: KANTO_LINK, emerald: HOENN_LINK, rubysapphire: HOENN_LINK, yellow: KANTO_LINK, fireredleafgreen: KANTO_LINK };

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
