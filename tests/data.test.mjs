// Checks the data and what is built from it, without a browser. Run: npm test
import { test } from 'node:test';
import { pickStill } from '../src/still.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadData } from '../src/data/index.js';
import { validate, allClips, localClips, NEVER } from '../src/data/validate.js';
import { mergeActivity } from '../src/data/activity.js';
import { renderWalk, sceneOrder } from '../src/render/walk.js';
import { renderCv } from '../src/render/cv.js';
import { renderDesk } from '../src/render/desk.js';
import { clipHtml, isShown } from '../src/render/clip.js';
import { esc, rich } from '../src/render/util.js';
import { word } from '../src/data/profile.js';
import { mergeCalendar, parseCalendar } from '../scripts/refresh-activity.mjs';

const data = loadData();
const text = (html) => html.replace(/<title>[^<]*<\/title>/g, ' ').replace(/<\/?a\b[^>]*>/g, '').replace(/<[^>]+>/g, ' ') /* a link sits inside its sentence */.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const pagesFor = (dev) => { const w = renderWalk(data, { dev }); const d = renderDesk(data, { dev }); return { walk: w.walk + w.team + w.stories + w.rail + d.hero + d.dock + d.surfaces + d.captions + d.note + d.screen, cv: renderCv(data, { dev }), desk: d }; };
const prod = pagesFor(false), dev = pagesFor(true);
const clone = () => structuredClone({ ...data });
const withDraft = (d) => { const c = structuredClone({ ...d }); c.desk.bin.sheets[0].draft = true; return c; };
const photoIn = (d) => allClips(d).map((x) => x.clip).find((c) => c.status === 'photo');

test('the data passes every check', () => {
  assert.deepEqual(validate(data), []);
});

test('the checks catch broken data', () => {
  const cases = [
    ['a scene with no proof', (d) => { d.scenes[0].proof = []; }, /no proof/],
    ['a duplicate scene id', (d) => { d.scenes[1].id = d.scenes[0].id; }, /used twice/],
    ['an unknown clip status', (d) => { d.scenes[0].stories[0].clips[0].status = 'public'; }, /unknown status/],
    ['company footage set to play locally', (d) => { d.scenes[0].stories[0].clips[0].local = 'Neural Foundry/ph_measure.mp4'; }, /only in-house/],
    ['the held-back mapping video', (d) => { const c = d.scenes.find((s) => s.id === 'wheels').stories[0].clips[0]; c.local = 'Navigation Collections/Slam-mapping and navigation_2.mov'; }, /never be shown/],
    ['a public file not marked cleared', (d) => { d.scenes[0].stories[0].clips[0].src = '/media/x.mp4'; }, /not marked cleared/],
    ['a cleared clip with no file', (d) => { d.scenes[0].stories[0].clips[0].cleared = true; }, /need a file/],
    ['a held-back clip marked cleared', (d) => { const c = d.scenes.find((s) => s.id === 'wheels').stories[2].clips[0]; c.cleared = true; c.src = '/media/x.mp4'; }, /cannot be cleared/],
    ['a photo with no words for those who cannot see it', (d) => { delete photoIn(d).alt; }, /a photo needs/],
    ['a photo kept somewhere other than /photos/', (d) => { photoIn(d).img = 'https://storage.googleapis.com/x.svg'; }, /a photo needs/],
    ['a photo not linked to the company page', (d) => { photoIn(d).href = 'https://example.org/x'; }, /links to the company page/],
    ['a photo set to play as footage', (d) => { photoIn(d).local = 'x.mp4'; }, /not footage/],
    ['a picture file on footage', (d) => { d.scenes[0].stories[0].clips.find((c) => c.status === 'company').img = '/photos/x.webp'; }, /only a photo/],
    ['a bad link', (d) => { d.profile.links.linkedin = 'linkedin.com/in/x'; }, /not a usable address/],
    ['a count in the future', (d) => { d.activity.sources.nf['2999-01-01'] = 3; }, /in the future/],
    ['a negative count', (d) => { d.activity.sources.nf['2025-05-05'] = -1; }, /bad count/],
  ];
  for (const [name, breakIt, expect] of cases) {
    const d = clone();
    breakIt(d);
    assert.ok(validate(d).some((p) => expect.test(p)), `not caught: ${name}`);
  }
});

