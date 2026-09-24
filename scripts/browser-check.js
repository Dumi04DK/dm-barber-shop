const { chromium } = require("playwright-core");
const path = require("path");
const fs = require("fs");

const EXE = "C:\\Users\\Akonisaho\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const OUT = path.join(__dirname, "shots");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const consoleErrors = [];

function nextWeekdayISO(targetDow) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== targetDow) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

  // ---- Desktop pass ----
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[desktop:${page.url()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`[desktop:pageerror:${page.url()}] ${err.message}`));

  await page.goto("http://localhost:5500/", { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT, "01-home.png"), fullPage: true });

  // scroll through to trigger lazy-loaded images before checking
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle");
  const brokenImgs = await page.$$eval("img", (imgs) =>
    imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src)
  );
  console.log("BROKEN_IMAGES_HOME:", JSON.stringify(brokenImgs));

  // popup modal
  await page.waitForTimeout(2200);
  const modalOpen = await page.isVisible(".modal-overlay.is-open");
  console.log("MODAL_VISIBLE_AFTER_DELAY:", modalOpen);
  await page.screenshot({ path: path.join(OUT, "02-popup.png") });
  if (modalOpen) {
    await page.click(".modal-close");
    await page.waitForTimeout(300);
    const modalClosed = !(await page.isVisible(".modal-overlay.is-open"));
    console.log("MODAL_CLOSED_OK:", modalClosed);
  }

  // Services page
  await page.goto("http://localhost:5500/services.html", { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT, "03-services.png"), fullPage: true });
  const brokenImgsServices = await page.$$eval("img", (imgs) =>
    imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src)
  );
  console.log("BROKEN_IMAGES_SERVICES:", JSON.stringify(brokenImgsServices));

  // About page
  await page.goto("http://localhost:5500/about.html", { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT, "04-about.png"), fullPage: true });
  const brokenImgsAbout = await page.$$eval("img", (imgs) =>
    imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src)
  );
  console.log("BROKEN_IMAGES_ABOUT:", JSON.stringify(brokenImgsAbout));

  // Terms page
  await page.goto("http://localhost:5500/terms.html", { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT, "05-terms.png"), fullPage: true });

  // ---- Mobile pass: hamburger menu ----
  const mobile = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mpage = await mobile.newPage();
  mpage.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(`[mobile:${mpage.url()}] ${msg.text()}`); });
  mpage.on("pageerror", (err) => consoleErrors.push(`[mobile:pageerror] ${err.message}`));
  await mpage.goto("http://localhost:5500/", { waitUntil: "networkidle" });
  await mpage.screenshot({ path: path.join(OUT, "06-mobile-home.png"), fullPage: true });
  const hScroll = await mpage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  console.log("MOBILE_HORIZONTAL_OVERFLOW:", hScroll);
  await mpage.waitForTimeout(2200);
  if (await mpage.isVisible(".modal-overlay.is-open")) {
    await mpage.click(".modal-close");
    await mpage.waitForTimeout(300);
  }
  await mpage.click(".nav-toggle");
  await mpage.waitForTimeout(300);
  const navOpen = await mpage.isVisible(".main-nav.is-open");
  console.log("MOBILE_NAV_OPEN:", navOpen);
  await mpage.screenshot({ path: path.join(OUT, "07-mobile-nav-open.png") });
  await mpage.click(".nav-toggle");
  await mpage.waitForTimeout(300);
  const navClosed = !(await mpage.isVisible(".main-nav.is-open"));
  console.log("MOBILE_NAV_CLOSED_OK:", navClosed);
  await mobile.close();

  // ---- Booking flow (desktop page) ----
  await page.goto("http://localhost:5500/contact.html", { waitUntil: "networkidle" });
  await page.waitForSelector("#service-options .option-card", { timeout: 8000 });
  await page.click("#service-options .option-card[data-id='skin-fade']");
  await page.click("#barber-options .option-card[data-id='duma']");

  const testDate = nextWeekdayISO(2); // next Tuesday
  await page.fill("#booking-date", testDate);
  await page.waitForSelector("#slot-grid .slot-btn:not(:disabled)", { timeout: 8000 });
  await page.screenshot({ path: path.join(OUT, "08-booking-slots.png"), fullPage: true });
  await page.click("#slot-grid .slot-btn:not(:disabled)");

  await page.fill("#customer-name", "Thabo Ndlovu");
  await page.fill("#customer-email", "thabo.ndlovu@example.com");
  await page.fill("#customer-phone", "0821234567");
  await page.fill("#customer-notes", "Guard 2 on the sides please");
  await page.screenshot({ path: path.join(OUT, "09-booking-filled.png"), fullPage: true });

  const [download] = await Promise.all([
    page.waitForEvent("download").catch(() => null),
    page.click("#booking-submit"),
  ]);

  await page.waitForSelector("#booking-confirmation .confirmation", { timeout: 8000 });
  await page.screenshot({ path: path.join(OUT, "10-booking-confirmed.png"), fullPage: true });
  console.log("CONFIRMATION_VISIBLE: true");

  const [ics] = await Promise.all([
    page.waitForEvent("download"),
    page.click("[data-action='ics']"),
  ]);
  const icsPath = path.join(OUT, "appointment.ics");
  await ics.saveAs(icsPath);
  const icsContent = fs.readFileSync(icsPath, "utf-8");
  console.log("ICS_DOWNLOADED: true");
  console.log("ICS_CONTENT:\n" + icsContent);

  const gcalHref = await page.getAttribute("a.btn.btn-gold[href*='calendar.google.com']", "href");
  console.log("GCAL_LINK:", gcalHref);

  // Try booking the exact same slot again with the same barber -> should now be unavailable in UI
  await page.goto("http://localhost:5500/contact.html", { waitUntil: "networkidle" });
  await page.waitForSelector("#service-options .option-card", { timeout: 8000 });
  await page.click("#service-options .option-card[data-id='skin-fade']");
  await page.click("#barber-options .option-card[data-id='duma']");
  await page.fill("#booking-date", testDate);
  await page.waitForSelector("#slot-grid .slot-btn", { timeout: 8000 });
  const firstSlotDisabled = await page.getAttribute("#slot-grid .slot-btn:first-child", "disabled");
  console.log("REBOOKED_SLOT_NOW_DISABLED (first slot):", firstSlotDisabled !== null);
  await page.screenshot({ path: path.join(OUT, "11-slots-after-booking.png"), fullPage: true });

  await browser.close();

  console.log("\n=== CONSOLE_ERRORS (" + consoleErrors.length + ") ===");
  consoleErrors.forEach((e) => console.log(e));
})().catch((e) => {
  console.error("SCRIPT_ERROR:", e);
  process.exitCode = 1;
});
