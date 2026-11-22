// Takes screenshots of the running site in a headless browser (software 3D), for checking the look.
//   node scripts/shoot.mjs <out-dir> '<json list of jobs>'
// A job: { name, url, w, h, wait, js, after }. The dev server must be running on port 5173.
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BROWSER = [process.env.BROWSER_PATH, '/usr/bin/brave-browser', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => p && existsSync(p));
const out = process.argv[2];
const jobs = JSON.parse(process.argv[3]);
const base = process.env.SITE_URL || 'http://localhost:5173/';
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'portfolio-shots-'));
const browser = await puppeteer.launch({ executablePath: BROWSER, headless: true, userDataDir: profile,
  args: ['--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const j of jobs) {
  const page = await browser.newPage();
  await page.setViewport({ width: j.w || 1440, height: j.h || 900, deviceScaleFactor: 1 });
  const errs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(base + (j.url || ''), { waitUntil: 'load' });
  await sleep(j.wait || 5000);
  if (j.js) { await page.evaluate(j.js); await sleep(j.after || 3000); }
  await page.screenshot({ path: join(out, j.name + '.png') });
  console.log(j.name, await page.evaluate(() => document.body.className), errs.slice(0, 4).join(' | '));
  await page.close();
}
await browser.close();
if (profile.startsWith(tmpdir())) rmSync(profile, { recursive: true, force: true });
