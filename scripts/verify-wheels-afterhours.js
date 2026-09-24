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
  await page.waitForSelector("#hour-wheel .slot-btn[data-hour='20']", { timeout: 8000 });

  await page.click("#hour-wheel .slot-btn[data-hour='20']");
  await page.waitForSelector("#minute-wheel .slot-btn[data-time='20:37']", { timeout: 8000 });
  await page.click("#minute-wheel .slot-btn[data-time='20:37']");

  const summaryText = await page.textContent("#booking-summary");
  console.log("SUMMARY:", summaryText.replace(/\s+/g, " ").trim());

  await page.fill("#customer-name", "Late Nighter");
  await page.fill("#customer-email", "late@example.com");
  await page.fill("#customer-phone", "0821239999");
  await page.click("#booking-submit");
  await page.waitForSelector("#booking-confirmation .confirmation", { timeout: 8000 });
  const details = await page.textContent("#booking-confirmation .details");
  console.log("CONFIRMATION_DETAILS:", details.replace(/\s+/g, " ").trim());

  await browser.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
