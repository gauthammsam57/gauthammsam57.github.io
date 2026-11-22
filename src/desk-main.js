// Behaviour of the desk page. The words are already in the page (put there at build time).
// There are no side panels: each object shows what it holds in its own form.
// Links that can be shared: /?open=whiteboard · ?open=monitor&work=wheels · ?time=2020
import { pickStill, STILL_DIR, spotsFile, STILL_SKIP, STILL_START } from './still.js';
import { lazyVideos } from './lazy-video.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const info = JSON.parse($('#desk-data').textContent || '{}');

const surface = $('#surface'), surfaceBody = $('.surface-body', surface), screen = $('#screen'), dock = $('#dock'), tip = $('#tip'), caption = $('#caption');
const SURFACES = ['whiteboard', 'notebook', 'bin'];
const names = { lamp: 'The lamp', chair: 'Sit down', monitor: 'The second monitor', whiteboard: 'The whiteboard', notebook: 'The notebook', bin: 'The bin', 'photo-then': '2020', 'photo-now': 'Now', note: info.link ? info.link.ref + ' ↗' : '' };
const places = (info.outside && info.outside.places) || [];
const drawers = info.drawers || [];
if (info.clock && info.clock.hint) names.clock = info.clock.hint;
const SMALL = (info.small || []).map((x) => x.id); // the gears and the board
(info.small || []).forEach((x) => { names[x.id] = x.label; });
drawers.forEach((d) => { names['drawer:' + d.id] = d.label; });
if (info.outside) names.outside = info.outside.label;
(info.shelf || []).forEach((s) => { names['shelf:' + s.id] = s.label; });

// small things remembered in this browser only (which notebook page, which pages were read)
const recall = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const keep = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window: carry on without it */ } };
let room = null;
const still = { box: $('#still'), pic: $('#still .still-pic'), file: null, map: null, grid: null, start: 0.48, placed: false, moved: false };
const ui = { open: null, work: null, time: 'now', tab: 'walk', place: null }; // place: which one the right window shows, once asked
const askedWork = new URLSearchParams(location.search).get('work'); // the project a link asked for
const askedRobot = new URLSearchParams(location.search).get('robot'); // preview only: ?robot=12 holds the robot 12 seconds into its round
const askedDebug = new URLSearchParams(location.search).has('debug'); // preview only: show the tools from the start
const askedWalls = new URLSearchParams(location.search).get('walls'); // preview only: the wall colour on trial
const askedHold = Number(new URLSearchParams(location.search).get('hold')) || 0; // preview only: ?hold=3 holds the 3D back 3 s, to watch it load
const askedStill = new URLSearchParams(location.search).has('still'); // ?still=1: the still picture, even where 3D would run

function writeUrl() {
  const q = new URLSearchParams();
  if (ui.open) q.set('open', ui.open);
  if (ui.open === 'monitor' && ui.tab !== 'walk') q.set('tab', ui.tab);
  if (ui.open === 'monitor' && ui.work) q.set('work', ui.work);
  if (ui.time === 'then') q.set('time', '2020');
  if (ui.open === 'outside' && places[ui.place]) q.set('place', places[ui.place].id);
  const keep = new URLSearchParams(location.search).get('t');
  if (keep !== null) q.set('t', keep);
  if (document.body.dataset.walls === 'dark') q.set('walls', 'dark');
  if (askedStill) q.set('still', '1');
  if (tester && askedHold) q.set('hold', String(askedHold));
  const s = q.toString();
  history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
}
function mark() {
  $$('#dock button').forEach((b) => b.classList.toggle('on', b.dataset.open === ui.open));
  document.body.classList.toggle('viewing', !!ui.open && ui.open !== 'photos');
  document.body.dataset.open = ui.open || '';
  document.body.dataset.time = ui.time;
  $$('[data-small-caption]', caption).forEach((p) => { p.hidden = ui.open !== p.dataset.smallCaption; });
  const pc = $('[data-place-caption]', caption);
  if (pc) {
    pc.hidden = ui.open !== 'outside' || !places[ui.place];
    if (!pc.hidden) { $('[data-place-name]', pc).textContent = places[ui.place].name; const c = $('[data-place-standin]', pc); if (c) c.hidden = !!places[ui.place].photo; }
  }
  $$('[data-time-caption]', caption).forEach((p) => { p.hidden = ui.open !== 'photos' || p.dataset.timeCaption !== ui.time; });
  placePrint();
}
// With the still picture there is no window to show a place in, so it is shown as a print.
function placePrint() {
  const fig = $('#place-print'), img = $('img', fig), pl = places[ui.place];
  const on = !room && !!still.file && ui.open === 'outside' && !!(pl && pl.photo);
  document.body.classList.toggle('place-print', on);
  if (!on) { fig.classList.remove('on'); fig.hidden = true; return; }
  fig.hidden = false;
  if (img.getAttribute('src') !== pl.photo) { fig.classList.remove('on'); img.onload = () => fig.classList.add('on'); img.alt = pl.name; img.src = pl.photo; }
  else fig.classList.add('on');
}

