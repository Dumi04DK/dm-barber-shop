const { chromium } = require("playwright-core");
const path = require("path");
const EXE = "C:\\Users\\Akonisaho\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const OUT = path.join(__dirname, "shots");
require("fs").mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:5507";

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
  await page.waitForSelector("#minute-wheel .slot-btn", { timeout: 8000 });
  await page.$eval("#wheel-wrap", (el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(200);

  const pageScrollBefore = await page.evaluate(() => window.scrollY);

  // Realistic small-increment scrolling (like a real mouse, ~15-20px per
  // notch) all the way through the minute wheel's full 60-item range,
  // checking at every step that scrollTop is actually advancing.
  const minBox = await page.$eval("#minute-wheel", (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(minBox.x, minBox.y);

  let lastScrollTop = -1;
  let stuckCount = 0;
  const reachedMinutes = new Set();
  for (let i = 0; i < 200; i++) {
    await page.mouse.wheel(0, 15);
    await page.waitForTimeout(15);
    const info = await page.$eval("#minute-wheel", (el) => ({ scrollTop: el.scrollTop, max: el.scrollHeight - el.clientHeight }));
    if (info.scrollTop === lastScrollTop && info.scrollTop < info.max - 1) stuckCount++;
    lastScrollTop = info.scrollTop;
    if (i % 10 === 0) {
      const centered = await page.$eval("#minute-wheel", (el, ih) => {
        const idx = Math.round(el.scrollTop / ih);
        const items = el.querySelectorAll(".slot-btn");
        return items[idx] ? items[idx].querySelector(".slot-time").textContent : null;
      }, 44);
      if (centered) reachedMinutes.add(centered);
    }
    if (info.scrollTop >= info.max - 1) break;
  }

  const pageScrollAfter = await page.evaluate(() => window.scrollY);
  console.log("PAGE_SCROLL_UNCHANGED:", pageScrollBefore === pageScrollAfter, "(before:", pageScrollBefore, "after:", pageScrollAfter + ")");
  console.log("STUCK_TICKS (scrollTop didn't move but not at max):", stuckCount);
  console.log("DISTINCT_MINUTES_REACHED_WHILE_SCROLLING:", reachedMinutes.size, "e.g.", [...reachedMinutes].slice(0, 6).join(","), "...", [...reachedMinutes].slice(-6).join(","));

  const finalMinuteInfo = await page.$eval("#minute-wheel", (el) => {
    const items = el.querySelectorAll(".slot-btn");
    return { scrollTop: el.scrollTop, max: el.scrollHeight - el.clientHeight, lastItemText: items[items.length - 1].querySelector(".slot-time").textContent };
  });
  console.log("REACHED_BOTTOM_OF_MINUTE_WHEEL:", finalMinuteInfo);

  await page.waitForTimeout(200);
  const selectedAtEnd = await page.textContent("#minute-wheel .slot-btn.is-selected .slot-time");
  console.log("SELECTED_AT_END_OF_SCROLL:", selectedAtEnd.trim());

  console.log("CONSOLE_ERRORS:", JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
