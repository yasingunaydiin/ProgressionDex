<img width="128px" src="images/icons/ProgressionDex_logo.png" alt="Logo" align="left" />

# Progression Dex

A tool for tracking your 100% progress in Pokemon games. Pick a game, tick things off, and watch the progress bar fill.

## Features

- Checklists for 25 mainline and spin-off games (Red/Blue through Scarlet/Violet, plus Pokemon Home)
- Progress bar per game, struck-through sections once complete, confetti at 100%
- In Progress / Completed badges and filters on the game list
- Progress is saved in your browser (`localStorage`) - no account needed
- **Export / Import** buttons (bottom-right) back your progress up to a JSON file, so clearing browser data or switching devices doesn't lose it

## Screenshots

<img width="1920px" src="images/screenshots/index_screenshot.png" alt="screenshot" align="left" />

<img width="1920px" src="images/screenshots/list_screenshot.png" alt="screenshot" align="left" />

<img width="1920px" src="images/screenshots/game_screenshot.png" alt="screenshot" align="left" />

## Development

It is a static site; there is no server code. Serve the repo root with any static file server (for example `python3 -m http.server`) and open `index.html`.

```sh
npm install
npm run dev     # rebuild output.css (Tailwind + DaisyUI) on change
npm run build   # one-off minified build of output.css (commit the result)
npm run check   # validate checkbox ids, label links and local file references
npm run format  # prettier
```

### Layout

- `index.html`, `list/` - landing page and game picker
- `checklists/<game>.html` - one page per game; each checkbox needs a unique id of the form `<game>-checkbox-<name>`
- `checklists/js/script.js` - shared behaviour (persistence, progress, theme switching); `backup.js` - export/import
- `checklists/css/base.css` + `<game>.css` - shared and per-game styles
- Games with two versions switch theme by clicking a logo: give the `<img>` `data-theme-color` and `data-theme-pattern` attributes

Not affiliated with Nintendo, Game Freak or The Pokemon Company.
