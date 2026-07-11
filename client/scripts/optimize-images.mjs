// One-time image optimizer: converts the service thumbnails from heavy PNGs to
// compact WebP at display resolution. Thumbnails render at ~144px tall / ~300px
// wide, so 480px @ q78 is retina-sharp while cutting bytes ~95%.
//
// Usage: node scripts/optimize-images.mjs
// Originals are moved to image-sources/services/ (outside public/, so they are
// kept in the repo for re-export but never shipped to the browser).
import sharp from 'sharp';
import { readdir, mkdir, rename, stat } from 'node:fs/promises';
import { join, extname, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR    = join(root, 'public', 'images', 'services');
const BACKUP_DIR = join(root, 'image-sources', 'services');
const WIDTH = 480;
const QUALITY = 78;

const kb = (n) => `${Math.round(n / 1024)} KB`;

async function run() {
  await mkdir(BACKUP_DIR, { recursive: true });
  const files = (await readdir(SRC_DIR)).filter((f) => extname(f).toLowerCase() === '.png');
  if (!files.length) { console.log('No PNGs to convert.'); return; }

  let before = 0, after = 0;
  for (const file of files) {
    const inPath = join(SRC_DIR, file);
    const outPath = join(SRC_DIR, `${basename(file, extname(file))}.webp`);
    const srcBytes = (await stat(inPath)).size;

    await sharp(inPath)
      .resize({ width: WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(outPath);

    const outBytes = (await stat(outPath)).size;
    before += srcBytes; after += outBytes;
    console.log(`  ${file}  ${kb(srcBytes)} -> ${kb(outBytes)}`);

    // Move the original out of the shipped public/ folder.
    await rename(inPath, join(BACKUP_DIR, file));
  }

  console.log(`\nDone. ${files.length} images: ${kb(before)} -> ${kb(after)} (${Math.round((1 - after / before) * 100)}% smaller).`);
  console.log('Originals moved to image-sources/services/ (not shipped).');
}

run().catch((e) => { console.error(e); process.exit(1); });
