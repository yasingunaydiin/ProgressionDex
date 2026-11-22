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
        b.textContent = dark ? "☀ Light mode" : "☾ Dark mode";
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
