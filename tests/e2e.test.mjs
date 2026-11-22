// Drives the real site in a real (headless) browser, on your machine only. Run: npm run test:e2e
// It starts its own servers: one for the working copy, one for the built site as it would be published.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer, build, preview } from 'vite';
import { loadData } from '../src/data/index.js';
import { STILLS, STILL_START } from '../src/still.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const BROWSER = [process.env.BROWSER_PATH, '/usr/bin/brave-browser', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
const data = loadData();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser, devServer, prodServer, DEV, PROD, WALK, PWALK, outDir, profileDir;
// DEV and PROD are the front page (the desk); WALK and PWALK are the walk-through at its own address.

before(async () => {
  if (!BROWSER) return;
  const puppeteer = (await import('puppeteer-core')).default;
  devServer = await createServer({ root, logLevel: 'silent', server: { port: 5191, strictPort: false } });
  await devServer.listen();
  DEV = devServer.resolvedUrls.local[0];
  WALK = DEV + 'monitor/walk.html';
  process.env.NODE_ENV = 'production'; // the test runner sets "test"; a real build is production
  outDir = mkdtempSync(join(tmpdir(), 'portfolio-e2e-'));
  await build({ root, logLevel: 'silent', build: { outDir, emptyOutDir: true } });
  prodServer = await preview({ root, logLevel: 'silent', build: { outDir }, preview: { port: 5192, strictPort: false } });
  PROD = prodServer.resolvedUrls.local[0];
  PWALK = PROD + 'monitor/walk.html';
  profileDir = mkdtempSync(join(tmpdir(), 'portfolio-browser-'));
  browser = await puppeteer.launch({ executablePath: BROWSER, headless: true, userDataDir: profileDir,
    args: ['--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
});
after(async () => {
  if (browser) await browser.close();
  if (devServer) await devServer.close();
  if (prodServer) await new Promise((r) => prodServer.httpServer.close(r));
  for (const d of [outDir, profileDir]) if (d && d.startsWith(tmpdir())) rmSync(d, { recursive: true, force: true });
});

// Opens a page, collects script errors, and waits until the page has settled.
// `direct: true` opens monitor/walk.html as a visitor would; otherwise the tests stay on it to test the walk-through itself.
async function open(url, { w = 1440, h = 900, setup, reduced = false, direct = false, abort = null, touch = false } = {}) {
  const page = await browser.newPage();
  if (!direct) await page.evaluateOnNewDocument(() => { window.__stayOnWalk = true; });
  await page.setViewport({ width: w, height: h, hasTouch: touch, isMobile: touch });
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  if (setup) await page.evaluateOnNewDocument(setup);
  if (abort) { await page.setRequestInterception(true); page.on('request', (r) => (abort.test(r.url()) ? r.abort() : r.continue())); }
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => document.body.classList.contains('has-floor') || document.body.classList.contains('no-floor') || !document.getElementById('floor'), { timeout: 20000 });
  return { page, errors };
}
// Waits until a link to a scene has landed there and the camera has stopped.
async function arrived(page, id) {
  await page.waitForFunction((x) => document.body.dataset.scene === x && document.documentElement.classList.contains('ready'), { timeout: 8000 }, id);
  await sleep(500);
}
const skip = (t) => { if (!BROWSER) { t.skip('no Chrome, Brave or Chromium found (set BROWSER_PATH)'); return true; } return false; };
const state = (page) => page.evaluate(() => ({
  scene: document.body.dataset.scene,
  rail: document.querySelector('#rail a.on')?.dataset.to,
  floor: document.body.classList.contains('has-floor'),
  drawer: !document.getElementById('drawer').hidden,
  story: document.getElementById('drawer').dataset.story,
  storyTitle: document.querySelector('.drawer-body h3')?.textContent,
  url: location.search + location.hash,
  overflow: document.documentElement.scrollWidth - innerWidth,
}));

test('the page loads, the 3D floor starts, and nothing errors', async (t) => {
  if (skip(t)) return;
  const { page, errors } = await open(WALK);
  const s = await state(page);
  assert.equal(s.floor, true, 'the 3D floor did not start');
  assert.equal(s.scene, 'opening');
  assert.equal(await page.$eval('h1', (e) => e.innerText.replace(/\s+/g, ' ').trim()), data.profile.headline.join(' '));
  assert.deepEqual(errors, []);
  await page.close();
});

test('a link to any scene lands on that scene', async (t) => {
  if (skip(t)) return;
  for (const id of [...data.scenes.map((s) => s.id), 'journey', 'off', 'thanks', 'contact']) {
    const { page, errors } = await open(WALK + '#' + id);
    await page.waitForFunction((x) => document.body.dataset.scene === x, { timeout: 8000 }, id).catch(() => {});
    const s = await state(page);
    assert.equal(s.scene, id, `#${id} did not land on its scene`);
    assert.equal(s.rail, id, 'the rail marks a different scene');
    assert.deepEqual(errors, []);
    await page.close();
  }
});

test('scrolling walks through every scene in order', async (t) => {
  if (skip(t)) return;
  const { page } = await open(WALK, { reduced: true });
  const seen = [];
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= total; y += 300) {
    await page.evaluate((v) => new Promise((r) => { window.scrollTo({ top: v, behavior: 'instant' }); requestAnimationFrame(() => requestAnimationFrame(r)); }), y);
    const sc = await page.evaluate(() => document.body.dataset.scene);
    if (seen[seen.length - 1] !== sc) seen.push(sc);
  }
  assert.deepEqual(seen, ['opening', ...data.scenes.map((s) => s.id), 'journey', 'off', 'thanks', 'contact']);
  await page.close();
});

test('clicking a robot opens its story; Escape closes it', async (t) => {
  if (skip(t)) return;
  for (const s of data.scenes.filter((x) => x.stories.length)) {
    const { page, errors } = await open(WALK + '#' + s.id);
    await arrived(page, s.id);
    // every station is drawn at the same place on screen: right of the text
    let hit = false;
    for (const [fx, fy] of [[0.69, 0.52], [0.66, 0.6], [0.72, 0.45], [0.62, 0.55]]) {
      await page.mouse.move(1440 * fx, 900 * fy);
      await sleep(150);
      if ((await page.$eval('#floor', (c) => c.style.cursor)) === 'pointer') { await page.mouse.click(1440 * fx, 900 * fy); hit = true; break; }
    }
    assert.ok(hit, `${s.id}: no robot under the pointer`);
    await page.waitForFunction(() => !document.getElementById('drawer').hidden, { timeout: 5000 });
    let st = await state(page);
    assert.equal(st.story, `${s.id}.0`);
    assert.equal(st.storyTitle, s.stories[0].title);
    assert.ok(st.url.includes(`story=${s.id}`), 'the link does not remember the open story');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('drawer').hidden, { timeout: 5000 });
    st = await state(page);
    assert.ok(!st.url.includes('story='), 'the link still names a closed story');
    assert.deepEqual(errors, []);
    await page.close();
  }
});

test('a robot with no story is not clickable', async (t) => {
  if (skip(t)) return;
  for (const s of data.scenes.filter((x) => !x.stories.length)) {
    const { page } = await open(WALK + '#' + s.id);
    await arrived(page, s.id);
    await page.mouse.move(1440 * 0.69, 900 * 0.52);
    await sleep(200);
    assert.notEqual(await page.$eval('#floor', (c) => c.style.cursor), 'pointer', s.id + ' looks clickable but has nothing to open');
    assert.equal(await page.$('#' + s.id + ' .story-btn'), null);
    await page.close();
  }
});

test('story tabs, the button on the card, and "+ more" work', async (t) => {
  if (skip(t)) return;
  const wheels = data.scenes.find((s) => s.id === 'wheels');
  const { page } = await open(WALK + '#wheels');
  await arrived(page, 'wheels'); // the page is still scrolling to the scene; a click before it lands can miss the button
  await page.click('#wheels .story-btn').catch((e) => { throw new Error('click 1 #wheels .story-btn: ' + e.message); });
  await page.waitForFunction(() => !document.getElementById('drawer').hidden);
  assert.equal(await page.$$eval('.drawer-body .tabs button', (b) => b.length), wheels.stories.length);
  // the panel slides in from the side: wait until the tab is fully on screen before clicking it
  await page.waitForFunction(() => { const r = document.querySelector('.drawer-body .tabs button[data-i="2"]')?.getBoundingClientRect(); return !!r && r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }, { timeout: 8000 });
  await page.click('.drawer-body .tabs button[data-i="2"]').catch((e) => { throw new Error('click 2 .drawer-body .tabs button[data-i="2"]: ' + e.message); });
  let st = await state(page);
  assert.equal(st.storyTitle, wheels.stories[2].title);
  assert.ok(st.url.includes('story=wheels.2'));
  assert.ok((await page.$eval('.drawer-body', (e) => e.innerText)).includes('Held back'), 'the held-back clip is not marked');
  assert.equal(await page.$$eval('.drawer-body video', (v) => v.length), 0, 'the held-back clip can be played');
  await page.click('#drawer .close').catch((e) => { throw new Error('click 3 #drawer .close: ' + e.message); });
  await page.click('#wheels .more-btn').catch((e) => { throw new Error('click 4 #wheels .more-btn: ' + e.message); });
  assert.equal(await page.$eval('#wheels .proof.more', (e) => e.hidden), false);
  assert.equal(await page.$$eval('#wheels .proof li', (l) => l.length), wheels.proof.length);
  await page.close();
});

test('links straight into a story, and old links to the Team view still land', async (t) => {
  if (skip(t)) return;
  // the Team view is gone (the team is on the whiteboard): an old ?view=team link opens the walk-through
  let { page, errors } = await open(WALK + '?view=team#arms');
  let st = await state(page);
  assert.equal(st.scene, 'arms');
  assert.ok(!st.url.includes('view=team'), 'the old view is still in the address');
  assert.equal(await page.$('#team'), null);
  assert.equal(await page.$('#sw-team'), null);
  assert.deepEqual(errors, []);
  await page.close();
  ({ page } = await open(WALK + '?story=wheels.1#wheels'));
  st = await state(page);
  assert.equal(st.storyTitle, data.scenes.find((s) => s.id === 'wheels').stories[1].title);
  await page.close();
  ({ page, errors } = await open(WALK + '?story=nothing.9'));
  st = await state(page);
  assert.equal(st.drawer, false);
  assert.ok(!st.url.includes('story='), 'a bad story link was kept');
  assert.deepEqual(errors, []);
  await page.close();
});

