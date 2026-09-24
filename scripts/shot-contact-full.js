const { chromium } = require("playwright-core");
const path = require("path");
const EXE = "C:\\Users\\Akonisaho\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const OUT = path.join(__dirname, "shots");
require("fs").mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
  await page.goto("http://localhost:5511/contact.html", { waitUntil: "load" });
  await page.addStyleTag({ content: ".modal-overlay{display:none!important;}" });
  await page.click("#service-options .option-card[data-id='skin-fade']");
  await page.click("#barber-options .option-card[data-id='duma']");
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() + 1);
  await page.fill("#booking-date", d.toISOString().slice(0, 10));
  await page.waitForSelector("#time-list .slot-btn", { timeout: 8000 });
  const step3 = await page.$(".booking-step:nth-of-type(3)");
  await step3.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const box = await step3.boundingBox();
  await page.screenshot({ path: path.join(OUT, "step3-time-picker.png"), clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 } });
  await browser.close();
})();
