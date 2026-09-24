const { chromium } = require("playwright-core");
const path = require("path");
const EXE = "C:\\Users\\Akonisaho\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const OUT = path.join(__dirname, "shots");

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 600, height: 900 } });

  await page.goto("file:///" + path.join(OUT, "email-customer.html").replace(/\\/g, "/"));
  await page.screenshot({ path: path.join(OUT, "email-customer.png"), fullPage: true });

  await page.goto("file:///" + path.join(OUT, "email-admin.html").replace(/\\/g, "/"));
  await page.screenshot({ path: path.join(OUT, "email-admin.png"), fullPage: true });

  await browser.close();
})();
