// Fails if any internal href="*.html" (optionally with a #fragment) points
// to a page that doesn't exist in the repo.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));

let failed = false;
let checked = 0;

for (const page of PAGES) {
  const html = fs.readFileSync(path.join(ROOT, page), "utf-8");
  const matches = html.matchAll(/href="([^"]+\.html)(#[^"]*)?"/g);
  for (const m of matches) {
    const target = m[1];
    checked++;
    if (!fs.existsSync(path.join(ROOT, target))) {
      console.error(`${page}: broken link to "${target}"`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log(`OK — ${checked} internal links checked across ${PAGES.length} pages, all resolve`);
}
