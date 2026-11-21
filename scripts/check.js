// Sanity checks for the static pages: unique checkbox ids, label/for pairing, local file references.
// Run with: npm run check
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const pages = [
  "index.html",
  "404/index.html",
  "list/index.html",
  ...fs
    .readdirSync(path.join(root, "checklists"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => `checklists/${f}`),
];

let errors = 0;
const fail = (page, msg) => {
  errors++;
  console.error(`${page}: ${msg}`);
};

for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  const dir = path.dirname(path.join(root, page));

  const ids = [...html.matchAll(/<input\b[^>]*\bid="([^"]+)"[^>]*type="checkbox"|<input\b[^>]*type="checkbox"[^>]*\bid="([^"]+)"/g)].map((m) => m[1] || m[2]);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) fail(page, `duplicate checkbox id "${id}"`);
    seen.add(id);
  }
  for (const [, target] of html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)) {
    if (!seen.has(target)) fail(page, `label for="${target}" has no matching checkbox`);
  }

  for (const [, ref] of html.matchAll(/\b(?:src|href|data-theme-icon)="([^"#?]+)"/g)) {
    if (/^(https?:|mailto:|data:|\/\/)/.test(ref) || !/\.(png|webp|gif|avif|ico|css|js|html)$/.test(ref)) continue;
    if (!fs.existsSync(path.resolve(dir, ref))) fail(page, `missing file "${ref}"`);
  }
  for (const [, pattern] of html.matchAll(/data-theme-pattern="([^"]+)"/g)) {
    if (!fs.existsSync(path.join(root, "images/patterns", pattern))) fail(page, `missing pattern "${pattern}"`);
  }
}

console.log(`${pages.length} pages checked, ${errors} problem(s)`);
process.exit(errors ? 1 : 0);
