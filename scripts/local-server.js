// Local-only dev server for manual/browser testing without the Netlify platform.
// Serves the static site and proxies /api/* to the real function handlers,
// backed by an in-memory stand-in for @netlify/blobs. Not used in production.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const Module = require("module");
const originalRequire = Module.prototype.require;
const buckets = new Map();
const fakeBlobs = {
  getStore(name) {
    return {
      async get(key, opts) {
        const bucket = buckets.get(name) || {};
        const val = bucket[key];
        if (val === undefined) return null;
        return opts && opts.type === "json" ? JSON.parse(val) : val;
      },
      async setJSON(key, value) {
        const bucket = buckets.get(name) || {};
        bucket[key] = JSON.stringify(value);
        buckets.set(name, bucket);
      },
    };
  },
};
Module.prototype.require = function (id) {
  if (id === "@netlify/blobs") return fakeBlobs;
  return originalRequire.apply(this, arguments);
};

const catalogFn = require("../netlify/functions/catalog");
const availabilityFn = require("../netlify/functions/availability");
const bookFn = require("../netlify/functions/book");

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname.startsWith("/api/")) {
    const qs = Object.fromEntries(url.searchParams.entries());
    let result;
    try {
      if (url.pathname === "/api/catalog") {
        result = await catalogFn.handler({});
      } else if (url.pathname === "/api/availability") {
        result = await availabilityFn.handler({ queryStringParameters: qs });
      } else if (url.pathname === "/api/book") {
        const body = await readBody(req);
        result = await bookFn.handler({ httpMethod: "POST", body });
      } else {
        result = { statusCode: 404, body: JSON.stringify({ error: "Unknown API route" }) };
      }
    } catch (e) {
      result = { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
    res.writeHead(result.statusCode, { "Content-Type": "application/json" });
    res.end(result.body);
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
