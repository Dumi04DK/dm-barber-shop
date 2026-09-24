const { chromium } = require("playwright-core");
const path = require("path");

const EXE = "C:\\Users\\Akonisaho\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const OUT = path.join(__dirname, "shots");
require("fs").mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  // Re-verify home hero over http one more time post-restart
  await page.goto("http://localhost:5500/", { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT, "home-final.png") });

  // Admin: wrong key
  await page.goto("http://localhost:5500/admin.html", { waitUntil: "networkidle" });
  await page.fill("#admin-key-input", "wrongkey");
  await page.click("#admin-signin");
  await page.waitForTimeout(500);
  console.log("GATE_ERROR_VISIBLE:", await page.isVisible("#admin-gate-error"));
  await page.screenshot({ path: path.join(OUT, "admin-wrong-key.png") });

  // Admin: correct key
  await page.fill("#admin-key-input", "localtest");
  await page.click("#admin-signin");
  await page.waitForTimeout(700);
  console.log("APP_VISIBLE:", await page.isVisible("#admin-app"));
  await page.screenshot({ path: path.join(OUT, "admin-signed-in.png"), fullPage: true });

  console.log("CONSOLE_ERRORS:", JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
