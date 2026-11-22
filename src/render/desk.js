// Turns the data into the HTML of the desk page. Text in, text out: runs at build time and in the tests.
// Nothing here is a side panel. Each object shows its content in its own form: the monitor as a
// computer, the whiteboard as a board, the notebook as pages, the bin as a sheet of paper.
import { esc, linked } from './util.js';
import { clipsHtml } from './clip.js';
import { SHARE, STILL_DIR } from '../still.js';

const draftChip = (on, dev) => (on && dev ? ' <span class="chip chip-team">Draft wording · to confirm</span>' : '');

// Everyone on the tree who carries a number, in the order they are drawn (each area, then the engineers
// under it): p1, p2, … Each opens what they are on.
export const people = (tree) => (tree.children || []).flatMap((k) => [k, ...(k.children || []).map((c) => ({ ...c, area: k.label }))])
  .filter((x) => x.on).map((x, i) => ({ ...x, id: `p${i + 1}` }));

// The org chart as a drawing: roles only, each with the number it is working on.
export function treeSvg(tree) {
  const kids = tree.children || [];
  const W = 620, colW = W / Math.max(kids.length, 1);
  let n = 0; // people so far, to number them as people() does
  const opener = (cls, label, on, area) => {
    if (!tree.opens) return '';
    if (cls === 'me') return ` data-item="me" role="button" tabindex="0" aria-expanded="false" aria-label="${esc(label)}: how the team came to be"`;
    if (on) return ` data-item="p${++n}" role="button" tabindex="0" aria-expanded="false" aria-label="${esc(area ? `${label}, ${area}` : label)}: what they are on"`;
    return '';
  };
  const node = (x, y, w, label, on, cls = '', area = '') => `
    <g class="node ${cls}"${opener(cls, label, on, area)}><rect x="${x - w / 2}" y="${y - 19}" width="${w}" height="38" rx="${cls === 'me' ? 19 : 7}"/>
    <text x="${x}" y="${y + 5}" text-anchor="middle">${esc(label)}</text>
    ${on ? `<g class="tag" data-on="${esc(on)}"><rect x="${x + w / 2 - 14}" y="${y - 31}" width="38" height="22" rx="11"/><text x="${x + w / 2 + 5}" y="${y - 15}" text-anchor="middle">${esc(on)}</text></g>` : ''}</g>`;
  const cx = W / 2 - 40;
  let out = '', lines = '';
  lines += `<path d="M${cx} 59 V86 M${colW / 2} 86 H${W - colW / 2}"/>`;
  kids.forEach((k, i) => {
    const x = colW / 2 + i * colW;
    lines += `<path d="M${x} 86 V109"/>`;
    out += node(x, 128, 150, k.label, k.on);
    const g = k.children || [];
    g.forEach((c, j) => {
      const gx = x + (j - (g.length - 1) / 2) * 98;
      lines += `<path d="M${x} 147 V172 H${gx} V197"/>`;
      out += node(gx, 216, 88, c.label, c.on, 'small', k.label);
    });
  });
  if (tree.beside) { lines += `<path class="dash" d="M${cx + 46} 40 H${W - 150}"/>`; out += `<text class="beside" x="${W - 142}" y="45">${esc(tree.beside)}</text>`; }
  return `<svg class="tree" viewBox="0 0 ${W} 250" role="img" aria-label="The team as a tree of roles">${`<g class="lines">${lines}</g>`}${node(cx, 40, 92, tree.label, null, 'me')}${out}</svg>`;
}

