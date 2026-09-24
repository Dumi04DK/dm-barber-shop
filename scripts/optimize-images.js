const sharp = require("sharp");
const path = require("path");

const dir = path.join(__dirname, "..", "assets", "images");

const jobs = [
  { file: "logo.png", width: 240, format: "png", out: "logo.png" },
  { file: "hero-shop.png", width: 1920, format: "jpeg", quality: 76, out: "hero-shop.jpg" },
  { file: "shop-wide.png", width: 1600, format: "jpeg", quality: 76, out: "shop-wide.jpg" },
  { file: "barber-cutting.png", width: 1400, format: "jpeg", quality: 76, out: "barber-cutting.jpg" },
  { file: "team-braids.png", width: 1000, format: "jpeg", quality: 76, out: "team-braids.jpg" },
  { file: "team-fade.png", width: 1000, format: "jpeg", quality: 76, out: "team-fade.jpg" },
  { file: "team-group.png", width: 1000, format: "jpeg", quality: 76, out: "team-group.jpg" },
];

(async () => {
  for (const job of jobs) {
    const input = path.join(dir, job.file);
    const output = path.join(dir, job.out);
    let pipeline = sharp(input).resize({ width: job.width, withoutEnlargement: true });
    if (job.format === "jpeg") pipeline = pipeline.jpeg({ quality: job.quality, mozjpeg: true });
    if (job.format === "png") pipeline = pipeline.png({ quality: 90 });
    await pipeline.toFile(output + ".tmp");
    require("fs").renameSync(output + ".tmp", output);
    const meta = await sharp(output).metadata();
    const size = require("fs").statSync(output).size;
    console.log(`${job.out}: ${meta.width}x${meta.height} — ${(size / 1024).toFixed(0)}KB`);
  }
})();
