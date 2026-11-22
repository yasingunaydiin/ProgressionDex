// Light/dark preference shared by every page. Load it in <head> so the theme is set before first paint.
(function () {
  var KEY = "pdex-theme";
  var root = document.documentElement;
  try {
    var saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);
  } catch (e) {
    /* storage unavailable: fall back to the page default */
  }

  var ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var SUN = ICON + '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON = ICON + '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  window.pdexTheme = {
    // def: what the page shows when nothing is saved ("dark" for the menu pages, system setting for checklists)
    current: function (def) {
      var t = root.getAttribute("data-theme");
      if (t) return t;
      return def || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    },
    set: function (t) {
      root.setAttribute("data-theme", t);
      try {
        localStorage.setItem(KEY, t);
      } catch (e) {
        /* ignore */
      }
      document.dispatchEvent(new Event("pdex-theme"));
    },
    button: function (def) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "theme-btn";
      var self = this;
      function update() {
        var dark = self.current(def) === "dark";
        b.innerHTML = dark ? SUN : MOON; // shows the mode you would switch to
        b.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
      }
      update();
      b.addEventListener("click", function () {
        self.set(self.current(def) === "dark" ? "light" : "dark");
      });
      document.addEventListener("pdex-theme", update);
      return b;
    },
  };
})();
