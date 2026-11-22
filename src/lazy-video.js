// Clips are written into the pages without their address (data-src, see render/clip.js), so nothing
// is downloaded on arrival. A clip gets its address only when it comes near the screen: one inside a
// closed panel or a tab that is not open never loads at all. Clips added later (a story opened from
// a template) are picked up too.
export function lazyVideos(root = document) {
  const give = (v) => { if (!v.dataset.src) return; v.preload = 'metadata'; v.src = v.dataset.src; delete v.dataset.src; };
  if (!('IntersectionObserver' in window)) { root.querySelectorAll('video[data-src]').forEach(give); return; }
  const io = new IntersectionObserver((seen) => seen.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); give(e.target); } }), { rootMargin: '300px' });
  const watch = (el) => {
    if (el.nodeType !== 1) return;
    if (el.matches('video[data-src]')) io.observe(el);
    el.querySelectorAll('video[data-src]').forEach((v) => io.observe(v));
  };
  watch(root.documentElement || root);
  new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach(watch))).observe(root.documentElement || root, { childList: true, subtree: true });
}
