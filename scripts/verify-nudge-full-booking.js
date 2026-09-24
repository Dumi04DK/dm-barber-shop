const { chromium } = require("playwright-core");
const EXE = "C:\\Users\\Akonisaho\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";

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
  await page.click("#service-options .option-card[data-id='combo']");
  await page.click("#barber-options .option-card[data-id='naledi']");
  await page.fill("#booking-date", nextWeekdayISO(4)); // Thursday
  await page.waitForSelector("#minute-wheel .slot-btn", { timeout: 8000 });

  // Nudge hour forward 3 times, minute forward 22 times -> composes a specific time.
  for (let i = 0; i < 3; i++) { await page.click('button.wheel-nudge[data-target="hour-wheel"][data-dir="1"]'); await page.waitForTimeout(60); }
  for (let i = 0; i < 22; i++) { await page.click('button.wheel-nudge[data-target="minute-wheel"][data-dir="1"]'); await page.waitForTimeout(60); }

  const hh = (await page.textContent("#hour-wheel .slot-btn.is-selected .slot-time")).trim();
  const mm = (await page.textContent("#minute-wheel .slot-btn.is-selected .slot-time")).trim();
  console.log("COMPOSED_TIME_VIA_NUDGE:", hh + ":" + mm);

  await page.fill("#customer-name", "Nudge Tester");
  await page.fill("#customer-email", "nudge@example.com");
  await page.fill("#customer-phone", "0821112233");
  await page.click("#booking-submit");
  await page.waitForSelector("#booking-confirmation .confirmation", { timeout: 8000 });
  const details = await page.textContent("#booking-confirmation .details");
  console.log("CONFIRMED_BOOKING_DETAILS:", details.replace(/\s+/g, " ").trim());

  console.log("CONSOLE_ERRORS:", JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
