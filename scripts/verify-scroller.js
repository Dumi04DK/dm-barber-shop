const { chromium } = require("playwright-core");
const path = require("path");
const EXE = "C:\\Users\\Akonisaho\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const OUT = path.join(__dirname, "shots");
require("fs").mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:5503";

function nextWeekdayISO(targetDow) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== targetDow) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(BASE + "/contact.html", { waitUntil: "load" });
  await page.waitForSelector("#service-options .option-card", { timeout: 8000 });
  await page.waitForTimeout(2200);
  if (await page.isVisible(".modal-overlay.is-open")) {
    await page.click(".modal-close");
    await page.waitForTimeout(300);
  }
  await page.click("#service-options .option-card[data-id='skin-fade']");
  await page.click("#barber-options .option-card[data-id='duma']");
  const testDate = nextWeekdayISO(2);
  await page.fill("#booking-date", testDate);
  await page.waitForSelector("#slot-grid .slot-btn", { timeout: 8000 });

  const isScrollable = await page.$eval("#slot-grid", (el) => el.scrollHeight > el.clientHeight);
  console.log("SCROLLER_IS_SCROLLABLE:", isScrollable);

  const slotCount = await page.$$eval("#slot-grid .slot-btn", (els) => els.length);
  console.log("TOTAL_SLOTS:", slotCount);

  const grid = await page.$("#slot-grid");
  await grid.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  let box = await grid.boundingBox();
  await page.screenshot({ path: path.join(OUT, "scroller-initial.png"), clip: { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 10), width: box.width + 20, height: box.height + 20 } });

  // Pick an after-hours slot further down the list.
  await page.click("#slot-grid .slot-btn[data-time='21:00']");
  const selectedText = await page.textContent("#slot-grid .slot-btn.is-selected");
  console.log("SELECTED_SLOT_TEXT:", selectedText.replace(/\s+/g, " ").trim());
  box = await grid.boundingBox();
  await page.screenshot({ path: path.join(OUT, "scroller-selected.png"), clip: { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 10), width: box.width + 20, height: box.height + 20 } });

  console.log("CONSOLE_ERRORS:", JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
