// Turns the data into the HTML of the CV page (cv.html). Runs at build time and in the tests.
// The PDF is printed from this same page by scripts/cv-pdf.mjs; the activity chart is left out of print.
import { esc, rich } from './util.js';
import { activitySvg } from './activity.js';

export function renderCv(data, { dev = false } = {}) {
  const { profile, cv, activity } = data;
  const L = profile.links;
  // Each is written out in full, not as a word to click, so it can be read off the printed CV too.
  const bare = (u) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  const links = [['LinkedIn', L.linkedin, L.linkedin && bare(L.linkedin)], ['GitHub', L.github, L.github && bare(L.github)],
    ['Email', L.email ? 'mailto:' + L.email : '', L.email], ['Phone', profile.phone ? 'tel:' + profile.phone.replace(/\s+/g, '') : '', profile.phone]]
    .map(([n, u, shown]) => (u ? `<a href="${esc(u)}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : ''}>${esc(shown)}</a>` : dev ? `<span class="todo">${n} (to add)</span>` : ''))
    .filter(Boolean).join(' · ');
  const dl = (cls, rows) => `<dl class="${cls}">${rows.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${rich(b)}</dd></div>`).join('')}</dl>`;
  const ul = (items) => `<ul>${items.map((t) => `<li>${rich(t)}</li>`).join('')}</ul>`;
  const jobs = cv.jobs.map((j) => `
    <section class="job">
      <h3>${esc(j.company)}${j.place ? ` <span>${esc(j.place)}</span>` : ''}</h3>
      ${j.roles.map((r) => `${r.title ? `<p class="title"><strong>${esc(r.title)}</strong>${r.extra ? ' ' + esc(r.extra) : ''} <span>${esc(r.dates)}</span></p>` : ''}${ul(r.bullets)}`).join('')}
    </section>`).join('');
  return `
    <h1>${esc(profile.name)}</h1>
    <p class="role">${esc(profile.role)} · ${esc(profile.place)}, ${esc(profile.country)}</p>
    <p class="intro">${esc(cv.intro)}</p>
    <p class="links" id="links">${links}</p>
    <h2>At a glance</h2>
    ${dl('glance', cv.glance)}
    ${cv.profile ? `<h2>${esc(cv.profileTitle)}</h2>${dl('profile', cv.profile)}` : ''}
    <section class="activity">
    <h2>Activity</h2>
    <div class="lights" id="lights">${activitySvg(activity)}</div>
    <p class="small">${esc(cv.activityNote)}</p>
    </section>
    <h2>Experience</h2>
    ${jobs}
    <h2>Skills</h2>
    <p class="small">${esc(cv.skillsNote)}</p>
    ${dl('skills', cv.skills)}
    ${cv.lists.map((l) => `<h2>${esc(l.title)}</h2>${ul(l.items)}`).join('')}`;
}
