// Turns the data into the HTML of the interactive page. Pure text in, text out:
// it runs at build time (and in the tests) and never touches a browser.
import { esc, linked } from './util.js';
import { clipsHtml } from './clip.js';

export function sceneOrder(data) {
  return ['opening', ...data.scenes.map((s) => s.id), 'journey', 'off', 'thanks', 'contact'];
}

export function renderWalk(data, { dev = false } = {}) {
  const { profile, scenes, journey, off, thanks, contact } = data;
  const order = sceneOrder(data);
  const names = { opening: 'Start', journey: 'Journey', off: 'Off the floor', thanks: 'Thanks', contact: 'Contact' };
  scenes.forEach((s) => { names[s.id] = s.nav; });
  const num = (id) => String(order.indexOf(id)).padStart(2, '0');
  const li = ([text, tag, link]) => `<li><span>${linked(text, link)}</span><code>${esc(tag)}</code></li>`;

  let walk = `
  <section class="scene opening" id="opening" data-id="opening">
    <div class="hero">
      <h1><span>${esc(profile.headline[0])}</span><span class="h1b">${esc(profile.headline[1])}</span></h1>
      <p class="who">${esc(profile.name)} <i>·</i> ${esc(profile.role)} <i>·</i> ${esc(profile.place)}</p>
      <p class="actions"><a class="btn primary" href="#${esc(scenes[0].id)}">Walk the floor</a><a class="btn" href="../cv.html">CV</a></p>
      <p class="hint">Scroll to walk. Click a robot to open its story.</p>
    </div>
  </section>`;

  for (const s of scenes) {
    const first = s.proof.slice(0, 2), rest = s.proof.slice(2);
    walk += `
  <section class="scene" id="${esc(s.id)}" data-id="${esc(s.id)}">
    <article class="card">
      <p class="kicker"><b>${num(s.id)}</b> ${esc(s.kicker)}</p>
      <h2>${s.words.map((w, k) => `<span class="${k ? 'w2' : 'w1'}">${esc(w)}</span>`).join(' ')}</h2>
      <ul class="proof">${first.map(li).join('')}</ul>
      ${rest.length ? `<ul class="proof more" hidden>${rest.map(li).join('')}</ul><button class="link more-btn" aria-expanded="false" data-n="${rest.length}">+ ${rest.length} more</button>` : ''}
      <p class="thanks-line"><b>Made possible by</b> ${esc(s.thanks)}</p>
      ${s.stories.length ? `<button class="btn primary story-btn" data-story="${esc(s.id)}">${esc(s.cta)} <span aria-hidden="true">→</span></button>` : ''}
    </article>
  </section>`;
  }

  walk += `
  <section class="scene" id="journey" data-id="journey">
    <article class="card wide">
      <p class="kicker"><b>${num('journey')}</b> ${esc(journey.title)}</p>
      <ol class="timeline">${journey.rows.map(([y, w, t]) => `<li><code>${esc(y)}</code><div><strong>${esc(w)}</strong><span>${esc(t)}</span></div></li>`).join('')}</ol>
    </article>
  </section>
  <section class="scene" id="off" data-id="off">
    <article class="card">
      <p class="kicker"><b>${num('off')}</b> ${esc(off.title)}</p>
      <p class="plain">${esc(off.words)}</p>
      <ul class="places">${off.places.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    </article>
  </section>
  <section class="scene center" id="thanks" data-id="thanks">
    <article class="card">
      <p class="kicker"><b>${num('thanks')}</b> Thanks</p>
      <h2><span class="w1">${esc(thanks.title)}</span></h2>
      <ul class="plain-list">${thanks.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      ${thanks.note ? `<p class="note">${esc(thanks.note)}</p>` : ''}
    </article>
  </section>`;

  const L = profile.links;
  const linkBtn = (name, url) => (url ? `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">${name}</a>` : dev ? `<span class="btn ghost">${name} <small>to add</small></span>` : '');
  walk += `
  <section class="scene center" id="contact" data-id="contact">
    <div class="hero small">
      <h2 class="big">${esc(contact.title)}<span class="h1b">${esc(contact.sub)}</span></h2>
      <p class="actions">${linkBtn('LinkedIn', L.linkedin)}${linkBtn('GitHub', L.github)}${linkBtn('Email', L.email ? 'mailto:' + L.email : '')}<a class="btn" href="../cv.html">CV</a></p>
      <p class="hint">© ${esc(profile.name)}</p>
    </div>
  </section>`;

  const rail = order.map((id) => `<a href="#${esc(id)}" data-to="${esc(id)}"><i></i><span>${esc(names[id])}</span></a>`).join('');

  // One hidden template per story; the page copies it into the side panel when a robot is opened.
  let stories = '';
  for (const s of scenes) {
    s.stories.forEach((st, i) => {
      stories += `
  <template data-story="${esc(s.id)}" data-i="${i}">
    <p class="kicker">${esc(s.kicker)}</p>
    ${s.stories.length > 1 ? `<div class="tabs" role="tablist">${s.stories.map((x, k) => `<button role="tab" aria-selected="${k === i}" data-i="${k}">${esc(x.title)}</button>`).join('')}</div>` : ''}
    <h3>${esc(st.title)}</h3>
    ${st.body.map((p) => `<p>${linked(p, st.links)}</p>`).join('')}
    ${clipsHtml(st.clips, { dev })}
  </template>`;
    });
  }


  return { walk, rail, stories, order };
}
