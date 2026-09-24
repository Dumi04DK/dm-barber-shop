// Fails if any referenced image under assets/images/ (from an <img src>, a
// CSS/inline url(), or a data record like lib/data.js barber photos) doesn't
// actually exist in the repo. This is exactly the class of bug that shipped
// the hero-image CSS regression earlier in this project.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SCAN_GLOBS = [
  ...fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")),
  "css/style.css",
  "js/booking.js",
  "js/admin.js",
  "js/main.js",
  "lib/data.js",
];

const PATTERN = /assets\/images\/[A-Za-z0-9_\-.]+\.(?:png|jpg|jpeg|svg|ico)/g;

let failed = false;
let checked = 0;
const seen = new Set();

for (const rel of SCAN_GLOBS) {
  const filePath = path.join(ROOT, rel);
  if (!fs.existsSync(filePath)) continue;
  const content = fs.readFileSync(filePath, "utf-8");
  const matches = content.match(PATTERN) || [];
  for (const ref of matches) {
    if (seen.has(ref)) continue;
    seen.add(ref);
    checked++;
    if (!fs.existsSync(path.join(ROOT, ref))) {
      console.error(`${rel}: references missing image "${ref}"`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log(`OK — ${checked} distinct image references checked, all exist`);
}