// ----- a board, a notebook, a sheet of paper
function showSurface(id) {
  const tpl = $(`#surfaces template[data-surface="${id}"]`);
  if (!tpl) return false;
  surfaceBody.replaceChildren(tpl.content.cloneNode(true));
  surface.hidden = false;
  surface.dataset.kind = id;
  document.body.classList.add('surface-on');
  // The whiteboard is drawn on the board in the room (like the monitor), not in a box over it.
  // The notebook is drawn on the open notebook on the desk in the same way.
  fitId = FIT[id] ? id : null;
  boardFit = !!fitId && !!room && !room.flat();
  surface.classList.toggle('fitted', boardFit);
  if (boardFit) {
    boardSettled = false; boardLast = null;
    const el = $(FIT[id].sel, surfaceBody);
    el.style.width = '900px'; el.style.height = Math.round(900 / FIT[id].aspect()) + 'px';
    el.style.opacity = '0';
    surface.classList.add('open');
    if (!boardTracking) boardTracking = requestAnimationFrame(trackBoard);
  } else {
    // let the camera get there first
    setTimeout(() => { if (ui.open === id) surface.classList.add('open'); }, room && !reduced ? 550 : 0);
  }
  // notebook pages
  const tabs = $$('[data-page-tab]', surfaceBody);
  // The notebook remembers the page you were on (the ribbon), and which pages you have not read.
  const turn = (pid) => {
    tabs.forEach((x) => x.setAttribute('aria-selected', String(x.dataset.pageTab === pid)));
    $$('[data-page]', surfaceBody).forEach((x) => { x.hidden = x.dataset.page !== pid; });
    const read = new Set(recall('nb-read', []));
    read.add(pid);
    keep('nb-read', [...read]); keep('nb-page', pid);
    tabs.forEach((x) => x.classList.toggle('unread', !read.has(x.dataset.pageTab)));
  };
  tabs.forEach((b) => b.addEventListener('click', () => turn(b.dataset.pageTab)));
  const marked = recall('nb-page', null);
  if (tabs.length) turn(marked && tabs.some((x) => x.dataset.pageTab === marked) ? marked : tabs[0].dataset.pageTab); // open at the ribbon
  // whiteboard: a bug, a feature, an engineer or "me" opens what it has to say, and lights up the tags
  // that go with it (whoever is on an item; an engineer's own tags)
  const openers = $$('[data-item][aria-expanded]', surfaceBody);
  const goes = (tag, el) => tag.dataset.on === el.dataset.item || tag.closest('[data-item]') === el;
  const toggle = (b) => {
    const on = b.getAttribute('aria-expanded') !== 'true';
    openers.forEach((x) => x.setAttribute('aria-expanded', String(x === b && on)));
    $$('[data-story]', surfaceBody).forEach((x) => { x.hidden = !(on && x.dataset.story === b.dataset.item); });
    $$('.tag', surfaceBody).forEach((x) => x.classList.toggle('lit', on && goes(x, b)));
    // on a phone the board scrolls: bring what just opened into view (on the desk it always fits the board)
    const opened = on && !boardFit && $(`[data-story="${b.dataset.item}"]`, surfaceBody);
    if (opened) opened.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  };
  openers.forEach((b) => {
    b.addEventListener('click', () => toggle(b));
    // "me" is part of the drawing, not a real button: give it the keys a button has
    if (b.tagName !== 'BUTTON') b.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(b); } });
  });
  $$('[data-item]', surfaceBody).forEach((el) => {
    el.addEventListener('mouseenter', () => $$('.tag', surfaceBody).forEach((x) => x.classList.toggle('hot', goes(x, el))));
    el.addEventListener('mouseleave', () => $$('.tag', surfaceBody).forEach((x) => x.classList.remove('hot')));
  });
  // in an engineer's box, what they are on opens that item
  $$('button.goto', surfaceBody).forEach((g) => g.addEventListener('click', () => {
    const b = openers.find((x) => x.dataset.item === g.dataset.goto);
    if (b) { toggle(b); b.focus({ preventScroll: true }); }
  }));
  $('.close', surface).focus({ preventScroll: true });
  return true;
}
function hideSurface() {
  document.body.classList.remove('surface-on');
  if (boardFit) { // the board shrinks back onto the whiteboard, then goes (see trackBoard)
    boardSettled = false; boardLast = null;
    if (!boardTracking) boardTracking = requestAnimationFrame(trackBoard);
    return;
  }
  surface.classList.remove('open');
  setTimeout(() => { if (!document.body.classList.contains('surface-on')) surface.hidden = true; }, 300);
}
// the whiteboard, fitted to the four corners of the board in the room every frame; once the
// camera is still and square in front of it, placed flat, and the fitting stops
let boardFit = false, boardTracking = 0, boardSettled = false, boardLast = null, fitId = null;
// what can be drawn on its own object in the room, and how to find that object's corners
const FIT = {
  whiteboard: { sel: '.board', quad: () => room.boardQuad(), near: () => room.boardApproach(), aspect: () => { const [w, h] = room.boardSize(); return w / h; } },
  notebook: { sel: '.book', quad: () => room.nbQuad(), near: () => room.nbApproach(), aspect: () => room.nbAspect },
};
function trackBoard() {
  boardTracking = 0;
  const F = FIT[fitId], el = F && $(F.sel, surfaceBody);
  if (!boardFit || !el || !room || room.flat()) return;
  const q = F.quad(), k = F.near(), on = ui.open === fitId;
  if (q) {
    const still = boardLast && q.every((p, i) => Math.abs(p[0] - boardLast[i][0]) + Math.abs(p[1] - boardLast[i][1]) < 0.25);
    const square = Math.abs(q[0][1] - q[1][1]) < 1 && Math.abs(q[0][0] - q[3][0]) < 1 && Math.abs(q[1][0] - q[2][0]) < 1 && Math.abs(q[3][1] - q[2][1]) < 1;
    boardLast = q;
    if (on && k > 0.99 && still && square) {
      const w = el.offsetWidth, h = el.offsetHeight;
      el.style.transform = 'translate(' + q[0][0].toFixed(2) + 'px,' + q[0][1].toFixed(2) + 'px) scale(' + ((q[1][0] - q[0][0]) / w).toFixed(5) + ',' + ((q[3][1] - q[0][1]) / h).toFixed(5) + ')';
      el.style.opacity = '1';
      boardSettled = true;
      return; // closing, a resize or a reopen starts the fitting again
    }
    el.style.transform = fitToQuad(el.offsetWidth, el.offsetHeight, q);
  }
  boardSettled = false;
  el.style.opacity = String(Math.min(1, k * 3).toFixed(3));
  if (!on && k < 0.03) { surface.hidden = true; surface.classList.remove('open', 'fitted'); boardFit = false; return; }
  boardTracking = requestAnimationFrame(trackBoard);
}