test('adding the two activity sources adds the days', () => {
  assert.deepEqual(mergeActivity({ '2024-01-01': 2, '2024-01-02': 1 }, { '2024-01-02': 3, '2024-01-03': 0 }), { '2024-01-01': 2, '2024-01-02': 4, '2024-01-03': 0 });
  const { days, sources, first, last } = data.activity;
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  assert.equal(sum(days), sum(sources.invento) + sum(sources.nf), 'no commit is lost or counted twice');
  assert.ok(first >= '2021-01-01' && first < '2021-03-01', 'the lights start in early 2021');
  assert.ok(last <= new Date().toISOString().slice(0, 10));
});

test('refreshing from GitHub keeps the early days and never invents future ones', () => {
  const saved = { '2024-09-05': 21, '2025-03-12': 4, '2025-03-13': 1, '2025-06-01': 0 };
  const calendar = [['2024-09-05', 0], ['2025-03-12', 0], ['2025-03-13', 7], ['2025-06-01', 2], ['2025-06-02', 5], ['2031-01-01', 9]];
  const next = mergeCalendar(saved, calendar, { until: '2026-01-01' });
  assert.deepEqual(next, { '2024-09-05': 21, '2025-03-12': 4, '2025-03-13': 1, '2025-06-01': 2, '2025-06-02': 5 });
  assert.deepEqual(Object.keys(next), Object.keys(next).slice().sort(), 'days are kept in date order');
});

test('the commit chart reads GitHub\'s public page', () => {
  const page = `<td data-date="2026-11-20" id="d-1" class="x"></td><td data-date="2026-11-21" id="d-2"></td><td data-date="2026-11-22" id="d-3"></td>
    <tool-tip id="t1" for="d-2" class="sr-only">6 contributions on November 21st.</tool-tip>
    <tool-tip id="t2" for="d-1" class="sr-only">No contributions on November 20th.</tool-tip>
    <tool-tip id="t3" for="d-3" class="sr-only">1 contribution on November 22nd.</tool-tip>`;
  assert.deepEqual(parseCalendar(page), [['2026-11-20', 0], ['2026-11-21', 6], ['2026-11-22', 1]]);
  assert.deepEqual(parseCalendar('<p>something else</p>'), []);
});

test('every scene, story and proof point reaches the page', () => {
  const order = sceneOrder(data);
  for (const id of order) assert.ok(prod.walk.includes(`<section class="scene`) && prod.walk.includes(`id="${id}"`), `scene ${id} missing`);
  const t = text(prod.walk);
  for (const s of data.scenes) {
    for (const [p, tag] of s.proof) { assert.ok(t.includes(text(esc(p))), `${s.id}: a proof point is missing`); assert.ok(t.includes(tag)); }
    s.stories.forEach((st, i) => {
      assert.ok(prod.walk.includes(`<template data-story="${s.id}" data-i="${i}">`), `${s.id}: story ${i} has no panel`);
      assert.ok(t.includes(text(esc(st.title))));
    });
    assert.equal(prod.walk.includes(`data-story="${s.id}">`), s.stories.length > 0, `${s.id}: the story button and the stories disagree`);
  }
  // the commit chart is on the CV only
  for (const y of new Set(Object.keys(data.activity.days).map((d) => d.slice(0, 4)))) assert.ok(prod.cv.includes(`data-year="${y}"`), `no lights for ${y} on the CV`);
  assert.ok(!prod.walk.includes('class="lights"'), 'the commit chart is in the walk-through');
});

