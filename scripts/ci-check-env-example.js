// Fails if .env.example is missing or someone accidentally deleted one of
// the required variable names it's supposed to document.
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", ".env.example");
const REQUIRED_KEYS = ["RESEND_API_KEY", "ADMIN_KEY"];

if (!fs.existsSync(filePath)) {
  console.error(".env.example is missing");
  process.exit(1);
}

const content = fs.readFileSync(filePath, "utf-8");
let failed = false;

for (const key of REQUIRED_KEYS) {
  if (!new RegExp(`^${key}=`, "m").test(content)) {
    console.error(`.env.example is missing the "${key}" entry`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log(`OK — .env.example documents all ${REQUIRED_KEYS.length} required variables`);
}
