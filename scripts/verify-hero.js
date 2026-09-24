const { chromium } = require("playwright-core");
const path = require("path");

const EXE = "C:\\Users\\Akonisaho\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const OUT = path.join(__dirname, "shots");
require("fs").mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const page = await browser.newPage();

  // Scenario A: direct file:// open (double-click equivalent)
  const fileUrl = "file:///" + path.join(__dirname, "..", "index.html").replace(/\\/g, "/");
  await page.goto(fileUrl, { waitUntil: "load" });
  await page.waitForTimeout(500);
  const heroBgFile = await page.$eval(".hero-media", (el) => getComputedStyle(el).backgroundImage);
  console.log("FILE_PROTOCOL hero-media background-image:", heroBgFile);
  await page.screenshot({ path: path.join(OUT, "verify-file.png") });

  // Scenario B: via local http server
  await page.goto("http://localhost:5500/", { waitUntil: "load" });
  await page.waitForTimeout(500);
  const heroBgHttp = await page.$eval(".hero-media", (el) => getComputedStyle(el).backgroundImage);
  console.log("HTTP hero-media background-image:", heroBgHttp);
  await page.screenshot({ path: path.join(OUT, "verify-http.png") });

  await page.goto("http://localhost:5500/services.html", { waitUntil: "load" });
  await page.waitForTimeout(500);
  const pageHeroBg = await page.$eval(".page-hero-media", (el) => getComputedStyle(el).backgroundImage);
  console.log("HTTP services page-hero-media background-image:", pageHeroBg);
  await page.screenshot({ path: path.join(OUT, "verify-services.png") });

  await browser.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