test('footage: only cleared clips play when published, from the site itself, and the archive cannot be fetched', async (t) => {
  if (skip(t)) return;
  let { page } = await open(WALK + '?story=wheels#wheels');
  await page.waitForFunction(() => { const v = document.querySelector('#drawer video'); return v && v.readyState >= 1; }, { timeout: 15000 });
  assert.ok((await page.$eval('#drawer video', (v) => v.videoWidth)) > 0, 'the local clip did not load');
  for (const f of ['Navigation Collections/Slam-mapping and navigation_2.mov', 'Navigation Projects/Docking-Fleet Video.mov', 'Neural Foundry/ph_measure.mp4', '..%2F..%2F.git%2Fconfig', '..%2F..%2Fsite%2Fpackage.json']) {
    const status = await page.evaluate((x) => fetch('/local-media/' + x).then((r) => r.status), f);
    assert.equal(status, 404, `${f} can be fetched`);
  }
  await page.close();

  ({ page } = await open(PWALK + '?story=wheels#wheels'));
  // only cleared clips play when published: each from the site's own /media/, none from the archive
  const pub = await page.$$eval('#drawer video', (v) => v.map((x) => x.getAttribute('src') || x.dataset.src || ''));
  assert.ok(pub.length > 0, 'the cleared clips are not on the published site');
  assert.ok(pub.every((u) => u.startsWith('/media/')), 'the published site plays a clip that is not cleared: ' + pub.join(', '));
  assert.equal(await page.$$eval('.slot', (s) => s.length), 0, 'a striped box for a clip that is not cleared is on the published site');
  assert.equal(await page.evaluate(() => fetch('/local-media/Navigation%20Collections/all_robot_navigation.mp4').then((r) => r.ok && (r.headers.get('content-type') || '').startsWith('video'))), false, 'the published site serves a private clip');
  assert.equal(await page.$('#preview-note'), null, 'the preview note is on the published site');
  await page.close();
});

test('the published site behaves like the working copy', async (t) => {
  if (skip(t)) return;
  const { page, errors } = await open(PWALK + '#humanoid');
  await page.waitForFunction(() => document.body.dataset.scene === 'humanoid', { timeout: 8000 });
  await page.click('#humanoid .story-btn');
  await page.waitForFunction(() => !document.getElementById('drawer').hidden);
  assert.equal((await state(page)).storyTitle, data.scenes.find((s) => s.id === 'humanoid').stories[0].title);
  assert.equal((await state(page)).floor, true);
  assert.deepEqual(errors, []);
  await page.close();
});

test('the CV page: complete, linked both ways, and built from the same data', async (t) => {
  if (skip(t)) return;
  const { page, errors } = await open(PROD + 'cv.html');
  const txt = await page.$eval('main', (m) => m.innerText);
  const n = data.profile.numbers;
  assert.ok(txt.includes(`${n.prsWritten} written, ${n.prsReviewed} reviewed`));
  assert.equal(await page.$$eval('section.job', (s) => s.length), data.cv.jobs.length);
  assert.equal(await page.$$eval('.lights svg', (s) => s.length), new Set(Object.keys(data.activity.days).map((d) => d.slice(0, 4))).size);
  assert.ok(await page.$('#print'));
  await page.click('.top a');
  await page.waitForFunction(() => !!document.getElementById('room'), { timeout: 8000 }); // back to the front page, the desk
  await page.waitForSelector('a.cv-link');
  assert.ok((await page.$eval('a.cv-link', (a) => a.getAttribute('href'))).includes('cv.html'));
  assert.deepEqual(errors, []);
  await page.close();
});

test('phones: nothing spills off the side of the screen', async (t) => {
  if (skip(t)) return;
  for (const url of [WALK, WALK + '#wheels', WALK + '#journey', WALK + '?view=team', PROD + 'cv.html']) {
    const { page } = await open(url, { w: 390, h: 844 });
    await sleep(300);
    assert.ok((await state(page).catch(() => page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth })))).overflow <= 1, `${url} is wider than the screen`);
    await page.close();
  }
});

test('without 3D the page still reads in full', async (t) => {
  if (skip(t)) return;
  const noWebgl = () => { const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (kind, ...a) { return /webgl/.test(kind) ? null : orig.call(this, kind, ...a); }; };
  const { page, errors } = await open(WALK + '#cell', { setup: noWebgl });
  assert.equal(await page.evaluate(() => document.body.classList.contains('no-floor')), true);
  await sleep(700);
  assert.equal(await page.$eval('#cell .card', (c) => getComputedStyle(c).opacity), '1');
  await page.click('#cell .story-btn');
  await page.waitForFunction(() => !document.getElementById('drawer').hidden);
  await sleep(500);
  await page.click('#drawer .close');
  await page.waitForFunction(() => document.getElementById('drawer').hidden, { timeout: 5000 });
  assert.deepEqual(errors, []);
  await page.close();
});

test('with scripts switched off, every word is still there', async (t) => {
  if (skip(t)) return;
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.goto(PWALK, { waitUntil: 'load' });
  const txt = await page.$eval('body', (b) => b.textContent);
  for (const s of data.scenes) assert.ok(txt.includes(s.proof[0][0]), `${s.id} cannot be read without scripts`);
  await page.close();
});

// ---------- the desk page
async function openDesk(url, opts) {
  const r = await open(url, opts);
  await r.page.waitForFunction(() => document.body.classList.contains('has-room') || document.body.classList.contains('no-room'), { timeout: 20000 });
  return r;
}
const deskState = (page) => page.evaluate(() => ({
  open: document.body.dataset.open,
  time: document.body.dataset.time,
  surface: document.getElementById('surface').hidden ? null : document.getElementById('surface').dataset.kind,
  screen: !document.getElementById('screen').hidden,
  work: document.querySelector('.screen-nav a.on')?.dataset.work || null,
  url: location.search,
  room: document.body.classList.contains('has-room'),
  overflow: document.documentElement.scrollWidth - innerWidth,
}));
const shown = (page, sel) => page.waitForFunction((s) => document.querySelector(s)?.classList.contains('open'), { timeout: 8000 }, sel);

test('the desk loads with its room; there is no side panel and no headline', async (t) => {
  if (skip(t)) return;
  const { page, errors } = await openDesk(DEV);
  assert.equal((await deskState(page)).room, true, 'the 3D room did not start');
  assert.equal(await page.$('#drawer'), null, 'the side panel is back');
  assert.equal(await page.$('h1'), null, 'there is a headline at the top again');
  assert.equal(await page.$$eval('#dock button', (b) => b.length), data.desk.objects.length);
  for (const id of ['whiteboard', 'notebook', 'bin']) {
    await page.click('#dock button[data-open="' + id + '"]');
    await shown(page, '#surface');
    const st = await deskState(page);
    assert.equal(st.surface, id);
    assert.ok(st.url.includes('open=' + id), 'the link does not remember ' + id);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('surface').hidden, { timeout: 5000 });
  }
  assert.equal((await deskState(page)).url, '');
  assert.deepEqual(errors, []);
  await page.close();
});

// the walk-through page running inside the monitor's browser
async function walkFrame(page) {
  await page.waitForFunction(() => document.querySelector('#tab-walk iframe')?.getAttribute('src'), { timeout: 8000 });
  const handle = await page.$('#tab-walk iframe');
  const f = await handle.contentFrame();
  await f.waitForFunction(() => document.body.classList.contains('has-floor') || document.body.classList.contains('no-floor'), { timeout: 25000 });
  return f;
}
const address = (page) => page.$eval('#screen-path', (e) => e.textContent);

test('the desk: sit down, and the page is on the monitor itself, not in a box over it', async (t) => {
  if (skip(t)) return;
  const { page, errors } = await openDesk(DEV);
  assert.equal(await page.$eval('#tab-walk iframe', (f) => f.getAttribute('src')), null, 'the walk-through loaded before anyone looked at it');
  await page.click('#dock button[data-open="monitor"]');
  await shown(page, '#screen');
  // the page is on the monitor's own glass: it moves with the monitor as it swings over
  const fit = () => page.$eval('#screen .display', (e) => e.style.transform);
  await sleep(250);
  const early = await fit();
  // the heavy walk-through must not start during the swing, or the swing stutters
  assert.equal(await page.$eval('#tab-walk iframe', (f) => f.getAttribute('src')), null, 'the walk-through started loading during the swing');
  assert.equal(await page.$eval('#tab-walk .loader', (l) => l.classList.contains('gone')), false, 'there is no loading screen while it starts');
  await page.waitForFunction(() => document.querySelector('#screen .display').style.transform.startsWith('translate('), { timeout: 10000 });
  const settled = await fit();
  assert.ok(early.startsWith('matrix3d('), 'the page is not fitted to the monitor as it swings');
  assert.ok(settled.startsWith('translate('), 'once seated the page should sit flat, which is cheaper to draw');
  // it loads on arrival, and the loading screen goes once it has really drawn
  await page.waitForFunction(() => document.querySelector('#tab-walk iframe').getAttribute('src'), { timeout: 5000 });
  await page.waitForFunction(() => document.querySelector('#tab-walk .loader').classList.contains('gone'), { timeout: 25000 });
  assert.equal(await page.$('#screen .bezel'), null, 'a frame is drawn over the room; the frame should be the monitor itself');
  assert.equal(await page.$eval('#screen', (e) => getComputedStyle(e).backgroundColor), 'rgba(0, 0, 0, 0)', 'a backdrop dims the room like a pop-up');
  const box = await page.$eval('#screen .display', (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom, innerWidth, innerHeight]; });
  assert.ok(box[0] > 0 && box[1] > 0 && box[2] < box[4] && box[3] < box[5], 'the page spills past the monitor to the edge of the window');
  assert.ok(box[2] - box[0] > box[4] * 0.7, 'the monitor is too small to read');
  // a click on the room beside the monitor goes back to the desk
  await page.mouse.click(4, box[5] / 2);
  await page.waitForFunction(() => document.getElementById('screen').hidden, { timeout: 8000 });
  assert.equal((await deskState(page)).open, '');
  assert.deepEqual(errors, []);
  await page.close();
});