test('the desk: every object opens as itself, and its words are there', () => {
  const d = prod.desk, t = text(d.surfaces + d.screen + d.hero + d.captions + d.note);
  for (const o of data.desk.objects) assert.ok(d.dock.includes('data-open="' + o.id + '"'), o.id + ' has no button');
  for (const id of ['whiteboard', 'notebook', 'bin']) assert.ok(d.surfaces.includes('data-surface="' + id + '"'), id + ' has nothing to show');
  assert.ok(!/drawer|data-panel/.test(d.surfaces + d.screen), 'a side panel is back');
  // the monitor shows a browser with tabs: the walk-through as a page of its own, the detail, and the live map
  assert.ok(d.screen.includes('data-src="./monitor/walk.html?embed=1"') && d.screen.includes('data-tab="walk"') && d.screen.includes('data-tab="detail"') && d.screen.includes('data-tab="map"'), 'the monitor does not have its tabs');
  assert.ok(!/<iframe[^>]*\ssrc=/.test(d.screen), 'the walk-through loads before anyone looks at it');
  for (const s of data.scenes) assert.ok(d.screen.includes('data-work-section="' + s.id + '"'), s.id + ' is not in the monitor');
  for (const p of data.desk.notebook.pages) assert.ok(t.includes(text(esc(p.title))), 'a notebook page is missing');
  for (const x of [...data.desk.whiteboard.bugs, ...data.desk.whiteboard.features]) assert.ok(t.includes(x.title) && d.surfaces.includes('data-item="' + x.id + '"'), x.id + ' is not on the board');
  for (const x of data.desk.whiteboard.bugs.filter((y) => y.story)) assert.ok(d.surfaces.includes('data-story="' + x.id + '"'));
  // the note: Proverbs written out with its translation named; Deuteronomy as a link and never as text
  const n = data.desk.note;
  for (const l of n.verse.lines) assert.ok(t.includes(l), 'a line of the verse is missing');
  assert.ok(t.includes(n.verse.ref + ' · ' + n.verse.version));
  assert.ok(d.note.includes('href="' + n.link.href + '"') && t.includes(n.link.ref));
  assert.ok(!/fear you/i.test(t), 'the text of Deuteronomy 28:10 is on the page; it should be a link only');
  assert.ok(!text(d.hero).includes(data.desk.time.line), 'the line about what changed is the headline again');
  assert.ok(text(d.captions).includes(data.desk.time.line));
  assert.ok(!(d.surfaces + d.captions).includes('Draft wording'), 'a draft label is on the published desk');
  // the label shows in preview wherever wording is still a draft (none is today: all confirmed 22 Nov 2026)
  const drafts = JSON.stringify(data.desk).split('"draft":true').length - 1;
  assert.equal((dev.desk.surfaces + dev.desk.captions).split('Draft wording').length - 1, drafts, 'draft wording is not labelled in preview');
  assert.ok(renderDesk(withDraft(data), { dev: true }).surfaces.includes('Draft wording'), 'a draft sheet would not be labelled in preview');
  assert.ok(!renderDesk(withDraft(data), { dev: false }).surfaces.includes('Draft wording'), 'a draft sheet would be labelled on the published desk');
  assert.equal(d.devtools, '', 'the time-of-day tester is in the published page');
  const bad = structuredClone({ ...data });
  bad.desk.shelf[0].id = 'nothing';
  bad.desk.whiteboard.tree.children[0].on = 'B9';
  const problems = validate(bad);
  assert.ok(problems.some((p) => /not a project/.test(p)) && problems.some((p) => /not on the board/.test(p)));
});