// ----- the second monitor: a computer inside the room
const scroller = $('.screen-scroll', screen);
// The page is drawn on the glass of the monitor in the room, not in a box laid over it: every
// frame it is fitted to the four corners of that glass, so it swings and grows with the monitor.
// On a phone, or without the 3D room, it simply fills the screen.
const display = $('.display', screen);
let tracking = 0, lastQuad = null, settled = false;
window.addEventListener('resize', () => { boardLast = null; if (boardFit && room && !room.flat() && ui.open === fitId && !boardTracking) boardTracking = requestAnimationFrame(trackBoard); });
window.addEventListener('resize', () => { lastQuad = null; if (ui.open === 'monitor' && room && !room.flat() && !tracking) { const [w, h] = room.screenSize(); display.style.width = w + 'px'; display.style.height = h + 'px'; tracking = requestAnimationFrame(track); } });
function fitToQuad(w, h, [p0, p1, p2, p3]) {
  const dx1 = p1[0] - p2[0], dx2 = p3[0] - p2[0], dx3 = p0[0] - p1[0] + p2[0] - p3[0];
  const dy1 = p1[1] - p2[1], dy2 = p3[1] - p2[1], dy3 = p0[1] - p1[1] + p2[1] - p3[1];
  const den = dx1 * dy2 - dx2 * dy1 || 1e-9;
  const g = (dx3 * dy2 - dx2 * dy3) / den, hh = (dx1 * dy3 - dx3 * dy1) / den;
  const a = p1[0] - p0[0] + g * p1[0], b = p3[0] - p0[0] + hh * p3[0], d = p1[1] - p0[1] + g * p1[1], e = p3[1] - p0[1] + hh * p3[1];
  return 'matrix3d(' + [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, p0[0], p0[1], 0, 1].map((v) => +v.toFixed(7)).join(',') + ')';
}
function track() {
  tracking = 0;
  if (!room || room.flat()) return;
  const q = room.screenQuad(), k = room.shown();
  if (q) {
    // Once seated and still, the glass is square to the eye: place the page flat (cheap to draw,
    // and sharper) and stop refitting it every frame until something moves again.
    const still = lastQuad && q.every((p, i) => Math.abs(p[0] - lastQuad[i][0]) + Math.abs(p[1] - lastQuad[i][1]) < 0.25);
    const square = Math.abs(q[0][1] - q[1][1]) < 1 && Math.abs(q[0][0] - q[3][0]) < 1 && Math.abs(q[1][0] - q[2][0]) < 1 && Math.abs(q[3][1] - q[2][1]) < 1;
    lastQuad = q;
    if (ui.open === 'monitor' && k > 0.99 && still && square) {
      const w = display.offsetWidth, h = display.offsetHeight;
      display.style.transform = 'translate(' + q[0][0].toFixed(2) + 'px,' + q[0][1].toFixed(2) + 'px) scale(' + ((q[1][0] - q[0][0]) / w).toFixed(5) + ',' + ((q[3][1] - q[0][1]) / h).toFixed(5) + ')';
      display.style.opacity = '1';
      settled = true;
      arrive();
      return; // hideScreen, a resize or a reopen starts the fitting again
    }
    display.style.transform = fitToQuad(display.offsetWidth, display.offsetHeight, q);
  }
  settled = false;
  display.style.opacity = String(Math.min(1, k * 3).toFixed(3));
  if (ui.open !== 'monitor' && k < 0.03) { screen.hidden = true; screen.classList.remove('open'); return; } // back on the desk
  tracking = requestAnimationFrame(track);
}
// The browser on the monitor has two tabs: a walk past the robots (the first build, running as a
// page of its own inside a frame) and everything written out. They stay on the same robot.
const frame = $('#tab-walk iframe', screen);
const toWalk = (msg) => { if (frame.contentWindow) frame.contentWindow.postMessage({ to: 'walk', ...msg }, location.origin); };
// The Live map tab: the robot's map from the room, drawn large. Only where the room runs in 3D.
const mapPane = $('#tab-map', screen), mapCv = $('canvas', mapPane);
function fitMap() {
  // the picture keeps its shape (768 × 440), as large as the tab allows, drawn at the screen's own pixels
  const legend = $('.map-legend', mapPane);
  const W = mapPane.clientWidth - 24, H = mapPane.clientHeight - 24 - (legend ? legend.offsetHeight + 8 : 0);
  if (W <= 0 || H <= 0) { if (ui.open === 'monitor' && ui.tab === 'map') requestAnimationFrame(fitMap); return; } // not laid out yet: try again next frame
  const w = Math.floor(Math.min(W, (H * 768) / 440)), h = Math.floor((w * 440) / 768), dpr = Math.min(window.devicePixelRatio || 1, 2);
  mapCv.style.width = w + 'px'; mapCv.style.height = h + 'px';
  if (mapCv.width !== Math.round(w * dpr)) { mapCv.width = Math.round(w * dpr); mapCv.height = Math.round(h * dpr); }
  if (room) room.setMapCanvas(mapCv);
}
window.addEventListener('resize', () => { if (ui.open === 'monitor' && ui.tab === 'map') fitMap(); });
function setTab(tab, work) {
  ui.tab = tab === 'detail' ? 'detail' : tab === 'map' && !document.body.classList.contains('no-room') ? 'map' : 'walk'; // the map needs the room
  if (work !== undefined && work !== null) ui.work = work;
  $$('.btab', screen).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
  $('#tab-walk', screen).hidden = ui.tab !== 'walk';
  $('#tab-detail', screen).hidden = ui.tab !== 'detail';
  mapPane.hidden = ui.tab !== 'map';
  if (ui.tab === 'map') requestAnimationFrame(fitMap); // once the pane has its size
  else if (room) room.setMapCanvas(null);
  if (ui.tab === 'walk') {
    // loaded only when first looked at; after that it is simply told where to go
    if (frame.getAttribute('src')) { toWalk({ type: 'resume' }); if (work) toWalk({ type: 'goto', id: work }); }
    else arrive(); // it starts only once the swing is over (see arrive)
  } else {
    toWalk({ type: 'pause' });
  }
  if (ui.tab === 'walk' || ui.tab === 'map') {
    // nothing more to do here
  } else {
    const target = ui.work && $(`[data-work-section="${ui.work}"]`, screen);
    scroller.scrollTop = target ? target.offsetTop - scroller.offsetTop : 0;
    markWork();
  }
  $('#screen-path').textContent = ui.work || '';
  if (ui.open === 'monitor') writeUrl();
}
// Starting the walk-through builds a whole 3D scene, which is heavy for a moment. It must not
// happen during the swing to the monitor, or the swing stutters. So it starts only on arrival,
// behind a loading screen that goes when the walk-through says it has really drawn.
const loader = $('.loader', screen);
function arrive() {
  if (ui.open !== 'monitor' || ui.tab !== 'walk' || frame.getAttribute('src')) return;
  const seated = !room || room.flat() || settled || reduced;
  if (!seated) return; // track() calls again when the swing is over
  frame.setAttribute('src', frame.dataset.src + (ui.work ? '#' + ui.work : ''));
  setTimeout(() => loader.classList.add('gone'), 12000); // never leave the loading screen up for good
}
$$('.btab', screen).forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab, ui.work)));
// what the walk-through tab tells us: which robot it is at, and when a story is asked for
window.addEventListener('message', (ev) => {
  if (ev.origin !== location.origin || ev.source !== frame.contentWindow || !ev.data || ev.data.from !== 'walk') return;
  if (ev.data.type === 'scene' && ui.tab === 'walk') {
    ui.work = $(`[data-work-section="${ev.data.id}"]`, screen) ? ev.data.id : null;
    $('#screen-path').textContent = ui.work || '';
    if (ui.open === 'monitor') writeUrl();
  }
  if (ev.data.type === 'ready') { loader.classList.add('gone'); if (ui.open !== 'monitor' || ui.tab !== 'walk') toWalk({ type: 'pause' }); }
  if (ev.data.type === 'detail') setTab('detail', ev.data.id);
  if (ev.data.type === 'escape' && ui.open === 'monitor') open(null);
});

