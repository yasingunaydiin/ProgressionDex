// Shared behaviour for every checklist page.
//  - saves/restores checkbox state in localStorage (key = checkbox id)
//  - progress bar, struck-through section titles, confetti on 100%
//  - collapsible panels and game-theme switching (via data attributes)
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

  onReady(() => {
    const checkboxes = [...document.querySelectorAll('input[type="checkbox"]')];
    const progressBar = document.getElementById("progressBar");

    // Each ".checkbox-item > .title" heads a section; the section is its parent container.
    const sections = [...document.querySelectorAll(".checkbox-item > .title")]
      .map((title) => {
        const container = title.parentElement.parentElement;
        return { label: title.querySelector("label"), boxes: [...container.querySelectorAll('input[type="checkbox"]')] };
      })
      .filter((s) => s.label && s.boxes.length);

    function refresh() {
      if (progressBar && checkboxes.length) {
        const done = checkboxes.filter((c) => c.checked).length;
        progressBar.style.width = `${(done / checkboxes.length) * 100}%`;
      }
      sections.forEach(({ label, boxes }) => {
        label.style.textDecoration = boxes.every((c) => c.checked) ? "line-through" : "none";
      });
    }

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

    // Collapsible panels (TM/TR lists etc.)
    document.querySelectorAll(".collapsible").forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.classList.toggle("active");
        const content = btn.nextElementSibling;
        if (content) content.style.display = content.style.display === "block" ? "none" : "block";
      });
    });

    // Game theme switching: <img data-theme-color="#fff" data-theme-pattern="pattern-x.png" [data-theme-icon="..."]>
    const themed = document.querySelectorAll("[data-theme-color]");
    themed.forEach((logo) => {
      logo.addEventListener("click", () => {
        const color = logo.dataset.themeColor;
        document.querySelector(".title")?.style.setProperty("color", color);
        const footer = document.querySelector("footer");
        if (footer) footer.style.background = color;
        document.body.style.backgroundImage = `url(../images/patterns/${logo.dataset.themePattern})`;
        document.querySelectorAll(".panel-label").forEach((el) => (el.style.color = color));
        document.querySelectorAll(".wide-panel").forEach((el) => (el.style.border = `2px solid ${color}`));
        const icon = document.getElementById("professorIcons");
        if (icon && logo.dataset.themeIcon) icon.src = logo.dataset.themeIcon;
      });
    });
  });
})();
