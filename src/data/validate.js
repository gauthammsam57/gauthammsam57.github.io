// Checks the data before any page is built from it. Returns a list of problems (empty = fine).
// The build stops if this list is not empty.
export const STATUSES = ['team', 'company', 'held', 'drawn', 'photo'];
// Files that must never be served or built, whatever the data says.
export const NEVER = [/slam-mapping/i, /fleet/i, /\.mov$/i, /\.avi$/i];

export function allClips({ scenes }) {
  const out = [];
  for (const s of scenes) for (const st of s.stories) for (const c of st.clips) out.push({ where: `${s.id} / ${st.title}`, clip: c });
  return out;
}
export const localClips = (data) => [...new Set(allClips(data).map((x) => x.clip.local).filter(Boolean))];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function validate({ profile, scenes, journey, off, thanks, contact, cv, activity, desk }, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const p = [];
  const need = (ok, msg) => { if (!ok) p.push(msg); };
  const str = (v) => typeof v === 'string' && v.trim().length > 0;

  need(str(profile.name) && str(profile.role) && str(profile.place), 'profile: name, role and place are needed');
  need(Array.isArray(profile.headline) && profile.headline.length === 2 && profile.headline.every(str), 'profile: headline needs two lines');
  need(typeof profile.site === 'string' && /^https:\/\/[^\s]+\/$/.test(profile.site), 'profile.site: the full address of the site, ending in /');
  need(str(desk.share && desk.share.description), 'desk.share.description: what a shared link says under the title');
  for (const [k, v] of Object.entries(profile.links)) need(v === '' || /^https:\/\//.test(v) || (k === 'email' && /^[^@\s]+@[^@\s]+$/.test(v)), `profile.links.${k}: not a usable address`);
  for (const [k, v] of Object.entries(profile.numbers)) need(Number.isInteger(v) || str(v), `profile.numbers.${k}: empty`);

  const ids = new Set();
  need(scenes.length > 0, 'scenes: none');
  for (const s of scenes) {
    need(/^[a-z]+$/.test(s.id || ''), `scene "${s.id}": id must be lower-case letters`);
    need(!ids.has(s.id), `scene "${s.id}": id used twice`);
    ids.add(s.id);
    for (const k of ['nav', 'kicker', 'title', 'thanks']) need(str(s[k]), `scene ${s.id}: "${k}" is empty`);
    need(Array.isArray(s.words) && s.words.length >= 1 && s.words.every(str), `scene ${s.id}: words are empty`);
    need(Array.isArray(s.proof) && s.proof.length >= 1, `scene ${s.id}: no proof points`);
    const linkOk = (l, text) => l && str(l.text) && /^https:\/\//.test(l.href || '') && [].concat(text).some((t) => t.includes(l.text));
    for (const pr of s.proof || []) {
      need(Array.isArray(pr) && (pr.length === 2 || pr.length === 3) && str(pr[0]) && str(pr[1]), `scene ${s.id}: each proof point needs text and a tag`);
      if (pr && pr[2] !== undefined) need(linkOk(pr[2], pr[0]), `scene ${s.id}: a proof point's link needs words from its text and a full https address`);
    }
    need(Array.isArray(s.stories), `scene ${s.id}: stories must be a list`);
    need(!(s.stories || []).length || str(s.cta), `scene ${s.id}: has stories but no button text`);
    for (const st of s.stories || []) {
      need(str(st.title) && Array.isArray(st.body) && st.body.length && st.body.every(str), `scene ${s.id}: a story has no title or text`);
      need(Array.isArray(st.clips), `scene ${s.id} / ${st.title}: clips must be a list`);
      for (const l of st.links || []) need(linkOk(l, st.body || []), `scene ${s.id} / ${st.title}: a link needs words from its text and a full https address`);
    }
  }
  need(journey.rows.every((r) => r.length === 3 && r.every(str)), 'journey: a row is incomplete');
  need(off.places.length > 0 && str(off.words), 'off the floor: places or words missing');
  need(thanks.items.length > 0 && str(contact.title), 'thanks or contact is empty');

  for (const { where, clip } of allClips({ scenes })) {
    need(str(clip.title), `clip in ${where}: no title`);
    need(STATUSES.includes(clip.status), `clip "${clip.title}" in ${where}: unknown status "${clip.status}"`);
    need(!clip.local || clip.status === 'team', `clip "${clip.title}": only in-house team footage may play locally`);
    need(!clip.local || !NEVER.some((r) => r.test(clip.local)), `clip "${clip.title}": this file must never be shown`);
    need(!clip.src || clip.cleared === true, `clip "${clip.title}": has a public file but is not marked cleared`);
    need(!clip.cleared || (str(clip.src) && clip.src.startsWith('/media/')), `clip "${clip.title}": cleared clips need a file under /media/`);
    need(!clip.cleared || clip.status !== 'held', `clip "${clip.title}": a held-back clip cannot be cleared`);
    need(!clip.href || /^https:\/\//.test(clip.href), `clip "${clip.title}": link must be https`);
    // a photograph Neural Foundry has published itself: shown as it is, always credited and linked to its page
    need(clip.status !== 'photo' || (/^\/photos\/[a-z0-9-]+\.webp$/.test(clip.img || '') && str(clip.alt) && str(clip.from)),
      `clip "${clip.title}": a photo needs its file (/photos/….webp), words for those who cannot see it, and the page it is from`);
    need(clip.status !== 'photo' || /^https:\/\/neuralfoundry\.co\.uk\//.test(clip.href || ''), `clip "${clip.title}": a photo links to the company page it is from`);
    need(clip.status !== 'photo' || (!clip.local && !clip.src && !clip.cleared), `clip "${clip.title}": a photo is not footage`);
    need(!clip.img || clip.status === 'photo', `clip "${clip.title}": only a photo has a picture file`);
  }

  need(str(cv.intro) && cv.glance.length && cv.skills.length && cv.jobs.length, 'cv: a section is empty');
  for (const j of cv.jobs) for (const r of j.roles) need(r.bullets.length && r.bullets.every(str), `cv: ${j.company} has an empty role`);

  if (desk) {
    const items = new Set([...desk.whiteboard.bugs, ...desk.whiteboard.features].map((x) => x.id));
    need(desk.objects.length > 0 && desk.objects.every((o) => /^[a-z]+$/.test(o.id) && str(o.label)), 'desk: an object has no id or label');
    for (const s of desk.shelf) need(ids.has(s.id), 'desk: the shelf points at "' + s.id + '", which is not a project');
    need(desk.notebook.pages.length > 0 && desk.notebook.pages.every((p) => /^[a-z]+$/.test(p.id) && str(p.tab) && str(p.title)), 'desk: a notebook page has no tab or title');
    need(items.size === desk.whiteboard.bugs.length + desk.whiteboard.features.length, 'desk: two items on the whiteboard share a number');
    need([...desk.whiteboard.bugs, ...desk.whiteboard.features].every((x) => /^[BF]\d+$/.test(x.id) && str(x.title)), 'desk: a whiteboard item needs a number (B1, F2) and a title');
    const walkTree = (n) => { need(str(n.label), 'desk: someone on the team tree has no role'); need(!n.on || items.has(n.on), 'desk: the team tree points at "' + n.on + '", which is not on the board'); (n.children || []).forEach(walkTree); };
    walkTree(desk.whiteboard.tree);
    const wb = desk.whiteboard;
    need(wb.features.every((f) => (f.what === undefined || str(f.what)) && ['why', 'part', 'tools'].every((k) => f[k] === undefined || (str(f[k]) && str(f.what)))), 'desk: a feature that opens needs its plain sentence (what), and any why, part or tools must have words');
    need(wb.bugs.every((b) => b.story === undefined || (b.story.length > 0 && b.story.every(str))), 'desk: a bug story is empty');
    need(str(wb.featuresNote) && wb.me.length > 0 && wb.me.every(str), 'desk: the whiteboard needs its note under Features and the story behind "me"');
    need(wb.hint.length === 3 && wb.hint.every(str), 'desk: the whiteboard hint needs its click word, tap word and the rest');
    need(wb.then.length > 0 && wb.then.length <= 4 && wb.then.every((x) => str(x.text)), 'desk: the 2020 board needs one to four short lines');
    need(desk.bin.sheets.every((s) => str(s.title) && s.body.every(str)), 'desk: a sheet in the bin is empty');
    need(str(desk.note.verse.ref) && str(desk.note.verse.version) && desk.note.verse.lines.length > 0 && desk.note.verse.lines.every(str), 'desk: the verse on the note needs its reference, its translation and its lines');
    need(str(desk.note.link.ref) && /^https:\/\//.test(desk.note.link.href), 'desk: the link on the note needs a name and an https address');
    const nbPages = new Set(desk.notebook.pages.map((x) => x.id));
    need(desk.drawers.length > 0 && desk.drawers.length <= 4 && new Set(desk.drawers.map((x) => x.id)).size === desk.drawers.length && desk.drawers.every((x) => /^[a-z]+$/.test(x.id) && str(x.label)), 'desk: a drawer has no id or label, two share an id, or there are more than four');
    need(desk.drawers.every((x) => (str(x.href) && !x.page) || nbPages.has(x.page)), 'desk: a drawer needs either a page to go to or a page of the notebook');
    need(str(desk.small.back) && desk.small.items.length === 2 && ['gears', 'board'].every((id) => desk.small.items.some((x) => x.id === id && str(x.label) && str(x.caption))), 'desk: the gears and the board each need a label and a caption');
    need(['charging', 'cleaning', 'patrolling', 'docking'].every((k) => str(desk.monitor.idle.tasks[k])), 'desk: the second monitor needs a name for each of the robot\'s tasks');
    const places = desk.outside.places;
    need(places.length > 0 && new Set(places.map((x) => x.id)).size === places.length && places.every((x) => /^[a-z]+$/.test(x.id) && str(x.name)), 'desk: a place outside the window has no id or name, or two share an id');
    need(places.every((x) => str(x.photo) || ['snow', 'canyon', 'tea', 'water', 'valley', 'desert'].includes(x.scene)), 'desk: a place outside the window has neither a photo nor a known stand-in scene');
    need(str(desk.outside.label) && str(desk.outside.next) && str(desk.outside.back), 'desk: the window is missing its wording');
    need(!desk.outside.more || (str(desk.outside.more.label) && /^https:\/\//.test(desk.outside.more.href)), 'desk: the link to more photographs needs a label and an https address');
    need(Number.isFinite(desk.clock.offsetHours) && str(desk.clock.zone), 'desk: the clock needs a time zone');
    need(str(desk.clock.hint) && str(desk.clock.set) && str(desk.clock.reset), 'desk: the clock is missing its wording');
    need(str(desk.time.then.caption) && str(desk.time.now.caption) && str(desk.time.line), 'desk: a photograph has no caption');
  }
  if (activity) {
    for (const [name, src] of Object.entries(activity.sources)) {
      for (const [d, n] of Object.entries(src)) {
        need(ISO.test(d) && !Number.isNaN(Date.parse(d)), `activity ${name}: bad date "${d}"`);
        need(Number.isInteger(n) && n >= 0, `activity ${name}: bad count on ${d}`);
        need(d <= today, `activity ${name}: ${d} is in the future`);
      }
    }
    need(ISO.test(activity.first || '') && ISO.test(activity.last || '') && activity.first < activity.last, 'activity: no usable date range');
  }
  return p;
}
