// Builds the site the way it would be published and checks what comes out. Run: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { loadData } from '../src/data/index.js';
import { allClips } from '../src/data/validate.js';
import { STILLS, STILL_DIR, SPOT_CELL, SHARE, spotsFile } from '../src/still.js';

const root = fileURLToPath(new URL('..', import.meta.url));
let out;
const files = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; });

before(async () => {
  process.env.NODE_ENV = 'production'; // the test runner sets "test"; a real build is production
  out = mkdtempSync(join(tmpdir(), 'portfolio-build-'));
  await build({ root, logLevel: 'silent', build: { outDir: out, emptyOutDir: true } });
});
after(() => { if (out && out.startsWith(tmpdir())) rmSync(out, { recursive: true, force: true }); });

test('the pages are complete HTML before any script runs', () => {
  const data = loadData();
  const index = readFileSync(join(out, 'monitor', 'walk.html'), 'utf8');
  const desk = readFileSync(join(out, 'index.html'), 'utf8');
  const cvPage = readFileSync(join(out, 'cv.html'), 'utf8');
  for (const s of data.scenes) assert.ok(index.includes(`id="${s.id}"`), `scene ${s.id} is not in the built page`);
  assert.ok(index.includes(data.profile.headline[0].replace(/&/g, '&amp;')));
  assert.ok(!/<!--@\w+-->/.test(index + cvPage + desk), 'a placeholder was left unfilled');
  assert.ok(desk.includes('id="room"') && desk.includes('monitor/walk.html?embed=1'), 'the front page is not the desk');
  assert.ok(!existsSync(join(out, 'walk.html')), 'the walk-through still has a top-level address of its own');
  assert.ok(!index.includes('id="preview-note"') && !index.includes('to add'), 'a preview-only note is in the published page');
  for (const j of data.cv.jobs) assert.ok(cvPage.includes(j.company));
  assert.ok(cvPage.includes('<svg class="year"'), 'the activity lights are missing from the CV');
  assert.ok(!index.includes('<svg class="year"'), 'the activity lights are in the walk-through (they are on the CV only)');
});

test('the still pictures of the room are in the built site', () => {
  // shown where 3D cannot run; taken by `npm run stills`
  assert.ok(STILLS.length > 0);
  for (const s of STILLS) {
    const f = join(out, STILL_DIR, s.file);
    assert.ok(existsSync(f), `${s.file} is missing: run npm run stills`);
    const kb = statSync(f).size / 1024;
    assert.ok(kb > 10 && kb < 400, `${s.file} is ${Math.round(kb)} KB`);
    // and beside it, the map of what can be clicked in it, the same shape as the picture
    const map = JSON.parse(readFileSync(join(out, STILL_DIR, spotsFile(s)), 'utf8'));
    assert.deepEqual([map.cols, map.rows], [Math.round(s.w / SPOT_CELL), Math.round(s.h / SPOT_CELL)], `${spotsFile(s)} does not fit its picture: run npm run stills`);
    for (const row of map.runs) assert.equal(row.filter((_, k) => k % 2).reduce((a, b) => a + b, 0), map.cols);
    // everything the buttons along the bottom open can also be clicked in the picture
    const data = loadData();
    const want = ['whiteboard', 'notebook', 'bin', 'monitor', 'outside', 'photo-now', 'photo-then', 'note',
      ...data.desk.drawers.map((d) => 'drawer:' + d.id), ...data.desk.shelf.map((x) => 'shelf:' + x.id), ...data.desk.small.items.map((x) => x.id)];
    // (the 2020 desk has no second monitor, chair, gears or board, and only one robot on the shelf)
    const here = s.era === 'then' ? ['whiteboard', 'notebook', 'bin', 'outside', 'photo-now', 'photo-then', 'note', 'shelf:wheels', ...data.desk.drawers.map((d) => 'drawer:' + d.id)] : want;
    for (const id of here) assert.ok(map.ids.includes(id), `${id} cannot be clicked in ${s.file}: run npm run stills`);
  }
  assert.ok(readFileSync(join(out, 'index.html'), 'utf8').includes('id="still"'));
});