function showScreen(work, tab) {
  const flat = !room || room.flat();
  document.body.classList.toggle('flat-screen', flat);
  screen.hidden = false;
  document.body.classList.add('screen-on');
  if (flat) {
    display.style.cssText = '';
    setTimeout(() => { if (ui.open === 'monitor') screen.classList.add('open'); }, room && !reduced ? 900 : 0);
  } else {
    const [w, h] = room.screenSize();
    display.style.width = w + 'px'; display.style.height = h + 'px';
    screen.classList.add('open');
    if (!tracking) tracking = requestAnimationFrame(track);
  }
  setTab(tab || ui.tab, work);
  $('#screen-back').focus({ preventScroll: true });
}
function hideScreen() {
  toWalk({ type: 'pause' }); // nobody is looking at the walk-through now
  if (room) room.setMapCanvas(null);
  settled = false; lastQuad = null;
  document.body.classList.remove('screen-on');
  $$('video', screen).forEach((v) => v.pause());
  if (document.body.classList.contains('flat-screen') || !room) {
    screen.classList.remove('open');
    setTimeout(() => { if (ui.open !== 'monitor') screen.hidden = true; }, 360);
  } else if (!screen.hidden && !tracking) tracking = requestAnimationFrame(track); // it shrinks back onto the desk, then goes
}
function markWork() {
  if (ui.tab !== 'detail') return;
  const mid = scroller.scrollTop + scroller.clientHeight * 0.35;
  let cur = null;
  $$('.work', screen).forEach((s) => { if (s.offsetTop - scroller.offsetTop <= mid) cur = s.dataset.workSection; });
  ui.work = cur;
  $$('.screen-nav a', screen).forEach((a) => a.classList.toggle('on', a.dataset.work === cur));
  if (cur) $('#screen-path').textContent = cur;
}
scroller.addEventListener('scroll', () => { markWork(); if (ui.open === 'monitor') writeUrl(); }, { passive: true });
$$('.screen-nav a', screen).forEach((a) => a.addEventListener('click', (ev) => {
  ev.preventDefault();
  const t = $(`[data-work-section="${a.dataset.work}"]`, screen);
  scroller.scrollTop = t.offsetTop - scroller.offsetTop;
}));
$('#screen-back').addEventListener('click', () => open(null));
$$('[data-goto]', screen).forEach((b) => b.addEventListener('click', () => open(b.dataset.goto)));
// a click on the room around the monitor takes you back to the desk
let leftMonitorAt = 0;
$('#room').addEventListener('click', () => { if (ui.open === 'monitor' || (boardFit && ui.open === fitId)) { leftMonitorAt = performance.now(); open(null); } });
screen.addEventListener('click', (ev) => { if (ev.target === screen) open(null); }); // a click on the room around the monitor
surface.addEventListener('click', (ev) => { if (ev.target === surface) open(null); });

