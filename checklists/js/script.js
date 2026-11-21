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

  onReady(() => {
    const checkboxes = [...document.querySelectorAll('input[type="checkbox"]')];
    const page = document.querySelector(".page-container");
    const progressBar = document.getElementById("progressBar");
    const game = page?.dataset.game;

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
      s.head.insertAdjacentHTML("beforeend", `<span class="count"><span class="num"></span><span class="meter"><i></i></span></span>${CHEVRON}`);
      s.num = s.head.querySelector(".num");
      s.fill = s.head.querySelector(".meter i");
      s.head.addEventListener("click", () => s.el.classList.toggle("is-collapsed"));
    });

    // ---------- toolbar ----------
    let summaryStrong, summarySmall;
    if (page) {
      const toolbar = document.createElement("div");
      toolbar.className = "toolbar";
      toolbar.innerHTML = `
        <div class="summary"><strong></strong><small></small></div>
        <input type="search" placeholder="Search this game..." aria-label="Search checklist" />
        <button type="button" data-action="hide-done" aria-pressed="false">Hide collected</button>
        <button type="button" data-action="collapse">Collapse all</button>
        <span class="toolbar-extra" style="display: contents"></span>`;
      page.prepend(toolbar);
      summaryStrong = toolbar.querySelector("strong");
      summarySmall = toolbar.querySelector("small");

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
          const text = item.textContent.toLowerCase() + " " + (item.querySelector("label")?.dataset.tip || "").toLowerCase();
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
        summaryStrong.textContent = `${done} / ${total} collected`;
        summarySmall.textContent = `${Math.round(pct)}% complete`;
      }
      // Summary read by the game list page to show In Progress / Completed badges.
      if (game && total) storage.set(`pdex-summary-${game}`, JSON.stringify({ done, total }));

      sections.forEach((s) => {
        const d = s.boxes.filter((c) => c.checked).length;
        s.num.textContent = `${d}/${s.boxes.length}`;
        s.fill.style.width = `${(d / s.boxes.length) * 100}%`;
        s.el.classList.toggle("is-complete", d === s.boxes.length);
      });
    }

    // ---------- checkboxes ----------
    checkboxes.forEach((box) => {
      if (box.id) box.checked = storage.get(box.id) === "true";
      box.addEventListener("change", () => {
        if (box.id) storage.set(box.id, box.checked);
        refresh();
        const items = checkboxes.filter((c) => c.closest(".checkbox-item"));
        if (box.checked && items.length && items.every((c) => c.checked) && typeof confetti === "function") confetti();
      });
    });
    refresh();

    // Clicking anywhere on a tile (not just the label) toggles it.
    document.addEventListener("click", (e) => {
      const item = e.target.closest(".checkbox-item");
      if (!item || e.target.closest("label, input, .section-head")) return;
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
