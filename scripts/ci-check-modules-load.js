// Fails if any api/ or lib/ module throws just from being require()'d —
// catches syntax errors, typos in requires, etc. across files the smoke
// test doesn't directly exercise (e.g. lib/ics.js, api/admin-bookings.js
// module load, lib/store.js load without a database configured).
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIRS = ["api", "lib"];

let checked = 0;
let failed = false;

for (const dir of DIRS) {
  const dirPath = path.join(ROOT, dir);
  for (const file of fs.readdirSync(dirPath)) {
    if (!file.endsWith(".js")) continue;
    const full = path.join(dirPath, file);
    checked++;
    try {
      require(full);
    } catch (e) {
      console.error(`${dir}/${file}: threw on require() — ${e.message}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log(`OK — ${checked} modules in api/ and lib/ all load without error`);
}
