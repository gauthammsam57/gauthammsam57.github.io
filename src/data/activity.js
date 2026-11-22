// Daily commit counts, read from the two saved files beside this one (activity/), the only copies.
// Runs in Node at build time. Dates and counts only: no repository names, no code.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ASSETS = new URL('./activity/', import.meta.url);
const read = (name) => JSON.parse(readFileSync(fileURLToPath(new URL(name, ASSETS)), 'utf8'));

// Adds the two sources together day by day.
export function mergeActivity(...sources) {
  const days = {};
  for (const src of sources) for (const [d, n] of Object.entries(src)) days[d] = (days[d] || 0) + n;
  return days;
}

export function loadActivity() {
  const invento = read('invento-activity.json');
  const nf = read('github-activity.json');
  const days = mergeActivity(invento, nf);
  const active = Object.keys(days).filter((d) => days[d] > 0).sort();
  return { days, first: active[0], last: Object.keys(nf).sort().pop(), sources: { invento, nf } };
}
