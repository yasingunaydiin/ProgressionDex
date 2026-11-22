// Optional sign-in + cross-device sync. Everything stays local-first: checkboxes always live in localStorage,
// and when someone is signed in the same data is mirrored to Supabase (table "progress").
(function () {
  "use strict";
  var cfg = window.PDEX_CONFIG || {};
  var enabled = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  var SDK = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.min.js";

  var client = null;
  var session = null;
  var state = "out"; // out | syncing | synced | error
  var buttons = [];
  var dialog = null;
  var timers = {};
  var lastSync = 0;

  function get(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function put(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {
      /* ignore */
    }
  }

  // ---------- local data ----------
  function localKeys(game) {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k.indexOf(game + "-checkbox-") === 0) out.push(k);
      }
    } catch (e) {
      /* ignore */
    }
    return out;
  }
  function localChecked(game) {
    return localKeys(game).filter(function (k) {
      return get(k) === "true";
    });
  }
  function localGames() {
    var seen = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var m = /^([a-z0-9]+)-checkbox-/.exec(localStorage.key(i));
        if (m) seen[m[1]] = true;
      }
    } catch (e) {
      /* ignore */
    }
    return Object.keys(seen);
  }
  function summaryOf(game) {
    try {
      return JSON.parse(get("pdex-summary-" + game)) || null;
    } catch (e) {
      return null;
    }
  }
  function applyLocal(game, checked, mod, total) {
    var want = {};
    checked.forEach(function (id) {
      want[id] = true;
    });
    localKeys(game).forEach(function (k) {
      if (!want[k]) put(k, "false");
    });
    checked.forEach(function (id) {
      put(id, "true");
    });
    put("pdex-mod-" + game, String(mod));
    var prev = summaryOf(game);
    var t = total || (prev && prev.total) || 0;
    if (t) put("pdex-summary-" + game, JSON.stringify({ done: checked.length, total: t }));
  }

  // ---------- server sync ----------
  function setState(s) {
    state = s;
    buttons.forEach(paint);
    if (dialog && dialog.open) renderDialog();
  }

  function push(game, checkedOverride) {
    var checked = checkedOverride || localChecked(game);
    var sum = summaryOf(game);
    var mod = Number(get("pdex-mod-" + game)) || Date.now();
    return client.from("progress").upsert({ user_id: session.user.id, game: game, checked: checked, done: checked.length, total: (sum && sum.total) || 0, modified_at: mod }, { onConflict: "user_id,game" });
  }

  function syncAll() {
    if (!client || !session) return Promise.resolve([]);
    lastSync = Date.now();
    setState("syncing");
    return client
      .from("progress")
      .select("game,checked,total,modified_at")
      .then(function (res) {
        if (res.error) throw res.error;
        var server = {};
        res.data.forEach(function (r) {
          server[r.game] = r;
        });
        var games = {};
        Object.keys(server).forEach(function (g) {
          games[g] = true;
        });
        localGames().forEach(function (g) {
          games[g] = true;
        });
        var changed = [];
        var jobs = [];
        Object.keys(games).forEach(function (g) {
          var s = server[g];
          var lmod = Number(get("pdex-mod-" + g)) || 0;
          var lchecked = localChecked(g);
          if (!s) {
            if (lchecked.length) {
              if (!lmod) put("pdex-mod-" + g, String(Date.now()));
              jobs.push(push(g));
            }
          } else if (!lmod) {
            // first time this browser meets the account: keep everything ticked on either side
            var union = {};
            s.checked.concat(lchecked).forEach(function (id) {
              union[id] = true;
            });
            var merged = Object.keys(union);
            var now = Date.now();
            var localChanged = merged.length !== lchecked.length;
            applyLocal(g, merged, now, s.total);
            if (localChanged) changed.push(g);
            if (merged.length !== s.checked.length) jobs.push(push(g, merged));
            else put("pdex-mod-" + g, String(s.modified_at));
          } else if (s.modified_at > lmod) {
            applyLocal(g, s.checked, s.modified_at, s.total);
            changed.push(g);
          } else if (lmod > s.modified_at) {
            jobs.push(push(g));
          }
        });
        return Promise.all(jobs).then(function (results) {
          results.forEach(function (r) {
            if (r && r.error) throw r.error;
          });
          return changed;
        });
      })
      .then(function (changed) {
        setState("synced");
        if (changed.length) document.dispatchEvent(new CustomEvent("pdex-synced", { detail: { games: changed } }));
        return changed;
      })
      .catch(function () {
        setState("error");
        return [];
      });
  }

  // called by checklist pages whenever a box changes
  function changed(game) {
    if (!game) return;
    put("pdex-mod-" + game, String(Date.now()));
    if (!client || !session) return;
    clearTimeout(timers[game]);
    setState("syncing");
    timers[game] = setTimeout(function () {
      push(game).then(function (r) {
        setState(r && r.error ? "error" : "synced");
      });
    }, 700);
  }

  // ---------- account button ----------
  var USER = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
  function paint(b) {
    if (session && session.user && session.user.email) {
      b.textContent = session.user.email.charAt(0).toUpperCase();
      b.style.fontWeight = "800";
      b.style.fontSize = "0.85rem";
      b.title = state === "synced" ? "Signed in - synced" : state === "syncing" ? "Signed in - syncing..." : state === "error" ? "Signed in - sync problem, will retry" : "Signed in";
    } else {
      b.innerHTML = USER;
      b.title = "Sign in to sync your progress";
    }
    b.setAttribute("aria-label", session ? "Account" : "Sign in");
    b.setAttribute("data-state", session ? state : "out");
  }

  function button() {
    if (!enabled) return document.createDocumentFragment();
    var b = document.createElement("button");
    b.type = "button";
    b.className = "theme-btn pdex-account";
    b.addEventListener("click", openDialog);
    buttons.push(b);
    paint(b);
    return b;
  }

  // ---------- dialog ----------
  var view = "signin"; // signin | signup | reset | recovery | account
  var message = "";
  var busy = false;

  function injectStyle() {
    if (document.getElementById("pdex-auth-style")) return;
    var s = document.createElement("style");
    s.id = "pdex-auth-style";
    s.textContent =
      ".pdex-account{position:relative}" +
      ".pdex-account[data-state=synced]::after,.pdex-account[data-state=syncing]::after,.pdex-account[data-state=error]::after{content:'';position:absolute;top:1px;right:1px;width:9px;height:9px;border-radius:50%;border:2px solid var(--card,var(--bg,#fff));background:#2ecf9c}" +
      ".pdex-account[data-state=syncing]::after{background:#f5a524}.pdex-account[data-state=error]::after{background:#e5484d}" +
      ".pdex-dialog{border:1px solid var(--line-strong,rgba(128,128,128,.5));border-radius:18px;padding:0;background:var(--card,var(--bg,#fff));color:var(--text,var(--fg,#111));width:min(380px,calc(100% - 32px));box-shadow:0 24px 60px rgba(0,0,0,.5);font:15px/1.5 system-ui,sans-serif}" +
      ".pdex-dialog::backdrop{background:rgba(0,0,0,.6)}" +
      ".pdex-dialog form{display:grid;gap:12px;padding:22px}" +
      ".pdex-dialog h2{margin:0;font-size:1.25rem}" +
      ".pdex-dialog p{margin:0;font-size:.88rem;opacity:.8}" +
      ".pdex-dialog input{padding:10px 12px;border-radius:10px;border:1px solid var(--line-strong,rgba(128,128,128,.5));background:transparent;color:inherit;font:inherit}" +
      ".pdex-dialog input:focus-visible,.pdex-dialog button:focus-visible{outline:2px solid var(--accent,#4f6bed);outline-offset:2px}" +
      ".pdex-dialog .pdex-row{display:flex;gap:8px;flex-wrap:wrap}" +
      ".pdex-dialog button{padding:10px 14px;border-radius:10px;border:1px solid var(--line-strong,rgba(128,128,128,.5));background:transparent;color:inherit;font:600 .9rem system-ui,sans-serif;cursor:pointer}" +
      ".pdex-dialog button.pdex-primary{background:var(--accent,#4f6bed);border-color:var(--accent,#4f6bed);color:#fff}" +
      ".pdex-dialog button.pdex-link{border:0;padding:2px 0;opacity:.8;text-decoration:underline;font-weight:500}" +
      ".pdex-dialog .pdex-msg{min-height:1.2em;font-size:.85rem;color:#e5484d}.pdex-dialog .pdex-msg.pdex-ok{color:#2ecf9c}";
    document.head.appendChild(s);
  }

  function openDialog() {
    injectStyle();
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "pdex-dialog";
      dialog.addEventListener("click", function (e) {
        if (e.target === dialog) dialog.close();
      });
      document.body.appendChild(dialog);
    }
    view = session ? "account" : "signin";
    message = "";
    renderDialog();
    if (!dialog.open) dialog.showModal();
  }

  function renderDialog() {
    var html = "";
    var email = session && session.user ? session.user.email : "";
    if (view === "account") {
      html =
        "<h2>Your account</h2><p>Signed in as <b>" +
        esc(email) +
        "</b>.</p>" +
        "<p>" +
        (state === "syncing" ? "Syncing..." : state === "error" ? "Last sync failed. It will retry on your next change." : "Your progress is synced on every device you sign in on.") +
        "</p>" +
        "<div class='pdex-msg pdex-ok' data-msg>" +
        esc(message) +
        "</div>" +
        "<div class='pdex-row'>" +
        (state === "error" ? "<button type='button' class='pdex-primary' data-act='sync'>Try again</button>" : "") +
        "<button type='button' data-act='signout'>Sign out</button><button type='button' data-act='close'>Close</button></div>";
    } else if (view === "recovery") {
      html =
        "<h2>Choose a new password</h2><input type='password' name='password' placeholder='New password (6+ characters)' minlength='6' required autocomplete='new-password' />" +
        "<div class='pdex-msg' data-msg>" +
        esc(message) +
        "</div><div class='pdex-row'><button class='pdex-primary' type='submit'>Save password</button></div>";
    } else if (view === "reset") {
      html =
        "<h2>Reset password</h2><p>We will email you a link to choose a new one.</p><input type='email' name='email' placeholder='Email' required autocomplete='email' />" +
        "<div class='pdex-msg' data-msg>" +
        esc(message) +
        "</div><div class='pdex-row'><button class='pdex-primary' type='submit'>Send link</button><button type='button' data-act='signin'>Back</button></div>";
    } else {
      var up = view === "signup";
      html =
        "<h2>" +
        (up ? "Create an account" : "Sign in") +
        "</h2>" +
        "<p>Optional. Without an account your progress simply stays in this browser. With one it follows you between devices.</p>" +
        "<input type='email' name='email' placeholder='Email' required autocomplete='email' />" +
        "<input type='password' name='password' placeholder='Password" +
        (up ? " (6+ characters)" : "") +
        "' minlength='6' required autocomplete='" +
        (up ? "new-password" : "current-password") +
        "' />" +
        "<div class='pdex-msg' data-msg>" +
        esc(message) +
        "</div>" +
        "<div class='pdex-row'><button class='pdex-primary' type='submit'" +
        (busy ? " disabled" : "") +
        ">" +
        (up ? "Create account" : "Sign in") +
        "</button><button type='button' data-act='close'>Not now</button></div>" +
        "<div class='pdex-row'><button type='button' class='pdex-link' data-act='" +
        (up ? "signin" : "signup") +
        "'>" +
        (up ? "I already have an account" : "Create an account") +
        "</button>" +
        (up ? "" : "<button type='button' class='pdex-link' data-act='reset'>Forgot password?</button>") +
        "</div>";
    }
    dialog.innerHTML = "<form>" + html + "</form>";
    var form = dialog.querySelector("form");
    form.addEventListener("submit", onSubmit);
    form.addEventListener("click", function (e) {
      var act = e.target.getAttribute && e.target.getAttribute("data-act");
      if (!act) return;
      e.preventDefault();
      if (act === "close") dialog.close();
      else if (act === "sync")
        syncAll().then(function (ch) {
          message = ch.length ? "Synced. Updated " + ch.length + " game(s) from your account." : "Everything is up to date.";
          renderDialog();
        });
      else if (act === "signout")
        client.auth.signOut().then(function () {
          dialog.close();
        });
      else {
        view = act;
        message = "";
        renderDialog();
      }
    });
  }

  function esc(t) {
    return String(t || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function onSubmit(e) {
    e.preventDefault();
    if (busy || !client) return;
    var f = new FormData(e.target);
    var email = f.get("email");
    var password = f.get("password");
    busy = true;
    var p;
    if (view === "signup") {
      p = client.auth.signUp({ email: email, password: password, options: { emailRedirectTo: location.origin + location.pathname } }).then(function (r) {
        if (r.error) throw r.error;
        if (!r.data.session) {
          message = "Check your email to confirm your account, then sign in.";
          view = "signin";
        } else dialog.close();
      });
    } else if (view === "reset") {
      p = client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }).then(function (r) {
        if (r.error) throw r.error;
        message = "Check your email for the reset link.";
        view = "signin";
      });
    } else if (view === "recovery") {
      p = client.auth.updateUser({ password: password }).then(function (r) {
        if (r.error) throw r.error;
        dialog.close();
      });
    } else {
      p = client.auth.signInWithPassword({ email: email, password: password }).then(function (r) {
        if (r.error) throw r.error;
        dialog.close();
      });
    }
    p.catch(function (err) {
      message = err && err.message ? err.message : "Something went wrong.";
    }).then(function () {
      busy = false;
      if (dialog.open) renderDialog();
    });
  }

  // ---------- start ----------
  function start() {
    var s = document.createElement("script");
    s.src = SDK;
    s.onload = function () {
      client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      client.auth.onAuthStateChange(function (event, sess) {
        var had = !!session;
        session = sess;
        buttons.forEach(paint);
        if (event === "PASSWORD_RECOVERY") {
          injectStyle();
          openDialog();
          view = "recovery";
          renderDialog();
        } else if (sess && !had) {
          // defer: do not call back into supabase from inside its auth callback
          setTimeout(syncAll, 0);
        } else if (!sess) {
          setState("out");
        }
      });
      client.auth.getSession().then(function (r) {
        if (r.data && r.data.session && !session) {
          session = r.data.session;
          buttons.forEach(paint);
          syncAll();
        }
      });
    };
    s.onerror = function () {
      setState("out");
    };
    document.head.appendChild(s);
  }

  // pick up changes made on another device when this tab comes back or the connection returns
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && session && Date.now() - lastSync > 30000) syncAll();
  });
  window.addEventListener("online", function () {
    if (session) syncAll();
  });

  window.pdexAuth = { enabled: enabled, button: button };
  window.pdexSync = { changed: changed, syncAll: syncAll };
  if (enabled) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  }
})();