test('the desk: the monitor is a browser with two tabs that stay on the same robot', async (t) => {
  if (skip(t)) return;
  const { page, errors } = await openDesk(DEV);
  await page.click('#dock button[data-open="monitor"]');
  await shown(page, '#screen');
  // tab one: the walk-through, running as its own page with its own 3D
  assert.equal(await page.$eval('.btab[aria-selected="true"]', (b) => b.dataset.tab), 'walk');
  const f = await walkFrame(page);
  assert.equal(await f.evaluate(() => document.body.classList.contains('embed')), true);
  assert.equal(await f.evaluate(() => document.body.classList.contains('has-floor')), true, 'the robots are not running inside the monitor');
  // only the walk past the robots: the team, thanks and contact live elsewhere on the desk
  assert.deepEqual(await f.$$eval('.scene', (s) => s.map((x) => x.id)), ['opening', ...data.scenes.map((s) => s.id), 'journey']);
  assert.equal(await f.$eval('#bar', (b) => getComputedStyle(b).display), 'none');
  // walking to a robot changes the address bar outside
  await f.evaluate(() => document.getElementById('wheels').scrollIntoView({ behavior: 'auto', block: 'center' }));
  await page.waitForFunction(() => document.getElementById('screen-path').textContent === 'wheels', { timeout: 8000 });
  assert.ok((await deskState(page)).url.includes('work=wheels'));
  // "open the story" has no side panel here: it switches to the other tab, at the same robot
  await f.click('#wheels .story-btn');
  await page.waitForFunction(() => document.querySelector('.btab[aria-selected="true"]').dataset.tab === 'detail', { timeout: 5000 });
  assert.equal(await f.$eval('#drawer', (d) => d.hidden), true, 'the old side panel opened inside the monitor');
  await page.waitForFunction(() => document.querySelector('.screen-nav a.on')?.dataset.work === 'wheels', { timeout: 5000 });
  assert.equal(await address(page), 'wheels');
  assert.ok((await deskState(page)).url.includes('tab=detail'));
  // tab two: everything written out, and it scrolls
  assert.equal(await page.$$eval('#tab-detail .work', (s) => s.length), data.scenes.length);
  const before = await page.$eval('.screen-scroll', (e) => e.scrollTop);
  await page.click('#tab-detail .screen-nav a[data-work="people"]');
  await page.waitForFunction(() => document.querySelector('.screen-nav a.on')?.dataset.work === 'people', { timeout: 5000 });
  assert.ok((await page.$eval('.screen-scroll', (e) => e.scrollTop)) > before, 'the page inside the monitor did not scroll');
  // back to the walk: it goes to the robot the detail tab was on
  await page.click('.btab[data-tab="walk"]');
  await f.waitForFunction(() => document.body.dataset.scene === 'people', { timeout: 8000 });
  await page.click('#screen-back');
  await page.waitForFunction(() => document.getElementById('screen').hidden, { timeout: 8000 });
  assert.deepEqual(errors, []);
  await page.close();
});

test('the desk: the Live map tab shows the robot in the room, large, and only when picked', async (t) => {
  if (skip(t)) return;
  let { page, errors } = await openDesk(DEV);
  await page.click('#dock button[data-open="monitor"]');
  await shown(page, '#screen');
  assert.equal(await page.$eval('.btab[aria-selected="true"]', (b) => b.dataset.tab), 'walk', 'the monitor did not open on the walk-through');
  assert.equal(await page.$eval('#tab-map', (e) => e.hidden), true);
  await page.click('.btab[data-tab="map"]');
  await page.waitForFunction(() => document.querySelector('#tab-map canvas').width > 0 && document.querySelector('#tab-map canvas').dataset.t, { timeout: 8000 });
  assert.equal(await page.$eval('#tab-walk', (e) => e.hidden), true);
  assert.ok((await deskState(page)).url.includes('tab=map'));
  // larger than the picture in the room, and drawn at the screen's own pixels, keeping its shape
  const cv = await page.$eval('#tab-map canvas', (c) => ({ w: c.clientWidth, h: c.clientHeight, px: c.width })); // its own size, before the glass is fitted to the monitor in the room
  assert.ok(cv.w > 768 * 0.9, 'the live map is not drawn large: ' + JSON.stringify(cv));
  assert.ok(Math.abs(cv.w / cv.h - 768 / 440) < 0.02, 'the live map is stretched');
  assert.ok(cv.px >= Math.round(cv.w) - 1, 'the live map is drawn at fewer pixels than it is shown');
  if (data.desk.monitor.mapLegend) assert.equal(await page.$eval('#tab-map .map-legend', (e) => e.innerText.trim()), data.desk.monitor.mapLegend);
  // the robot keeps going while its map is watched, at about its own pace
  const t0 = Number(await page.$eval('#tab-map canvas', (c) => c.dataset.t)), w0 = Date.now();
  await sleep(3000);
  const t1 = Number(await page.$eval('#tab-map canvas', (c) => c.dataset.t)), went = (t1 - t0 + 1000) % 1000, real = (Date.now() - w0) / 1000;
  assert.ok(went > real * 0.5, `the robot hardly moved while its map was open (${went.toFixed(2)} s of its round in ${real.toFixed(1)} s)`);
  // leaving the tab stops drawing it
  await page.click('.btab[data-tab="detail"]');
  assert.equal(await page.$eval('#tab-map', (e) => e.hidden), true);
  const t2 = await page.$eval('#tab-map canvas', (c) => c.dataset.t);
  await sleep(600);
  assert.equal(await page.$eval('#tab-map canvas', (c) => c.dataset.t), t2, 'the map is still drawn after leaving its tab');
  assert.deepEqual(errors, []);
  await page.close();
  // a link straight to it
  ({ page, errors } = await openDesk(DEV + '?open=monitor&tab=map'));
  await page.waitForFunction(() => !document.getElementById('tab-map').hidden && document.querySelector('#tab-map canvas').width > 0, { timeout: 15000 });
  assert.equal(await page.$eval('#tab-walk iframe', (x) => x.getAttribute('src')), null, 'the walk-through loaded although its tab was never opened');
  assert.deepEqual(errors, []);
  await page.close();
});

test('the desk: a robot on the shelf, and links, open the monitor in the right place', async (t) => {
  if (skip(t)) return;
  let { page } = await openDesk(DEV + '?open=monitor&work=humanoid');
  let f = await walkFrame(page);
  await f.waitForFunction(() => document.body.dataset.scene === 'humanoid', { timeout: 10000 });
  assert.equal(await address(page), 'humanoid');
  await page.close();
  ({ page } = await openDesk(DEV + '?open=monitor&tab=detail&work=arms'));
  await page.waitForFunction(() => document.querySelector('.screen-nav a.on')?.dataset.work === 'arms', { timeout: 8000 });
  assert.equal(await page.$eval('#tab-walk', (e) => e.hidden), true);
  assert.equal(await page.$eval('#tab-walk iframe', (x) => x.getAttribute('src')), null, 'the walk-through loaded although its tab was never opened');
  await page.close();
  // find a robot on the shelf with the pointer and click it
  ({ page } = await openDesk(DEV + '?t=13'));
  await sleep(1200);
  const labels = Object.fromEntries(data.desk.shelf.map((s) => [s.label, s.id]));
  let hit = null;
  for (let fy = 0.34; fy <= 0.52 && !hit; fy += 0.03) for (let fx = 0.5; fx <= 0.9 && !hit; fx += 0.02) {
    await page.mouse.move(1440 * fx, 900 * fy);
    await sleep(60);
    const label = await page.$eval('#tip', (e) => (e.hidden ? '' : e.textContent));
    if (labels[label]) hit = [1440 * fx, 900 * fy, labels[label]];
  }
  assert.ok(hit, 'no robot on the shelf can be found with the pointer');
  await page.mouse.click(hit[0], hit[1]);
  await shown(page, '#screen');
  f = await walkFrame(page);
  await f.waitForFunction((id) => document.body.dataset.scene === id, { timeout: 10000 }, hit[2]);
  assert.equal(await address(page), hit[2]);
  await page.close();
});


