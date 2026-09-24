const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "assets", "images", "logo.png");
const out = path.join(__dirname, "..", "favicon.ico");

function buildICO(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([header, entry, pngBuffer]);
}

(async () => {
  const png48 = await sharp(src).resize(48, 48).png().toBuffer();
  fs.writeFileSync(out, buildICO(png48, 48));
  console.log("favicon.ico written:", out, fs.statSync(out).size, "bytes");
})();