// ----- then and now
function setTime(v) {
  ui.time = v === 'then' ? 'then' : 'now';
  if (room) room.setTime(ui.time);
  if (still.file) showStill(); // the still picture of that desk
  mark();
  writeUrl();
}

// ----- leaving for another page through a drawer: the camera comes in, a sheet lifts out of the
// drawer and comes up to fill the view, the page's own colour closes over it, and the page opens.
let leaving = false;
function leaveBySheet(d) {
  if (leaving) return;
  leaving = true;
  hideSurface(); hideScreen();
  tip.hidden = true;
  document.body.classList.add('viewing', 'going');
  const ms = room.takeSheet(d.id);
  setTimeout(() => document.body.classList.add('leaving'), ms - 420);
  setTimeout(() => { try { sessionStorage.setItem('from-desk', '1'); } catch { /* private window */ } location.href = d.href; }, ms + 60);
}
// coming back with the browser's Back button, the room is as it was left: put it right again
window.addEventListener('pageshow', (ev) => {
  if (!ev.persisted || !leaving) return;
  leaving = false;
  document.body.classList.remove('leaving', 'going', 'viewing');
  if (room) { room.putSheetBack(); room.focus('room'); room.jump(); }
  mark();
});

// ----- opening and closing things
function open(id, { work = null, tab = null } = {}) {
  if (id === 'lamp') { if (room) document.body.dataset.lamp = room.toggleLamp() ? 'on' : 'off'; return; }
  if (id === 'note') { if (info.link) window.open(info.link.href, '_blank', 'noopener'); return; }
  if (id === 'photo-then' || id === 'photo-now') { ui.open = 'photos'; hideSurface(); hideScreen(); if (room) { room.focus('room'); room.setBusy(false); } setTime(id === 'photo-then' ? 'then' : 'now'); return; }
  if (id === 'photos') { ui.open = 'photos'; hideSurface(); hideScreen(); if (room) { room.focus('room'); room.setBusy(false); } setTime(ui.time === 'now' ? 'then' : 'now'); return; }
  if (id && id.startsWith('drawer:')) {
    // a drawer: it slides right out, then takes you where its label says
    const d = drawers.find((x) => 'drawer:' + x.id === id);
    if (!d) return;
    if (d.href && room && !reduced) { leaveBySheet(d); return; }
    if (room) room.pullDrawer(d.id);
    setTimeout(() => { if (d.href) location.href = d.href; else { keep('nb-page', d.page); open('notebook'); } }, room && !reduced ? 450 : 0);
    return;
  }
  if (SMALL.includes(id)) {
    // the gears or the board: lean over the desk, and set that one going
    ui.open = id; hideSurface(); hideScreen();
    if (room) { room.focus('bits'); room.setBusy(true); room.kick(id); }
    mark(); writeUrl();
    return;
  }
  if (id === 'outside' && places.length) {
    // the window on the right wall: the first click walks over to it, each one after shows the next place
    ui.place = ui.open === 'outside' ? (ui.place + 1) % places.length : ui.place === null ? 0 : ui.place;
    ui.open = 'outside'; hideSurface(); hideScreen();
    if (room) { room.focus('outside'); room.setBusy(false); room.setPlace(ui.place); }
    mark(); writeUrl();
    return;
  }
  if (id === 'chair') id = 'monitor';
  if (id && id.startsWith('shelf:')) { work = id.slice(6); id = 'monitor'; tab = 'walk'; } // a shelf robot: walk up to it
  if (id === 'monitor' && ui.time === 'then') setTime('now'); // the second monitor is not there in 2020
  hideSurface();
  if (id === 'monitor') {
    ui.open = 'monitor'; if (work) ui.work = work;
    if (room) { room.focus('monitor'); room.setBusy(true); }
    showScreen(work, tab);
  } else {
    hideScreen();
    if (id && SURFACES.includes(id) && showSurface(id)) {
      ui.open = id;
      if (room) { room.focus(id); room.setBusy(true); }
    } else {
      ui.open = null;
      if (room) { room.focus('room'); room.setBusy(false); }
    }
  }
  mark();
  writeUrl();
}
dock.addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) open(ui.open === b.dataset.open && b.dataset.open !== 'photos' ? null : b.dataset.open); });
$('.close', surface).addEventListener('click', () => open(null));
window.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && ui.open) open(null); });
caption.addEventListener('click', (ev) => { if (ev.target.closest('[data-place-next]')) open('outside'); else if (ev.target.closest('[data-place-back], [data-small-back]')) open(null); });

