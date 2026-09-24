const { chromium } = require("playwright-core");
const path = require("path");
const EXE = "C:\\Users\\Akonisaho\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const OUT = path.join(__dirname, "shots");
require("fs").mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:5504";

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
  await page.waitForSelector("#hour-wheel .slot-btn", { timeout: 8000 });

  const hourCount = await page.$$eval("#hour-wheel .slot-btn", (els) => els.length);
  const minuteCountDefault = await page.$$eval("#minute-wheel .slot-btn", (els) => els.length);
  console.log("HOUR_WHEEL_COUNT:", hourCount);
  console.log("DEFAULT_MINUTE_WHEEL_COUNT:", minuteCountDefault);

  const wheelsEl = await page.$("#time-wheels");
  await wheelsEl.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  let wbox = await wheelsEl.boundingBox();
  await page.screenshot({ path: path.join(OUT, "wheels-default.png"), clip: { x: Math.max(0, wbox.x - 10), y: Math.max(0, wbox.y - 10), width: wbox.width + 20, height: wbox.height + 20 } });

  // Click hour "15"
  await page.click("#hour-wheel .slot-btn[data-hour='15']");
  const minuteCount15 = await page.$$eval("#minute-wheel .slot-btn", (els) => els.length);
  console.log("HOUR_15_MINUTE_COUNT:", minuteCount15);

  // Click minute "06" within hour 15 -> composes 15:06
  await page.click("#minute-wheel .slot-btn[data-time='15:06']");
  const stateTimeText = await page.textContent("#minute-wheel .slot-btn.is-selected .slot-time");
  console.log("SELECTED_MINUTE_TEXT:", stateTimeText.trim());

  const summaryText = await page.textContent("#booking-summary");
  console.log("SUMMARY_TIME_LINE:", summaryText.replace(/\s+/g, " ").match(/Time\S*\s*\S+/) ? summaryText.replace(/\s+/g, " ") : summaryText);

  wbox = await wheelsEl.boundingBox();
  await page.screenshot({ path: path.join(OUT, "wheels-1506-selected.png"), clip: { x: Math.max(0, wbox.x - 10), y: Math.max(0, wbox.y - 10), width: wbox.width + 20, height: wbox.height + 20 } });

  console.log("CONSOLE_ERRORS:", JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
