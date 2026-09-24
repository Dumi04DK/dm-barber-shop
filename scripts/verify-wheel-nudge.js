const { chromium } = require("playwright-core");
const path = require("path");
const EXE = "C:\\Users\\Akonisaho\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const OUT = path.join(__dirname, "shots");
require("fs").mkdirSync(OUT, { recursive: true });

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

  await page.goto("http://localhost:5508/contact.html", { waitUntil: "load" });
  await page.waitForSelector("#service-options .option-card", { timeout: 8000 });
  await page.waitForTimeout(2200);
  if (await page.isVisible(".modal-overlay.is-open")) { await page.click(".modal-close"); await page.waitForTimeout(300); }
  await page.click("#service-options .option-card[data-id='skin-fade']");
  await page.click("#barber-options .option-card[data-id='duma']");
  await page.fill("#booking-date", nextWeekdayISO(2));
  await page.waitForSelector("#minute-wheel .slot-btn", { timeout: 8000 });

  const reachedMinutes = new Set();
  const downBtn = 'button.wheel-nudge[data-target="minute-wheel"][data-dir="1"]';
  for (let i = 0; i < 65; i++) {
    await page.click(downBtn);
    await page.waitForTimeout(60);
    const mm = await page.textContent("#minute-wheel .slot-btn.is-selected .slot-time");
    reachedMinutes.add(mm.trim());
  }
  console.log("MINUTES_REACHED_VIA_NUDGE:", reachedMinutes.size, "/60 — has 00:", reachedMinutes.has("00"), "has 59:", reachedMinutes.has("59"));
  const missing = [];
  for (let m = 0; m < 60; m++) { const s = String(m).padStart(2, "0"); if (!reachedMinutes.has(s)) missing.push(s); }
  console.log("MISSING_MINUTES:", missing.length ? missing.join(",") : "none");

  const reachedHours = new Set();
  const downBtnHour = 'button.wheel-nudge[data-target="hour-wheel"][data-dir="1"]';
  for (let i = 0; i < 20; i++) {
    await page.click(downBtnHour);
    await page.waitForTimeout(60);
    const hh = await page.textContent("#hour-wheel .slot-btn.is-selected .slot-time");
    reachedHours.add(hh.trim());
  }
  console.log("HOURS_REACHED_VIA_NUDGE:", reachedHours.size, "/16 — has 06:", reachedHours.has("06"), "has 21:", reachedHours.has("21"));

  await page.$eval("#wheel-wrap", (el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(150);
  const box = await page.$eval("#wheel-wrap", (el) => { const r = el.getBoundingClientRect(); return { x: r.x - 10, y: r.y - 10, width: r.width + 20, height: r.height + 20 }; });
  await page.screenshot({ path: path.join(OUT, "wheel-with-nudges.png"), clip: box });

  console.log("CONSOLE_ERRORS:", JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