// ----- the time of day. The clock on the wall can be dragged; this keeps the page in step with it.
const tester = $('#time-test'), clockNote = $('#clock-note');
function setHours(h) {
  if (room) room.setHours(h);
  const mins = h === null ? 0 : Math.round(h * 60) % 1440;
  const hhmm = h === null ? 'live' : String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
  document.body.dataset.hours = h === null ? '' : h.toFixed(2);
  if (clockNote) { clockNote.hidden = h === null; if (h !== null) $('[data-clock-time]', clockNote).textContent = hhmm; }
  if (tester) { $('output', tester).textContent = hhmm; if (h !== null) $('input', tester).value = h; }
}
// back to the real time, and a link that asked for a time no longer does
function liveClock() {
  setHours(null);
  const q = new URLSearchParams(location.search);
  if (q.has('t')) { q.delete('t'); const rest = q.toString(); history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '')); }
}
if (clockNote) $('[data-clock-reset]', clockNote).addEventListener('click', liveClock);
// ----- only while previewing: the tools come and go with the D key (or ?debug in the address)
if (tester) {
  if (askedDebug) document.body.classList.add('debug');
  window.addEventListener('keydown', (ev) => { if ((ev.key === 'd' || ev.key === 'D') && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !/^(INPUT|TEXTAREA)$/.test(ev.target.tagName)) document.body.classList.toggle('debug'); });
}
if (tester) {
  // frames per second on this page, so "it feels laggy" can be a number
  let n = 0, since = performance.now();
  const tick = (now) => { n++; if (now - since >= 1000) { $('#fps').textContent = Math.round((n * 1000) / (now - since)) + ' fps'; n = 0; since = now; } requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  $('input', tester).addEventListener('input', (ev) => setHours(Number(ev.target.value)));
  $('button', tester).addEventListener('click', liveClock);
  // and try the other wall colour (also ?walls=dark)
  $('#walls-test').addEventListener('click', () => setWalls(document.body.dataset.walls === 'light' ? 'dark' : 'light'));
}
function setWalls(v) {
  const now = room ? room.setWalls(v) : v;
  document.body.dataset.walls = now;
  const b = $('#walls-test');
  if (b) b.textContent = 'walls: ' + now;
  writeUrl();
}

// ----- the room as a still picture, for where 3D cannot run. It is the room itself, photographed
// (scripts/stills.mjs), at the time of day it is in Hyderabad (or the hour a link asks for with ?t=).
// On an upright screen it is swiped sideways, and starts at the desk.
// If the picture does not arrive, the plain dark page stays.
function stillHour() {
  const t = new URLSearchParams(location.search).get('t');
  if (t !== null && t !== '' && !Number.isNaN(Number(t))) return Number(t);
  const d = new Date();
  return d.getUTCHours() + d.getUTCMinutes() / 60 + ((info.clock && info.clock.offsetHours) || 0);
}
function showStill() {
  const { box } = still, img = $('img', box), s = pickStill(stillHour(), ui.time);
  if (!s || s.file === still.file) return;
  still.file = s.file; still.map = null; still.grid = null;
  box.dataset.still = s.file;
  box.style.setProperty('--ratio', (s.w / s.h).toFixed(4));
  img.onload = () => { if (still.file !== s.file) return; document.body.classList.add('has-still'); if (!room) document.body.dataset.walls = 'light'; box.classList.add('on'); if (!still.placed) placeStill(true); };
  img.onerror = () => { if (still.file === s.file) box.hidden = true; };
  img.width = s.w * s.scale; img.height = s.h * s.scale;
  img.fetchPriority = 'high'; // the first thing anyone sees
  box.hidden = false;
  img.src = STILL_DIR + s.file;
  placePrint(); // a link straight to the window opens it before there was a picture to print on
  fetch(STILL_DIR + spotsFile(s)).then((r) => (r.ok ? r.json() : null)).then((m) => {
    if (!m || still.file !== s.file) return;
    still.map = m;
    still.grid = m.runs.map((row) => { const out = []; for (let k = 0; k < row.length; k += 2) for (let n = 0; n < row[k + 1]; n++) out.push(m.ids[row[k]]); return out; });
    box.dataset.spots = m.ids.filter((x) => x && !STILL_SKIP.includes(x)).join(' ');
    // where the desk is in the picture, from the map: the middle of the notebook to the drawers
    let lo = Infinity, hi = -Infinity;
    still.grid.forEach((row) => row.forEach((id, i) => { if (STILL_START.includes(id)) { lo = Math.min(lo, i); hi = Math.max(hi, i + 1); } }));
    if (hi > lo) still.start = (lo + hi) / 2 / m.cols;
    if (!still.moved) placeStill(); // the map knows where the desk is better than the first guess did
  }).catch(() => { /* the buttons along the bottom still open everything */ });
}
// Upright: scroll the picture so the desk is in the middle. The first time, a small nudge to show it moves.
function placeStill(first = false) {
  const { box, pic } = still;
  if (getComputedStyle(box).overflowX !== 'auto') return; // only upright screens swipe (desk.css)
  box.scrollLeft = still.start * pic.offsetWidth - box.clientWidth / 2;
  if (first && !still.placed && !reduced) {
    const from = box.scrollLeft;
    setTimeout(() => box.scrollTo({ left: from + 48, behavior: 'smooth' }), 700);
    setTimeout(() => box.scrollTo({ left: from, behavior: 'smooth' }), 1300);
  }
  still.placed = true;
}
// a phone turned between upright and on its side: back to the desk
let stillShape = innerWidth / innerHeight < 1;
window.addEventListener('resize', () => { const up = innerWidth / innerHeight < 1; if (still.file && up !== stillShape) { stillShape = up; requestAnimationFrame(() => placeStill()); } });

// The picture can be clicked like the room: a map, taken with it, says what is under each part.
// Over something, the pointer turns to a hand and the name shows beside it, as in the room. (No glow:
// the click areas are rough boxes, and lighting them up shows the boxes, not the things.)
// A finger is less exact than a mouse: a tap that lands just beside something still counts.
const REACH = 3; // cells (8 page pixels each) around a tap
function stillAt(ev, reach = 0) {
  const { map, grid, pic } = still;
  if (!map) return null;
  const r = pic.getBoundingClientRect();
  const i = Math.floor(((ev.clientX - r.left) / r.width) * map.cols), j = Math.floor(((ev.clientY - r.top) / r.height) * map.rows);
  const ok = (y, x) => { const id = grid[y] && grid[y][x]; return id && !STILL_SKIP.includes(id) ? id : null; };
  if (ok(j, i)) return ok(j, i);
  let best = null, bd = Infinity;
  for (let y = j - reach; y <= j + reach; y++) for (let x = i - reach; x <= i + reach; x++) {
    const id = ok(y, x), d = (x - i) ** 2 + (y - j) ** 2;
    if (id && d <= reach * reach && d < bd) { best = id; bd = d; }
  }
  return best;
}
let stillLit = null;
function stillLight(id) {
  if (id === stillLit) return;
  stillLit = id;
  still.box.dataset.hover = id || '';
  still.box.style.cursor = id ? 'pointer' : '';
}
still.box.addEventListener('pointermove', (ev) => {
  if (ev.pointerType === 'touch') return;
  const id = stillAt(ev);
  stillLight(id);
  tip.hidden = !id;
  if (id) { tip.textContent = names[id] || ''; tip.style.left = ev.clientX + 'px'; tip.style.top = ev.clientY + 'px'; }
});
still.box.addEventListener('pointerleave', () => { stillLight(null); tip.hidden = true; });
let stillTouch = false;
still.box.addEventListener('pointerdown', (ev) => { stillTouch = ev.pointerType !== 'mouse'; still.moved = true; });
still.box.addEventListener('wheel', () => { still.moved = true; }, { passive: true });
still.box.addEventListener('click', (ev) => {
  const id = stillAt(ev, stillTouch ? REACH : 0);
  stillLight(null); tip.hidden = true;
  if (id) open(id);
  else if (ui.open) open(null);
});

// Once the room has drawn a frame or two it fades in over the still picture, which then goes. Anything
// opened from the picture meanwhile is already open in the room (startRoom picks up ui.open).
function roomReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.body.classList.add('room-ready');
    if (reduced) { endStill(); return; }
    // the picture goes once the room has fully faded in over it (or after a while, if that is never told)
    $('#room').addEventListener('transitionend', endStill, { once: true });
    setTimeout(endStill, 2000);
  }));
}
function endStill() {
  if (!still.file) return;
  still.file = null; still.map = null; still.grid = null;
  still.box.hidden = true; still.box.classList.remove('on');
  document.body.classList.remove('has-still');
  tip.hidden = true;
  mark(); // the place print, if one was up, gives way to the window
}

