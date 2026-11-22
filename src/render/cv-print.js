// The CV as one self-contained HTML document, laid out like Gautham's own resume: a centred name
// and contact line, ruled section headings, the company on the left with the dates on the right,
// compact justified bullets in a book typeface, on letter paper. scripts/cv-pdf.mjs prints it to
// the PDF that the CV page offers for download. Text in, text out: runs in the tests too.
// The words are the same ones the CV page shows (src/data/cv.js); only the layout differs.
// There is no commit history here, and nothing from the web page's look.
import { esc, rich } from './util.js';

const CSS = `
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; }
body { margin: 0; color: #000; background: #fff; font-family: 'Linux Libertine O', 'Libertinus Serif', 'Latin Modern Roman', 'Liberation Serif', 'Times New Roman', serif; font-size: 9.5pt; line-height: 1.17; font-variant-ligatures: common-ligatures; font-kerning: normal; }
a { color: inherit; text-decoration: none; }
header { text-align: center; margin-bottom: 5pt; }
h1 { margin: 0 0 4pt; font-size: 18.5pt; font-weight: 700; letter-spacing: 0.01em; line-height: 1.1; }
header p { margin: 0; line-height: 1.3; text-align: center; }
header .sep { display: inline-block; margin: 0 0.9em; }
h2 { margin: 6pt 0 2.5pt; padding-bottom: 1pt; border-bottom: 0.5pt solid #000; font-size: 12pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.015em; line-height: 1.15; break-after: avoid; }
p { margin: 0; text-align: justify; hyphens: auto; }
p + p { margin-top: 1pt; }
.glance { text-align: left; }
.glance span { margin-right: 1.4em; white-space: nowrap; }
.row { display: flex; justify-content: space-between; align-items: baseline; gap: 12pt; break-after: avoid; }
.row + .row { margin-top: 0; }
.job { margin-top: 2.5pt; }
.job:first-of-type { margin-top: 0; }
.job b, .when { font-weight: 700; }
.where { white-space: nowrap; }
ul { margin: 1.2pt 0 0; padding-left: 0.17in; }
li { margin: 1.3pt 0 0; padding-left: 1pt; text-align: justify; hyphens: auto; break-inside: avoid; }
li::marker { font-size: 0.85em; }
code { font-family: 'Latin Modern Mono', 'DejaVu Sans Mono', monospace; font-size: 0.86em; }
`;

const bare = (u) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
const SEP = '<span class="sep">|</span>';

export function renderCvHtml(data) {
  const { profile, cv } = data;
  const L = profile.links;
  const line1 = [esc(`${profile.place}, ${profile.country}`), profile.phone && `<a href="tel:${esc(profile.phone.replace(/\s+/g, ''))}">${esc(profile.phone)}</a>`, L.email && `<a href="mailto:${esc(L.email)}">${esc(L.email)}</a>`].filter(Boolean).join(SEP);
  const line2 = [L.linkedin, L.github].filter(Boolean).map((u) => `<a href="${esc(u)}">${esc(bare(u))}</a>`).join(SEP);
  const labelled = (rows, dash = false) => rows.map(([a, b]) => (dash ? `<p><b>${esc(a)}</b> – ${rich(b)}</p>` : `<p><b>${esc(a)}:</b> ${rich(b)}</p>`)).join('');
  const ul = (items) => `<ul>${items.map((t) => `<li>${rich(t)}</li>`).join('')}</ul>`;
  const jobs = cv.jobs.map((j) => j.roles.map((r) => `
    <div class="job">
      ${r.title
        ? `<div class="row"><b>${esc(j.company)}</b><span class="when">${esc(r.dates)}</span></div>
      <div class="row"><span><i>${esc(r.title)}</i>${r.extra ? ' ' + esc(r.extra) : ''}</span><span class="where">${esc([j.place, profile.country].filter(Boolean).join(', '))}</span></div>`
        : `<div class="row"><b>${esc(j.company)}</b></div>`}
      ${ul(r.bullets)}
    </div>`).join('')).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(profile.name)} · ${esc(profile.role)} · CV</title>
<style>${CSS}</style>
</head>
<body>
<header>
  <h1>${esc(profile.name)}</h1>
  <p>${line1}</p>
  <p>${line2}</p>
</header>
<h2>Professional summary</h2>
<p>${esc(cv.intro)}</p>
<h2>At a glance</h2>
<p class="glance">${cv.glance.map(([a, b]) => `<span><b>${esc(a)}:</b> ${rich(b)}</span>`).join(' ')}</p>
${cv.profile ? `<h2>${esc(cv.profileTitle)}</h2>${labelled(cv.profile, true)}` : ''}
<h2>Professional experience</h2>
${jobs}
<h2>Technical skills</h2>
${labelled(cv.skills)}
${cv.lists.map((l) => `<h2>${esc(l.title)}</h2>${l.items.map((t) => `<p>${rich(t)}</p>`).join('')}`).join('\n')}
</body>
</html>
`;
}

// How the browser is asked to print it: letter paper, the resume's margins, a page number at the foot.
export const CV_PDF_OPTIONS = {
  format: 'Letter',
  printBackground: false,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: '<div style="width:100%;text-align:center;font-family:\'Linux Libertine O\',\'Liberation Serif\',serif;font-size:9.5px;color:#000;"><span class="pageNumber"></span></div>',
  margin: { top: '0.42in', bottom: '0.62in', left: '0.48in', right: '0.48in' },
};
