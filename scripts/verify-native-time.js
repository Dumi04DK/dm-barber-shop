const { chromium } = require("playwright-core");
const path = require("path");
const EXE = "C:\\Users\\Akonisaho\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const OUT = path.join(__dirname, "shots");
require("fs").mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:5512";

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

  const disabledBeforeDate = await page.isDisabled("#booking-time");
  console.log("TIME_DISABLED_BEFORE_DATE:", disabledBeforeDate);

  const testDate = nextWeekdayISO(2);
  await page.fill("#booking-date", testDate);
  await page.waitForFunction(() => !document.getElementById("booking-time").disabled, { timeout: 8000 });

  // Set an arbitrary exact minute — this is the whole point: 15:06.
  await page.fill("#booking-time", "15:06");
  await page.waitForTimeout(150);
  const status1 = await page.textContent("#slot-status");
  console.log("STATUS_AFTER_15_06:", status1.trim());
  const summary1 = await page.textContent("#booking-summary");
  console.log("SUMMARY_AFTER_15_06:", summary1.replace(/\s+/g, " ").trim());

  // Now an after-hours arbitrary minute.
  await page.fill("#booking-time", "20:37");
  await page.waitForTimeout(150);
  const status2 = await page.textContent("#slot-status");
  console.log("STATUS_AFTER_20_37:", status2.trim());
  const summary2 = await page.textContent("#booking-summary");
  console.log("SUMMARY_AFTER_20_37:", summary2.replace(/\s+/g, " ").trim());

  // Now an out-of-window time (before 06:00).
  await page.fill("#booking-time", "03:00");
  await page.waitForTimeout(150);
  const status3 = await page.textContent("#slot-status");
  console.log("STATUS_AFTER_03_00:", status3.trim());

  const step3 = await page.$(".booking-step:nth-of-type(3)");
  await step3.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const box = await step3.boundingBox();
  await page.screenshot({ path: path.join(OUT, "native-time-step.png"), clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 } });

  // Now book the after-hours 20:37 time and confirm it goes through correctly.
  await page.fill("#booking-time", "20:37");
  await page.waitForTimeout(150);
  await page.fill("#customer-name", "Native Time Tester");
  await page.fill("#customer-email", "nativetime@example.com");
  await page.fill("#customer-phone", "0821119988");
  await page.click("#booking-submit");
  await page.waitForSelector("#booking-confirmation .confirmation", { timeout: 8000 });
  const details = await page.textContent("#booking-confirmation .details");
  console.log("CONFIRMED_DETAILS:", details.replace(/\s+/g, " ").trim());

  console.log("CONSOLE_ERRORS:", JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