// ----- the room (3D). Without it the still picture stands in, and the buttons along the bottom open everything.
async function startRoom() {
  try {
    if (askedStill) throw new Error('the still picture was asked for');
    if (tester && askedHold > 0) await new Promise((r) => setTimeout(r, Math.min(askedHold, 30) * 1000)); // a slow connection, on this machine
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no webgl');
    const { createRoom } = await import('./room.js');
    room = createRoom($('#room'), {
      reduced, data: info,
      figure: true, // him at the desk, 10 to 6 IST (room.js)
      onZoom: (z) => { document.body.dataset.zoom = z.toFixed(2); },
      onClock: (h) => (h === null ? liveClock() : setHours(h)),
      onPick: (id) => { if (performance.now() - leftMonitorAt > 80) open(id); },
      onHover: (id, x, y) => { tip.hidden = !id; if (id) { tip.textContent = names[id] || ''; tip.style.left = x + 'px'; tip.style.top = y + 'px'; } },
    });
    document.body.classList.add('has-room');
    $('.btab[data-tab="map"]', screen).hidden = false; // the robot is there to be shown
    if (window.__keepRoom) window.__room = room; // only for scripts/stills.mjs, which asks for the click map
    document.body.dataset.zoom = room.zoom().toFixed(2);
    room.setTime(ui.time);
    const t = new URLSearchParams(location.search).get('t');
    if (t !== null && t !== '') setHours(Number(t));
    setWalls(tester && askedWalls === 'dark' ? 'dark' : 'light'); // the dark walls can only be tried in the preview
    if (ui.open && ui.open !== 'photos') { room.focus(SMALL.includes(ui.open) ? 'bits' : ui.open); room.setBusy(ui.open !== 'outside'); }
    if (SMALL.includes(ui.open)) room.kick(ui.open);
    if (tester && askedRobot !== null && askedRobot !== '') { room.setRobotTime(Number(askedRobot) || 0); room.setBusy(true); }
    if (ui.place !== null) room.setPlace(ui.place);
    room.jump();
    roomReady();
    // a link that opened the monitor before the room was ready: now put the page on the glass
    if (ui.open === 'monitor') showScreen(askedWork || ui.work, ui.tab);
    if (FIT[ui.open]) showSurface(ui.open); // now put it on its own object in the room
  } catch (e) {
    document.body.classList.add('no-room');
    if (ui.tab === 'map') setTab('walk'); // no robot to show: a link to the map opens the walk-through
    showStill();
    console.warn('3D room not started:', e.message);
  }
}

// ----- start in the state the link asked for
const q = new URLSearchParams(location.search);
if (q.get('time') === '2020') ui.time = 'then';
const first = q.get('open');
if (first === 'photos') { ui.open = 'photos'; mark(); writeUrl(); }
else if (SMALL.includes(first)) open(first);
else if (first === 'outside' && places.length) { ui.place = Math.max(0, places.findIndex((x) => x.id === q.get('place'))); open('outside'); }
else if (first === 'monitor' || SURFACES.includes(first)) open(first, { work: q.get('work'), tab: q.get('tab') });
else { mark(); writeUrl(); }
let saveData = false;
try { saveData = !!(navigator.connection && navigator.connection.saveData); } catch { /* not known */ }
if (!saveData) showStill();
startRoom();
lazyVideos(); // clips load only when they come near the screen
