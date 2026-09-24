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
  const page = await browser.newPage();

  await page.goto("http://localhost:5500/contact.html", { waitUntil: "load" });
  await page.waitForSelector("#service-options .option-card", { timeout: 8000 });
  await page.waitForTimeout(2200);
  if (await page.isVisible(".modal-overlay.is-open")) {
    await page.click(".modal-close");
    await page.waitForTimeout(300);
  }
  await page.click("#service-options .option-card[data-id='combo']");
  await page.click("#barber-options .option-card[data-id='naledi']");
  const testDate = nextWeekdayISO(3); // next Wednesday, different from earlier tests
  await page.fill("#booking-date", testDate);
  await page.waitForSelector("#slot-grid .slot-btn:not(:disabled)", { timeout: 8000 });
  await page.click("#slot-grid .slot-btn:not(:disabled)");
  await page.fill("#customer-name", "Priya Govender");
  await page.fill("#customer-email", "priya@example.com");
  await page.fill("#customer-phone", "0839998888");
  await page.click("#booking-submit");
  await page.waitForSelector("#booking-confirmation .confirmation", { timeout: 8000 });
  const confirmationText = await page.textContent("#booking-confirmation .confirmation p");
  console.log("CONFIRMATION_TEXT:", confirmationText.trim());
  await page.screenshot({ path: path.join(OUT, "e2e-confirmation.png"), fullPage: true });

  await page.goto("http://localhost:5500/admin.html", { waitUntil: "networkidle" });
  await page.fill("#admin-key-input", "localtest");
  await page.click("#admin-signin");
  await page.waitForTimeout(700);
  const rowText = await page.textContent("table.admin-table tbody tr");
  console.log("ADMIN_ROW_TEXT:", rowText.replace(/\s+/g, " ").trim());
  await page.screenshot({ path: path.join(OUT, "e2e-admin-row.png"), fullPage: true });

  await browser.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
