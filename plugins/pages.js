// Builds the pages from the data: checks it, renders it to HTML, and drops it into the page shells.
// In dev it also serves Gautham's own clips for preview; those are never part of a build.
import { resolve, join, normalize } from 'node:path';
import { createReadStream, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const ARCHIVE = resolve(ROOT, '../assets/project-videos/Project Videos');

// `tamper` exists only so the tests can prove that a build stops on bad data.
export function pages({ tamper = null } = {}) {
  let server = null;
  let allowedCache = null;
  const load = async (p) => (server ? server.ssrLoadModule('/' + p) : import(pathToFileURL(join(ROOT, p)).href));
  async function build(dev) {
    const [{ loadData }, { validate, localClips, NEVER }, { renderWalk }, { renderCv }, { renderDesk }] = await Promise.all(
      ['src/data/index.js', 'src/data/validate.js', 'src/render/walk.js', 'src/render/cv.js', 'src/render/desk.js'].map(load));
    const data = loadData();
    if (tamper) tamper(data);
    const problems = validate(data);
    if (problems.length) {
      const msg = 'The site data has problems:\n  - ' + problems.join('\n  - ');
      if (!dev) throw new Error(msg);
      console.warn('\n' + msg + '\n');
    }
    const allowed = new Set(localClips(data).filter((f) => !NEVER.some((r) => r.test(f))));
    return { walk: renderWalk(data, { dev }), cv: renderCv(data, { dev }), desk: renderDesk(data, { dev }), data, allowed, problems };
  }
  return {
    name: 'portfolio-pages',
    configureServer(s) {
      server = s;
      // Only clips named in the data (and never the held-back ones) can be fetched, and only here.
      s.middlewares.use('/local-media', async (req, res) => {
        const rel = normalize(decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, ''));
        const allowed = allowedCache || (allowedCache = (await build(true)).allowed);
        let size;
        try { if (!allowed.has(rel)) throw 0; size = statSync(join(ARCHIVE, rel)).size; } catch { res.statusCode = 404; return res.end('not available'); }
        const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
        const start = m && m[1] ? Number(m[1]) : 0;
        const end = m && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
        res.writeHead(m ? 206 : 200, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, ...(m ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}) });
        createReadStream(join(ARCHIVE, rel), { start, end }).pipe(res);
      });
    },
    handleHotUpdate({ file, server: s }) {
      allowedCache = null;
      if (/\/src\/(data|render)\//.test(file) || /\/src\/data\/activity\/[^/]+\.json$/.test(file)) s.ws.send({ type: 'full-reload' });
    },
    async transformIndexHtml(html, ctx) {
      const dev = !!ctx.server;
      const out = await build(dev);
      const banner = dev && out.problems.length ? `<pre id="data-problems">Data problems:\n${out.problems.map((x) => '- ' + x.replace(/</g, '&lt;')).join('\n')}</pre>` : '';
      return html
        .replace('<!--@walk-->', () => out.walk.walk)
        .replace('<!--@rail-->', () => out.walk.rail)
        .replace('<!--@stories-->', () => out.walk.stories)
        .replace('<!--@cv-->', () => out.cv)
        .replace('<!--@desk-hero-->', () => out.desk.hero)
        .replace('<!--@social-->', () => out.desk.social)
        .replace('<!--@desk-dock-->', () => out.desk.dock)
        .replace('<!--@desk-surfaces-->', () => out.desk.surfaces)
        .replace('<!--@desk-captions-->', () => out.desk.captions)
        .replace('<!--@desk-note-->', () => out.desk.note)
        .replace('<!--@desk-screen-->', () => out.desk.screen)
        .replace('<!--@desk-clock-->', () => out.desk.clock)
        .replace('<!--@desk-devtools-->', () => out.desk.devtools)
        .replace('<!--@desk-data-->', () => JSON.stringify(out.desk.roomData).replace(/</g, '\\u003c'))
        .replace('<!--@problems-->', () => banner)
        .replace('<!--@preview-->', () => dev ? '<div id="preview-note">Preview · amber labels = not cleared to publish</div>' : '');
    },
  };
}
