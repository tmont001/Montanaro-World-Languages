// tools/resize.js  (CommonJS)
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const { glob } = require("glob"); // v10+ exposes a named export

const OUT = path.resolve("assets/images/optimized");
const SIZES = [800, 1200, 1600];

(async () => {
  // make sure the output dir exists
  await fs.promises.mkdir(OUT, { recursive: true });

  // glob v10+: promise-based, not callback-based
  const files = await glob("assets/images/originals/*.{jpg,jpeg,png}", {
    nodir: true,
  });

  if (!files.length) {
    console.warn("No source images found in assets/images/originals/");
    return;
  }

  for (const file of files) {
    const base = path.basename(file, path.extname(file));

    for (const w of SIZES) {
      // AVIF
      await sharp(file)
        .resize({ width: w })
        .toFormat("avif", { quality: 50 })
        .toFile(path.join(OUT, `${base}-${w}.avif`));

      // WebP
      await sharp(file)
        .resize({ width: w })
        .toFormat("webp", { quality: 75 })
        .toFile(path.join(OUT, `${base}-${w}.webp`));
    }
    console.log(`✓ ${base} done`);
  }

  console.log(`All done. Files are in: ${OUT}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