test('the desk: the whiteboard shows who is on what; a bug, a feature, anyone on the tree or "me" opens what it has to say', async (t) => {
  if (skip(t)) return;
  const { page, errors } = await openDesk(DEV + '?open=whiteboard');
  await shown(page, '#surface');
  await page.waitForFunction(() => document.querySelector('#surface .board').style.transform.startsWith('translate('), { timeout: 10000 });
  const w = data.desk.whiteboard;
  assert.equal(await page.$$eval('.board-lists [data-item]', (e) => e.length), w.bugs.length + w.features.length);
  assert.ok((await page.$$eval('.board .tree .tag', (e) => e.length)) >= 4, 'nobody on the chart carries a number');
  // only the items with something to say can be opened; the rest are lines on the board
  for (const x of [...w.bugs, ...w.features]) {
    assert.equal(await page.$eval(`.board-lists [data-item="${x.id}"]`, (e) => e.tagName), x.story || x.what ? 'BUTTON' : 'SPAN', `${x.id} opens or not as its data says`);
  }
  const openOnly = (id) => page.$$eval('.board [data-story]', (e, id) => e.every((x) => x.hidden === (x.dataset.story !== id)), id);
  // each one opens alone, lights its number on the chart, and fits on the board in the room
  const fits = (id) => page.$eval('.board', (board, id) => {
    const box = board.querySelector(`[data-story="${id}"]`), b = board.getBoundingClientRect(), r = box.getBoundingClientRect();
    return r.bottom <= b.bottom - 4 && r.right <= b.right + 1;
  }, id);
  const bug = w.bugs.find((b) => b.story);
  await page.click('.board button[data-item="' + bug.id + '"]');
  assert.ok(await openOnly(bug.id));
  assert.ok((await page.$$eval('.board .tag.lit', (e) => e.map((x) => x.dataset.on))).every((x) => x === bug.id));
  for (const f of w.features.filter((x) => x.what)) {
    await page.click('.board button[data-item="' + f.id + '"]');
    assert.ok(await openOnly(f.id), `${f.id} did not open on its own`);
    const box = await page.$eval(`.board [data-story="${f.id}"]`, (e) => e.innerText);
    assert.ok(box.includes(f.what.slice(0, 40)) && (!f.part || box.includes(f.part.slice(0, 30))), `${f.id} shows the wrong words`);
    assert.ok(await fits(f.id), `${f.id} runs off the board`);
    assert.deepEqual(await page.$$eval('.board .tag.lit', (e) => e.map((x) => x.dataset.on)), [f.id]);
  }
  assert.ok((await page.$eval('.board', (e) => e.innerText)).includes(w.featuresNote), 'who built the features is not said');
  assert.equal(await page.$eval('.board .board-then', (e) => getComputedStyle(e).display), 'none', 'the 2020 notes show on today’s board');
  // "me" at the top of the tree opens the story, by click and from the keyboard, and closes again
  await page.click('.board .tree [data-item="me"]');
  assert.ok(await openOnly('me'));
  assert.ok((await page.$eval('.board [data-story="me"]', (e) => e.innerText)).includes(w.me[1].slice(0, 40)));
  assert.ok(await fits('me'), 'the story behind "me" runs off the board');
  await page.click('.board .tree [data-item="me"]');
  assert.ok(await openOnly('none'), 'clicking "me" again did not close it');
  await page.$eval('.board .tree [data-item="me"]', (e) => e.focus()); // part of the drawing (SVG), so focused from inside the page
  await page.keyboard.press('Enter');
  assert.equal(await page.$eval('.board .tree [data-item="me"]', (e) => e.getAttribute('aria-expanded')), 'true');
  // everyone on the tree opens what they are on: their role and area, their items, their own tag lit; and an item there opens that item
  const engs = w.tree.children.flatMap((k) => [k, ...(k.children || []).map((c) => ({ ...c, area: k.label }))]).filter((x) => x.on);
  assert.equal(await page.$$eval('.board .tree .node:not(.me)[data-item]', (e) => e.length), engs.length, 'not everyone on the tree opens');
  for (const [i, e] of engs.entries()) {
    const id = `p${i + 1}`;
    await page.click(`.board .tree [data-item="${id}"]`);
    assert.ok(await openOnly(id), `engineer ${id} did not open on its own`);
    const box = await page.$eval(`.board [data-story="${id}"]`, (x) => x.innerText.toLowerCase());
    const item = [...w.bugs, ...w.features].find((x) => x.id === e.on);
    assert.ok(box.includes(e.area || e.label) && box.includes(item.title.toLowerCase()), `${id} shows the wrong area or item`);
    assert.ok(await fits(id), `engineer ${id} runs off the board`);
    assert.deepEqual(await page.$$eval('.board .tag.lit', (x) => x.map((y) => y.dataset.on)), [e.on], `engineer ${id} lights the wrong tag`);
  }
  const first = `p${engs.findIndex((x) => [...w.bugs, ...w.features].find((y) => y.id === x.on && (y.story || y.what))) + 1}`;
  await page.click(`.board .tree [data-item="${first}"]`);
  await page.click(`.board [data-story="${first}"] button.goto`);
  assert.ok(await openOnly(engs[+first.slice(1) - 1].on), 'what someone is on does not open from their box');
  await page.$eval('.board .tree [data-item="p2"]', (e) => e.focus());
  await page.keyboard.press('Enter');
  assert.ok(await openOnly('p2'), 'someone on the tree does not open from the keyboard');
  const txt = await page.$eval('.board', (e) => e.innerText);
  assert.ok(!/\b(Mr|Ms|Dr)\b/.test(txt), 'the board should carry roles, not names');
  assert.deepEqual(errors, []);
  await page.close();
});

test('the desk: the whiteboard is on the whiteboard in the room, not a pop-up over it', async (t) => {
  if (skip(t)) return;
  const { page, errors } = await openDesk(DEV);
  await page.click('#dock button[data-open="whiteboard"]');
  await shown(page, '#surface');
  const fit = () => page.$eval('#surface .board', (e) => e.style.transform);
  await sleep(250);
  const early = await fit();
  assert.ok(early.startsWith('matrix3d('), 'the board is not fitted to the whiteboard while the camera moves');
  await page.waitForFunction(() => document.querySelector('#surface .board').style.transform.startsWith('translate('), { timeout: 10000 });
  // no backdrop, no drawn frame: nothing dims the room
  const look = await page.evaluate(() => {
    const b = getComputedStyle(document.querySelector('#surface .board')), s = getComputedStyle(document.getElementById('surface'));
    const r = document.querySelector('#surface .board').getBoundingClientRect();
    return { bg: s.backgroundColor, img: s.backgroundImage, border: b.borderTopWidth, shadow: b.boxShadow, box: [r.left, r.top, r.right, r.bottom, innerWidth, innerHeight] };
  });
  assert.equal(look.bg, 'rgba(0, 0, 0, 0)', 'a backdrop dims the room like a pop-up');
  assert.equal(look.img, 'none');
  assert.equal(look.border, '0px', 'a frame is drawn around the board; the frame should be the 3D board');
  assert.equal(look.shadow, 'none');
  const box = look.box;
  assert.ok(box[0] > 0 && box[1] > 0 && box[2] < box[4] && box[3] < box[5], 'the board spills past the whiteboard to the edge of the window');
  assert.ok(box[2] - box[0] > box[4] * 0.6, 'the board is too small to read');
  // a click on the room beside the board goes back to the desk, and the board shrinks back first
  await page.mouse.click(4, box[5] / 2);
  await page.waitForFunction(() => document.getElementById('surface').hidden, { timeout: 8000 });
  assert.equal((await deskState(page)).open, '');
  // so does the close control, and Escape
  await page.click('#dock button[data-open="whiteboard"]');
  await shown(page, '#surface');
  await page.click('#surface .close');
  await page.waitForFunction(() => document.getElementById('surface').hidden, { timeout: 8000 });
  await page.click('#dock button[data-open="whiteboard"]');
  await shown(page, '#surface');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('surface').hidden, { timeout: 8000 });
  assert.deepEqual(errors, []);
  await page.close();
});

test('the desk: the notebook opens on the notebook, remembers its page, and the monitor points to it', async (t) => {
  if (skip(t)) return;
  const pages = data.desk.notebook.pages;
  let { page, errors } = await openDesk(DEV + '?t=13');
  await page.evaluate(() => localStorage.clear());
  await page.click('#dock button[data-open="notebook"]');
  await shown(page, '#surface');
  // drawn on the open notebook on the desk: fitted to its corners, nothing dimming the room
  await page.waitForFunction(() => document.querySelector('.book')?.style.transform.startsWith('matrix3d('), { timeout: 8000 });
  assert.equal(await page.$eval('#surface', (e) => getComputedStyle(e).backgroundColor), 'rgba(0, 0, 0, 0)', 'a backdrop dims the room behind the notebook');
  // pages not read yet are marked; reading one clears its mark
  const unread = () => page.$$eval('.book-tabs button.unread', (b) => b.map((x) => x.dataset.pageTab));
  assert.deepEqual(await unread(), pages.slice(1).map((p) => p.id));
  await sleep(2500); // let the camera arrive so the tab is where the pointer clicks
  await page.click('.book [data-page-tab="' + pages[1].id + '"]');
  assert.deepEqual(await unread(), pages.slice(2).map((p) => p.id));
  // close it, come back: it opens where the ribbon is
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('surface').hidden, { timeout: 8000 });
  await page.click('#dock button[data-open="notebook"]');
  await shown(page, '#surface');
  assert.equal(await page.$eval('.book .page:not([hidden]) h3', (h) => h.textContent), pages[1].title, 'the notebook forgot the page');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('surface').hidden, { timeout: 8000 });
  // the end of the work on the monitor points back to the notebook
  await page.goto(DEV + '?open=monitor&tab=detail&t=13', { waitUntil: 'load' });
  await page.waitForFunction(() => document.body.classList.contains('has-room'), { timeout: 20000 });
  await shown(page, '#screen');
  await page.waitForFunction(() => document.querySelector('#screen .display').style.transform.startsWith('translate('), { timeout: 10000 });
  await page.$eval('.screen-scroll', (e) => { e.scrollTop = e.scrollHeight; });
  await sleep(300);
  await page.click('#screen [data-goto="notebook"]');
  await shown(page, '#surface');
  assert.equal((await deskState(page)).open, 'notebook');
  assert.deepEqual(errors, []);
  await page.close();
});

test('the desk: the notebook turns its pages', async (t) => {
  if (skip(t)) return;
  // start as a first-time visitor: forget the remembered page before the desk loads, not after,
  // so an earlier test (the Say hello drawer) cannot leave the notebook open at its last page
  const { page } = await openDesk(DEV, { setup: () => { try { localStorage.removeItem('nb-page'); localStorage.removeItem('nb-read'); } catch {} } });
  await page.click('#dock button[data-open="notebook"]');
await shown(page, '#surface');
  const pages = data.desk.notebook.pages;
  assert.equal(await page.$eval('.book .page:not([hidden]) h3', (h) => h.textContent), pages[0].title);
  await page.click('.book [data-page-tab="' + pages[2].id + '"]');
  assert.equal(await page.$eval('.book .page:not([hidden]) h3', (h) => h.textContent), pages[2].title);
  assert.ok((await page.$eval('.book .page:not([hidden])', (e) => e.innerText)).includes('CV'));
  await page.close();
});

test('the desk: things in the room can be clicked', async (t) => {
  if (skip(t)) return;
  const { page, errors } = await openDesk(DEV + '?t=13');
  await sleep(1200);
  // sweep the picture and collect what the pointer finds
  const found = {};
  for (let fy = 0.2; fy <= 0.86; fy += 0.06) for (let fx = 0.08; fx <= 0.92; fx += 0.04) {
    await page.mouse.move(1440 * fx, 900 * fy);
    await sleep(60);
    const label = await page.$eval('#tip', (e) => (e.hidden ? '' : e.textContent));
    if (label && !found[label]) found[label] = [1440 * fx, 900 * fy];
  }
  for (const want of ['The second monitor', 'Sit down', 'The whiteboard', 'The notebook', 'The bin', '2020', data.desk.note.link.ref + ' ↗']) assert.ok(found[want], '"' + want + '" cannot be found with the pointer');
  // the lamp is on to begin with; a click switches it off, another switches it back on
  assert.ok(found['The lamp'], 'the lamp cannot be found with the pointer');
  await page.mouse.click(found['The lamp'][0], found['The lamp'][1]);
  assert.equal(await page.evaluate(() => document.body.dataset.lamp), 'off', 'the lamp did not switch off');
  assert.equal((await deskState(page)).open, '', 'switching the lamp opened something');
  await page.mouse.click(found['The lamp'][0], found['The lamp'][1]);
  assert.equal(await page.evaluate(() => document.body.dataset.lamp), 'on');
  await page.mouse.click(found['Sit down'][0], found['Sit down'][1]);
  await shown(page, '#screen');
  assert.equal((await deskState(page)).open, 'monitor', 'clicking the second chair did not sit you down at the monitor');
  await page.click('#screen-back');
  await sleep(6000); // long enough for the robot to be on its way
  assert.deepEqual(errors, []);
  await page.close();
});

