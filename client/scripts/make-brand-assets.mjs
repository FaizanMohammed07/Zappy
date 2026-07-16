/**
 * Generates the real favicon set + social preview image from the ZappyOne logo.
 *
 *     node scripts/make-brand-assets.mjs
 *
 * Why this exists:
 *  - The favicon was an inline SVG data-URI placeholder (a generic bolt), not the
 *    ZappyOne mark, and there was no /favicon.ico at all. Google, WhatsApp and
 *    older browsers request /favicon.ico directly; with vercel.json rewriting
 *    /(.*) -> /index.html, that request returned HTML, so no icon ever resolved.
 *  - og:image pointed at /og-default.jpg which did not exist -> every WhatsApp /
 *    LinkedIn / X share of zappyone.com rendered with no preview image.
 */
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'public', 'branding', 'zappylogo.png');
const PUB = join(root, 'public');
const BRAND_BG = '#2563EB';

// The source has whitespace around the mark — trim it so the icon fills the frame
// (an untrimmed mark looks tiny and unreadable at 16px).
const mark = () => sharp(SRC).trim();

/** Square PNG: mark centred on a white tile with a little breathing room. */
async function squarePng(size, pad = 0.12, bg = { r: 255, g: 255, b: 255, alpha: 1 }) {
  const inner = Math.round(size * (1 - pad * 2));
  const resized = await mark()
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toBuffer();
}

/** Minimal ICO writer — ICO may embed PNG payloads directly (Vista+). */
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);            // reserved
  header.writeUInt16LE(1, 2);            // type: icon
  header.writeUInt16LE(pngs.length, 4);  // image count

  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, buf }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);     // width (0 == 256)
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1); // height
    dir.writeUInt8(0, o + 2);                      // palette
    dir.writeUInt8(0, o + 3);                      // reserved
    dir.writeUInt16LE(1, o + 4);                   // colour planes
    dir.writeUInt16LE(32, o + 6);                  // bits per pixel
    dir.writeUInt32LE(buf.length, o + 8);          // payload size
    dir.writeUInt32LE(offset, o + 12);             // payload offset
    offset += buf.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.buf)]);
}

async function run() {
  mkdirSync(join(PUB, 'icons'), { recursive: true });

  // favicon.ico — 16/32/48 so browsers and crawlers each pick their best fit.
  const icoSizes = [16, 32, 48];
  const icoPngs = [];
  for (const size of icoSizes) icoPngs.push({ size, buf: await squarePng(size, 0.06) });
  writeFileSync(join(PUB, 'favicon.ico'), buildIco(icoPngs));
  console.log('favicon.ico        16+32+48');

  // PNG favicons + PWA/apple icons.
  for (const size of [16, 32, 180, 192, 512]) {
    const pad = size <= 32 ? 0.06 : 0.12;
    // Apple/PWA icons must not be transparent — iOS renders alpha as black.
    const buf = await squarePng(size, pad);
    const name = size === 180 ? 'apple-touch-icon.png' : `icons/icon-${size}.png`;
    writeFileSync(join(PUB, name), buf);
    console.log(`${name.padEnd(19)}${size}x${size}`);
  }

  // Maskable icon — Android crops to a circle, so the mark needs a safe zone.
  writeFileSync(join(PUB, 'icons/maskable-512.png'), await squarePng(512, 0.22, BRAND_BG));
  console.log('icons/maskable-512.png  512x512 (safe zone)');

  // logo.png — referenced by the Organization schema's `logo` (it 404'd, so Google
  // had no logo for rich results / the knowledge panel). Google wants it >=112px
  // and on a solid background.
  writeFileSync(join(PUB, 'logo.png'), await squarePng(512, 0.1));
  console.log('logo.png           512x512 (schema Organization logo)');

  // og-default.jpg — 1200x630 social preview (WhatsApp/LinkedIn/X).
  const logoW = 640;
  const logo = await mark()
    .resize(logoW, null, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#ffffff' } })
    .composite([{ input: logo, gravity: 'center' }])
    .jpeg({ quality: 88 })
    .toFile(join(PUB, 'og-default.jpg'));
  console.log('og-default.jpg     1200x630');
}

run().catch((e) => { console.error(e); process.exit(1); });
