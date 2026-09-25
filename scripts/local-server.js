// Local-only dev server for manual/browser testing without Vercel.
// Serves the static site and proxies /api/* to the real function handlers,
// backed by an in-memory stand-in for @upstash/redis. Not used in production.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

// Load .env.local by hand (no dotenv dependency) so BREVO_API_KEY, ADMIN_KEY,
// etc. set there are picked up when running this script directly with `node`,
// same as `vercel dev` would. Real process env vars always win.
const envLocalPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envLocalPath)) {
  for (const line of fs.readFileSync(envLocalPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

const Module = require("module");
const originalRequire = Module.prototype.require;
const store = new Map();

class FakeRedis {
  async get(key) {
    return store.has(key) ? store.get(key) : null;
  }
  async set(key, value) {
    store.set(key, value);
    return "OK";
  }
  async keys(pattern) {
    const prefix = pattern.replace(/\*$/, "");
    return [...store.keys()].filter((k) => k.startsWith(prefix));
  }
  async incr(key) {
    const next = (store.get(key) || 0) + 1;
    store.set(key, next);
    return next;
  }
}

const fakeUpstash = { Redis: { fromEnv: () => new FakeRedis() } };

Module.prototype.require = function (id) {
  if (id === "@upstash/redis") return fakeUpstash;
  return originalRequire.apply(this, arguments);
};

// store.js checks for these directly before calling Redis.fromEnv() (which is mocked above).
process.env.UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || "http://fake.local";
process.env.UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "fake-token";

const catalogFn = require("../api/catalog");
const availabilityFn = require("../api/availability");
const bookFn = require("../api/book");
const adminBookingsFn = require("../api/admin-bookings");

process.env.ADMIN_KEY = process.env.ADMIN_KEY || "localtest";

const ROOT = path.join(__dirname, "..");
const PORT = process.env.PORT || 5500;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
  });
}

function makeRes(res) {
  let statusCode = 200;
  return {
    setHeader: (k, v) => res.setHeader(k, v),
    status(code) {
      statusCode = code;
      return this;
    },
    json(obj) {
      res.writeHead(statusCode, { "Content-Type": "application/json" });
      res.end(JSON.stringify(obj));
    },
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname.startsWith("/api/")) {
    const query = Object.fromEntries(url.searchParams.entries());
    const vercelRes = makeRes(res);
    try {
      if (url.pathname === "/api/catalog") {
        await catalogFn({ query, method: req.method, headers: req.headers }, vercelRes);
      } else if (url.pathname === "/api/availability") {
        await availabilityFn({ query, method: req.method, headers: req.headers }, vercelRes);
      } else if (url.pathname === "/api/book") {
        const raw = await readBody(req);
        let body = {};
        try { body = JSON.parse(raw || "{}"); } catch { /* leave empty */ }
        await bookFn({ query, method: req.method, headers: req.headers, body }, vercelRes);
      } else if (url.pathname === "/api/admin-bookings") {
        await adminBookingsFn({ query, method: req.method, headers: req.headers }, vercelRes);
      } else {
        vercelRes.status(404).json({ error: "Unknown API route" });
      }
    } catch (e) {
      vercelRes.status(500).json({ error: e.message });
    }
    return;
  }

  let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
  filePath = path.join(ROOT, decodeURIComponent(filePath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(ROOT, "404.html"), (err2, data2) => {
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end(err2 ? "Not found" : data2);
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Local test server ready: http://localhost:${PORT}`);
});
