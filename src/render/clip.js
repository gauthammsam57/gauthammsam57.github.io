import { esc } from './util.js';

export const STATUS_LABEL = {
  team: 'Team footage · faces to clear',
  company: 'Company footage · awaiting OK',
  held: 'Held back',
  drawn: 'No footage',
  photo: 'Photo · Neural Foundry',
};
const MARK = { held: '⊘', drawn: '✎' };

// What a story shows. Published: only the company's photos and cleared clips. A clip still waiting
// (for the company's OK, for faces, or held back) stays in the data and in the preview, with its
// striped box, and is left out of the published pages until it is cleared (22 Nov 2026).
export const isShown = (c) => c.status === 'photo' || Boolean(c.cleared && c.src);
export function clipsHtml(clips, { dev = false } = {}) {
  const shown = dev ? clips : clips.filter(isShown);
  return shown.length ? `<div class="clips">${shown.map((c) => clipHtml(c, { dev })).join('')}</div>` : '';
}

// One piece of footage. A clip plays only if it is cleared (anywhere), or if it is
// in-house footage being previewed on Gautham's own machine (dev server only).
export function clipHtml(c, { dev = false } = {}) {
  let media, label, kind = c.status;
  if (c.status === 'photo') {
    // one of the company's own published photographs, credited to it and linked to its page
    media = `<img src="${esc(c.img)}" alt="${esc(c.alt)}" loading="lazy" decoding="async" width="1280" height="720">`;
    label = STATUS_LABEL.photo;
    const from = `<a href="${esc(c.href)}" target="_blank" rel="noopener">From Neural Foundry’s ${esc(c.from)} page →</a>`;
    return `<figure class="clip">${media}<figcaption><strong>${esc(c.title)}</strong><span class="chip chip-photo">${esc(label)}</span><span class="clip-note">${c.note ? esc(c.note) + ' ' : ''}${from}</span></figcaption></figure>`;
  }
  if (c.cleared && c.src) {
    media = `<video controls preload="none" playsinline muted data-src="${esc(c.src)}"></video>`; // given its address near the screen (lazy-video.js)
    label = '';
  } else if (dev && c.local) {
    media = `<video controls preload="none" playsinline muted data-local data-src="/local-media/${encodeURI(c.local)}"></video>`;
    label = 'Plays on this machine only · faces to clear';
  } else {
    media = `<div class="slot slot-${esc(c.status)}"><span class="slot-mark" aria-hidden="true">${MARK[c.status] || '▶'}</span></div>`;
    label = STATUS_LABEL[c.status];
  }
  const link = c.href ? ` <a href="${esc(c.href)}" target="_blank" rel="noopener">See it there →</a>` : '';
  return `<figure class="clip">${media}<figcaption><strong>${esc(c.title)}</strong>${label ? `<span class="chip chip-${esc(kind)}">${esc(label)}</span>` : ''}${c.note ? `<span class="clip-note">${esc(c.note)}${link}</span>` : ''}</figcaption></figure>`;
}
