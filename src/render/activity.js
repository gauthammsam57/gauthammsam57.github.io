// The "days with a commit" lights, as plain SVG. No totals, no comparison with anyone.
const level = (n) => (n <= 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 9 ? 3 : 4);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const nice = (s) => `${Number(s.slice(8))} ${MONTHS[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`;

export function activitySvg({ days, first, last }) {
  const y0 = Number(first.slice(0, 4)), y1 = Number(last.slice(0, 4));
  const S = 9, G = 2, P = S + G, LABEL = 38;
  let html = '';
  for (let y = y1; y >= y0; y--) {
    let cells = '';
    const start = new Date(Date.UTC(y, 0, 1));
    const offset = start.getUTCDay();
    for (let d = new Date(start); d.getUTCFullYear() === y; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      if (key > last) break;
      const idx = Math.floor((d - start) / 864e5) + offset;
      const n = days[key] || 0;
      cells += `<rect class="l${level(n)}" x="${LABEL + Math.floor(idx / 7) * P}" y="${(idx % 7) * P}" width="${S}" height="${S}" rx="2">${n > 0 ? `<title>${nice(key)}</title>` : ''}</rect>`;
    }
    html += `<svg class="year" data-year="${y}" viewBox="0 0 ${LABEL + 54 * P} ${7 * P}" role="img" aria-label="Days with a commit in ${y}"><text x="0" y="${4 * P}" class="yl">${y}</text>${cells}</svg>`;
  }
  return html;
}
