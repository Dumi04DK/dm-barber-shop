const { chromium } = require("playwright-core");
const path = require("path");
const EXE = "C:\\Users\\Akonisaho\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const OUT = path.join(__dirname, "shots");
require("fs").mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:5511";

function nextWeekdayISO(targetDow) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() !== targetDow) d.setUTCDate(d.getUTCDate() + 1);
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
  if (await page.isVisible(".modal-overlay.is-open")) { await page.click(".modal-close"); await page.waitForTimeout(300); }
  await page.click("#service-options .option-card[data-id='skin-fade']");
  await page.click("#barber-options .option-card[data-id='duma']");
  const testDate = nextWeekdayISO(2);
  await page.fill("#booking-date", testDate);
  await page.waitForSelector("#time-list .slot-btn", { timeout: 8000 });

  const count = await page.$$eval("#time-list .slot-btn", (els) => els.length);
  const first = await page.textContent("#time-list .slot-btn:first-child .slot-time");
  const last = await page.textContent("#time-list .slot-btn:last-child .slot-time");
  console.log("SLOT_COUNT:", count, "FIRST:", first.trim(), "LAST:", last.trim());

  const listEl = await page.$("#time-list");
  await listEl.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  let box = await listEl.boundingBox();
  await page.screenshot({ path: path.join(OUT, "list-initial.png"), clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 } });

  // Real mouse-wheel scroll (native browser scrolling, no custom snap now).
  const listBox = await page.$eval("#time-list", (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(listBox.x, listBox.y);
  await page.mouse.wheel(0, 1000);
  await page.waitForTimeout(150);
  const scrollInfo = await page.$eval("#time-list", (el) => ({ scrollTop: el.scrollTop, max: el.scrollHeight - el.clientHeight }));
  console.log("NATIVE_SCROLL_AFTER_WHEEL:", JSON.stringify(scrollInfo));

  // Click an after-hours time to confirm fee shows.
  await page.click("#time-list .slot-btn[data-time='20:00']");
  const summaryText = await page.textContent("#booking-summary");
  console.log("SUMMARY_AFTER_20_00_CLICK:", summaryText.replace(/\s+/g, " ").trim());

  await page.fill("#customer-name", "Cal Style Tester");
  await page.fill("#customer-email", "calstyle@example.com");
  await page.fill("#customer-phone", "0827773344");
  await page.click("#booking-submit");
  await page.waitForSelector("#booking-confirmation .confirmation", { timeout: 8000 });
  const details = await page.textContent("#booking-confirmation .details");
  console.log("CONFIRMED_DETAILS:", details.replace(/\s+/g, " ").trim());

  console.log("CONSOLE_ERRORS:", JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