export function renderDesk(data, { dev = false } = {}) {
  const { profile, scenes, desk } = data;
  const L = profile.links;
  const linkBtn = (name, url) => (url ? `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">${name}</a>` : dev ? `<span class="btn ghost">${name} <small>to add</small></span>` : '');

  // Quiet on purpose: who he is and how to look around.
  const hero = `
    <p class="who">${esc(profile.role)} <i>·</i> ${esc(profile.place)}</p>
    <p class="hint">${esc(desk.hint)}</p>`;

  const dock = desk.objects.map((o) => `<button data-open="${esc(o.id)}"><b>${esc(o.label)}</b>${o.sub ? `<span>${esc(o.sub)}</span>` : ''}</button>`).join('');

  // ----- the whiteboard
  const w = desk.whiteboard;
  const opens = (x) => !!(x.story || x.what);
  const item = (x) => (opens(x)
    ? `<li><button class="item" data-item="${esc(x.id)}" aria-expanded="false"><b>${esc(x.id)}</b> ${esc(x.title)}</button></li>`
    : `<li><span class="item" data-item="${esc(x.id)}"><b>${esc(x.id)}</b> ${esc(x.title)}</span></li>`);
  // an opened feature: a plain sentence, then whichever of why / my part / built with it has
  const rows = [['why', 'Why'], ['part', 'My part'], ['tools', 'Built with']];
  const featureBox = (f) => `<div class="board-story feature" data-story="${esc(f.id)}" hidden><b>${esc(f.id)}</b> <strong>${esc(f.title)}</strong>
        <p>${esc(f.what)}</p>${rows.some(([k]) => f[k]) ? `<dl>${rows.filter(([k]) => f[k]).map(([k, t]) => `<dt>${t}</dt><dd>${esc(f[k])}</dd>`).join('')}</dl>` : ''}</div>`;
  // someone on the tree: their role (and area), and what they are on now, each a link to that item when it opens.
  // Only what the board already says: no names, no words about the person (Gautham, 21 Nov 2026).
  const byId = Object.fromEntries([...w.bugs, ...w.features].map((x) => [x.id, x]));
  const onNow = (id) => (opens(byId[id])
    ? `<button class="goto" data-goto="${esc(id)}"><b>${esc(id)}</b> ${esc(byId[id].title)}</button>`
    : `<span class="goto"><b>${esc(id)}</b> ${esc(byId[id].title)}</span>`);
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const engBox = (e) => `<div class="board-story eng" data-story="${e.id}" hidden>${e.area ? `<b>${esc(e.label)}</b> <strong>${esc(cap(e.area))}</strong>` : `<strong>${esc(cap(e.label))}</strong>`}
        <dl><dt>On now</dt><dd>${[].concat(e.on).map(onNow).join('<br>')}</dd></dl></div>`;
  const whiteboard = `
  <template data-surface="whiteboard">
    <div class="board">
      <p class="board-title">${esc(w.title)}${draftChip(w.draft, dev)}</p>
      <div class="board-grid">
        ${treeSvg({ ...w.tree, opens: w.me.length > 0 })}
        <div class="board-lists">
          <h3 class="bugs">Bugs</h3><ul>${w.bugs.map(item).join('')}</ul>
          <h3 class="features">Features</h3><p class="board-note">${esc(w.featuresNote)}</p><ul>${w.features.map(item).join('')}</ul>
        </div>
        <div class="board-stories">
          ${w.bugs.filter((b) => b.story).map((b) => `<div class="board-story" data-story="${esc(b.id)}" hidden><b>${esc(b.id)}</b> ${b.story.map((p) => `<span>${esc(p)}</span>`).join(' ')}</div>`).join('')}
          ${w.features.filter((f) => f.what).map(featureBox).join('')}
          ${people(w.tree).map(engBox).join('')}
          <div class="board-story me" data-story="me" hidden><b>me</b>${w.me.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
        </div>
      </div>
      <ul class="board-then" aria-label="Notes on the board in 2020">${w.then.map((x) => `<li${x.done ? ' class="done"' : ''}>${x.done ? `<s>${esc(x.text)}</s>` : esc(x.text)}</li>`).join('')}</ul>
      <p class="board-hint"><span class="fine">${esc(w.hint[0])}</span><span class="coarse">${esc(w.hint[1])}</span> ${esc(w.hint[2])}</p>
    </div>
  </template>`;

  // ----- the notebook
  const nb = desk.notebook;
  const page = (p) => `
      <article class="page" data-page="${esc(p.id)}">
        <h3>${esc(p.title)}</h3>
        ${(p.body || []).map((x) => `<p>${esc(x)}</p>`).join('')}
        ${p.items ? `<ul>${p.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${p.contact ? `<p class="actions">${linkBtn('LinkedIn', L.linkedin)}${linkBtn('GitHub', L.github)}${linkBtn('Email', L.email ? 'mailto:' + L.email : '')}<a class="btn" href="./cv.html">CV</a></p>` : ''}
        ${p.note ? `<p class="pencil">${esc(p.note)}</p>` : ''}
      </article>`;
  const notebook = `
  <template data-surface="notebook">
    <div class="book">
      <nav class="book-tabs" role="tablist">${nb.pages.map((p, i) => `<button role="tab" aria-selected="${i === 0}" data-page-tab="${esc(p.id)}">${esc(p.tab)}</button>`).join('')}</nav>
      <div class="book-pages">${nb.pages.map(page).join('')}</div>
    </div>
  </template>`;

  // ----- the bin: one sheet of paper, flattened out
  const b = desk.bin;
  const bin = `
  <template data-surface="bin">
    <div class="paper">
      <p class="paper-lead">${esc(b.lead)}</p>
      ${b.sheets.map((s) => `<article><h3>${esc(s.title)}${draftChip(s.draft, dev)}</h3>${s.body.map((p) => `<p>${esc(p)}</p>`).join('')}</article>`).join('')}
      <p class="pencil">${esc(b.note)}</p>
    </div>
  </template>`;

  // ----- the photographs: no surface, only a caption under the room
  const t = desk.time;
  const captions = `
    <p data-time-caption="then" hidden><b>${esc(t.then.year)}</b> ${esc(t.then.caption)}${draftChip(t.then.draft, dev)}</p>
    <p data-time-caption="now" hidden><b>${esc(t.now.year)}</b> ${esc(t.now.caption)} <i>${esc(t.line)}</i></p>
${desk.small.items.map((x) => `<p data-small-caption="${esc(x.id)}" hidden><b>${esc(x.label)}</b> ${esc(x.caption)}${draftChip(x.draft, dev)}
      <span class="place-actions"><button type="button" class="btn" data-small-back>${esc(desk.small.back)}</button></span></p>`).join('')}
    <p data-place-caption hidden><b data-place-name></b>${dev ? ' <span class="chip chip-team" data-place-standin>Stand-in drawing · photo to come</span>' : ''}
      <span class="place-actions"><button type="button" class="btn" data-place-next>${esc(desk.outside.next)} <span aria-hidden="true">→</span></button>${desk.outside.more ? `<a class="btn" data-place-more href="${esc(desk.outside.more.href)}" target="_blank" rel="noopener">${esc(desk.outside.more.label)} <span aria-hidden="true">↗</span></a>` : ''}<button type="button" class="btn" data-place-back>${esc(desk.outside.back)}</button></span></p>`;

  // ----- the note, for where there is no room to pin it in (no 3D)
  const n = desk.note;
  const note = `<blockquote class="verse">${n.verse.lines.map((l) => `<span>${esc(l)}</span>`).join('')}<cite>${esc(n.verse.ref)} · ${esc(n.verse.version)}</cite></blockquote>
    <a class="verse-link" href="${esc(n.link.href)}" target="_blank" rel="noopener">${esc(n.link.ref)} <span aria-hidden="true">→</span></a>`;

  // ----- the second monitor: a computer inside the room
  const li = ([text, tag, link]) => `<li><span>${linked(text, link)}</span><code>${esc(tag)}</code></li>`;
  // No frame is drawn here: the frame is the monitor in the room. This is only its glass.
  const screen = `
   <div class="display">
    <header class="screen-top" role="tablist" aria-label="Browser tabs">
      <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
      <button class="btab" role="tab" data-tab="walk" aria-selected="true">${esc(desk.monitor.tabs.walk)}</button>
      <button class="btab" role="tab" data-tab="detail" aria-selected="false">${esc(desk.monitor.tabs.detail)}</button>
      <button class="btab" role="tab" data-tab="map" aria-selected="false" hidden>${esc(desk.monitor.tabs.map)}</button>
      <button class="btn" id="screen-back"><span aria-hidden="true">←</span> ${esc(desk.monitor.back)}</button>
    </header>
    <div class="address"><p class="screen-path"><b>${esc(desk.monitor.site)}</b> <span id="screen-path"></span></p><p class="screen-lead">${esc(desk.monitor.lead)}</p></div>
    <div class="pane" id="tab-walk"><iframe title="${esc(desk.monitor.tabs.walk)}" data-src="./monitor/walk.html?embed=1"></iframe><div class="loader" role="status"><span class="loader-text">${esc(desk.monitor.loading)}</span><span class="loader-bar"><i></i></span></div></div>
    <div class="pane" id="tab-map" hidden><canvas aria-label="${esc(desk.monitor.tabs.map)}: the robot in the room, as its own software shows it"></canvas>${desk.monitor.mapLegend ? `<p class="map-legend">${esc(desk.monitor.mapLegend)}</p>` : ''}</div>
    <div class="pane" id="tab-detail" hidden>
    <nav class="screen-nav" aria-label="Projects">${scenes.map((s) => `<a href="#work-${esc(s.id)}" data-work="${esc(s.id)}">${esc(s.nav)}</a>`).join('')}</nav>
    <div class="screen-scroll">
      ${scenes.map((s, i) => `
      <section class="work" id="work-${esc(s.id)}" data-work-section="${esc(s.id)}">
        <p class="kicker"><b>${String(i + 1).padStart(2, '0')}</b> ${esc(s.kicker)}</p>
        <h2>${s.words.map((x, k) => `<span class="${k ? 'w2' : 'w1'}">${esc(x)}</span>`).join(' ')}</h2>
        <ul class="proof">${s.proof.map(li).join('')}</ul>
        <p class="thanks-line"><b>Made possible by</b> ${esc(s.thanks)}</p>
        ${s.stories.map((st) => `<article class="work-story"><h3>${esc(st.title)}</h3>${st.body.map((p) => `<p>${linked(p, st.links)}</p>`).join('')}${clipsHtml(st.clips, { dev })}</article>`).join('')}
      </section>`).join('')}
      <p class="to-notebook">${esc(desk.monitor.after.text)} <button class="btn" data-goto="notebook">${esc(desk.monitor.after.button)} <span aria-hidden="true">→</span></button></p>
    </div>
    </div>
   </div>`;

  // ----- shown while the clock has been set to another time, so nobody takes it for the real one
  const clock = `<p id="clock-note" aria-live="polite" hidden><b data-clock-time></b> ${esc(desk.clock.zone)} <span>· ${esc(desk.clock.set)}</span> <button type="button" class="btn" data-clock-reset>${esc(desk.clock.reset)}</button></p>`;

  // ----- only while previewing, and hidden until D is pressed (or ?debug): the time of day, the wall colour, frames per second
  const devtools = dev ? `<label id="time-test">Time of day (${esc(desk.clock.zone)}) <input type="range" min="0" max="24" step="0.25" value="12" /> <output>live</output> <button type="button">live</button> <button type="button" id="walls-test" title="Try the other wall colour">walls: light</button> <span id="fps" title="frames per second on this page">-- fps</span></label>` : '';

  // what the room itself needs to draw: no wording beyond what is already on the page
  const roomData = {
    shelf: desk.shelf, tree: w.tree, boardTitle: w.title, boardThen: w.then,
    bugs: w.bugs.map((x) => ({ id: x.id, title: x.title })), features: w.features.map((x) => ({ id: x.id, title: x.title })),
    verse: n.verse, link: n.link, clock: desk.clock, idle: desk.monitor.idle,
    small: desk.small.items.map((x) => ({ id: x.id, label: x.label })),
    drawers: desk.drawers.map((x) => ({ id: x.id, label: x.label, sub: x.sub || '', href: x.href || null, page: x.page || null })),
    outside: { label: desk.outside.label, places: desk.outside.places.map((x) => ({ id: x.id, name: x.name, scene: x.scene, photo: x.photo, focus: x.focus })) },
  };

  // The description, and what a shared link shows (Open Graph, read by LinkedIn, WhatsApp and the rest).
  const title = `${profile.name} · ${profile.role}`, image = new URL(STILL_DIR + SHARE.file, profile.site).href;
  const social = [
    `<meta name="description" content="${esc(desk.share.description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${esc(profile.site)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desk.share.description)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:image:width" content="${SHARE.w}" />`,
    `<meta property="og:image:height" content="${SHARE.h}" />`,
    `<meta property="og:image:alt" content="${esc(`A desk in a room: two monitors, a whiteboard, a shelf of small robots, and a window.`)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join('\n  ');
  return { hero, dock, surfaces: whiteboard + notebook + bin, captions, note, screen, clock, devtools, roomData, social };
}
