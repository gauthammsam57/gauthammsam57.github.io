// Behaviour only. All the words are already in the page: they were put there at build
// time from src/data (see plugins/pages.js). This file adds scrolling, the 3D floor,
// the story panel, and links that can be shared.

import { lazyVideos } from './lazy-video.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const walk = $('#walk');
const rail = $('#rail');

// Inside the monitor on the desk page this runs as one tab of a browser (monitor/walk.html?embed=1).
// It has no public address of its own: it is only ever loaded into the monitor.
// Opened on its own, monitor/walk.html sends the visitor to the desk instead (see the script in its head).
// There it is only the walk past the robots: the team is on the whiteboard and the thanks and
// contact are in the notebook, so those parts are taken out, and its own top bar is hidden.
const EMBED = new URLSearchParams(location.search).has('embed') && window.parent !== window;
const tell = (msg) => { if (EMBED) window.parent.postMessage({ from: 'walk', ...msg }, location.origin); };
if (EMBED) {
  document.body.classList.add('embed');
  for (const id of ['off', 'thanks', 'contact']) {
    const s = document.getElementById(id);
    if (s) s.remove();
    const a = $(`a[data-to="${id}"]`, rail);
    if (a) a.remove();
  }
}
const sections = $$('.scene', walk);
const order = sections.map((s) => s.id);

// ---------- the address bar remembers where you are, so any view can be shared
// #wheels = a scene · ?story=wheels.1 = an open story
function readUrl() {
  const q = new URLSearchParams(location.search);
  const m = /^([a-z]+)(?:\.(\d+))?$/.exec(q.get('story') || '');
  return { story: m ? { id: m[1], i: Number(m[2] || 0) } : null };
}
function writeUrl({ story }) {
  const q = new URLSearchParams(location.search);
  q.delete('view'); // links to the old Team view (?view=team) simply land on the walk-through
  if (story) q.set('story', story.i ? `${story.id}.${story.i}` : story.id); else q.delete('story');
  const s = q.toString();
  history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash);
}
const ui = { story: null };

// "+ n more" on the proof lists
walk.addEventListener('click', (ev) => {
  const b = ev.target.closest('.more-btn');
  if (!b) return;
  const more = b.previousElementSibling;
  more.hidden = !more.hidden;
  b.setAttribute('aria-expanded', String(!more.hidden));
  b.textContent = more.hidden ? `+ ${b.dataset.n} more` : 'Show fewer';
});

// ---------- the floor (3D). The page reads fine without it.
let floor = null;
async function startFloor() {
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no webgl');
    const { createFloor } = await import('./floor.js');
    const pickable = $$('.story-btn', walk).map((b) => b.dataset.story);
    // inside the monitor it starts ready (no lights-on intro) and a little less sharp, to start fast
    floor = createFloor($('#floor'), { reduced, order, pickable, onPick: (id) => openStory(id), intro: !EMBED, maxPixelRatio: EMBED ? 1.25 : 1.5 });
    document.body.classList.add('has-floor');
    onScroll();
    floor.setFocus(ui.story ? ui.story.id : null);
    floor.jump(); // arrive where the page already is (a link to #wheels starts at the wheels)
    // tell the desk once a few frames have really been drawn, so its loading screen can go
    let drawn = 0;
    const ready = () => { if (++drawn < 4) requestAnimationFrame(ready); else tell({ type: 'ready' }); };
    requestAnimationFrame(ready);
  } catch (e) {
    document.body.classList.add('no-floor');
    tell({ type: 'ready' });
    console.warn('3D floor not started:', e.message);
  }
}

