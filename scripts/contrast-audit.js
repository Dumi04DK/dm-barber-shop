const { chromium } = require("playwright-core");
const EXE = "C:\\Users\\Akonisaho\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const BASE = "http://localhost:5501";
const PAGES = ["/", "/services.html", "/about.html", "/contact.html", "/terms.html", "/404.html", "/admin.html"];

function parseColor(str) {
  const m = str.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(",").map((s) => parseFloat(s.trim()));
  return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] === undefined ? 1 : parts[3] };
}

function luminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(c1, c2) {
  const l1 = luminance(c1);
  const l2 = luminance(c2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const results = [];

  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: "load" });
    const findings = await page.evaluate(() => {
      function effectiveBackground(el) {
        let node = el;
        while (node) {
          const bg = getComputedStyle(node).backgroundColor;
          const m = bg.match(/rgba?\(([^)]+)\)/);
          if (m) {
            const parts = m[1].split(",").map((s) => parseFloat(s.trim()));
            const alpha = parts[3] === undefined ? 1 : parts[3];
            if (alpha > 0.5) return bg;
          }
          node = node.parentElement;
        }
        return "rgb(255,255,255)";
      }

      const out = [];
      const all = document.querySelectorAll("body *");
      all.forEach((el) => {
        if (el.children.length > 0) return; // leaf-ish only (avoid double counting containers)
        const text = (el.textContent || "").trim();
        if (!text || text.length < 2) return;
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none") return;
        const opacity = parseFloat(style.opacity);
        if (opacity < 0.4) return;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const color = style.color;
        const bg = effectiveBackground(el);
        out.push({
          tag: el.tagName,
          cls: el.className && typeof el.className === "string" ? el.className.slice(0, 40) : "",
          text: text.slice(0, 40),
          color,
          bg,
          fontSize: parseFloat(style.fontSize),
          fontWeight: style.fontWeight,
        });
      });
      return out;
    });

    findings.forEach((f) => {
      const fg = parseColor(f.color);
      const bg = parseColor(f.bg);
      if (!fg || !bg) return;
      const ratio = contrastRatio(fg, bg);
      const isLarge = f.fontSize >= 18 || (f.fontSize >= 14 && parseInt(f.fontWeight) >= 700);
      const threshold = isLarge ? 3.0 : 4.5;
      if (ratio < threshold) {
        results.push({ page: path, ...f, ratio: ratio.toFixed(2), threshold });
      }
    });
  }

  console.log("LOW_CONTRAST_FINDINGS (" + results.length + "):");
  results.forEach((r) => {
    console.log(`[${r.page}] <${r.tag} class="${r.cls}"> "${r.text}" — ratio ${r.ratio} (need ${r.threshold}) — color:${r.color} on bg:${r.bg}`);
  });

  await browser.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
