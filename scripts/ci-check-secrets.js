// Fails if any tracked file contains something that looks like a real API
// key/secret, or if a real dotenv file (.env, .env.local, etc.) is tracked.
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const files = execSync("git ls-files", { cwd: ROOT, encoding: "utf-8" }).trim().split("\n").filter(Boolean);

const SECRET_PATTERNS = [
  [/re_[A-Za-z0-9]{20,}/, "Resend API key"],
  [/sk_live_[A-Za-z0-9]{10,}/, "Stripe live secret key"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key ID"],
  [/-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----/, "private key block"],
];

let failed = false;

for (const rel of files) {
  if (/^\.env(\..*)?$/.test(path.basename(rel)) && rel !== ".env.example") {
    console.error(`Tracked dotenv file with real values should never be committed: ${rel}`);
    failed = true;
    continue;
  }
  const filePath = path.join(ROOT, rel);
  let content;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    continue; // binary or unreadable — skip
  }
  for (const [pattern, label] of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      console.error(`${rel}: looks like it contains a ${label}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log(`OK — ${files.length} tracked files scanned, no secrets or real dotenv files found`);
}
