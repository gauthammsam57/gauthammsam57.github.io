// Makes the CV as a PDF, laid out like Gautham's own resume, from the same data as the CV page.
// It prints src/render/cv-print.js in a headless browser into public/Gautham-Sam-CV.pdf: no LaTeX
// is needed. It also writes cv/Gautham-Sam-CV.tex, the same CV as LaTeX, for anyone who wants to
// open it in a LaTeX editor; that file is not used to make the PDF.
//   npm run cv-pdf
// Run it again whenever the words on the CV page change; a test fails until you do.
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { loadData } from '../src/data/index.js';
import { renderCvTex } from '../src/render/cv-tex.js';
import { renderCvHtml, CV_PDF_OPTIONS } from '../src/render/cv-print.js';
import { cvFingerprint, CV_PDF, CV_TEX, CV_STAMP } from './cv-fingerprint.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const BROWSER = [process.env.BROWSER_PATH, '/usr/bin/brave-browser', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
if (!BROWSER) { console.error('No Chrome, Brave or Chromium found (set BROWSER_PATH).'); process.exit(1); }

const data = loadData();
mkdirSync(join(root, 'public'), { recursive: true });
mkdirSync(join(root, 'cv'), { recursive: true });
writeFileSync(join(root, CV_TEX), renderCvTex(data));

const out = process.argv[2] || join(root, 'public', CV_PDF); // a path can be given, for trying a layout out
const profile = mkdtempSync(join(tmpdir(), 'portfolio-cv-browser-'));
let browser;
try {
  browser = await puppeteer.launch({ executablePath: BROWSER, headless: true, userDataDir: profile, args: ['--no-first-run'] });
  const page = await browser.newPage();
  await page.setContent(renderCvHtml(data), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: out, ...CV_PDF_OPTIONS });
  const pages = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight / (96 * (11 - 0.42 - 0.62))));
  if (!process.argv[2]) writeFileSync(join(root, CV_STAMP), cvFingerprint() + '\n');
  console.log(`Wrote ${process.argv[2] ? out : 'public/' + CV_PDF} (about ${pages} pages) and ${CV_TEX}`);
} finally {
  if (browser) await browser.close();
  if (profile.startsWith(tmpdir())) rmSync(profile, { recursive: true, force: true });
}
