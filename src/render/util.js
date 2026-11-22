export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// `text in backticks` becomes <code>, after escaping.
// Text with some of its words made into links: each link is { text, href }, and the first place its
// text appears becomes the link (to a source, opened in a new tab). A link whose text is not there is left out.
export const linked = (s, links = []) => {
  let out = esc(s);
  for (const l of [].concat(links || [])) {
    const at = out.indexOf(esc(l.text));
    if (at >= 0) out = out.slice(0, at) + `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.text)}</a>` + out.slice(at + esc(l.text).length);
  }
  return out;
};
export const rich = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
