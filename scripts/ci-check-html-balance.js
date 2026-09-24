// Fails if any tracked HTML page has mismatched open/close tag counts for
// the structural elements that matter most (a stray unclosed <div> or
// <section> silently breaks layout for everything after it).
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PAGES = ["index.html", "services.html", "about.html", "contact.html", "terms.html", "404.html", "admin.html"];
const TAGS = ["section", "div", "header", "footer", "form", "table"];

let failed = false;

for (const page of PAGES) {
  const filePath = path.join(ROOT, page);
  if (!fs.existsSync(filePath)) {
    console.error(`MISSING PAGE: ${page}`);
    failed = true;
    continue;
  }
  const html = fs.readFileSync(filePath, "utf-8");
  for (const tag of TAGS) {
    const openCount = (html.match(new RegExp(`<${tag}[ >]`, "g")) || []).length;
    const closeCount = (html.match(new RegExp(`</${tag}>`, "g")) || []).length;
    if (openCount !== closeCount) {
      console.error(`${page}: <${tag}> mismatch — ${openCount} opened, ${closeCount} closed`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log(`OK — ${PAGES.length} pages, tags balanced: ${TAGS.join(", ")}`);
}