test('the desk: he is at it from 10 to 6, takes a coffee to the window, and keeps out of the way', async (t) => {
  if (skip(t)) return;
  const keep = () => { window.__keepRoom = true; }; // gives the test window.__room
  const ready = (page) => page.waitForFunction(() => document.body.classList.contains('room-ready') && window.__room && window.__room.figure, { timeout: 20000 });
  const him = (page) => page.evaluate(() => window.__room.figure.state());
  // in his hours he is at the desk; before 10 and after 6 the chair is empty
  for (const [h, there] of [[13, true], [9.5, false], [22, false]]) {
    const { page, errors } = await openDesk(DEV + '?t=' + h, { setup: keep });
    await ready(page);
    await sleep(400);
    const s = await him(page);
    assert.equal(s.visible, there, `at ${h}:00`);
    if (there) assert.equal(s.mode, 'desk', `at ${h}:00 he is not at the desk`);
    assert.deepEqual(errors, []);
    await page.close();
  }
  // a coffee: up, between the desk and the bin (never through either), to the window, back, and sitting again
  {
    const { page, errors } = await openDesk(DEV + '?t=13', { setup: keep });
    await ready(page);
    await page.evaluate(() => window.__room.figure.coffee());
    const seen = [];
    const until = Date.now() + 120000;
    let s;
    do { await sleep(150); s = await him(page); seen.push(s); } while ((s.mode !== 'desk' || seen.length < 5) && Date.now() < until);
    assert.ok(seen.some((x) => x.mode === 'busy' && x.mug), 'he did not set off with his mug');
    assert.equal(s.mode, 'desk', 'he did not come back to the desk');
    assert.equal(s.sit, 1, 'he did not sit down again');
    assert.ok(Math.min(...seen.map((x) => x.z)) < -2.5, 'he did not reach the window');
    for (const x of seen) {
      assert.ok(!(Math.abs(x.x) < 1.55 && Math.abs(x.z) < 0.68), `he walked through the desk at ${x.x}, ${x.z}`);
      assert.ok(Math.hypot(x.x - 2.1, x.z - 0.6) > 0.4, `he walked through the bin at ${x.x}, ${x.z}`);
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  // with reduced motion he only sits there: no walking, no coffee
  {
    const { page, errors } = await openDesk(DEV + '?t=13', { setup: keep, reduced: true });
    await ready(page);
    await page.evaluate(() => window.__room.figure.coffee());
    await sleep(1500);
    const s = await him(page);
    assert.ok(s.visible && s.mode === 'desk' && s.sit === 1, 'with reduced motion he should stay seated');
    assert.deepEqual(errors, []);
    await page.close();
  }
});

test('the desk: 2020 and now, and the time of day', async (t) => {
  if (skip(t)) return;
  const { page, errors } = await openDesk(DEV);
  await page.click('#dock button[data-open="photos"]');
  let st = await deskState(page);
  assert.equal(st.time, 'then');
  assert.ok(st.url.includes('time=2020'));
  assert.equal(await page.$eval('#caption [data-time-caption="then"]', (e) => e.hidden), false);
  assert.equal(st.surface, null, 'the photographs opened a panel');
  await page.click('#dock button[data-open="photos"]');
  st = await deskState(page);
  assert.equal(st.time, 'now');
  assert.ok((await page.$eval('#caption [data-time-caption="now"]', (e) => e.innerText)).includes(data.desk.time.line));
  // sitting down in 2020 brings the present back: the second monitor is not there in 2020
  await page.click('#dock button[data-open="photos"]');
  await page.click('#dock button[data-open="monitor"]');
  await shown(page, '#screen');
  assert.equal((await deskState(page)).time, 'now');
  await page.click('#screen-back');
  await page.waitForFunction(() => document.getElementById('screen').hidden, { timeout: 8000 }); // gone, so it does not take the next click
  // in 2020 the board is blank, in the room and when you walk up to it
  await page.click('#dock button[data-open="photos"]');
  assert.equal((await deskState(page)).time, 'then');
  await page.click('#dock button[data-open="whiteboard"]');
  await page.waitForFunction(() => document.querySelector('.board'), { timeout: 8000 });
  assert.equal((await deskState(page)).time, 'then', 'opening the whiteboard left 2020');
  const seen = await page.$$eval('.board [data-item], .board .tree, .board .board-title', (els) => els.filter((e) => getComputedStyle(e).visibility !== 'hidden').length);
  assert.equal(seen, 0, 'the 2020 whiteboard shows today’s team and tasks');
  // only his three notes from his first weeks, bottom left, the first one done
  const then = await page.$$eval('.board .board-then li', (els) => els.map((e) => ({ text: e.innerText.trim(), seen: getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().height > 0, done: !!e.querySelector('s') })));
  assert.deepEqual(then, data.desk.whiteboard.then.map((x) => ({ text: x.text, seen: true, done: !!x.done })), 'the 2020 board does not show his notes');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.body.dataset.open === '', { timeout: 8000 });
  await page.click('#dock button[data-open="photos"]');
  assert.equal((await deskState(page)).time, 'now');
  // morning, day, dusk and night all draw without error
  for (const h of [6.5, 13, 18.2, 23]) {
    await page.$eval('#time-test input', (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, h);
    await sleep(500);
  }
  assert.equal(await page.$eval('#time-test output', (e) => e.textContent), '23:00');
  // the walls are light; the dark colour can be tried in the preview: it switches, stays in the link, and draws at night and by day
  assert.equal(await page.evaluate(() => document.body.dataset.walls), 'light');
  await page.$eval('#walls-test', (b) => b.click()); // the preview tools are out of sight until asked for
  assert.equal(await page.evaluate(() => document.body.dataset.walls), 'dark');
  assert.ok((await deskState(page)).url.includes('walls=dark'), 'the wall colour is not kept in the link');
  await page.$eval('#time-test input', (e) => { e.value = 13; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(500);
  await page.$eval('#walls-test', (b) => b.click()); // the preview tools are out of sight until asked for
  assert.equal(await page.evaluate(() => document.body.dataset.walls), 'light');
  assert.ok(!(await deskState(page)).url.includes('walls='));
  assert.deepEqual(errors, []);
  await page.close();
});

test('the desk: scrolling moves the camera a little nearer and further, and no more', async (t) => {
  if (skip(t)) return;
  const { page, errors } = await openDesk(DEV + '?t=13');
  const zoom = () => page.evaluate(() => Number(document.body.dataset.zoom));
  const start = await zoom();
  assert.ok(start > 0.5 && start < 1, 'the camera does not start closer than the far end');
  await page.mouse.move(720, 120); // empty wall
  await page.mouse.wheel({ deltaY: -120 });
  const nearer = await zoom();
  assert.ok(nearer < start, 'scrolling up did not bring the camera nearer');
  for (let i = 0; i < 30; i++) await page.mouse.wheel({ deltaY: -120 });
  const near = await zoom();
  assert.ok(near >= 0.6 && near < nearer, 'there is no limit on the way in');
  // up close, things can still be pointed at
  await sleep(1500);
  let label = '';
  for (let fy = 0.3; fy <= 0.8 && !label; fy += 0.08) for (let fx = 0.1; fx <= 0.9 && !label; fx += 0.06) {
    await page.mouse.move(1440 * fx, 900 * fy);
    await sleep(60);
    label = await page.$eval('#tip', (e) => (e.hidden ? '' : e.textContent));
  }
  assert.ok(label, 'nothing in the room can be pointed at after zooming in');
  await page.mouse.move(720, 120);
  for (let i = 0; i < 40; i++) await page.mouse.wheel({ deltaY: 120 });
  assert.equal(await zoom(), 1, 'there is no limit on the way out');
  // at the monitor the wheel scrolls the page on the glass and leaves the camera alone
  await page.click('#dock button[data-open="monitor"]');
  await shown(page, '#screen');
  await page.mouse.move(720, 450);
  await page.mouse.wheel({ deltaY: -240 });
  assert.equal(await zoom(), 1, 'scrolling at the monitor moved the room camera');
  assert.deepEqual(errors, []);
  await page.close();
  // a phone starts with the whole room in view
  const phone = await openDesk(DEV, { w: 390, h: 844 });
  assert.equal(await phone.page.evaluate(() => Number(document.body.dataset.zoom)), 1);
  await phone.page.close();
});

test('the desk: the view leans a little with the mouse, and only in the room', async (t) => {
  if (skip(t)) return;
  const { page, errors } = await openDesk(DEV + '?t=13');
  const lean = () => page.$eval('#room', (c) => c.dataset.lean.split(',').map(Number));
  await page.mouse.move(1400, 450);
  await sleep(1500);
  let [x, y] = await lean();
  assert.ok(x > 0.5 && Math.abs(y) < 0.2, 'the view did not lean right with the mouse');
  await page.mouse.move(40, 120);
  await sleep(1500);
  [x, y] = await lean();
  assert.ok(x < -0.5 && y > 0.3, 'the view did not lean left and up with the mouse');
  // seated at the monitor the view is still, so the page stays on the glass
  await page.click('#dock button[data-open="monitor"]');
  await shown(page, '#screen');
  await page.mouse.move(1400, 800);
  await sleep(2500);
  assert.deepEqual(await lean(), [0, 0], 'the view leans while seated at the monitor');
  assert.deepEqual(errors, []);
  await page.close();
  // not for anyone who asked for less motion
  const calm = await openDesk(DEV + '?t=13', { reduced: true });
  await calm.page.mouse.move(1400, 450);
  await sleep(600);
  assert.deepEqual(await calm.page.$eval('#room', (c) => c.dataset.lean.split(',').map(Number)), [0, 0]);
  await calm.page.close();
});

test('the desk: the window on the right shows life outside work, one place at a time', async (t) => {
  if (skip(t)) return;
  const places = data.desk.outside.places;
  const { page, errors } = await openDesk(DEV + '?t=13');
  const cap = () => page.$eval('[data-place-caption]', (p) => (p.hidden ? null : { name: p.querySelector('[data-place-name]').textContent, text: p.innerText }));
  assert.equal(await cap(), null, 'a place is named before anyone went to the window');
  await page.click('#dock button[data-open="outside"]');
  assert.equal((await cap()).name, places[0].name);
  assert.ok(!/\d\s*\/\s*\d/.test((await cap()).text), 'the caption counts the places');
  assert.ok((await deskState(page)).url.includes('place=' + places[0].id));
  assert.equal((await deskState(page)).surface, null, 'the window opened a panel');
  await page.click('[data-place-next]');
  assert.equal((await cap()).name, places[1].name);
  // after the last place it starts again
  for (let i = 2; i <= places.length; i++) await page.click('[data-place-next]');
  assert.equal((await cap()).name, places[0].name);
  // up close, the glass itself can be clicked for the next place
  await sleep(2500);
  let at = null;
  for (let fy = 0.3; fy <= 0.6 && !at; fy += 0.1) for (let fx = 0.3; fx <= 0.7 && !at; fx += 0.1) {
    await page.mouse.move(1440 * fx, 900 * fy);
    await sleep(60);
    if ((await page.$eval('#tip', (e) => (e.hidden ? '' : e.textContent))) === data.desk.outside.label) at = [1440 * fx, 900 * fy];
  }
  assert.ok(at, 'the window cannot be found with the pointer');
  await page.mouse.click(at[0], at[1]);
  assert.equal((await cap()).name, places[1].name);
  await page.click('[data-place-back]');
  assert.equal((await deskState(page)).open, '');
  assert.equal(await cap(), null);
  // coming back, it is still on the place that was left
  await page.click('#dock button[data-open="outside"]');
  assert.equal((await cap()).name, places[1].name);
  // each place has its photograph: the file is there, and the stand-in label is not shown
  for (const pl of places) {
    assert.ok(pl.photo, pl.name + ' has no photograph');
    assert.equal(await page.evaluate(async (u) => (await fetch(u)).headers.get('content-type'), pl.photo), 'image/jpeg', pl.name + ': the photograph is missing');
  }
  assert.equal(await page.$eval('[data-place-standin]', (e) => getComputedStyle(e).display), 'none', 'a real photograph is labelled as a stand-in');
  assert.equal(await page.$eval('[data-place-more]', (a) => a.href), data.desk.outside.more.href);
  assert.deepEqual(errors, []);
  await page.close();
  // a link straight to a place
  const linked = await openDesk(DEV + '?open=outside&place=' + places[3].id);
  assert.equal(await linked.page.$eval('[data-place-name]', (e) => e.textContent), places[3].name);
  assert.deepEqual(linked.errors, []);
  await linked.page.close();
  // published: the stand-in label is a preview-only note
  const pub = await openDesk(PROD + '?open=outside');
  assert.equal(await pub.page.$('[data-place-standin]'), null);
  assert.equal(await pub.page.$eval('[data-place-name]', (e) => e.textContent), places[0].name);
  await pub.page.close();
});

test('the desk: the drawers can be read, and take you to the CV and to the notebook', async (t) => {
  if (skip(t)) return;
  const [cv, hello] = data.desk.drawers;
  const { page, errors } = await openDesk(DEV + '?t=13');
  await sleep(1200);
  const found = {};
  for (let fy = 0.6; fy <= 0.9; fy += 0.025) for (let fx = 0.45; fx <= 0.75; fx += 0.02) {
    await page.mouse.move(1440 * fx, 900 * fy);
    await sleep(50);
    const label = await page.$eval('#tip', (e) => (e.hidden ? '' : e.textContent));
    if (label && !found[label]) found[label] = [1440 * fx, 900 * fy];
  }
  assert.ok(found[cv.label] && found[hello.label], 'a drawer cannot be found with the pointer');
  // the second drawer opens the notebook at the page it names
  await page.mouse.click(found[hello.label][0], found[hello.label][1]);
  await page.waitForFunction(() => document.body.dataset.open === 'notebook', { timeout: 8000 });
  await page.waitForFunction((id) => document.querySelector('[data-page-tab][aria-selected="true"]')?.dataset.pageTab === id, { timeout: 8000 }, hello.page);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.body.dataset.open === '', { timeout: 8000 });
  await sleep(2500); // the camera is back where the drawers were found
  // the first one leaves for the CV page
  await Promise.all([page.waitForNavigation({ timeout: 8000 }), page.mouse.click(found[cv.label][0], found[cv.label][1])]);
  assert.ok(page.url().endsWith('cv.html'), 'the CV drawer did not open the CV page');
  // it got there by the sheet lifted out of the drawer, and the page knows to settle in
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('arrive')), true, 'the CV page did not arrive from the drawer');
  assert.ok(await page.$('.top a.back'), 'the CV page has no way back to the desk');
  assert.deepEqual(errors, []);
  await page.close();
});

test('the desk: the gears turn and the board lights up, seen from close over the desk', async (t) => {
  if (skip(t)) return;
  const [gears, board] = ['gears', 'board'].map((id) => data.desk.small.items.find((x) => x.id === id));
  const { page, errors } = await openDesk(DEV + '?t=13');
  await sleep(1200);
  const shownCaption = () => page.$$eval('[data-small-caption]', (ps) => ps.filter((p) => !p.hidden).map((p) => p.dataset.smallCaption));
  const turned = () => page.$eval('#room', (c) => Number(c.dataset.gears || 0));
  assert.deepEqual(await shownCaption(), []);
  // both can be found on the desk from the room
  const found = {};
  for (let fy = 0.5; fy <= 0.72; fy += 0.02) for (let fx = 0.4; fx <= 0.7; fx += 0.015) {
    await page.mouse.move(1440 * fx, 900 * fy);
    await sleep(45);
    const label = await page.$eval('#tip', (e) => (e.hidden ? '' : e.textContent));
    if (label && !found[label]) found[label] = [1440 * fx, 900 * fy];
  }
  assert.ok(found[gears.label] && found[board.label], 'the gears or the board cannot be found with the pointer');
  // a click leans over the desk, names the thing, and sets the gears going
  const before = await turned();
  await page.mouse.click(found[gears.label][0], found[gears.label][1]);
  assert.equal((await deskState(page)).open, 'gears');
  assert.deepEqual(await shownCaption(), ['gears']);
  assert.ok((await page.$eval('[data-small-caption="gears"]', (p) => p.innerText)).includes(gears.caption));
  await sleep(2000);
  assert.ok((await turned()) > before + 1, 'the gears did not turn after a click');
  assert.ok((await deskState(page)).url.includes('open=gears'));
  await page.click('[data-small-caption="gears"] [data-small-back]');
  assert.equal((await deskState(page)).open, '');
  assert.deepEqual(await shownCaption(), []);
  assert.deepEqual(errors, []);
  await page.close();
  // a link to the board, and the pattern of lights runs without error
  const linked = await openDesk(DEV + '?open=board');
  assert.deepEqual(await linked.page.$$eval('[data-small-caption]', (ps) => ps.filter((p) => !p.hidden).map((p) => p.dataset.smallCaption)), ['board']);
  await sleep(3200);
  await linked.page.keyboard.press('Escape');
  assert.equal((await deskState(linked.page)).open, '');
  assert.deepEqual(linked.errors, []);
  await linked.page.close();
  // with less motion asked for, the gears stay still
  const calm = await openDesk(DEV + '?open=gears', { reduced: true });
  await sleep(1200);
  assert.equal(await calm.page.$eval('#room', (c) => Number(c.dataset.gears || 0)), 0);
  await calm.page.close();
  // published: no draft label on the caption
  const pub = await openDesk(PROD + '?open=gears');
  assert.ok(!(await pub.page.$eval('[data-small-caption="gears"]', (p) => p.innerText)).includes('Draft wording'));
  await pub.page.close();
});

test('the desk: the clock can be dragged to another time, and a click puts it back', async (t) => {
  if (skip(t)) return;
  const { page, errors } = await openDesk(DEV);
  await sleep(1200);
  const hours = () => page.evaluate(() => document.body.dataset.hours || '');
  const note = () => page.$eval('#clock-note', (p) => (p.hidden ? null : p.innerText));
  assert.equal(await note(), null, 'the page says the time was changed before anyone changed it');
  // the preview tools are not in the way: hidden until D is pressed
  assert.equal(await page.$eval('#time-test', (e) => getComputedStyle(e).display), 'none');
  // find the clock on the wall
  let at = null;
  for (let fy = 0.04; fy <= 0.3 && !at; fy += 0.02) for (let fx = 0.3; fx <= 0.7 && !at; fx += 0.015) {
    await page.mouse.move(1440 * fx, 900 * fy);
    await sleep(45);
    if ((await page.$eval('#tip', (e) => (e.hidden ? '' : e.textContent))) === data.desk.clock.hint) at = [1440 * fx, 900 * fy];
  }
  assert.ok(at, 'the clock cannot be found with the pointer');
  // press on it and drag round: the time changes, and the page says it is no longer the real time
  await page.mouse.move(at[0], at[1]);
  await page.mouse.down();
  for (const [dx, dy] of [[30, 10], [50, 40], [40, 80], [0, 100], [-50, 90]]) { await page.mouse.move(at[0] + dx, at[1] + dy, { steps: 4 }); await sleep(40); }
  await page.mouse.up();
  const set = await hours();
  assert.notEqual(set, '', 'dragging the clock did not change the time');
  const said = await note();
  assert.ok(said && /\d\d:\d\d/.test(said) && said.includes(data.desk.clock.set), 'nothing says the time is not the real one');
  assert.equal((await deskState(page)).open, '', 'letting go of the clock opened something');
  // the button puts it back
  await page.click('#clock-note [data-clock-reset]');
  assert.equal(await hours(), '');
  assert.equal(await note(), null);
  // so does a click on the clock itself
  await page.mouse.move(at[0], at[1]);
  await page.mouse.down();
  await page.mouse.move(at[0] + 60, at[1] + 90, { steps: 6 });
  await page.mouse.up();
  assert.notEqual(await hours(), '');
  await page.mouse.click(at[0], at[1]);
  assert.equal(await hours(), '', 'a click on the clock did not put it back to now');
  // the preview tools appear with D
  await page.keyboard.press('d');
  assert.notEqual(await page.$eval('#time-test', (e) => getComputedStyle(e).display), 'none');
  assert.deepEqual(errors, []);
  await page.close();
  // published: a link to a time says so, the button returns to now, and there are no preview tools
  const pub = await openDesk(PROD + '?t=18.5');
  assert.ok((await pub.page.$eval('#clock-note', (p) => (p.hidden ? '' : p.innerText))).includes('18:30'));
  await pub.page.click('#clock-note [data-clock-reset]');
  assert.equal(await pub.page.$eval('#clock-note', (p) => p.hidden), true);
  assert.ok(!(await deskState(pub.page)).url.includes('t='), 'the link still asks for the old time');
  await pub.page.keyboard.press('d');
  assert.equal(await pub.page.$('#time-test'), null);
  await pub.page.close();
});

test('the desk: published, on a phone, and without 3D', async (t) => {
  if (skip(t)) return;
  let { page, errors } = await openDesk(PROD + '?open=monitor&work=wheels');
  assert.ok((await page.$$eval('video', (v) => v.map((x) => x.getAttribute('src') || x.dataset.src || ''))).every((u) => u.startsWith('/media/')), 'the published desk plays a clip that is not cleared');
  assert.equal(await page.$('#preview-note'), null);
  assert.equal(await page.$('#time-test'), null, 'the time-of-day tester is on the published site');
  assert.equal(await page.$('#walls-test'), null, 'the wall colour switch is on the published site');
  assert.equal(await page.evaluate(() => document.body.dataset.walls), 'light', 'the published desk does not have its light walls');
  assert.ok(!(await page.$eval('body', (b) => b.innerText)).includes('Draft wording'));
  assert.deepEqual(errors, []);
  await page.close();
  for (const u of ['', '?open=whiteboard', '?open=notebook', '?open=monitor', '?open=outside', '?open=gears']) {
    ({ page } = await openDesk(DEV + u, { w: 390, h: 844 }));
    await sleep(900);
    assert.ok((await deskState(page)).overflow <= 1, u + ' is wider than a phone screen');
    await page.close();
  }
  const noWebgl = () => { const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (kind, ...a) { return /webgl/.test(kind) ? null : orig.call(this, kind, ...a); }; };
  ({ page, errors } = await openDesk(DEV, { setup: noWebgl, abort: /\/still\// }));
  assert.equal(await page.evaluate(() => document.body.classList.contains('no-room')), true);
  assert.equal(await page.$eval('.btab[data-tab="map"]', (b) => b.hidden), true, 'the Live map tab is offered with no robot to show');
  // without the room, and without its picture, the note is still there, as text, with its link
  const note = await page.$eval('#note-plain', (e) => ({ shown: getComputedStyle(e).display !== 'none', text: e.innerText, href: e.querySelector('a').href }));
  assert.ok(note.shown && note.text.includes(data.desk.note.verse.lines[0]));
  assert.equal(note.href, data.desk.note.link.href);
  await page.click('#dock button[data-open="bin"]');
  await shown(page, '#surface');
  assert.ok((await page.$eval('.paper h3', (h) => h.textContent)).includes(data.desk.bin.sheets[0].title));
  assert.deepEqual(errors, []);
  await page.close();
});

test('clips are not downloaded until they come near the screen', async (t) => {
  if (skip(t)) return;
  const videoRequests = [];
  const { page, errors } = await openDesk(DEV, { setup: () => {} });
  page.on('request', (r) => { if (/\.(mp4|webm|mov)/i.test(r.url())) videoRequests.push(r.url()); });
  await sleep(1500);
  const count = await page.$$eval('#screen video', (v) => v.length);
  assert.ok(count > 0, 'no clips in the monitor to check (the dev server shows them)');
  assert.equal(await page.$$eval('video[src]', (v) => v.length), 0, 'a clip was given its address on arrival');
  // open the monitor's In detail tab, and scroll to the first clip: that one, and only those near it, load
  await page.goto(DEV + '?open=monitor&tab=detail', { waitUntil: 'load' });
  await page.waitForFunction(() => document.body.classList.contains('has-room'), { timeout: 20000 });
  await shown(page, '#screen');
  await page.evaluate(() => document.querySelector('#screen video').scrollIntoView({ block: 'center' }));
  await page.waitForFunction(() => document.querySelector('#screen video').getAttribute('src'), { timeout: 8000 });
  const after = await page.$$eval('#screen video', (v) => v.filter((x) => x.getAttribute('src')).length);
  assert.ok(after >= 1 && after < count, `${after} of ${count} clips loaded`);
  assert.deepEqual(errors, []);
  await page.close();
});

// Where a thing is in the still picture, in page pixels: the middle of the longest run of map cells
// that is it, so the point is well inside it; or, with `beside`, the first empty cell below that.
const stillSpot = (page, id, { beside = false } = {}) => page.evaluate(async (id, beside) => {
  const b = document.getElementById('still'), r = b.querySelector('.still-pic').getBoundingClientRect();
  const m = await (await fetch('./still/' + b.dataset.still.replace(/\.\w+$/, '.spots.json'))).json();
  const grid = m.runs.map((row) => { const out = []; for (let k = 0; k < row.length; k += 2) for (let n = 0; n < row[k + 1]; n++) out.push(m.ids[row[k]]); return out; });
  let best = null;
  grid.forEach((row, j) => { let i = 0; while (i < row.length) { let n = 0; while (row[i + n] === id) n++; if (n && (!best || n > best.n)) best = { n, i: i + n / 2, j }; i += n || 1; } });
  if (!best) return null;
  let { i, j } = best;
  if (beside) { const col = Math.floor(i); while (j < grid.length && grid[j][col] !== null) j++; i = col + 0.5; }
  return [r.left + (i / m.cols) * r.width, r.top + ((j + 0.5) / m.rows) * r.height];
}, id, beside);

test('where 3D cannot run, the room is there as a still picture', async (t) => {
  if (skip(t)) return;
  const noWebgl = () => { const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (kind, ...a) { return /webgl/.test(kind) ? null : orig.call(this, kind, ...a); }; };
  const still = (page) => page.evaluate(() => {
    const box = document.getElementById('still'), img = box.querySelector('img'), r = box.querySelector('.still-pic').getBoundingClientRect();
    return { on: box.classList.contains('on'), hidden: box.hidden, size: [img.naturalWidth, img.naturalHeight], file: box.dataset.still,
      swipe: getComputedStyle(box).overflowX === 'auto' ? box.scrollWidth - box.clientWidth : 0, scrolled: box.scrollLeft, picH: r.height,
      covers: r.left <= 0.5 && r.top <= 0.5 && r.right >= innerWidth - 0.5 && r.bottom >= innerHeight - 0.5,
      shape: r.width / r.height, walls: document.body.dataset.walls, noRoom: document.body.classList.contains('no-room'),
      canvas: getComputedStyle(document.getElementById('room')).display,
      note: (() => { const n = document.getElementById('note-plain'), r = n.getBoundingClientRect(); return { w: r.width, h: r.height, text: n.textContent }; })(),
      overflow: document.documentElement.scrollWidth - innerWidth, url: location.search };
  });
  const loaded = (page) => page.waitForFunction(() => document.getElementById('still').classList.contains('on'), { timeout: 8000 });
  const sizeOf = (file) => { const x = STILLS.find((y) => y.file === file); return x && [x.w * x.scale, x.h * x.scale]; };
  const s0 = STILLS[0];
  // wide, tall and phone-shaped windows: the picture always fills the window, undistorted
  for (const [w, h] of [[1440, 900], [2200, 800], [390, 844]]) {
    const { page, errors } = await openDesk(DEV, { w, h, setup: noWebgl });
    await loaded(page);
    const s = await still(page);
    assert.ok(s.noRoom && !s.hidden && s.canvas === 'none', `${w}×${h}: the still did not take the room's place`);
    assert.deepEqual(s.size, sizeOf(s.file), 'the picture is not the size the list says: run npm run stills');
    assert.ok(s.covers, `${w}×${h}: the picture leaves part of the window bare`);
    assert.ok(Math.abs(s.shape - s0.w / s0.h) < 0.01, `${w}×${h}: the picture is stretched`);
    if (h > w) {
      // upright: the picture fills the height and is swiped sideways, starting with the desk in view
      assert.ok(s.swipe > w && Math.abs(s.picH - h) < 1, `${w}×${h}: the picture cannot be swiped`);
      await page.waitForFunction(() => document.getElementById('still').dataset.spots, { timeout: 8000 });
      await sleep(1600); // after the little nudge
      for (const id of STILL_START) { const [x] = await stillSpot(page, id); assert.ok(x > 0 && x < w, `${id} is not in view at the start`); }
    } else assert.ok(s.swipe <= 1 && s.scrolled === 0, `${w}×${h}: the picture scrolls on a wide screen`);
    assert.equal(s.walls, 'light', 'the words at the top have no dark backing on the light picture');
    assert.ok(s.overflow <= 1, `${w}×${h}: the page scrolls sideways`);
    // the note is the small one in the picture: no big card over it, but its words are still in the page
    assert.ok(s.note.w <= 1 && s.note.h <= 1, `${w}×${h}: the note covers the picture`);
    assert.ok(s.note.text.includes(data.desk.note.verse.lines[0]), 'the note\'s words left the page');
    // everything still opens from the buttons along the bottom
    await page.click('#dock button[data-open="bin"]');
    await shown(page, '#surface');
    assert.deepEqual(errors, []);
    await page.close();
  }
  // the picture can be clicked like the room: hover shows the name, a click opens the thing
  {
    const { page, errors } = await openDesk(DEV + '?still=1');
    await page.waitForFunction(() => document.getElementById('still').dataset.spots, { timeout: 8000 });
    const spot = (id) => stillSpot(page, id);
    const at = await spot('whiteboard');
    await page.mouse.move(...at);
    await page.waitForFunction(() => !document.getElementById('tip').hidden, { timeout: 3000 });
    assert.equal(await page.$eval('#tip', (e) => e.textContent), 'The whiteboard');
    assert.equal(await page.$eval('#still', (e) => e.style.cursor), 'pointer');
    await page.mouse.click(...at);
    await shown(page, '#surface');
    assert.equal((await deskState(page)).surface, 'whiteboard');
    await page.keyboard.press('Escape');
    await sleep(400);
    // the lamp and the clock only work in the room: in the picture they are not offered
    await page.mouse.move(...(await spot('lamp')));
    await sleep(200);
    assert.equal(await page.$eval('#tip', (e) => e.hidden), true, 'the lamp is offered in the still picture');
    // the Say hello drawer opens the notebook at its page; a robot on the shelf opens the monitor at it
    await page.mouse.click(...(await spot('drawer:hello')));
    await shown(page, '#surface');
    assert.equal((await deskState(page)).surface, 'notebook');
    await page.keyboard.press('Escape');
    await sleep(400);
    await page.mouse.click(...(await spot('shelf:wheels')));
    await page.waitForFunction(() => document.body.dataset.open === 'monitor', { timeout: 5000 });
    assert.ok(page.url().includes('work=wheels'));
    assert.deepEqual(errors, []);
    await page.close();
  }
  // a finger is less exact than a mouse: on a phone a tap just beside a drawer still opens it
  {
    const { page, errors } = await openDesk(DEV + '?still=1', { w: 390, h: 844, touch: true });
    await page.waitForFunction(() => document.getElementById('still').dataset.spots, { timeout: 8000 });
    await sleep(1600);
    const [x, y] = await stillSpot(page, 'drawer:hello', { beside: true });
    assert.ok(x > 0 && x < 390, 'the drawer is not in view');
    await page.touchscreen.tap(x, y);
    await shown(page, '#surface');
    assert.equal((await deskState(page)).surface, 'notebook');
    assert.deepEqual(errors, []);
    await page.close();
  }
  // The photographs: the picture changes to the 2020 desk and back, as the room does
  {
    const { page, errors } = await openDesk(DEV + '?still=1&t=13');
    await loaded(page);
    await page.click('#dock button[data-open="photos"]');
    await page.waitForFunction(() => document.getElementById('still').dataset.still === 'room-2020-day.webp', { timeout: 5000 });
    await page.waitForFunction(() => document.querySelector('#still img').complete, { timeout: 8000 });
    assert.ok(page.url().includes('time=2020'));
    await page.click('#dock button[data-open="photos"]');
    await page.waitForFunction(() => document.getElementById('still').dataset.still === 'room-day.webp', { timeout: 5000 });
    // a link to the 2020 desk opens on its picture
    await page.goto(DEV + '?still=1&t=13&time=2020', { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('still').dataset.still === 'room-2020-day.webp', { timeout: 8000 });
    assert.deepEqual(errors, []);
    await page.close();
  }
  // The window: with no window to show it in, each place is shown as a print, above its caption
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const { page, errors } = await openDesk(DEV + '?still=1', { w, h });
    await loaded(page);
    const print = () => page.evaluate(() => {
      const f = document.getElementById('place-print'), img = f.querySelector('img'), r = f.getBoundingClientRect(), c = document.querySelector('[data-place-caption]').getBoundingClientRect();
      return { shown: !f.hidden && f.classList.contains('on'), src: img.getAttribute('src'), alt: img.alt, loaded: img.naturalWidth > 0,
        inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0, aboveCaption: r.bottom <= c.top + 4, dim: document.body.classList.contains('place-print') };
    });
    await page.click('#dock button[data-open="outside"]');
    await page.waitForFunction(() => document.getElementById('place-print').classList.contains('on'), { timeout: 8000 });
    let p = await print();
    const pl = data.desk.outside.places;
    assert.ok(p.shown && p.loaded && p.dim, `${w}×${h}: the place is not shown`);
    assert.equal(p.src, pl[0].photo);
    assert.equal(p.alt, pl[0].name);
    assert.ok(p.inView && p.aboveCaption, `${w}×${h}: the print is off the screen or under its caption`);
    await page.click('[data-place-next]');
    await page.waitForFunction((src) => document.querySelector('#place-print img').getAttribute('src') === src && document.getElementById('place-print').classList.contains('on'), { timeout: 8000 }, pl[1].photo);
    await page.click('[data-place-back]');
    await sleep(300);
    p = await print();
    assert.ok(!p.shown && !p.dim, 'the print stayed after going back to the desk');
    assert.deepEqual(errors, []);
    await page.close();
  }
  // a link straight to the window opens on the print too (it opens before the picture is chosen)
  {
    const { page, errors } = await openDesk(DEV + '?still=1&open=outside');
    await page.waitForFunction((src) => document.querySelector('#place-print img').getAttribute('src') === src && document.getElementById('place-print').classList.contains('on'), { timeout: 8000 }, data.desk.outside.places[0].photo);
    assert.deepEqual(errors, []);
    await page.close();
  }
  // once the 3D room is up the print goes: the place is in the window (while it loads, the still
  // picture is up, and the print with it)
  {
    const { page } = await openDesk(DEV + '?open=outside');
    await page.waitForFunction(() => document.body.classList.contains('room-ready') && !document.body.classList.contains('has-still'), { timeout: 20000 });
    await sleep(300);
    assert.equal(await page.$eval('#place-print', (f) => f.hidden), true);
    assert.equal(await page.evaluate(() => document.body.classList.contains('place-print')), false);
    await page.close();
  }
  // the picture is the time of day it is in Hyderabad (here, the hour the link asks for)
  for (const [hour, time] of [[7, 'morning'], [13, 'day'], [18.5, 'dusk'], [22, 'night'], [3, 'night']]) {
    const { page } = await openDesk(DEV + '?still=1&t=' + hour);
    await loaded(page);
    assert.equal((await still(page)).file, `room-${time}.webp`, `at ${hour}:00`);
    await page.close();
  }
  // it can be asked for where 3D would run (?still=1), and the address keeps saying so
  let { page, errors } = await openDesk(DEV + '?still=1&open=whiteboard');
  await loaded(page);
  let s = await still(page);
  assert.ok(s.noRoom && s.covers && s.url.includes('still=1') && s.url.includes('open=whiteboard'), JSON.stringify(s));
  assert.equal((await deskState(page)).surface, 'whiteboard');
  assert.deepEqual(errors, []);
  await page.close();
  // published
  ({ page, errors } = await openDesk(PROD + '?still=1'));
  await loaded(page);
  s = await still(page);
  assert.deepEqual(s.size, sizeOf(s.file));
  assert.deepEqual(errors, []);
  await page.close();
  // with 3D, the picture is shown while the room loads (held back here), then the room fades in over it and it goes
  {
    const p = await browser.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.setRequestInterception(true);
    p.on('request', (r) => { if (/\/src\/room\.js/.test(r.url())) setTimeout(() => r.continue(), 2500); else r.continue(); });
    await p.goto(DEV + '?t=13', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => document.getElementById('still').classList.contains('on') && document.getElementById('still').dataset.spots, { timeout: 8000 });
    assert.equal(await p.evaluate(() => document.body.classList.contains('has-room')), false, 'the room was not held back');
    assert.equal(await p.$eval('#room', (c) => getComputedStyle(c).opacity), '0', 'the room shows before it is drawn');
    // what is opened from the picture meanwhile is open in the room once it comes
    await p.mouse.click(...(await stillSpot(p, 'whiteboard')));
    await shown(p, '#surface');
    await p.waitForFunction(() => document.body.classList.contains('room-ready'), { timeout: 30000 });
    await p.waitForFunction(() => document.getElementById('still').hidden, { timeout: 5000 });
    const after = await p.evaluate(() => ({ open: document.body.dataset.open, room: getComputedStyle(document.getElementById('room')).opacity, hasStill: document.body.classList.contains('has-still') }));
    assert.deepEqual(after, { open: 'whiteboard', room: '1', hasStill: false });
    assert.deepEqual(errs, []);
    await p.close();
  }
  // on a connection that asks to save data, nothing extra is fetched while the room loads
  ({ page } = await openDesk(DEV, { setup: () => { Object.defineProperty(navigator, 'connection', { get: () => ({ saveData: true }) }); } }));
  assert.equal(await page.$eval('#still img', (i) => i.getAttribute('src')), null, 'the still was fetched although data is being saved');
  await page.close();
  // if the picture cannot be had, the plain dark page stays, and still works
  ({ page, errors } = await openDesk(DEV + '?still=1', { abort: /\/still\// }));
  await page.waitForFunction(() => document.getElementById('still').hidden, { timeout: 8000 });
  assert.equal(await page.evaluate(() => document.body.classList.contains('has-still')), false);
  // and then the note shows as a card, as it did before there was a picture
  assert.ok(await page.$eval('#note-plain', (e) => e.getBoundingClientRect().width > 100), 'without the picture the note is gone');
  await page.click('#dock button[data-open="notebook"]');
  await shown(page, '#surface');
  await page.close();
});

test('the walk-through lives in the monitor: opened on its own, it goes to the desk', async (t) => {
  if (skip(t)) return;
  // a visitor who lands on monitor/walk.html is taken to the desk, seated at the monitor
  let { page, errors } = await openDesk(WALK, { direct: true });
  assert.ok(!page.url().includes('walk.html'), 'the walk-through address was not left');
  assert.ok(!page.url().includes('/monitor/'), 'the redirect stayed inside monitor/');
  assert.equal((await deskState(page)).open, 'monitor');
  assert.deepEqual(errors, []);
  await page.close();
  // a link to one robot keeps its robot
  ({ page, errors } = await openDesk(WALK + '#wheels', { direct: true }));
  assert.equal((await deskState(page)).open, 'monitor');
  assert.ok(page.url().includes('work=wheels'), 'the link lost its robot');
  await page.close();
  // published too
  ({ page } = await openDesk(PWALK + '?story=arms.1', { direct: true }));
  assert.ok(page.url().includes('open=monitor') && page.url().includes('work=arms'));
  await page.close();
  // inside the monitor it stays put, as the walk-through
  ({ page } = await openDesk(DEV + '?open=monitor', { direct: true }));
  await page.waitForFunction(() => document.querySelector('#tab-walk iframe')?.getAttribute('src'), { timeout: 8000 });
  const frame = await (await page.$('#tab-walk iframe')).contentFrame();
  await frame.waitForSelector('#walk', { timeout: 15000 });
  assert.ok(frame.url().includes('walk.html'), 'the walk-through left the monitor');
  await page.close();
});
