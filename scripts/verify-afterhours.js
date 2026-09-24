const { chromium } = require("playwright-core");
const path = require("path");

const EXE = "C:\\Users\\Akonisaho\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const OUT = path.join(__dirname, "shots");
require("fs").mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:5502";

function nextWeekdayISO(targetDow) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== targetDow) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  // 1. Home page services section — check cards are NOT ghosted (full opacity immediately)
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.waitForTimeout(300); // no scroll at all — reveal bug would show ghosting here if still present
  const cardOpacities = await page.$$eval(".service-card h3", (els) =>
    els.map((el) => getComputedStyle(el).opacity)
  );
  console.log("SERVICE_CARD_HEADING_OPACITIES (should all be '1'):", JSON.stringify(cardOpacities));
  await page.screenshot({ path: path.join(OUT, "services-section.png"), clip: { x: 0, y: 550, width: 1280, height: 500 } });

  // 2. Booking flow with an explicit AFTER-HOURS slot
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

  // pick the explicit 07:00 after-hours slot
  await page.click("#slot-grid .slot-btn[data-time='07:00']");
  const summaryText = await page.textContent("#booking-summary");
  console.log("SUMMARY_TEXT:", summaryText.replace(/\s+/g, " ").trim());
  await page.screenshot({ path: path.join(OUT, "afterhours-summary.png"), fullPage: true });

  await page.fill("#customer-name", "Nomvula Khumalo");
  await page.fill("#customer-email", "nomvula@example.com");
  await page.fill("#customer-phone", "0827771234");
  await page.click("#booking-submit");
  await page.waitForSelector("#booking-confirmation .confirmation", { timeout: 8000 });
  const confirmationDetails = await page.textContent("#booking-confirmation .details");
  console.log("CONFIRMATION_DETAILS:", confirmationDetails.replace(/\s+/g, " ").trim());
  await page.screenshot({ path: path.join(OUT, "afterhours-confirmation.png"), fullPage: true });

  console.log("CONSOLE_ERRORS:", JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