test('the numbers on the two pages agree', () => {
  const n = data.profile.numbers, w = text(prod.walk), f = text(prod.cv);
  assert.ok(f.includes(`${n.teamSize} engineers`));
  assert.ok(f.includes(`${n.prsWritten} written, ${n.prsReviewed} reviewed`));
  assert.ok(f.includes(`${n.yearsInRobotics} (since ${n.since})`));
  assert.ok(f.includes(`${n.alexEarlyCommits} commits`));
  assert.ok(f.includes(`team is now ${word(n.teamSize)}`) && f.includes(`team of ${word(n.teamSize)}`) && w.includes(`team of ${word(n.teamSize)}`));
  for (const p of [w, f]) { assert.ok(p.includes(data.profile.name)); assert.ok(p.includes(data.profile.role)); }
});

test('the company\'s own photos are shown from this site, credited to it and linked to their page', () => {
  const photos = allClips(data).map((x) => x.clip).filter((c) => c.status === 'photo');
  assert.ok(photos.length > 0, 'no photos');
  for (const c of photos) {
    assert.ok(existsSync(fileURLToPath(new URL('../public' + c.img, import.meta.url))), `${c.img} is missing from public/`);
    // on both pages (the floor page and the desk's monitor): the picture, the credit, and the link to its page
    const fig = (html) => html.split('<figure class="clip">').filter((f) => f.includes(`src="${c.img}"`));
    for (const html of [prod.walk]) {
      const shown = fig(html);
      assert.equal(shown.length, 2, `${c.img} is not on both pages`);
      for (const f of shown) assert.ok(f.includes('Photo · Neural Foundry') && f.includes(`href="${c.href}"`) && f.includes(`Neural Foundry’s ${c.from} page`), `${c.img} is shown without its credit or link`);
    }
  }
  assert.ok(!prod.walk.includes('storage.googleapis.com'), 'a photo is loaded from the company\'s servers instead of this site');
});

