// Brings src/data/activity/github-activity.json up to date from GitHub's public contributions page
// (github.com/users/<name>/contributions), which needs no sign-in, so the publishing workflow runs it
// the same way as this machine does. Only dates and counts are saved: no repository names, no code.
//
//   npm run refresh-activity            update the file
//   npm run refresh-activity -- --dry   show what would change, write nothing
//
// GitHub's own calendar starts on 13 March 2025 for this account. Days up to and including
// that one came from commit dates and are left exactly as they are.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CALENDAR_FROM = '2025-03-14';
const FILE = fileURLToPath(new URL('../src/data/activity/github-activity.json', import.meta.url));
const dry = process.argv.includes('--dry');
const today = new Date().toISOString().slice(0, 10);

const USER = 'gauthammsam57';

// Pure, so the tests can check it: each day on the page is a cell with its date and an id, and a
// tooltip for that id says "No contributions on …" or "3 contributions on …".
export function parseCalendar(html) {
  const dates = {};
  for (const m of html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"[^>]*\bid="([^"]+)"/g)) dates[m[2]] = m[1];
  const days = [];
  for (const m of html.matchAll(/<tool-tip[^>]*\bfor="([^"]+)"[^>]*>\s*(No|\d+) contributions? on/g)) {
    if (dates[m[1]]) days.push([dates[m[1]], m[2] === 'No' ? 0 : Number(m[2])]);
  }
  return days.sort(([a], [b]) => (a < b ? -1 : 1));
}

async function year(y) {
  const res = await fetch(`https://github.com/users/${USER}/contributions?from=${y}-01-01&to=${y}-12-31`, { headers: { 'User-Agent': 'portfolio-build' } });
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${y}`);
  const days = parseCalendar(await res.text());
  if (days.length < 300) throw new Error(`GitHub's page for ${y} did not read as a calendar (${days.length} days): it may have changed`);
  return days;
}

// Pure, so the tests can check it: old days stay, calendar days replace, nothing from the future.
export function mergeCalendar(saved, calendarDays, { from = CALENDAR_FROM, until = today } = {}) {
  const next = { ...saved };
  for (const [date, count] of calendarDays) {
    if (date < from || date > until) continue;
    next[date] = count;
  }
  return Object.fromEntries(Object.entries(next).sort(([a], [b]) => (a < b ? -1 : 1)));
}

if (import.meta.url === new URL(process.argv[1], 'file:').href || process.argv[1] === fileURLToPath(import.meta.url)) {
  const saved = JSON.parse(readFileSync(FILE, 'utf8'));
  let days = [];
  for (let y = Number(CALENDAR_FROM.slice(0, 4)); y <= Number(today.slice(0, 4)); y++) days = days.concat(await year(y));
  const next = mergeCalendar(saved, days);
  const changed = Object.keys(next).filter((d) => saved[d] !== next[d]);
  const lastSaved = Object.keys(saved).sort().pop();
  console.log(`Saved up to ${lastSaved}. GitHub has ${changed.length} day(s) that differ, up to ${Object.keys(next).pop()}.`);
  for (const d of changed.slice(-10)) console.log(`  ${d}: ${saved[d] ?? 'none'} -> ${next[d]}`);
  if (dry) console.log('Dry run: nothing written.');
  else if (changed.length) {
    // same layout as the file already has, so a refresh changes only the days that changed
    writeFileSync(FILE, '{' + Object.entries(next).map(([d, n]) => `"${d}": ${n}`).join(', ') + '}');
    console.log('Written. Run "npm test" to check it.');
  }
  else console.log('Already up to date.');
}
