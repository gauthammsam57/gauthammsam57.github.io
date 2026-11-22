// A fingerprint of everything the still pictures of the room are made from: the room's own code,
// what it is given to draw (the whiteboard, the note, the shelf, the drawers, the clock, the window),
// the list of pictures, the script that takes them, and the 3D library's version. stills.mjs saves
// it when it takes the pictures; a test compares, so a room that no longer matches its pictures
// cannot go unnoticed. (The same idea as cv-fingerprint.mjs for the CV's PDF.)
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadData } from '../src/data/index.js';
import { renderDesk } from '../src/render/desk.js';

export const STILLS_STAMP = 'stills.stamp'; // in site/, not in public/: it is not published

const here = (rel) => fileURLToPath(new URL('../' + rel, import.meta.url));
export const STILLS_INPUTS = ['src/room.js', 'src/still.js', 'scripts/stills.mjs'];

export function stillsFingerprint() {
  const h = createHash('sha256');
  for (const f of STILLS_INPUTS) h.update(f).update(readFileSync(here(f)));
  h.update(JSON.stringify(renderDesk(loadData()).roomData));
  h.update('three@' + JSON.parse(readFileSync(here('node_modules/three/package.json'), 'utf8')).version);
  return h.digest('hex');
}