test('a shared link to the desk shows its title, a description and a picture of the room', () => {
  const data = loadData();
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  const meta = (attr, key) => (html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`)) || [])[1];
  assert.equal(meta('property', 'og:title'), `${data.profile.name} · ${data.profile.role}`);
  assert.equal(meta('property', 'og:description'), data.desk.share.description);
  assert.equal(meta('name', 'description'), data.desk.share.description);
  assert.equal(meta('property', 'og:url'), data.profile.site);
  assert.equal(meta('name', 'twitter:card'), 'summary_large_image');
  // the picture: a full address (the sites that read it need one), to a JPEG that is in the build
  const img = meta('property', 'og:image');
  assert.equal(img, new URL(STILL_DIR + SHARE.file, data.profile.site).href);
  assert.deepEqual([meta('property', 'og:image:width'), meta('property', 'og:image:height')], [String(SHARE.w), String(SHARE.h)]);
  const f = join(out, STILL_DIR, SHARE.file);
  assert.ok(existsSync(f), 'the preview picture is missing: run npm run stills');
  const b = readFileSync(f);
  assert.ok(b[0] === 0xff && b[1] === 0xd8, 'the preview picture is not a JPEG');
  assert.ok(b.length < 300 * 1024, 'the preview picture is too big for some sites to show');
  assert.equal((html.match(/<meta name="description"/g) || []).length, 1);
});

test('nothing that is not cleared is in the built site', () => {
  const data = loadData();
  const cleared = new Set(allClips(data).map((x) => x.clip).filter((c) => c.cleared).map((c) => c.src));
  const all = files(out);
  for (const f of all) {
    if (/\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(f)) assert.ok(cleared.has(f.slice(out.length).replace(/\\/g, '/')), `${f} is a video that is not cleared`);
    if (/\.(html|js|css|json)$/.test(f)) {
      const txt = readFileSync(f, 'utf8');
      assert.ok(!txt.includes('local-media'), `${f} mentions the local preview path`);
      assert.ok(!txt.includes('Project Videos'), `${f} mentions the private archive`);
    }
  }
  assert.ok(!all.some((f) => /preview\.png$|\.txt$|\.md$/.test(f)), 'a file that is not part of the site was copied into the build');
});

// Words that must never be published (one per line) are kept in a list outside this repository,
// next to it on Gautham's machine. Where the list is not there, these checks are skipped.
test('no word from the private list is anywhere in the built files', (t) => {
  const list = fileURLToPath(new URL('../../private/banned-terms.txt', import.meta.url));
  if (!existsSync(list)) return t.skip('the private word list is not next to this repository');
  const terms = readFileSync(list, 'utf8').split('\n').map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith('#'));
  for (const f of files(out).filter((f) => /\.(html|js|css|json|txt|svg)$/.test(f))) {
    const txt = readFileSync(f, 'utf8').toLowerCase();
    terms.forEach((term, i) => assert.ok(!txt.includes(term), `the word on line ${i + 1} of the private list is in ${f.slice(out.length)}`));
  }
});

test('a build stops when the data is wrong', async () => {
  // The plugin refuses to build pages from data that fails its checks.
  const { pages } = await import('../plugins/pages.js');
  const bad = mkdtempSync(join(tmpdir(), 'portfolio-bad-'));
  const tamper = (d) => { d.scenes[0] = { ...d.scenes[0], proof: [] }; };
  await assert.rejects(
    build({ root, configFile: false, logLevel: 'silent', plugins: [pages({ tamper })], build: { outDir: bad, emptyOutDir: true, rollupOptions: { input: join(root, 'monitor', 'walk.html') } } }),
    /The site data has problems[\s\S]*no proof points/,
  );
  assert.ok(!existsSync(join(bad, 'monitor', 'walk.html')), 'a page was written from bad data');
  rmSync(bad, { recursive: true, force: true });
});
