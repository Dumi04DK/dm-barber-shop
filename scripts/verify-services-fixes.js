const { chromium } = require("playwright-core");
const path = require("path");
const EXE = "C:\\Users\\Akonisaho\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const OUT = path.join(__dirname, "shots");
require("fs").mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  await page.goto("http://localhost:5509/services.html", { waitUntil: "load" });
  await page.addStyleTag({ content: ".modal-overlay{display:none!important;}" });
  const hairGrid = await page.$(".section:not(.section--dark) .grid-4");
  await hairGrid.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const box = await hairGrid.boundingBox();
  await page.screenshot({ path: path.join(OUT, "hair-grid.png"), clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 } });
  await browser.close();
})();
