// Takes the still pictures of the room, shown where 3D cannot run. Run: npm run stills
// The pictures are taken from the real room in a headless browser, so they are the room, standing
// still: the wide view, at a set time of day, the robot on its dock. Run it again after the room changes.
// Beside each picture it saves a map of what is under each part of it (the room's own click test),
// so the picture can be clicked like the room.
//   npm run stills                                 all of them, into public/still/ (and stills.stamp)
//   npm run stills -- --only tall --out /tmp/x     only those whose name has "tall", somewhere else
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { stillsFingerprint, STILLS_STAMP } from './stills-fingerprint.mjs';
import { STILLS, SHARE, SPOT_CELL, spotsFile } from '../src/still.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const arg = (name) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : null; };
const out = arg('out') || join(root, 'public', 'still');
const shots = [...STILLS, SHARE].filter((s) => !arg('only') || s.file.includes(arg('only')));

const BROWSER = [process.env.BROWSER_PATH, '/usr/bin/brave-browser', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
if (!BROWSER) { console.error('No Chrome, Brave or Chromium found (set BROWSER_PATH).'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(out, { recursive: true });
const server = await createServer({ root, logLevel: 'silent', server: { port: 5195, strictPort: false } });
await server.listen();
const base = server.resolvedUrls.local[0];
const profile = mkdtempSync(join(tmpdir(), 'portfolio-stills-'));
const browser = await puppeteer.launch({ executablePath: BROWSER, headless: true, userDataDir: profile,
  args: ['--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
let failed = false;
try {
  for (const s of shots) {
    const page = await browser.newPage();
    await page.setViewport({ width: s.w, height: s.h, deviceScaleFactor: s.scale });
    // reduced motion: the camera is already in place, nothing sways, and the robot stays on its dock
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.evaluateOnNewDocument(() => { window.__keepRoom = true; }); // lets this script ask the room for its map
    await page.goto(`${base}?t=${s.hours}${s.era === 'then' ? '&time=2020' : ''}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.body.classList.contains('has-room'), { timeout: 30000 });
    // only the room: no header, buttons, captions or preview tools
    await page.addStyleTag({ content: 'body > *:not(#room) { display: none !important; } body::after { display: none !important; } #room { opacity: 1 !important; transition: none !important; }' });
    await sleep(4000); // the photographs on the wall and in the window have loaded and been drawn
    const file = join(out, s.file);
    if (s === SHARE) await page.screenshot({ path: file, type: 'jpeg', quality: 86 }); // no map: nobody clicks it
    else {
      await page.screenshot({ path: file, type: 'webp', quality: 84 });
      const spots = await page.evaluate((c, r) => window.__room.spotMap(c, r), Math.round(s.w / SPOT_CELL), Math.round(s.h / SPOT_CELL));
      writeFileSync(join(out, spotsFile(s)), JSON.stringify(spots));
    }
    console.log(`${s.file}  ${s.w * s.scale}×${s.h * s.scale}  ${Math.round(statSync(file).size / 1024)} KB  ${errors.length ? 'ERRORS: ' + errors.join(' | ') : ''}`);
    if (errors.length) failed = true;
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
  if (profile.startsWith(tmpdir())) rmSync(profile, { recursive: true, force: true });
}
// a full set, into the site: note what it was made from (see stills-fingerprint.mjs)
if (!failed && !arg('out') && !arg('only')) writeFileSync(join(root, STILLS_STAMP), stillsFingerprint() + '\n');
process.exit(failed ? 1 : 0);