// ---------- scroll drives the camera
let active = '';
function onScroll() {
  const mid = window.scrollY + window.innerHeight / 2;
  const centers = sections.map((s) => s.offsetTop + s.offsetHeight / 2);
  let p = 0;
  if (mid >= centers[centers.length - 1]) p = centers.length - 1;
  else if (mid > centers[0]) {
    for (let i = 0; i < centers.length - 1; i++) {
      if (mid >= centers[i] && mid < centers[i + 1]) { p = i + (mid - centers[i]) / (centers[i + 1] - centers[i]); break; }
    }
  }
  if (floor) floor.setProgress(p);
  const id = order[Math.round(p)];
  if (id !== active) {
    active = id;
    tell({ type: 'scene', id });
    document.body.dataset.scene = id;
    sections.forEach((s) => s.classList.toggle('on', s.id === id));
    $$('a', rail).forEach((a) => a.classList.toggle('on', a.dataset.to === id));
  }
}
let ticking = false;
window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; onScroll(); }); } }, { passive: true });
window.addEventListener('resize', onScroll);

// ---------- story panel
const drawer = $('#drawer');
const drawerBody = $('.drawer-body', drawer);
let lastFocus = null;
function openStory(id, index = 0, { scroll = true } = {}) {
  const tpl = $(`#stories template[data-story="${id}"][data-i="${index}"]`);
  if (!tpl) return false;
  // in the monitor there is no side panel: the story is in the other tab
  if (EMBED) { tell({ type: 'detail', id }); return true; }
  if (scroll && active !== id) document.getElementById(id).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  drawerBody.replaceChildren(tpl.content.cloneNode(true));
  $$('.tabs button', drawerBody).forEach((b) => b.addEventListener('click', () => openStory(id, Number(b.dataset.i), { scroll: false })));
  if (drawer.hidden) lastFocus = document.activeElement;
  drawer.hidden = false;
  drawer.dataset.story = `${id}.${index}`;
  requestAnimationFrame(() => { if (document.body.classList.contains('drawer-on')) drawer.classList.add('open'); });
  document.body.classList.add('drawer-on');
  drawer.scrollTop = 0;
  if (floor) floor.setFocus(id);
  ui.story = { id, i: index };
  writeUrl(ui);
  $('.close', drawer).focus({ preventScroll: true });
  return true;
}
function closeStory() {
  if (drawer.hidden) return;
  drawer.classList.remove('open');
  document.body.classList.remove('drawer-on');
  $$('video', drawerBody).forEach((v) => v.pause());
  if (floor) floor.setFocus(null);
  ui.story = null;
  writeUrl(ui);
  setTimeout(() => { if (!ui.story) drawer.hidden = true; }, 260);
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
}
$('.close', drawer).addEventListener('click', closeStory);
walk.addEventListener('click', (ev) => { const b = ev.target.closest('.story-btn'); if (b) openStory(b.dataset.story); });

window.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  if (EMBED) tell({ type: 'escape' });
  else if (!drawer.hidden) closeStory();
});
// the desk page asks this tab to go to a robot (a robot on the shelf was clicked)
window.addEventListener('message', (ev) => {
  if (ev.origin !== location.origin || !ev.data || ev.data.to !== 'walk') return;
  if (ev.data.type === 'pause' || ev.data.type === 'resume') { if (floor) floor.setPaused(ev.data.type === 'pause'); return; }
  if (ev.data.type !== 'goto') return;
  const s = document.getElementById(ev.data.id);
  if (s && s.classList.contains('scene')) s.scrollIntoView({ behavior: 'auto', block: 'center' });
});

// ---------- start: put the page in the state the link asked for
onScroll();
const want = readUrl();
if (new URLSearchParams(location.search).has('view')) writeUrl(ui); // an old Team view link: tidy the address
if (want.story && !openStory(want.story.id, want.story.i)) writeUrl(ui); // an unknown story is dropped from the link
startFloor();
// A link to a scene starts at that scene; smooth scrolling is switched on only after that.
window.addEventListener('load', () => setTimeout(() => {
  onScroll();
  if (floor) floor.jump();
  document.documentElement.classList.add('ready');
}, 120));
lazyVideos(); // clips load only when they come near the screen