test('a clip that is not cleared is left out of the published pages, and kept in the data and the preview', () => {
  const waiting = allClips(data).filter((x) => !isShown(x.clip));
  assert.ok(waiting.length > 0, 'nothing is waiting, so this test checks nothing');
  for (const html of [prod.walk, renderDesk(data, { dev: false }).screen]) {
    assert.ok(!/class="slot|awaiting OK|faces to clear|Held back|No footage/.test(html), 'a striped box is on the published site');
    assert.ok(!/<div class="clips"><\/div>/.test(html), 'an empty clip row is on the published site');
  }
  // not lost: every waiting clip is still in the preview, on both pages, under its own title
  for (const { clip, where } of waiting) {
    const n = dev.walk.split(`<strong>${esc(clip.title)}</strong>`).length - 1;
    assert.equal(n, where.startsWith('team bench') ? 1 : 2, `"${clip.title}" is missing from the preview`);
    assert.ok(!prod.walk.includes(`<strong>${esc(clip.title)}</strong>`), `"${clip.title}" is on the published site`);
  }
  assert.equal((dev.walk.match(/class="slot /g) || []).length + (dev.walk.match(/<video[^>]*data-local/g) || []).length,
    waiting.reduce((n, x) => n + (x.where.startsWith('team bench') ? 1 : 2), 0), 'every waiting clip has its box or local player in the preview');
});

test('the published pages cannot play footage that is not cleared', () => {
  const clips = allClips(data).map((x) => x.clip);
  const cleared = clips.filter((c) => c.cleared);
  assert.ok(!prod.walk.includes('local-media'), 'a local clip leaked into the published page');
  // a story's clips are shown twice: on the floor page and inside the desk's monitor
  const shown = (keep) => allClips(data).filter((x) => keep(x.clip)).reduce((n, x) => n + (x.where.startsWith('team bench') ? 1 : 2), 0);
  assert.equal((prod.walk.match(/<video/g) || []).length, shown((c) => c.cleared), 'only cleared clips may play when published');
  assert.equal((dev.walk.match(/<video[^>]*data-local/g) || []).length, shown((c) => c.local && !c.cleared), 'local preview clips');
  for (const f of localClips(data)) {
    assert.ok(!NEVER.some((r) => r.test(f)), `${f} must never be shown`);
    // the archive is on Gautham's machine only; the public repository has no copy, so this is checked here
    const archive = fileURLToPath(new URL('../../assets/project-videos/Project Videos/', import.meta.url));
    if (existsSync(archive)) assert.ok(existsSync(archive + f), `${f} is not in the archive`);
  }
  for (const c of cleared) assert.ok(existsSync(fileURLToPath(new URL('../public' + c.src, import.meta.url))), `${c.src} is missing from public/`);
});

test('nothing confidential or personal is on either page', (t) => {
  const all = (prod.walk + prod.cv + dev.walk + dev.cv).toLowerCase();
  // The one phone number allowed is the one chosen in profile.js, and only on the CV page.
  const phone = data.profile.phone || '';
  const noCharts = (prod.walk + (phone ? prod.cv.split(phone).join(' ').split(phone.replace(/\s+/g, '')).join(' ') : prod.cv)).replace(/<svg[\s\S]*?<\/svg>/g, ' ');
  assert.ok(!/\+\d[\d\s-]{9,14}\d|\b\d{10}\b|\b\d{5}[\s-]\d{5}\b/.test(text(noCharts)), 'something that looks like a phone number');
  if (phone) { const d = renderDesk(data, { dev: false }); assert.ok(![prod.walk, d.hero, d.surfaces, d.screen, d.note].join(' ').includes(phone.slice(-5)), 'the phone number is somewhere other than the CV page'); }
  if (!data.profile.links.email) assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(text(prod.walk + prod.cv)), 'an email address is on the page but none was chosen');
  const file = fileURLToPath(new URL('../../private/banned-terms.txt', import.meta.url));
  if (!existsSync(file)) return t.skip('the private word list is not next to this repository, so it was not checked');
  const terms = readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  assert.ok(terms.length > 0, 'the private word list is empty');
  for (const term of terms) assert.ok(!all.includes(term.toLowerCase()), 'a word from the private list is on the site (line ' + (terms.indexOf(term) + 1) + ')');
});

test('the wording keeps to the tone rules', () => {
  const t = text(prod.walk + prod.cv);
  for (const w of ['led', 'spearheaded', 'pivotal', 'expert', 'passionate', 'dynamic', 'results-oriented', 'world-class', 'cutting-edge']) {
    assert.ok(!new RegExp(`\\b${w}\\b`, 'i').test(t), `"${w}" is on the site`);
  }
  assert.ok(!/\[(NEEDS YOU|CONFIRM)/i.test(t), 'a draft marker is on the site');
  assert.ok(!/[—]/.test(t), 'an em dash is on the site');
});

test('the CV can be downloaded as a PDF that matches the page', async () => {
  const { cvFingerprint, CV_PDF, CV_TEX, CV_STAMP } = await import('../scripts/cv-fingerprint.mjs');
  const { renderCvTex, tex } = await import('../src/render/cv-tex.js');
  const here = (rel) => fileURLToPath(new URL('../' + rel, import.meta.url));
  assert.ok(existsSync(here('public/' + CV_PDF)), 'there is no CV PDF: run npm run cv-pdf');
  assert.equal(readFileSync(here('public/' + CV_PDF)).subarray(0, 5).toString(), '%PDF-');
  assert.equal(existsSync(here(CV_STAMP)) ? readFileSync(here(CV_STAMP), 'utf8').trim().split(' ')[0] : '', cvFingerprint(), 'the CV has changed since its PDF was made: run npm run cv-pdf');
  // the LaTeX file is made from the same data, in the layout of his resume
  const made = renderCvTex(data);
  assert.equal(existsSync(here(CV_TEX)) ? readFileSync(here(CV_TEX), 'utf8') : '', made, 'cv/*.tex is not what the data would make: run npm run cv-pdf');
  assert.equal(tex('R&D 50% #1 $5 {x}'), String.raw`R\&D 50\% \#1 \$5 \{x\}`);
  assert.equal(tex('use `a_b` here'), String.raw`use \texttt{a\_b} here`);
  assert.ok(!/[^\x00-\x7f]/.test(made), 'a character LaTeX may not know is in the CV: ' + (made.match(/[^\x00-\x7f]/) || [''])[0]);
  for (const j of data.cv.jobs) for (const r of j.roles) assert.ok(made.includes(tex(r.bullets[0])), 'a job is missing from the LaTeX CV');
  assert.ok(made.includes(tex(data.profile.phone)) && made.includes(data.profile.links.email) && !made.includes('activity'), 'the LaTeX CV needs the contact line, and not the commit history');
  const shell = readFileSync(here('cv.html'), 'utf8');
  assert.ok(shell.includes('href="./' + CV_PDF + '" download'), 'the CV page does not offer the PDF');
  // the PDF is its own document in the layout of his resume: the same words, no commit history, nothing of the web page
  const { renderCvHtml } = await import('../src/render/cv-print.js');
  const doc = renderCvHtml(data), plain = (h) => text(h).replace(/\s+/g, ' ');
  for (const j of data.cv.jobs) for (const r of j.roles) for (const b of r.bullets) assert.ok(plain(doc).includes(plain(rich(b))), 'a line of the CV page is missing from the PDF: ' + b.slice(0, 40));
  assert.ok(doc.includes(data.profile.phone) && doc.includes(data.profile.links.email) && !doc.includes('<svg') && !/<script|<link|src=/.test(doc));
  // the commit history is on the page but not in the PDF
  assert.ok(prod.cv.includes('<section class="activity">') && /@media print \{[^}]*\.activity[^}]*display: none/.test(readFileSync(here('src/cv.css'), 'utf8')));
});

test('text from the data cannot break the page', () => {
  assert.equal(esc(`<img src=x onerror="a('b')">&`), '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
  assert.equal(rich('use `<b>` here'), 'use <code>&lt;b&gt;</code> here');
  const html = clipHtml({ title: '<script>x</script>', status: 'team', note: '"><b>', href: 'https://example.org/?a="b"' });
  assert.ok(!html.includes('<script>') && !html.includes('"><b>'));
  assert.ok(clipHtml({ title: 't', status: 'held', local: 'x.mp4' }, { dev: false }).includes('Held back'));
});

test('the still picture is the time of day it is', () => {
  for (const [h, time] of [[0, 'night'], [5, 'night'], [6, 'morning'], [9.5, 'morning'], [10, 'day'], [12, 'day'], [17.9, 'day'], [18, 'dusk'], [20, 'night'], [23.9, 'night'], [-1, 'night'], [30, 'morning']]) {
    assert.equal(pickStill(h).time, time, `at ${h}:00`);
  }
  // the day picture (with him at the desk) is shown exactly in his hours, 10 to 6
  assert.equal(pickStill(9.99).time, 'morning'); assert.equal(pickStill(17.99).time, 'day');
  // and of the desk that is shown: today's, or the 2020 one
  assert.equal(pickStill(13).file, 'room-day.webp');
  assert.equal(pickStill(13, 'then').file, 'room-2020-day.webp');
});

test('the still pictures were taken of the room as it is now', async () => {
  // anything the pictures are made from (the room's code or what it draws) changed since: retake them
  const { stillsFingerprint, STILLS_STAMP, STILLS_INPUTS } = await import('../scripts/stills-fingerprint.mjs');
  const here = (rel) => fileURLToPath(new URL('../' + rel, import.meta.url));
  const saved = existsSync(here(STILLS_STAMP)) ? readFileSync(here(STILLS_STAMP), 'utf8').trim() : '';
  assert.equal(saved, stillsFingerprint(), `the room has changed since its still pictures were taken (${STILLS_INPUTS.join(', ')} or the desk data): run npm run stills`);
});
