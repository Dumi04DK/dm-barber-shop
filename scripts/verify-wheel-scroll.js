const { chromium } = require("playwright-core");
const path = require("path");
const EXE = "C:\\Users\\Akonisaho\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const OUT = path.join(__dirname, "shots");
require("fs").mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:5505";

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

  const wheelWrap = await page.$("#wheel-wrap");
  await wheelWrap.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  let box = await wheelWrap.boundingBox();
  await page.screenshot({ path: path.join(OUT, "wheel-default-state.png"), clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 } });

  // Real mouse-wheel scroll on the hour wheel (not a click), simulating an
  // actual user scrolling the wheel with their mouse/trackpad.
  const hourBox = await page.$eval("#hour-wheel", (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(hourBox.x, hourBox.y);
  await page.mouse.wheel(0, 44 * 4); // scroll down 4 items
  await page.waitForTimeout(250); // let the 130ms settle timer fire

  const selectedHour = await page.textContent("#hour-wheel .slot-btn.is-selected .slot-time");
  console.log("HOUR_AFTER_WHEEL_SCROLL:", selectedHour.trim());

  // Now real mouse-wheel scroll on the minute wheel too.
  const minBox = await page.$eval("#minute-wheel", (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(minBox.x, minBox.y);
  await page.mouse.wheel(0, 44 * 7); // scroll down 7 items
  await page.waitForTimeout(250);

  const selectedMinute = await page.textContent("#minute-wheel .slot-btn.is-selected .slot-time");
  console.log("MINUTE_AFTER_WHEEL_SCROLL:", selectedMinute.trim());

  const summaryText = await page.textContent("#booking-summary");
  console.log("SUMMARY:", summaryText.replace(/\s+/g, " ").trim());

  box = await wheelWrap.boundingBox();
  await page.screenshot({ path: path.join(OUT, "wheel-after-scroll.png"), clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 } });

  console.log("CONSOLE_ERRORS:", JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
