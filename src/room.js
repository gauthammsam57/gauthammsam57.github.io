// The desk: one small room drawn from simple shapes. Every object can be clicked.
// The clock on the wall shows IST, and the window and the light in the room follow it.
// A mobile robot works in the background: it tidies, patrols, docks, and starts again.
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const C = { dark: 0x232c38, mid: 0x3a4656, shell: 0xdfe5ec, joint: 0x2f7fd0, amber: 0xffb454, cyan: 0x62d5ff, green: 0x4ade80, red: 0xe5533d, wood: 0x3a2f27, lidar: 0xff3b30 };

// Where the camera goes for each object: [position, look-at].
const VIEWS = {
  room: [V(0.9, 2.55, 6.7), V(0.45, 1.2, -1.0)],
  monitor: [V(-0.8, 1.27, 0.95), V(-0.74, 1.21, -0.07)],
  whiteboard: [V(-2.65, 1.9, 0.5), V(-2.75, 1.85, -3.36)],
  notebook: [V(0.95, 1.55, 1.05), V(0.95, 0.8, 0.2)],
  bin: [V(3.0, 1.5, 3.1), V(2.2, 0.3, 0.7)],
  bits: [V(0.95, 1.42, 1.3), V(0.8, 0.86, 0.2)], // leaning over the right of the desk, close to the gears and the board
  drawer: [V(1.5, 1.58, 1.95), V(1.03, 0.64, 0.68)], // above an open drawer, looking in
  outside: [V(0.9, 2.0, -0.7), V(5.05, 2.12, -1.9)], // standing in the room, facing the window on the right wall
};

// How far back the camera stands in the room, as a share of the distance in VIEWS.room.
// Scrolling (or a pinch) moves it a little between the two ends, and no further.
const ZOOM = { near: 0.68, start: 0.86, far: 1 };

// The walls are a warm off-white. The dark colour the room began with can still be tried in the preview.
const WALLS = { dark: 0x2b333e, light: 0xd4cbb9 };

// The look of the day, hour by hour (IST). Everything in between is blended.
// [hour, sky top, sky bottom, hills, light in the room, light from the window, its colour, lamp, stars, room]
const DAY = [
  [0, '#05070d', '#0b1220', '#0a1411', 0.42, 0.0, '#8fa8d8', 1, 1, '#070a0f'],
  [5, '#05070d', '#0b1220', '#0a1411', 0.42, 0.0, '#8fa8d8', 1, 1, '#070a0f'],
  [6.5, '#3b4f7a', '#f0a070', '#1f3a2c', 0.75, 0.7, '#ffc9a0', 0.6, 0.1, '#10151c'],
  [8.5, '#7fb0e0', '#dbe9f2', '#3f7a4c', 1.15, 1.2, '#fff4e0', 0, 0, '#19212b'],
  [13, '#6aa6e6', '#d5e8f5', '#4a8a52', 1.3, 1.4, '#ffffff', 0, 0, '#1c2530'],
  [16.5, '#6f9fd8', '#e8dcc0', '#437c4a', 1.15, 1.2, '#fff0d6', 0, 0, '#19212b'],
  [18.2, '#3c4a7c', '#f08c50', '#1c3528', 0.78, 0.8, '#ffb07a', 0.85, 0.05, '#10151c'],
  [19.5, '#0c1226', '#2a2440', '#0d1814', 0.5, 0.12, '#9aa8d8', 1, 0.6, '#090c12'],
  [21, '#05070d', '#0b1220', '#0a1411', 0.42, 0.0, '#8fa8d8', 1, 1, '#070a0f'],
  [24, '#05070d', '#0b1220', '#0a1411', 0.42, 0.0, '#8fa8d8', 1, 1, '#070a0f'],
];
const ca = new THREE.Color(), cb = new THREE.Color();
const mixHex = (a, b, k) => '#' + ca.set(a).lerp(cb.set(b), k).getHexString();
function lookAt(h) {
  let i = 0;
  while (i < DAY.length - 2 && h >= DAY[i + 1][0]) i++;
  const a = DAY[i], b = DAY[i + 1], k = clamp01((h - a[0]) / (b[0] - a[0]));
  const n = (j) => a[j] + (b[j] - a[j]) * k;
  return { top: mixHex(a[1], b[1], k), bottom: mixHex(a[2], b[2], k), hill: mixHex(a[3], b[3], k), amb: n(4), sun: n(5), sunCol: mixHex(a[6], b[6], k), lamp: n(7), stars: n(8), room: mixHex(a[9], b[9], k) };
}

export function createRoom(canvas, { onPick, onHover, onZoom, onClock, reduced = false, data = {}, figure: figureOn = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); // sharper costs a lot on modest graphics
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070a0f);
  scene.fog = new THREE.FogExp2(0x070a0f, 0.03);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2, ...o });
  const M = { floor: mat(0x20252c, { roughness: 0.95 }), wall: mat(0x2b333e, { roughness: 1, metalness: 0 }), dark: mat(C.dark), mid: mat(C.mid), shell: mat(C.shell, { roughness: 0.45, metalness: 0.05 }), joint: mat(C.joint), red: mat(C.red), wood: mat(C.wood, { roughness: 0.8, metalness: 0 }), chair: mat(0x2c3948, { roughness: 0.85 }), chair2: mat(0x5a4426, { roughness: 0.8, emissive: 0x2a1a05 }), paper: mat(0xeee6d2, { roughness: 0.95, metalness: 0 }), pcb: mat(0x1f6b45, { roughness: 0.5 }), steel: mat(0x9aa6b3, { roughness: 0.35, metalness: 0.8, flatShading: true }), brass: mat(0xc79a3c, { roughness: 0.35, metalness: 0.8, flatShading: true }) };
  const glow = (c) => new THREE.MeshBasicMaterial({ color: c });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x8fdcff, transparent: true, opacity: 0.16 });
  const amberEdge = new THREE.LineBasicMaterial({ color: C.amber, transparent: true, opacity: 0.9 });
  const withEdges = (m, em = edgeMat) => { m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), em)); return m; };
  const box = (w, h, d, m = M.dark, em = edgeMat) => withEdges(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), em);
  const plain = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const cyl = (rt, rb, h, m = M.dark, seg = 24, em = edgeMat) => withEdges(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m), em);
  const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

  // ---------- canvases used as pictures
  function picture(w, h, draw) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const p = { tex, redraw(fn) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h); fn(ctx, w, h); tex.needsUpdate = true; } };
    if (draw) p.redraw(draw);
    return p;
  }
  const FONT = 'system-ui, "Segoe UI", Roboto, Arial, sans-serif';
  const MONO = 'ui-monospace, Menlo, Consolas, monospace';
  const pen = (ctx, color, width = 5) => { ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; };
  const rr = (ctx, x, y, w, h, r, fill) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) ctx.fill(); else ctx.stroke(); };
  const text = (ctx, s, x, y, color, font, align = 'center') => { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); };
  const path = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };

  // the whiteboard: who is on what
  function drawBoard(ctx, w, h) {
    ctx.fillStyle = '#e6eaee'; ctx.fillRect(0, 0, w, h);
    text(ctx, data.boardTitle || '', 44, 46, '#6b7786', '600 28px ' + MONO, 'left');
    const t = data.tree || { label: 'me', children: [] };
    const kids = t.children || [];
    const TW = 640, colW = TW / Math.max(kids.length, 1), cx = TW / 2 - 30, top = 120;
    const tag = (x, y, on) => { if (!on) return; ctx.fillStyle = on[0] === 'B' ? '#c0392b' : '#2f8f5a'; rr(ctx, x - 26, y - 17, 52, 34, 17, true); text(ctx, on, x, y + 1, '#ffffff', '700 20px ' + FONT); };
    pen(ctx, '#c9661a', 6); rr(ctx, cx - 62, top - 30, 124, 60, 30); text(ctx, t.label, cx, top, '#c9661a', '700 28px ' + FONT);
    pen(ctx, '#1d4f8c', 5);
    path(ctx, [[cx, top + 30], [cx, top + 70]]); path(ctx, [[colW / 2 + 20, top + 70], [TW - colW / 2 + 20, top + 70]]);
    kids.forEach((k, i) => {
      const x = colW / 2 + 20 + i * colW, y = top + 130;
      pen(ctx, '#1d4f8c', 5);
      path(ctx, [[x, top + 70], [x, y - 30]]);
      rr(ctx, x - 92, y - 30, 184, 60, 10); text(ctx, k.label, x, y, '#1d2b3a', '600 24px ' + FONT);
      tag(x + 84, y - 34, k.on);
      (k.children || []).forEach((c, j, g) => {
        const gx = x + (j - (g.length - 1) / 2) * 108, gy = y + 150;
        pen(ctx, '#1d4f8c', 5);
        path(ctx, [[x, y + 30], [x, y + 74], [gx, y + 74], [gx, gy - 24]]);
        rr(ctx, gx - 50, gy - 24, 100, 48, 8); text(ctx, c.label, gx, gy, '#1d2b3a', '600 19px ' + FONT);
        tag(gx + 44, gy - 28, c.on);
      });
    });
    if (t.beside) { pen(ctx, '#2f8f5a', 4); ctx.setLineDash([10, 10]); path(ctx, [[cx - 62, top], [40, top], [40, top + 380]]); ctx.setLineDash([]); text(ctx, t.beside, 44, top + 410, '#2f8f5a', '600 22px ' + FONT, 'left'); }
    let y = 110;
    const list = (title, items, color) => {
      text(ctx, title, 700, y, color, '700 28px ' + FONT, 'left'); y += 16;
      pen(ctx, color, 4); path(ctx, [[700, y + 6], [700 + title.length * 17, y + 6]]); y += 38;
      for (const it of items) {
        text(ctx, it.id, 700, y, color, '700 22px ' + FONT, 'left');
        const words = it.title.split(' '); let line = '';
        for (const wd of words) { if ((line + ' ' + wd).length > 24) { text(ctx, line.trim(), 748, y, '#1d2b3a', '500 21px ' + FONT, 'left'); y += 28; line = wd; } else line += ' ' + wd; }
        text(ctx, line.trim(), 748, y, '#1d2b3a', '500 21px ' + FONT, 'left'); y += 40;
      }
      y += 14;
    };
    list('Bugs', data.bugs || [], '#c0392b');
    list('Features', data.features || [], '#2f8f5a');
  }
  const blankBoard = (ctx, w, h) => {
    ctx.fillStyle = '#e6eaee'; ctx.fillRect(0, 0, w, h); pen(ctx, '#9aa6b3', 4); path(ctx, [[90, 120], [300, 150], [220, 210]]); path(ctx, [[380, 300], [520, 280]]); text(ctx, '?', 720, 330, '#9aa6b3', '600 120px ' + FONT);
    // 2020: three notes to himself in the bottom-left corner, slightly crooked; the first one done
    const notes = data.boardThen || [], tilt = [-0.02, 0.01, -0.007];
    notes.forEach((x, i) => {
      const y = h - 44 - (notes.length - 1 - i) * 46;
      ctx.save(); ctx.translate(60 + (i % 2) * 4, y); ctx.rotate(tilt[i % 3]);
      ctx.font = '600 32px ' + FONT;
      const wd = ctx.measureText(x.text).width;
      text(ctx, x.text, 0, 0, x.done ? '#7a8593' : '#26303b', '600 32px ' + FONT, 'left');
      if (x.done) { pen(ctx, '#7a8593', 3); path(ctx, [[-4, 1], [wd + 4, -2]]); }
      ctx.restore();
    });
  };

  // ---------- the room
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), M.floor);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const grid = new THREE.GridHelper(30, 60, 0x2a323c, 0x232a33);
  grid.position.y = 0.005;
  scene.add(grid);
  const WALL_H = 10; // tall enough that a phone, which stands further back, never sees over the top
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, WALL_H), M.wall);
  wall.position.set(0, WALL_H / 2, -3.4);
  scene.add(wall);
  scene.add(at(plain(30, 0.12, 0.04, M.dark), 0, 0.06, -3.38)); // skirting
  // the side walls, so it is a room and not a stage: just past the whiteboard on the left and
  // the robot's dock on the right, and running forward to behind where the visitor stands
  const WALL_L = -4.4, WALL_R = 5.05, WALL_LEN = 16, WALL_Z = -3.4 + WALL_LEN / 2;
  for (const [x, turn] of [[WALL_L, 1], [WALL_R, -1]]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(WALL_LEN, WALL_H), M.wall);
    side.position.set(x, WALL_H / 2, WALL_Z);
    side.rotation.y = turn * Math.PI / 2;
    scene.add(side);
    scene.add(at(plain(0.04, 0.12, WALL_LEN, M.dark), x + turn * 0.02, 0.06, WALL_Z));
  }

  // a rug under the desk and both chairs, so the floor is not one empty plane
  const rugPic = picture(800, 600, (ctx, w, h) => {
    ctx.fillStyle = '#4a3a34'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#9a8a6c'; ctx.fillRect(26, 26, w - 52, h - 52);
    ctx.fillStyle = '#2f3e4e'; ctx.fillRect(40, 40, w - 80, h - 80);
    ctx.fillStyle = '#5a4239'; ctx.fillRect(74, 74, w - 148, h - 148);
    ctx.strokeStyle = 'rgba(179, 154, 116, 0.55)'; ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) { const cx = 160 + i * 120, cy = h / 2, r = 44; ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath(); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)'; ctx.lineWidth = 1; // the weave
    for (let y = 0; y < h; y += 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 3.0), new THREE.MeshStandardMaterial({ map: rugPic.tex, color: 0x8c8c8c, roughness: 1, metalness: 0 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.012, 0.55);
  scene.add(rug);

  // a low bookshelf against the back wall, under the whiteboard
  const SHELF = { x: -2.75, w: 1.9, h: 0.78, d: 0.32 };
  {
    const g = new THREE.Group();
    g.position.set(SHELF.x, 0, -3.4 + SHELF.d / 2 + 0.01);
    const { w, h, d } = SHELF, t = 0.035;
    for (const y of [t / 2, h / 2, h - t / 2]) g.add(at(box(w, t, d, M.wood), 0, y, 0));
    for (const x of [-w / 2 + t / 2, w / 2 - t / 2]) g.add(at(plain(t, h, d, M.wood), x, h / 2, 0));
    g.add(at(plain(w, h, 0.01, M.dark), 0, h / 2, -d / 2 + 0.005)); // the back
    const tints = [0x8a4b3c, 0x3f5d7a, 0xc9b98f, 0x4e6b52, 0x2f3b4a, 0xb07a3a, 0x6a5a7a, 0xd8d2c4];
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (const base of [t, h / 2 + t / 2]) {
      let x = -w / 2 + t + 0.02;
      const stop = w / 2 - t - (base === t ? 0.5 : 0.28); // leave a gap at the end of each row
      while (x < stop) {
        const bw = 0.028 + rnd() * 0.035, bh = 0.2 + rnd() * 0.1, bd = 0.17 + rnd() * 0.06;
        const b = plain(bw, bh, bd, mat(tints[Math.floor(rnd() * tints.length)], { roughness: 0.85, metalness: 0 }));
        g.add(at(b, x + bw / 2, base + bh / 2, d / 2 - bd / 2 - 0.03));
        x += bw + 0.004;
      }
      // the last one leans on the row
      const lean = plain(0.035, 0.26, 0.2, mat(tints[base === t ? 1 : 5], { roughness: 0.85, metalness: 0 }));
      lean.rotation.z = -0.3;
      g.add(at(lean, x + 0.06, base + 0.125, 0.02));
    }
    // two lying flat on top
    g.add(at(plain(0.3, 0.04, 0.21, mat(tints[0], { roughness: 0.85, metalness: 0 })), 0.55, h + 0.02, 0));
    g.add(at(plain(0.26, 0.035, 0.19, mat(tints[2], { roughness: 0.85, metalness: 0 })), 0.56, h + 0.058, 0.005));
    scene.add(g);
  }

  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x1a1d22, 0.5);
  scene.add(hemi);
  const fill = new THREE.PointLight(0xdfeaff, 6, 14, 1.2); // so the room is never fully black
  fill.position.set(0.3, 3.4, 2.4);
  scene.add(fill);
  const sun = new THREE.PointLight(0xffffff, 0, 18, 1.0); // daylight coming in through the window
  sun.position.set(2.6, 2.3, -2.2);
  scene.add(sun);

  const hits = [];
  function hit(id, w, h, d, x, y, z, parent = scene) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.set(x, y, z);
    m.userData.id = id;
    parent.add(m);
    hits.push(m);
    return m;
  }

  // ----- the window, and the view outside
  // It turns the corner: a pane on the back wall that runs to the corner, and one on the right wall.
  // One picture is shared between them, so the view carries on round the corner.
  const WY = 2.2, WH = 1.7, WLEFT = 1.3;
  const WW = WALL_R - WLEFT, WX = WLEFT + WW / 2; // the back pane
  const SIDE_W = 3.0, SIDE_Z = -3.4 + SIDE_W / 2; // the pane on the right wall
  const viewPic = picture(1760, 448);
  const pane = (len, u0, u1) => {
    const g = new THREE.PlaneGeometry(len, WH), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * (u1 - u0));
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: viewPic.tex }));
  };
  const split = WW / (WW + SIDE_W);
  scene.add(at(pane(WW, 0, split), WX, WY, -3.39));
  const sidePane = at(pane(SIDE_W, split, 1), WALL_R - 0.01, WY, SIDE_Z);
  sidePane.rotation.y = -Math.PI / 2;
  scene.add(sidePane);
  // frames: rails top and bottom, a post at each end and at the corner, two bars across each pane
  for (const [w, h, x, y] of [[WW + 0.06, 0.07, 0.03, WH / 2], [WW + 0.06, 0.07, 0.03, -WH / 2], [0.07, WH, -WW / 2, 0], [0.04, WH, -WW / 6, 0], [0.04, WH, WW / 6, 0]]) scene.add(at(plain(w, h, 0.07, M.mid), WX + x, WY + y, -3.36));
  scene.add(at(plain(0.09, WH + 0.07, 0.09, M.mid), WALL_R - 0.045, WY, -3.355)); // the corner post
  for (const [d, h, z, y] of [[SIDE_W, 0.07, 0, WH / 2], [SIDE_W, 0.07, 0, -WH / 2], [0.07, WH + 0.07, SIDE_W / 2, 0], [0.04, WH, -SIDE_W / 6, 0], [0.04, WH, SIDE_W / 6, 0]]) scene.add(at(plain(0.07, h, d, M.mid), WALL_R - 0.04, WY + y, SIDE_Z + z));
  scene.add(at(box(0.16, 0.04, SIDE_W + 0.06, M.wood), WALL_R - 0.08, WY - WH / 2 - 0.055, SIDE_Z)); // its sill

  // ----- life outside work: the pane on the right wall can show a place instead of the sky.
  // A real photograph goes here once there is one; until then each place gets a simple drawing.
  const outside = data.outside || { places: [] };
  const placePic = picture(1056, 600);
  const photoPane = at(new THREE.Mesh(new THREE.PlaneGeometry(SIDE_W, WH), new THREE.MeshBasicMaterial({ map: placePic.tex })), WALL_R - 0.013, WY, SIDE_Z);
  photoPane.rotation.y = -Math.PI / 2;
  photoPane.visible = false;
  scene.add(photoPane);
  const skyFill = (ctx, w, h, a, b, stop = 0.75) => { const g = ctx.createLinearGradient(0, 0, 0, h * stop); g.addColorStop(0, a); g.addColorStop(1, b); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); };
  const land = (ctx, w, h, color, f) => { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, h); for (let x = 0; x <= w; x += 6) ctx.lineTo(x, f(x / w) * h); ctx.lineTo(w, h); ctx.fill(); };
  const peaks = (k, amp, sharp, ph) => (u) => k - amp * Math.abs(Math.sin(u * sharp + ph)) - amp * 0.35 * Math.abs(Math.sin(u * sharp * 2.7 + ph * 3));
  const waves = (k, amp, f, ph) => (u) => k - amp * Math.sin(u * f + ph) - amp * 0.4 * Math.sin(u * f * 2.3 + ph * 2);
  const STANDINS = {
    snow(ctx, w, h) { // snow peaks and dark pines
      skyFill(ctx, w, h, '#7fb4e6', '#e4eef6');
      land(ctx, w, h, '#c9d6e4', peaks(0.62, 0.3, 5, 0.4)); land(ctx, w, h, '#f4f8fb', peaks(0.72, 0.26, 4, 1.7)); land(ctx, w, h, '#e3ebf2', waves(0.82, 0.04, 6, 1));
      ctx.fillStyle = '#23402f'; for (let i = 0; i < 16; i++) { const x = (i * 71 + 30) % w, y = h * (0.8 + ((i * 37) % 12) / 100), s = 26 + ((i * 13) % 22); ctx.beginPath(); ctx.moveTo(x, y - s * 2.2); ctx.lineTo(x + s * 0.55, y); ctx.lineTo(x - s * 0.55, y); ctx.fill(); }
    },
    canyon(ctx, w, h) { // a river gorge between red cliffs
      skyFill(ctx, w, h, '#e8b27a', '#f6dcb4');
      land(ctx, w, h, '#b9683f', (u) => 0.4 + 0.03 * Math.sin(u * 30) + (u > 0.42 && u < 0.58 ? 0.5 : 0)); land(ctx, w, h, '#96502f', (u) => 0.55 + 0.02 * Math.sin(u * 40 + 1) + (u > 0.36 && u < 0.66 ? 0.5 : 0));
      ctx.fillStyle = '#4f8a8f'; ctx.beginPath(); ctx.moveTo(w * 0.46, h * 0.55); ctx.lineTo(w * 0.54, h * 0.55); ctx.lineTo(w * 0.7, h); ctx.lineTo(w * 0.32, h); ctx.fill();
      ctx.strokeStyle = 'rgba(60, 28, 14, 0.35)'; ctx.lineWidth = 3; for (let i = 0; i < 7; i++) { const y = h * (0.5 + i * 0.07); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w * 0.36, y + 8); ctx.moveTo(w * 0.66, y + 8); ctx.lineTo(w, y); ctx.stroke(); }
    },
    tea(ctx, w, h) { // rows of tea on rolling hills
      skyFill(ctx, w, h, '#9cc7e8', '#e8f2ee');
      land(ctx, w, h, '#7fae8a', waves(0.5, 0.07, 5, 0.3)); land(ctx, w, h, '#4f8f55', waves(0.64, 0.08, 4, 2)); land(ctx, w, h, '#3a7a45', waves(0.8, 0.06, 6, 4));
      ctx.strokeStyle = 'rgba(20, 60, 30, 0.45)'; ctx.lineWidth = 3; for (let i = 0; i < 9; i++) { ctx.beginPath(); for (let x = 0; x <= w; x += 12) { const y = h * (0.66 + i * 0.04 - 0.05 * Math.sin((x / w) * 4 + 2 + i * 0.2)); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
    },
    water(ctx, w, h) { // backwater and palms
      skyFill(ctx, w, h, '#f0b98a', '#f7e3c4', 0.55);
      land(ctx, w, h, '#2f5d48', waves(0.5, 0.025, 14, 1));
      const g = ctx.createLinearGradient(0, h * 0.55, 0, h); g.addColorStop(0, '#6aa7a8'); g.addColorStop(1, '#2e6c78'); ctx.fillStyle = g; ctx.fillRect(0, h * 0.55, w, h);
      for (const [x, s] of [[0.12, 1], [0.2, 0.8], [0.8, 1.1], [0.9, 0.85]]) { const px = x * w, top = h * (0.5 - 0.24 * s); pen(ctx, '#3a2a1c', 9 * s); path(ctx, [[px, h * 0.56], [px + 14 * s, top]]); pen(ctx, '#1f4a35', 8 * s); for (let a = 0; a < 6; a++) { const t = (a / 6) * Math.PI * 2; path(ctx, [[px + 14 * s, top], [px + 14 * s + Math.cos(t) * 70 * s, top + Math.sin(t) * 34 * s + 16 * s]]); } }
      ctx.fillStyle = '#3a2a1c'; ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.74, 120, 14, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#c9a26a'; ctx.fillRect(w * 0.5 - 60, h * 0.74 - 44, 120, 36);
    },
    valley(ctx, w, h) { // a green valley with a village and a railway line
      skyFill(ctx, w, h, '#86b9e4', '#eef4ee');
      land(ctx, w, h, '#6f9d86', (u) => 0.36 + 0.3 * Math.abs(u - 0.5) * -1 + 0.2); land(ctx, w, h, '#4c8a5a', (u) => 0.5 + 0.5 * Math.pow(Math.abs(u - 0.52), 1.4) * -1 + 0.25); land(ctx, w, h, '#5fa063', waves(0.84, 0.03, 5, 1));
      const roofs = ['#c0553f', '#d9d2c2', '#5f7fa8', '#d6a045']; for (let i = 0; i < 14; i++) { const x = w * (0.3 + ((i * 53) % 40) / 100), y = h * (0.7 + ((i * 29) % 12) / 100); ctx.fillStyle = '#efe9dc'; ctx.fillRect(x, y, 26, 16); ctx.fillStyle = roofs[i % 4]; ctx.fillRect(x - 3, y - 7, 32, 8); }
      pen(ctx, '#3c3f45', 4); path(ctx, [[0, h * 0.93], [w * 0.4, h * 0.88], [w, h * 0.95]]);
    },
    desert(ctx, w, h) { // dunes, and a skyline far off
      skyFill(ctx, w, h, '#f2c58c', '#f9e6c6');
      ctx.fillStyle = 'rgba(120, 110, 120, 0.55)'; for (const [x, bw, bh] of [[0.52, 14, 110], [0.56, 22, 70], [0.6, 12, 150], [0.64, 26, 60], [0.69, 16, 95], [0.73, 20, 50]]) ctx.fillRect(w * x, h * 0.6 - bh, bw, bh);
      land(ctx, w, h, '#e0b074', waves(0.62, 0.04, 5, 0.5)); land(ctx, w, h, '#d29a5c', waves(0.74, 0.06, 4, 2.4)); land(ctx, w, h, '#c08549', waves(0.88, 0.05, 3, 4));
      ctx.fillStyle = '#fff3d6'; ctx.beginPath(); ctx.arc(w * 0.24, h * 0.24, 34, 0, 7); ctx.fill();
    },
  };
  const photos = {}; // real photographs, loaded the first time each is asked for
  let placeShown = -1;
  function drawPlace(i) {
    const pl = outside.places[i];
    if (!pl) return;
    placePic.redraw((ctx, w, h) => {
      const img = photos[pl.id];
      if (img && img.complete && img.naturalWidth) { const k = Math.max(w / img.naturalWidth, h / img.naturalHeight), iw = img.naturalWidth * k, ih = img.naturalHeight * k; ctx.drawImage(img, (w - iw) / 2, (h - ih) * (Number.isFinite(pl.focus) ? pl.focus : 0.5), iw, ih); }
      else (STANDINS[pl.scene] || STANDINS.valley)(ctx, w, h);
      // the name of the place, on a small plate in the corner
      ctx.font = '600 30px ' + MONO; const tw = ctx.measureText(pl.name).width;
      // (at the end away from the corner, so the camera on the sill does not stand in front of it)
      ctx.fillStyle = 'rgba(12, 17, 24, 0.82)'; ctx.beginPath(); ctx.roundRect(w - tw - 72, h - 84, tw + 44, 54, 10); ctx.fill();
      text(ctx, pl.name, w - 50, h - 56, '#f2f4f6', '600 30px ' + MONO, 'right');
    });
  }
  function setPlace(i) {
    const pl = outside.places[i];
    photoPane.visible = !!pl;
    if (!pl) { placeShown = -1; return; }
    placeShown = i;
    if (pl.photo && !photos[pl.id]) { const img = new Image(); img.onload = () => { if (placeShown === i) drawPlace(i); }; img.src = pl.photo; photos[pl.id] = img; }
    drawPlace(i);
  }
  // the camera on the sill: it is how the window is found, and each click shows the next place
  {
    // It stands on a small tripod so it shows against the glass, is light in colour, and is outlined
    // in amber like the visitor's chair: the things that ask to be clicked.
    const cam = new THREE.Group();
    cam.position.set(WALL_R - 0.2, WY - WH / 2 - 0.035, -3.4 + 0.6);
    cam.rotation.y = 0.35; // turned a little towards the room
    for (const [dx, dz] of [[-0.09, 0], [0.06, 0.08], [0.06, -0.08]]) { // tripod legs
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.24, 8), M.dark);
      leg.position.set(dx / 2, 0.11, dz / 2); leg.rotation.z = -dx * 4.2; leg.rotation.x = dz * 4.2;
      cam.add(leg);
    }
    cam.add(at(cyl(0.03, 0.03, 0.03, M.dark, 12), 0, 0.225, 0));
    const body = new THREE.Group(); body.position.y = 0.24;
    body.add(at(box(0.14, 0.2, 0.34, M.shell, amberEdge), 0, 0.1, 0));
    body.add(at(plain(0.142, 0.2, 0.09, M.dark), 0, 0.1, -0.126)); // the grip
    body.add(at(box(0.11, 0.05, 0.13, M.shell, amberEdge), 0, 0.225, -0.01)); // the viewfinder hump
    const lens = cyl(0.085, 0.09, 0.13, M.dark, 24, amberEdge); lens.rotation.z = Math.PI / 2; body.add(at(lens, -0.13, 0.1, 0.03));
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.066, 24), glow(0x7fc8ee)); glass.rotation.y = -Math.PI / 2; body.add(at(glass, -0.197, 0.1, 0.03));
    const glint = new THREE.Mesh(new THREE.CircleGeometry(0.02, 12), glow(0xffffff)); glint.rotation.y = -Math.PI / 2; body.add(at(glint, -0.198, 0.125, 0.05));
    body.add(at(plain(0.03, 0.025, 0.04, glow(C.amber)), 0, 0.2125, -0.12)); // the shutter button
    cam.add(body);
    scene.add(cam);
    if (outside.places.length) { hit('outside', 0.5, 0.56, 0.5, WALL_R - 0.24, WY - WH / 2 + 0.24, -3.4 + 0.6); hit('outside', 0.1, WH, SIDE_W, WALL_R - 0.05, WY, SIDE_Z); }
  }
  function drawView(look) {
    viewPic.redraw((ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h * 0.8);
      g.addColorStop(0, look.top); g.addColorStop(1, look.bottom);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      if (look.stars > 0.02) { ctx.fillStyle = 'rgba(255,255,255,' + (0.85 * look.stars).toFixed(2) + ')'; for (let i = 0; i < 70; i++) { const x = (i * 197.3) % w, y = (i * 89.7) % (h * 0.55); ctx.fillRect(x, y, i % 5 ? 1.5 : 2.5, i % 5 ? 1.5 : 2.5); } }
      const lit = look.lamp > 0.4;
      // far hills, a few small buildings, nearer hills, a line of trees
      const ridge = (base, amp, f, ph, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, h); for (let x = 0; x <= w; x += 8) ctx.lineTo(x, base - amp * Math.sin(x * f + ph) - amp * 0.5 * Math.sin(x * f * 2.3 + ph * 2)); ctx.lineTo(w, h); ctx.fill(); };
      ridge(h * 0.62, 34, 0.006, 0.4, mixHex(look.hill, look.bottom, 0.55));
      [[90, 60, 46], [150, 44, 70], [470, 52, 58], [540, 70, 40], [620, 40, 64], [880, 48, 52], [1130, 64, 44], [1200, 40, 72], [1480, 56, 50], [1590, 44, 62]].forEach(([x, bw, bh], i) => {
        ctx.fillStyle = mixHex(look.hill, '#8a94a0', 0.45); ctx.fillRect(x, h * 0.66 - bh, bw, bh + 30);
        if (lit) { ctx.fillStyle = 'rgba(255,214,140,0.9)'; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if ((r * 3 + c + i) % 3) ctx.fillRect(x + 8 + c * (bw - 16) / 3, h * 0.66 - bh + 8 + r * 14, 5, 6); }
      });
      ridge(h * 0.74, 26, 0.009, 2.1, mixHex(look.hill, look.bottom, 0.2));
      ctx.fillStyle = look.hill;
      for (let x = -10; x < w + 20; x += 26) { const r = 18 + ((x * 7) % 13); ctx.beginPath(); ctx.arc(x, h * 0.86 - ((x * 3) % 9), r, 0, 7); ctx.fill(); }
      ctx.fillRect(0, h * 0.86, w, h);
    });
  }

  // ----- the clock: no numbers, a reddish hour hand, a black minute hand
  const clockPic = picture(256, 256);
  scene.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.25, 48), new THREE.MeshBasicMaterial({ map: clockPic.tex, color: 0xdfe3e8 })), 0.05, 3.1, -3.385));
  const CLOCK = V(0.05, 3.1, -3.385);
  hit('clock', 0.62, 0.62, 0.12, CLOCK.x, CLOCK.y, CLOCK.z + 0.04);
  function drawClock(h) {
    clockPic.redraw((ctx, w) => {
      const c = w / 2;
      ctx.fillStyle = '#f2f4f6'; ctx.beginPath(); ctx.arc(c, c, c, 0, 7); ctx.fill();
      pen(ctx, '#3a4656', 10); ctx.beginPath(); ctx.arc(c, c, c - 6, 0, 7); ctx.stroke();
      const hand = (frac, len, color, width) => { const a = frac * Math.PI * 2 - Math.PI / 2; pen(ctx, color, width); path(ctx, [[c - Math.cos(a) * 12, c - Math.sin(a) * 12], [c + Math.cos(a) * len, c + Math.sin(a) * len]]); };
      hand((h % 12) / 12, 58, '#d9482f', 12);
      hand(h % 1, 92, '#14181d', 7);
      ctx.fillStyle = '#14181d'; ctx.beginPath(); ctx.arc(c, c, 8, 0, 7); ctx.fill();
    });
  }

  // ----- the desk, and what is on it
  const desk = new THREE.Group();
  scene.add(desk);
  desk.add(at(box(2.8, 0.06, 1.05, M.wood), 0, 0.76, 0));
  for (const [x, z] of [[-1.32, -0.45], [1.32, -0.45], [-1.32, 0.45], [1.32, 0.45]]) desk.add(at(box(0.06, 0.73, 0.06, M.dark), x, 0.365, z));

  // ----- the drawers: a pedestal under the right end of the desk, in the part his chair does not hide.
  // Each drawer has its label on the front, slides out a little as the pointer comes near, and all
  // the way on a click.
  const PED = { x: 1.03, w: 0.5, z0: -0.38, z1: 0.46, h: 0.71 };
  const drawerList = [];
  {
    const SLOTS = 4, list = (data.drawers || []).slice(0, SLOTS);
    const depth = PED.z1 - PED.z0, zc = (PED.z0 + PED.z1) / 2;
    desk.add(at(box(PED.w, PED.h, depth, M.dark), PED.x, PED.h / 2 + 0.02, zc));
    desk.add(at(plain(PED.w - 0.04, 0.02, depth - 0.04, M.dark), PED.x, 0.01, zc)); // plinth
    const fh = (PED.h - 0.03) / SLOTS; // the height of one drawer front
    const cw = PED.w - 0.14, ch = fh - 0.065; // the label card
    for (let i = 0; i < SLOTS; i++) {
      const d = list[i]; // the drawers past the end of the list are spare: shut, with an empty holder
      const y = 0.02 + PED.h - 0.015 - fh * (i + 0.5);
      const g = new THREE.Group();
      g.position.set(PED.x, y, PED.z1);
      g.add(at(box(PED.w - 0.03, fh - 0.02, 0.03, M.mid), 0, 0, 0.015));
      g.add(at(plain(0.14, 0.012, 0.02, d ? glow(C.amber) : M.dark), 0, -fh / 2 + 0.026, 0.04)); // the pull
      desk.add(g);
      if (!d) { g.add(at(plain(cw, ch, 0.004, M.dark), 0, 0.014, 0.031)); continue; }
      // the tray behind the front, seen when the drawer is out
      g.add(at(plain(PED.w - 0.07, 0.02, 0.5, M.dark), 0, -fh / 2 + 0.03, -0.25));
      for (const sx of [-1, 1]) g.add(at(plain(0.015, fh - 0.06, 0.5, M.dark), sx * (PED.w / 2 - 0.04), -0.005, -0.25));
      g.add(at(plain(PED.w - 0.09, fh - 0.09, 0.3, mat(0xe8e2d2, { roughness: 0.95, metalness: 0 })), 0, -0.015, -0.2)); // papers inside
      // the label: a card in a holder, large enough to read from across the room
      const label = picture(512, Math.round((512 * ch) / cw), (ctx, w, h) => {
        ctx.fillStyle = '#ece6d6'; ctx.beginPath(); ctx.roundRect(0, 0, w, h, 16); ctx.fill();
        pen(ctx, '#3a4656', 8); ctx.beginPath(); ctx.roundRect(6, 6, w - 12, h - 12, 12); ctx.stroke();
        const size = Math.min(Math.floor(h * 0.62), Math.floor((w - 70) / (d.label.length * 0.62)));
        text(ctx, d.label.toUpperCase(), w / 2, h / 2 + 2, '#14181d', '700 ' + size + 'px ' + MONO);
      });
      g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), new THREE.MeshBasicMaterial({ map: label.tex, color: 0xdcdcdc })), 0, 0.014, 0.031));
      hit('drawer:' + d.id, PED.w, fh, 0.14, PED.x, y, PED.z1 + 0.05);
      drawerList.push({ id: d.id, label: d.label, hitId: 'drawer:' + d.id, g, k: 0, until: 0 });
    }
  }
  // his monitor
  const codePic = picture(512, 300);
  const CODE = [[30, 120, '#ffb454'], [60, 250, '#55708a'], [60, 150, '#55708a'], [90, 280, '#55708a'], [90, 100, '#4ade80'], [60, 190, '#62d5ff'], [30, 70, '#ffb454'], [60, 220, '#55708a'], [90, 160, '#55708a'], [60, 110, '#62d5ff'], [30, 140, '#55708a']];
  function drawCode(t) {
    codePic.redraw((ctx, w, h) => {
      ctx.fillStyle = '#0a1017'; ctx.fillRect(0, 0, w, h);
      const off = Math.floor(t * 0.7);
      for (let r = 0; r < 9; r++) { const [x, len, c] = CODE[(r + off) % CODE.length]; ctx.fillStyle = c; rr(ctx, x, 26 + r * 30, len, 10, 5, true); }
      if (Math.floor(t * 2) % 2) { ctx.fillStyle = '#eaf0f6'; ctx.fillRect(CODE[(8 + off) % CODE.length][0] + CODE[(8 + off) % CODE.length][1] + 8, 26 + 8 * 30 - 3, 9, 16); }
    });
  }
  const MX = 0.5;
  desk.add(at(box(0.9, 0.52, 0.04, M.dark), MX, 1.2, -0.3));
  desk.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.46), new THREE.MeshBasicMaterial({ map: codePic.tex })), MX, 1.2, -0.279));
  desk.add(at(plain(0.06, 0.16, 0.04, M.dark), MX, 0.87, -0.31));
  desk.add(at(plain(0.3, 0.02, 0.18, M.dark), MX, 0.8, -0.31));
  desk.add(at(box(0.48, 0.02, 0.17, M.dark), MX, 0.8, 0.12)); // keyboard
  const mug = at(cyl(0.045, 0.04, 0.1, M.shell, 16), 1.12, 0.84, 0.08); // his mug (moved within his reach when he is drawn)
  desk.add(mug);
  // the note on the corner of his screen: Proverbs written out, small
  const notePic = picture(512, 480, (ctx, w, h) => {
    ctx.fillStyle = '#ffd98a'; ctx.fillRect(0, 0, w, h);
    const v = data.verse || { lines: [], ref: '', version: '' };
    v.lines.forEach((l, i) => text(ctx, l, w / 2, 70 + i * 58, '#4a3006', '600 25px ' + FONT));
    text(ctx, v.ref + ' · ' + v.version, w / 2, 70 + v.lines.length * 58 + 14, '#7a5310', '700 24px ' + FONT);
    if (data.link) { text(ctx, data.link.ref + '  ↗', w / 2, h - 52, '#7a5310', '700 26px ' + FONT); pen(ctx, '#7a5310', 2); path(ctx, [[w / 2 - 130, h - 34], [w / 2 + 130, h - 34]]); }
  });
  const note = at(new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.28), new THREE.MeshBasicMaterial({ map: notePic.tex })), MX + 0.5, 0.965, -0.272); // hanging from the bottom edge of the screen, low enough to be seen when leaning over the desk
  note.rotation.z = 0.05;
  desk.add(note);
  hit('note', 0.32, 0.3, 0.1, MX + 0.5, 0.965, -0.24);

  // the second monitor, on an arm that swings towards the second chair
  const swing = new THREE.Group();
  swing.position.set(-1.05, 0.79, -0.38);
  desk.add(at(cyl(0.03, 0.03, 0.46, M.mid, 12), -1.05, 1.02, -0.38));
  const armBar = plain(0.44, 0.03, 0.03, M.mid); armBar.geometry.translate(0.22, 0, 0); armBar.position.y = 0.42; swing.add(armBar);
  // What it shows while nobody sits at it: the robot in the room, as its own software would show it.
  // On top, the task it is on. Below, a map of the room (made from the same obstacles the lidar
  // hits), with the robot where it really is, what its lidar sees, and the way it means to go.
  const live = { x: 0, z: 0, heading: 0, task: 'charging', scan: new Float32Array(0), scanN: 0, route: [] };
  const idlePic = picture(768, 440);
  // The same picture, larger and sharp, on the monitor's Live map tab while that tab is open (desk-main.js).
  // It is drawn in the same 768 × 440 units, scaled to the canvas, so it looks exactly like the one in the room.
  let mapCanvas = null;
  const bases = new Map(); // the part of the map that never changes, drawn once for each canvas at its scale
  const MAP = { z0: -3.4, z1: 2.5, top: 62, pad: 12 };
  function drawIdle() {
    idlePic.redraw((ctx, w, h) => paintIdle(ctx, w, h, 1, idlePic));
    if (mapCanvas && mapCanvas.width) {
      const s = mapCanvas.width / 768, ctx = mapCanvas.getContext('2d');
      ctx.setTransform(s, 0, 0, s, 0, 0); ctx.clearRect(0, 0, 768, 440);
      paintIdle(ctx, 768, 440, s, mapCanvas);
      mapCanvas.dataset.t = robotT.toFixed(2); // how far round its route the robot is, so a test can see it keep going
    }
  }
  function paintIdle(ctx, w, h, s, key) {
    const idle = data.idle || { title: '', topics: [], tasks: {} };
    const tasks = idle.tasks || {};
    {
      ctx.fillStyle = '#0a1017'; ctx.fillRect(0, 0, w, h);
      // ----- the task
      text(ctx, idle.title, 16, 20, '#6f8296', '500 14px ' + MONO, 'left');
      let cx = 16;
      for (const key of ['charging', 'cleaning', 'patrolling', 'docking']) {
        const name = tasks[key] || key, on = live.task === key;
        ctx.font = (on ? '700 ' : '500 ') + '19px ' + FONT;
        const cw = ctx.measureText(name).width + 34;
        ctx.fillStyle = on ? '#ffb454' : '#141d28'; rr(ctx, cx, 32, cw, 24, 12, true);
        if (on) { ctx.fillStyle = '#0a1017'; ctx.beginPath(); ctx.arc(cx + 13, 44, 4.5, 0, 7); ctx.fill(); }
        text(ctx, name, cx + (on ? 23 : 17), 45, on ? '#0a1017' : '#6f8296', (on ? '700 ' : '500 ') + '19px ' + FONT, 'left');
        cx += cw + 8;
      }
      // ----- the map
      const sc = Math.min((w - 190 - MAP.pad * 2) / (WALL_R - WALL_L), (h - MAP.top - MAP.pad) / (MAP.z1 - MAP.z0));
      const ox = MAP.pad, oy = MAP.top, mw = (WALL_R - WALL_L) * sc, mh = (MAP.z1 - MAP.z0) * sc;
      const X = (x) => ox + (x - WALL_L) * sc, Y = (z) => oy + (z - MAP.z0) * sc;
      if (bases.get(key)?.s !== s) {
        // the part that never changes is drawn once: floor, grid, and everything the lidar can hit
        const cv = document.createElement('canvas'); cv.width = Math.round(w * s); cv.height = Math.round(h * s);
        const m = cv.getContext('2d');
        m.scale(s, s);
        m.fillStyle = '#1b2733'; m.fillRect(ox, oy, mw, mh);
        m.strokeStyle = 'rgba(140, 170, 200, 0.09)'; m.lineWidth = 1;
        for (let gx = Math.ceil(WALL_L); gx < WALL_R; gx++) { m.beginPath(); m.moveTo(X(gx), oy); m.lineTo(X(gx), oy + mh); m.stroke(); }
        for (let gz = Math.ceil(MAP.z0); gz < MAP.z1; gz++) { m.beginPath(); m.moveTo(ox, Y(gz)); m.lineTo(ox + mw, Y(gz)); m.stroke(); }
        m.save(); m.beginPath(); m.rect(ox, oy, mw, mh); m.clip();
        m.fillStyle = '#c3cfdb';
        for (const [x0, z0, x1, z1] of OBST) m.fillRect(X(x0) - 1, Y(z0) - 1, Math.max(3, (x1 - x0) * sc + 2), Math.max(3, (z1 - z0) * sc + 2));
        m.restore();
        m.strokeStyle = '#c3cfdb'; m.lineWidth = 4; m.beginPath(); m.moveTo(ox, oy + mh); m.lineTo(ox, oy); m.lineTo(ox + mw, oy); m.lineTo(ox + mw, oy + mh); m.stroke(); // the three walls; the room carries on towards the visitor
        m.strokeStyle = '#62d5ff'; m.lineWidth = 2; m.strokeRect(X(dock.position.x) - 7, Y(dock.position.z) - 9, 14, 18); // the dock
        bases.set(key, { cv, s });
      }
      ctx.drawImage(bases.get(key).cv, 0, 0, w, h);
      ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, mw, mh); ctx.clip();
      // the way it means to go
      if (live.route.length) {
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.85)'; ctx.lineWidth = 2.5; ctx.setLineDash([7, 5]);
        ctx.beginPath(); ctx.moveTo(X(live.x), Y(live.z)); for (const [x, z] of live.route) ctx.lineTo(X(x), Y(z)); ctx.stroke(); ctx.setLineDash([]);
        const [gx, gz] = live.route[live.route.length - 1]; ctx.fillStyle = '#4ade80'; ctx.beginPath(); ctx.arc(X(gx), Y(gz), 4, 0, 7); ctx.fill();
      }
      // what the lidar sees
      ctx.fillStyle = '#ff3b30';
      for (let i = 0; i < live.scanN; i++) ctx.fillRect(X(live.scan[i * 2]) - 1.5, Y(live.scan[i * 2 + 1]) - 1.5, 3, 3);
      // the robot: its outline, which way it faces, and its two axes
      ctx.translate(X(live.x), Y(live.z)); ctx.rotate(-live.heading);
      ctx.fillStyle = 'rgba(255, 180, 84, 0.25)'; ctx.strokeStyle = '#ffb454'; ctx.lineWidth = 2;
      ctx.fillRect(-0.3 * sc, -0.22 * sc, 0.6 * sc, 0.44 * sc); ctx.strokeRect(-0.3 * sc, -0.22 * sc, 0.6 * sc, 0.44 * sc);
      ctx.strokeStyle = '#ff5a4f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0.5 * sc, 0); ctx.stroke();
      ctx.strokeStyle = '#4ade80'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -0.34 * sc); ctx.stroke();
      ctx.restore();
      // ----- beside the map: where it is, and the streams it is reading
      const px = ox + mw + 18;
      text(ctx, 'pose', px, oy + 12, '#6f8296', '500 14px ' + MONO, 'left');
      const deg = Math.round((((live.heading * 180) / Math.PI) % 360 + 360) % 360);
      [['x', (live.x - HOME[0]).toFixed(2) + ' m'], ['y', (-(live.z - HOME[1])).toFixed(2) + ' m'], ['yaw', deg + '°']].forEach(([k, v], i) => {
        text(ctx, k, px, oy + 38 + i * 24, '#62d5ff', '500 16px ' + MONO, 'left'); text(ctx, v, w - 14, oy + 38 + i * 24, '#d7e0ea', '500 16px ' + MONO, 'right');
      });
      text(ctx, 'topics', px, oy + 124, '#6f8296', '500 14px ' + MONO, 'left');
      const beat = Math.floor(performance.now() / 220);
      idle.topics.forEach((name, i) => {
        const y = oy + 150 + i * 24, quiet = live.task === 'charging' && name !== '/tf' && name !== '/map';
        text(ctx, name, px, y, quiet ? '#3f5063' : '#62d5ff', '500 16px ' + MONO, 'left');
        ctx.fillStyle = quiet ? '#1a2330' : (beat + i) % 3 ? '#3f6f95' : '#8fdcff'; ctx.fillRect(w - 26, y - 6, 12, 12);
      });
      if (fps.shown) text(ctx, fps.shown + ' fps', w - 14, oy + mh - 8, '#6f8296', '500 14px ' + MONO, 'right'); // how fast this page is drawing, for whoever looks
    }
  }
  const mon2 = new THREE.Group();
  mon2.position.set(0.42, 0.42, 0.12);
  mon2.add(box(0.8, 0.48, 0.04, M.dark, amberEdge));
  const SW = 0.74, SH = 0.42; // the glass of the second monitor
  const screenPlane = at(new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: idlePic.tex })), 0, 0, 0.021);
  mon2.add(screenPlane);
  swing.add(mon2);
  desk.add(swing);
  const monHit = hit('monitor', 0.86, 0.56, 0.2, 0, 0, 0.05, mon2);
  // a lamp
  const lampG = new THREE.Group();
  lampG.position.set(-0.11, 0.79, -0.4); // in the middle, at the back, leaning forward over the notebook
  lampG.rotation.y = -Math.PI / 2; // its lean (local +x) now points towards the visitor
  lampG.add(at(cyl(0.09, 0.1, 0.03, M.dark, 20), 0, 0.015, 0));
  const lampArm = plain(0.025, 0.5, 0.025, M.mid); lampArm.position.set(0.07, 0.26, 0); lampArm.rotation.z = -0.28; lampG.add(lampArm);
  const lampHead = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.13, 20, 1, true), new THREE.MeshStandardMaterial({ color: C.amber, roughness: 0.5, side: THREE.DoubleSide }));
  lampHead.position.set(0.2, 0.52, 0.02); lampHead.rotation.z = -0.5; lampG.add(lampHead);
  const bulb = at(new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff1c9 })), 0.22, 0.49, 0.02);
  lampG.add(bulb);
  const lampLight = new THREE.SpotLight(0xffd9a0, 0, 5, 0.9, 0.6, 1.2);
  lampLight.position.set(0.22, 0.5, 0.02);
  lampLight.target.position.set(0.66, -0.05, 0);
  lampG.add(lampLight, lampLight.target);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.55, 36), new THREE.MeshBasicMaterial({ color: 0xffc77a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(0.66, 0.006, 0); lampG.add(pool);
  desk.add(lampG);
  hit('lamp', 0.3, 0.62, 0.42, -0.11, 1.1, -0.28);
  // The notebook: lying open in the middle of the desk, between the two chairs, because it is
  // for both of them: his evenings and people, and the visitor's way to say hello. Under the lamp.
  // Open pages with writing on them, three coloured tabs for its sections, and an amber ribbon.
  const NBW = 0.58, NBH = 0.38, nbCentre = V(-0.11, 0.812, 0.27); // midway between his chair and the visitor's
  const notebook = new THREE.Group();
  notebook.position.set(nbCentre.x, 0.79, nbCentre.z);
  notebook.add(at(plain(NBW + 0.03, 0.012, NBH + 0.02, M.dark), 0, 0.006, 0)); // cover
  const pagePic = picture(512, 336, (ctx, w, h) => {
    ctx.fillStyle = '#f3ecda'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d9cfb6'; for (let y = 46; y < h - 10; y += 22) ctx.fillRect(18, y, w - 36, 1.5);
    ctx.fillStyle = '#cdbf9f'; ctx.fillRect(w / 2 - 2, 0, 4, h);
    pen(ctx, '#3a3324', 3);
    for (const x0 of [26, w / 2 + 16]) for (let r = 0; r < 11; r++) { const y = 62 + r * 22, len = 150 + ((r * 53 + x0) % 60); if (r === 4 || r === 8) continue; ctx.globalAlpha = 0.55; path(ctx, [[x0, y], [x0 + len, y]]); }
    ctx.globalAlpha = 1;
    text(ctx, 'Evenings', 30, 28, '#2a2418', '700 22px ' + FONT, 'left'); text(ctx, 'People', w / 2 + 20, 28, '#2a2418', '700 22px ' + FONT, 'left');
  });
  const pages = at(new THREE.Mesh(new THREE.PlaneGeometry(NBW, NBH), new THREE.MeshBasicMaterial({ map: pagePic.tex, color: 0xe8e2d2 })), 0, 0.0225, 0);
  pages.rotation.x = -Math.PI / 2;
  notebook.add(pages);
  // one loose page that lifts a little when the pointer comes near
  const leaf = new THREE.Group();
  leaf.position.set(0, 0.024, 0);
  const leafM = new THREE.Mesh(new THREE.PlaneGeometry(NBW / 2 - 0.01, NBH - 0.02), new THREE.MeshStandardMaterial({ color: 0xf3ecda, roughness: 0.95, side: THREE.DoubleSide }));
  leafM.rotation.x = -Math.PI / 2; leafM.position.x = NBW / 4;
  leaf.add(leafM);
  notebook.add(leaf);
  [[0xc9661a, -0.11], [0x2f8f5a, 0], [0x1d4f8c, 0.11]].forEach(([c, z]) => notebook.add(at(plain(0.035, 0.004, 0.07, glow(c)), NBW / 2 + 0.012, 0.02, z))); // section tabs
  notebook.add(at(plain(0.02, 0.003, 0.16, glow(C.amber)), -0.05, 0.027, NBH / 2 + 0.05)); // ribbon bookmark
  const penM = cyl(0.008, 0.008, 0.17, M.joint, 8); penM.rotation.z = Math.PI / 2; penM.rotation.y = 0.5; penM.position.set(-0.12, 0.034, 0.06); notebook.add(penM);
  desk.add(notebook);
  hit('notebook', NBW + 0.12, 0.22, NBH + 0.12, nbCentre.x, 0.89, nbCentre.z);
  // ----- the small things on the right of the desk: a circuit board and a train of gears.
  // The board's light blinks; a click runs a pattern along its row of lights. The gears mesh:
  // they turn as the pointer comes near, and spin up on a click, each driving the next.
  const board = new THREE.Group();
  board.position.set(0.52, 0.794, 0.37); board.rotation.y = 0.1;
  board.add(plain(0.32, 0.008, 0.2, M.pcb));
  board.add(at(plain(0.07, 0.014, 0.07, M.dark), -0.06, 0.011, -0.01)); // the processor
  board.add(at(plain(0.03, 0.012, 0.06, M.dark), 0.04, 0.01, -0.04), at(plain(0.05, 0.02, 0.035, M.steel), -0.125, 0.014, -0.065), at(plain(0.09, 0.016, 0.018, M.dark), 0.09, 0.012, -0.085));
  for (const [x, z] of [[-0.145, 0.085], [0.145, 0.085], [-0.145, -0.085], [0.145, -0.085]]) board.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.01, 10), M.brass), x, 0.005, z)); // mounting holes
  const LED_ON = [0x4ade80, 0xffb454, 0xffb454, 0xffb454, 0x62d5ff], LED_OFF = 0x1a2622;
  const leds = LED_ON.map((c, i) => { const m = plain(0.016, 0.01, 0.016, glow(LED_OFF)); board.add(at(m, -0.03 + i * 0.034, 0.009, 0.065)); return m; });
  desk.add(board);
  const boardHit = hit('board', 0.36, 0.14, 0.24, 0.52, 0.86, 0.37);

  function gearGeo(N, mod, thick) {
    const rp = (mod * N) / 2, ro = rp + mod * 0.9, rr = rp - mod * 1.1, step = (Math.PI * 2) / N, sh = new THREE.Shape();
    for (let i = 0; i < N; i++) {
      const a = i * step;
      for (const [r, da] of [[rr, -0.3], [ro, -0.14], [ro, 0.14], [rr, 0.3]]) { const x = r * Math.cos(a + da * step), y = r * Math.sin(a + da * step); if (i === 0 && da === -0.3) sh.moveTo(x, y); else sh.lineTo(x, y); }
    }
    sh.closePath();
    const hole = new THREE.Path(); hole.absarc(0, 0, rp * 0.22, 0, Math.PI * 2, true); sh.holes.push(hole);
    for (let k = 0; k < (N > 9 ? 5 : 0); k++) { const h = new THREE.Path(), a = (k / 5) * Math.PI * 2; h.absarc(rp * 0.58 * Math.cos(a), rp * 0.58 * Math.sin(a), rp * 0.16, 0, Math.PI * 2, true); sh.holes.push(h); } // lightening holes
    const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false, curveSegments: 10 });
    g.rotateX(-Math.PI / 2); // lie flat: the shape's angle now runs the same way as a turn about the upright axis
    return g;
  }
  const GEAR_MOD = 0.0105;
  const train = new THREE.Group();
  train.position.set(1.02, 0.79, 0.34); train.rotation.y = -0.08;
  train.add(at(box(0.44, 0.012, 0.26, M.dark), 0, 0.006, 0)); // the plate they are pinned to
  // each gear: teeth, where it sits on the plate, and the direction to the next one
  const gears = [{ N: 18, m: M.brass, x: -0.1, z: 0.01, to: -0.25 }, { N: 11, m: M.steel, to: 0.9 }, { N: 8, m: M.brass }];
  gears.forEach((g, i) => {
    const prev = gears[i - 1];
    if (prev) { const d = (GEAR_MOD * (prev.N + g.N)) / 2; g.x = prev.x + d * Math.cos(prev.to); g.z = prev.z - d * Math.sin(prev.to); }
    g.mesh = at(withEdges(new THREE.Mesh(gearGeo(g.N, GEAR_MOD, 0.012), g.m)), g.x, 0.016, g.z);
    train.add(g.mesh, at(new THREE.Mesh(new THREE.CylinderGeometry(GEAR_MOD * g.N * 0.085, GEAR_MOD * g.N * 0.085, 0.03, 12), M.steel), g.x, 0.02, g.z));
  });
  function turnGears(a) {
    gears.forEach((g, i) => {
      const prev = gears[i - 1];
      // a tooth of one meets a gap of the next along the line between their centres
      g.a = prev ? -(prev.a - prev.to) * (prev.N / g.N) + prev.to + Math.PI + Math.PI / g.N : a;
      g.mesh.rotation.y = g.a;
    });
  }
  turnGears(0);
  desk.add(train);
  const gearsHit = hit('gears', 0.46, 0.14, 0.28, 1.02, 0.86, 0.34);
  [[0.27, 0.43], [0.31, 0.47], [1.3, 0.2]].forEach(([x, z]) => desk.add(at(plain(0.018, 0.012, 0.018, M.steel), x, 0.797, z))); // a few loose nuts
  const small = { spin: 0, angle: 0, spinUntil: 0, patternFrom: -1 };

  // ----- the sheet that comes out of a drawer. It is drawn in the colours of the page it leads to
  // (light, or dark for a visitor whose system is dark), so the page can take over without a jump.
  const darkPage = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const SHEET = darkPage ? { bg: '#0b0f14', ink: '#e8edf3', soft: '#2a3644', accent: '#ffb454' } : { bg: '#fbfaf7', ink: '#171a1f', soft: '#d6d1c7', accent: '#a85a00' };
  const sheetPic = picture(600, 848);
  function drawSheet(label) {
    sheetPic.redraw((ctx, w, h) => {
      ctx.fillStyle = SHEET.bg; ctx.fillRect(0, 0, w, h);
      text(ctx, label, 56, 92, SHEET.ink, '700 58px ' + FONT, 'left');
      ctx.fillStyle = SHEET.accent; ctx.fillRect(56, 138, 210, 9);
      let y = 196;
      for (const rows of [3, 5, 6, 4, 5]) {
        ctx.fillStyle = SHEET.accent; ctx.fillRect(56, y, 130, 7); y += 24;
        ctx.fillStyle = SHEET.soft;
        for (let i = 0; i < rows; i++) { ctx.fillRect(56, y, w - 112 - ((i * 97 + rows * 31) % 150), 8); y += 20; }
        y += 22;
      }
    });
  }
  const sheetOut = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.424), new THREE.MeshBasicMaterial({ map: sheetPic.tex, side: THREE.DoubleSide }));
  sheetOut.visible = false;
  scene.add(sheetOut);
  const taking = { drawer: null, from: 0 };
  const shA = V(0, 0, 0), shB = V(0, 0, 0), shC = V(0, 0, 0);
  const Q_FLAT = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -Math.PI / 2), Q_UP = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -0.12);

  // ----- chairs: both face the desk
  function makeChair(em = edgeMat, m = M.chair) {
    const g = new THREE.Group();
    const seat = new THREE.Group();
    seat.add(at(box(0.48, 0.07, 0.48, m, em), 0, 0.48, 0));
    seat.add(at(box(0.46, 0.42, 0.06, m, em), 0, 0.8, 0.23));
    g.add(seat);
    g.add(at(cyl(0.03, 0.03, 0.3, M.dark, 10), 0, 0.3, 0));
    for (let i = 0; i < 5; i++) { const leg = plain(0.3, 0.03, 0.04, M.dark); leg.geometry.translate(0.15, 0, 0); leg.position.y = 0.12; leg.rotation.y = (i / 5) * Math.PI * 2; g.add(leg); }
    g.userData.seat = seat;
    return g;
  }
  const chair1 = makeChair();
  chair1.position.set(MX, 0, 0.98);
  scene.add(chair1);
  const chair2 = makeChair(amberEdge, M.chair2);
  const C2 = V(-0.72, 0, 1.12);
  chair2.position.copy(C2);
  scene.add(chair2);
  const chairHit = hit('chair', 0.6, 1.0, 0.6, C2.x, 0.5, C2.z); // no taller than the chair, or it covers the notebook behind it

  // ----- him: a faceless glass figure in his chair, from 10 to 6 IST.
  // Plain shapes. He is never one of the click boxes, so clicks go through him.
  // He is glass: see-through, a light blue tint, brighter towards his outline the way glass catches
  // the light (how much the surface turns away from the eye). Each part is drawn twice: first only into
  // the depth buffer, after everything solid in the room, then as glass only where it is the front-most
  // surface. So where an arm overlaps the body there is still one layer of glass, not a darker patch.
  const GLASS = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthFunc: THREE.LessEqualDepth,
    uniforms: { tint: { value: new THREE.Color(0x9fd8ff) }, edge: { value: new THREE.Color(0xe4f6ff) }, fade: { value: 1 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main() { vec4 p = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-p.xyz); gl_Position = projectionMatrix * p; }',
    fragmentShader: 'uniform vec3 tint; uniform vec3 edge; uniform float fade; varying vec3 vN; varying vec3 vV; void main() { float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); gl_FragColor = vec4(mix(tint, edge, f), (0.1 + 0.6 * f) * fade); }',
  });
  const DEPTH_ONLY = new THREE.MeshBasicMaterial({ colorWrite: false });
  const rimmed = (geo) => { const m = new THREE.Mesh(geo, GLASS), d = new THREE.Mesh(geo, DEPTH_ONLY); m.renderOrder = 11; d.renderOrder = 10; m.add(d); return m; };
  const UP = V(0, 1, 0);
  const capsule = (r, len) => rimmed(new THREE.CapsuleGeometry(r, len, 6, 16));
  const lay = (m, a, b) => { m.position.lerpVectors(a, b, 0.5); m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize()); };
  // the elbow (or knee) of a two-part limb from a to b, bending towards `pole`
  function bend(a, b, l1, l2, pole) {
    const n = b.clone().sub(a), d = Math.min(n.length(), l1 + l2 - 0.001);
    n.normalize();
    const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d), out = pole.clone().addScaledVector(n, -pole.dot(n)).normalize();
    return { joint: a.clone().addScaledVector(n, along).addScaledVector(out, Math.sqrt(Math.max(l1 * l1 - along * along, 0))), end: a.clone().addScaledVector(n, d) };
  }
  // His body, in his own space: standing on the floor at the origin, facing -z. The group is moved and
  // turned around the room; every joint is worked out each frame from a few numbers (how far he is
  // sitting, leaning, turned, walking) and where each hand should be.
  const him = new THREE.Group();
  him.visible = false;
  scene.add(him);
  const ARM = 0.32, THIGH = 0.44, SHIN = 0.46;
  const body = capsule(0.15, 0.3), head = rimmed(new THREE.SphereGeometry(0.1, 24, 18));
  him.add(body, head);
  const legs = [-1, 1].map((side) => {
    const thigh = capsule(0.075, THIGH - 0.15), shin = capsule(0.06, SHIN - 0.12), shoe = rimmed(new THREE.CapsuleGeometry(0.04, 0.14, 4, 10));
    him.add(thigh, shin, shoe);
    return { side, thigh, shin, shoe };
  });
  const arms = [-1, 1].map((side) => {
    const upper = capsule(0.055, ARM - 0.08), fore = capsule(0.048, ARM - 0.08), hand = rimmed(new THREE.SphereGeometry(0.05, 14, 12));
    him.add(upper, fore, hand);
    return { side, upper, fore, hand };
  });
  const KNEE_POLE = V(0, 0.2, -1).normalize();
  const lerpV = (a, b, k) => a.clone().lerp(b, k);
  const turnY = (v, a) => v.clone().applyAxisAngle(UP, a);
  // r: { sit, lean, twist, walk, phase, hands: [left, right] } (hands in his own space)
  function shape(r) {
    const bob = 0.02 * r.walk * Math.abs(Math.cos(r.phase));
    const pelvis = lerpV(V(0, 0.95 + bob, 0), V(0, 0.6, 0.04), r.sit);
    const neck = lerpV(V(0, 1.47 + bob, 0), V(0, 1.12, -0.2), r.sit).add(V(0, 0.02 * r.lean, 0.14 * r.lean));
    lay(body, pelvis, neck);
    head.position.copy(neck).add(turnY(V(0, 0.17, -0.03), r.twist * 0.6));
    for (const l of legs) {
      const s = l.side, hip = pelvis.clone().add(V(0.1 * s, -0.02, 0.02));
      const stride = 0.2 * r.walk * Math.sin(r.phase) * s, lift = 0.07 * r.walk * Math.max(0, Math.cos(r.phase) * s);
      const foot = lerpV(V(0.11 * s, 0.07 + lift, -stride), V(0.12 * s, 0.07, -0.31), r.sit);
      const { joint, end } = bend(hip, foot, THIGH, SHIN, KNEE_POLE);
      lay(l.thigh, hip, joint); lay(l.shin, joint, end);
      l.shoe.position.set(end.x, 0.04 + lift, end.z - 0.06); l.shoe.rotation.set(Math.PI / 2, 0, 0);
    }
    arms.forEach((a, i) => {
      const shoulder = neck.clone().add(turnY(V(0.19 * a.side, -0.06, 0.02), r.twist));
      const { joint, end } = bend(shoulder, r.hands[i], ARM, ARM, V(0.6 * a.side, -1, 0.5).normalize());
      lay(a.upper, shoulder, joint); lay(a.fore, joint, end); a.hand.position.copy(end);
    });
    return head.position.clone();
  }

  // Where things are, in the room. His chair is chair1; the mug moved to the left of his keyboard, by
  // the front edge of the desk, where he can reach it.
  const SEAT = [MX, 0.98], STAND_AT = [MX, 0.95];
  const MUG0 = V(0.24, 0.84, 0.44);
  mug.position.copy(MUG0);
  // the walks, through the gap between the desk's right end and the bin, to the back window
  const TO_WINDOW = [[MX, 0.95], [1.0, 1.05], [1.62, 0.95], [1.62, -0.9], [1.75, -2.9]];
  const FROM_WINDOW = [...TO_WINDOW].reverse();
  const ENTER = [[2.4, 6.2], [1.1, 1.7], [MX, 0.95]], LEAVE = [...ENTER].reverse();

  const fig = { mode: 'away', x: SEAT[0], z: SEAT[1], yaw: 0, sit: 1, walk: 0, phase: 0, queue: [], step: null, stepT: 0, mug: false,
    pose: null, poseT: 0, poseLen: 0, poseW: 0, nextPose: 18, nextCoffee: 75 + Math.random() * 35, host: 0, hostUntil: 0, lastShown: 0, inited: false };
  let hoursIn = false, lastDayH = null, clockJumped = false;
  const local = (wx, wy, wz) => him.worldToLocal(V(wx, wy, wz));
  const keyboard = (side, tap) => V(0.12 * side, 0.83 + tap, -0.74);
  const hanging = (side, swing) => V(0.23 * side, 0.88, 0.02 + swing);
  const ease = (x) => smooth(clamp01(x));
  const POSES = { think: 6, sip: 4.5, glance: 3.5, stretch: 3 };
  function start(steps) { fig.queue = steps; fig.step = null; }
  const coffee = () => [{ pick: 0.8 }, { stand: 1.2 }, { walk: TO_WINDOW }, { turn: 0 }, { look: 12 }, { walk: FROM_WINDOW }, { turn: 0 }, { sit: 1.2 }, { put: 0.8 }];

  // one frame of him: what he is doing, then his body
  function updateHim(dt, t, robotAt, seatedVisitor) {
    if (!figureOn) return;
    // reduced motion: at the desk in his hours, still; otherwise not there
    if (reduced) {
      him.visible = hoursIn; fig.mode = hoursIn ? 'desk' : 'away';
      if (!hoursIn) return;
      him.position.set(SEAT[0], 0, SEAT[1]); him.rotation.y = 0;
      shape({ sit: 1, lean: 0, twist: 0, walk: 0, phase: 0, hands: [keyboard(-1, 0), keyboard(1, 0)] });
      return;
    }
    if (!fig.inited || clockJumped) {
      fig.inited = true; clockJumped = false;
      Object.assign(fig, { mode: hoursIn ? 'desk' : 'away', queue: [], step: null, sit: 1, walk: 0, x: SEAT[0], z: SEAT[1], yaw: 0, mug: false, pose: null });
      mug.position.copy(MUG0);
    }
    if (hoursIn && fig.mode === 'away' && !fig.queue.length && !fig.step) { fig.mode = 'busy'; fig.x = ENTER[0][0]; fig.z = ENTER[0][1]; fig.sit = 0; start([{ walk: ENTER }, { turn: 0 }, { sit: 1.2 }]); }
    if (!hoursIn && fig.mode === 'desk' && !fig.queue.length && !fig.step) { fig.mode = 'busy'; start([{ stand: 1.2 }, { walk: LEAVE }, { gone: true }]); }
    // a coffee at the window every 20 minutes, the first soon after the page opens
    fig.nextCoffee -= dt;
    if (fig.mode === 'desk' && fig.nextCoffee <= 0 && !fig.pose && !seatedVisitor) { fig.nextCoffee = 20 * 60; fig.mode = 'busy'; start(coffee()); }
    him.visible = fig.mode !== 'away';
    if (!him.visible) { chair1.position.z = SEAT[1]; return; }

    // the current step
    if (!fig.step && fig.queue.length) { fig.step = fig.queue.shift(); fig.stepT = 0; fig.seg = 1; }
    const s = fig.step;
    let lean = 0, twist = 0, hands = null, mugHand = null;
    if (s) {
      fig.stepT += dt;
      const len = s.pick || s.put || s.stand || s.sit || s.look || 0, u = len ? clamp01(fig.stepT / len) : 0;
      if (s.walk) {
        const [tx, tz] = s.walk[fig.seg] || s.walk[s.walk.length - 1];
        const dx = tx - fig.x, dz = tz - fig.z, d = Math.hypot(dx, dz);
        // a robot in the way: wait for it to pass
        const rx = robotAt.x - fig.x, rz = robotAt.z - fig.z, near = Math.hypot(rx, rz) < 0.95 && rx * dx + rz * dz > 0;
        const speed = near ? 0 : 0.8;
        fig.walk += ((near ? 0 : 1) - fig.walk) * Math.min(1, dt * 6);
        if (d > 0.001) {
          const want = Math.atan2(-dx, -dz);
          let dy = ((want - fig.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          fig.yaw += dy * Math.min(1, dt * 7); fig.yaw = Math.atan2(Math.sin(fig.yaw), Math.cos(fig.yaw));
          const stepLen = Math.min(d, speed * dt);
          fig.x += (dx / d) * stepLen; fig.z += (dz / d) * stepLen; fig.phase += stepLen * 7.5;
        }
        if (d < 0.02) { fig.seg++; if (fig.seg >= s.walk.length) { fig.step = null; } }
      } else {
        fig.walk += (0 - fig.walk) * Math.min(1, dt * 6);
        if (s.turn !== undefined) {
          let dy = ((s.turn - fig.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          fig.yaw += dy * Math.min(1, dt * 5);
          if (Math.abs(dy) < 0.02) { fig.yaw = s.turn; fig.step = null; }
        } else if (s.stand || s.sit) {
          // standing up rolls the chair back a little; sitting down pulls it in again
          const k = ease(u);
          fig.sit = s.stand ? 1 - k : k;
          const from = s.stand ? SEAT : STAND_AT, to = s.stand ? STAND_AT : SEAT;
          fig.x = from[0] + (to[0] - from[0]) * k; fig.z = from[1] + (to[1] - from[1]) * k;
          if (u >= 1) fig.step = null;
        } else if (s.pick || s.put) {
          // the left hand goes to the mug's place on the desk; it is held from the middle of a pick
          const reach = Math.sin(Math.PI * u), at = local(MUG0.x, MUG0.y + 0.05, MUG0.z);
          hands = [lerpV(keyboard(-1, 0), at, reach), keyboard(1, 0)];
          if (s.pick && u > 0.5) fig.mug = true;
          if (s.put && u > 0.5) { fig.mug = false; mug.position.copy(MUG0); }
          if (u >= 1) fig.step = null;
        } else if (s.look) {
          // at the window: two sips, otherwise just looking out
          const sip = Math.max(Math.sin(Math.PI * clamp01((fig.stepT - 3) / 1.6)), Math.sin(Math.PI * clamp01((fig.stepT - 7.5) / 1.6)));
          mugHand = sip;
          if (u >= 1) fig.step = null;
        } else if (s.gone) { fig.mode = 'away'; fig.step = null; fig.sit = 1; fig.x = SEAT[0]; fig.z = SEAT[1]; fig.yaw = 0; him.visible = false; return; }
      }
      if (!fig.step && !fig.queue.length && fig.mode === 'busy') fig.mode = 'desk';
    }

    // at the desk with nothing else to do: typing, and now and then something else for a few seconds
    const atDesk = fig.mode === 'desk';
    if (atDesk) {
      if (!fig.pose) { fig.nextPose -= dt; if (fig.nextPose <= 0) { const names = Object.keys(POSES); fig.pose = names[Math.floor(Math.random() * names.length)]; fig.poseT = 0; fig.poseLen = POSES[fig.pose]; } }
      else { fig.poseT += dt; if (fig.poseT >= fig.poseLen) { fig.pose = null; fig.nextPose = 20 + Math.random() * 20; } }
    }
    // a visitor sits down: he turns to them and waves a hand at the second monitor, which swings over
    if (seatedVisitor && !fig.lastShown && atDesk && time === 'now') fig.hostUntil = t + 2.4;
    fig.lastShown = seatedVisitor;
    fig.host += ((t < fig.hostUntil ? 1 : 0) - fig.host) * Math.min(1, dt * 4);

    const tapL = Math.max(0, Math.sin(t * 13)) * 0.012, tapR = Math.max(0, Math.sin(t * 13 + 1.7)) * 0.012;
    const swing = 0.15 * fig.walk * Math.sin(fig.phase);
    const r = { sit: fig.sit, lean, twist, walk: fig.walk, phase: fig.phase };
    // the hands: at the keyboard when sitting, by his sides when standing, the mug in the left when carrying
    let L = lerpV(hanging(-1, swing), keyboard(-1, tapL), fig.sit), R = lerpV(hanging(1, -swing), keyboard(1, tapR), fig.sit);
    if (fig.mug && fig.sit < 0.99) L = lerpV(L, V(-0.17, 1.02, -0.28), 1 - fig.sit);
    r.head = shape({ ...r, hands: [L, R] }); // first, to know where his head is
    if (mugHand) L = lerpV(V(-0.17, 1.02, -0.28), r.head.clone().add(V(-0.03, -0.09, -0.1)), mugHand);
    if (hands) [L, R] = hands;
    // the pose of the moment, faded in and out
    if (fig.pose) {
      const w = ease(Math.min(fig.poseT / 0.7, (fig.poseLen - fig.poseT) / 0.7)), p = fig.poseT / fig.poseLen;
      if (fig.pose === 'think') { r.lean = 0.9 * w; L = lerpV(L, V(-0.16, 0.82, -0.62), w); R = lerpV(R, r.head.clone().add(V(0.02, -0.12, -0.07)).add(V(0, 0.02, 0.14 * w)), w); }
      if (fig.pose === 'glance') { r.twist = 0.45 * w; L = lerpV(L, V(-0.2, 0.82, -0.6), w); R = lerpV(R, V(0.1, 0.82, -0.62), w); }
      if (fig.pose === 'stretch') { r.lean = 0.5 * w; L = lerpV(L, V(-0.14, 1.8, -0.1), w); R = lerpV(R, V(0.14, 1.8, -0.1), w); }
      if (fig.pose === 'sip') {
        // to the mug, up to his mouth, a moment, back down
        const at = local(MUG0.x, MUG0.y + 0.05, MUG0.z), mouth = r.head.clone().add(V(-0.03, -0.09, -0.1));
        const up = ease((p - 0.25) / 0.2) * (1 - ease((p - 0.7) / 0.2));
        L = lerpV(L, lerpV(at, mouth, up), w);
        fig.mug = p > 0.22 && p < 0.9;
        if (p >= 0.9) mug.position.copy(MUG0);
      }
    }
    if (fig.host > 0.01) { r.twist = Math.max(r.twist, 0.5 * fig.host); L = lerpV(L, V(-0.5, 1.05, -0.5), fig.host); }
    him.position.set(fig.x, 0, fig.z); him.rotation.y = fig.yaw;
    him.updateMatrixWorld();
    shape({ ...r, hands: [L, R] });
    chair1.position.z = SEAT[1] + 0.42 * (1 - fig.sit);
    if (fig.mug) { arms[0].hand.getWorldPosition(mug.position); mug.position.y += 0.02; }
  }
  if (figureOn) { him.position.set(SEAT[0], 0, SEAT[1]); him.updateMatrixWorld(); shape({ sit: 1, lean: 0, twist: 0, walk: 0, phase: 0, hands: [keyboard(-1, 0), keyboard(1, 0)] }); }

  // ----- whiteboard, photographs
  const boardPic = picture(1024, 624, drawBoard);
  scene.add(at(box(2.36, 1.46, 0.04, M.mid), -2.75, 1.85, -3.37));
  scene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(2.26, 1.36), new THREE.MeshBasicMaterial({ map: boardPic.tex, color: 0xd6dbe0 })), -2.75, 1.85, -3.345));
  scene.add(at(plain(1.2, 0.03, 0.08, M.mid), -2.75, 1.1, -3.33)); // tray
  hit('whiteboard', 2.4, 1.5, 0.3, -2.75, 1.85, -3.25);
  function photo(label, people) {
    return picture(256, 300, (ctx, w, h) => {
      ctx.fillStyle = '#e9edf2'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#152030'; ctx.fillRect(22, 22, w - 44, 196);
      ctx.fillStyle = '#86a9b8';
      const xs = people === 1 ? [w / 2] : [70, 108, 148, 186];
      xs.forEach((x, i) => { const s = people === 1 ? 1.5 : 1; const y = 120 - (i % 2) * 8; ctx.beginPath(); ctx.arc(x, y - 30 * s, 14 * s, 0, 7); ctx.fill(); rr(ctx, x - 15 * s, y - 12 * s, 30 * s, 62 * s, 12 * s, true); });
      text(ctx, label, w / 2, 262, '#18212c', '700 36px ' + FONT);
    });
  }
  const frames = {};
  [['then', '2020', 1, -0.5, 0.06], ['now', 'now', 4, 0.6, -0.05]].forEach(([id, label, n, x, rot]) => {
    const g = new THREE.Group();
    g.position.set(x, 2.25, -3.36);
    g.rotation.z = rot;
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.65), glow(C.amber));
    frame.position.z = 0.005;
    g.add(frame);
    g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.586), new THREE.MeshBasicMaterial({ map: photo(label, n).tex, color: 0xe2e6ea })), 0, 0, 0.01));
    scene.add(g);
    frames[id] = frame;
    hit('photo-' + id, 0.6, 0.7, 0.3, x, 2.25, -3.25);
  });

  // ----- a shelf under the window, with a small robot for each kind of thing
  const SY = 1.0;
  scene.add(at(box(WW, 0.05, 0.36, M.wood), WX - 0.03, SY, -3.2));
  const shelfItems = {};
  function shelfItem(id, x, build) {
    const g = new THREE.Group();
    g.position.set(x, SY + 0.025, -3.2);
    build(g);
    scene.add(g);
    shelfItems[id] = g;
    hit('shelf:' + id, 0.5, 0.56, 0.4, x, SY + 0.28, -3.15);
    return g;
  }
  const armParts = {};
  shelfItem('arms', WX - 1.35, (g) => {
    g.add(at(cyl(0.09, 0.1, 0.05, M.dark, 18), 0, 0.025, 0));
    const a = new THREE.Group(); a.position.y = 0.06;
    a.add(at(plain(0.05, 0.24, 0.05, M.shell), 0, 0.12, 0));
    const b = new THREE.Group(); b.position.y = 0.24;
    b.add(at(plain(0.04, 0.2, 0.04, M.shell), 0, 0.1, 0));
    b.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), M.joint));
    a.add(b); g.add(a);
    armParts.a = a; armParts.b = b;
  });
  const rover = shelfItem('wheels', WX - 0.45, (g) => {
    g.add(at(cyl(0.07, 0.11, 0.2, M.shell, 18), 0, 0.1, 0));
    g.add(at(plain(0.17, 0.12, 0.05, M.shell), 0, 0.28, 0));
    g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.08), glow(0x0c1722)), 0, 0.28, 0.027));
    for (const x of [-0.03, 0.03]) g.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.012, 10), glow(C.cyan)), x, 0.285, 0.029));
  });
  const humanoidArm = new THREE.Group();
  shelfItem('humanoid', WX + 0.45, (g) => {
    g.add(at(cyl(0.07, 0.09, 0.12, M.dark, 16), 0, 0.06, 0));
    g.add(at(plain(0.14, 0.2, 0.08, M.shell), 0, 0.23, 0));
    g.add(at(plain(0.1, 0.09, 0.07, M.shell), 0, 0.39, 0));
    g.add(at(plain(0.025, 0.17, 0.025, M.shell), 0.09, 0.22, 0));
    humanoidArm.position.set(-0.09, 0.31, 0);
    humanoidArm.add(at(plain(0.025, 0.18, 0.025, M.red), 0, -0.09, 0));
    g.add(humanoidArm);
  });
  const headset = shelfItem('remote', WX + 1.35, (g) => {
    g.add(at(plain(0.18, 0.1, 0.1, M.shell), 0, 0.07, 0));
    g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.05), glow(0x0c1722)), 0, 0.07, 0.052));
  });

  // ----- the bin, and the sheet that missed
  const bin = new THREE.Group();
  bin.position.set(2.1, 0, 0.6);
  const binWall = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.16, 0.42, 22, 1, true), new THREE.MeshStandardMaterial({ color: C.mid, roughness: 0.7, side: THREE.DoubleSide }));
  binWall.position.y = 0.21;
  bin.add(withEdges(binWall));
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xeef1f4, roughness: 0.9, flatShading: true });
  const paper = () => new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), paperMat);
  bin.add(at(paper(), -0.05, 0.4, 0.02), at(paper(), 0.06, 0.42, -0.04), at(paper(), 0.0, 0.36, 0.07));
  scene.add(bin);
  hit('bin', 0.6, 0.7, 0.6, 2.1, 0.3, 0.6);
  const MISSED = V(2.72, 0.06, 1.0);
  const sheet = paper();
  sheet.position.copy(MISSED);
  scene.add(sheet);

  // sticky notes: only in the 2020 view
  const stickies = new THREE.Group();
  const tints = [0xffd27a, 0x9be9a8, 0x8fdcff, 0xf3a6c0];
  [[-3.6, 2.9], [-1.4, 2.7], [-1.1, 1.9], [-0.9, 1.3], [0.9, 2.9], [1.1, 1.7], [-0.1, 1.7], [0.2, 2.6], [-1.3, 3.2], [1.0, 2.3], [-3.9, 1.4], [0.5, 1.5]].forEach(([x, y], i) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ color: tints[i % 4] })); s.position.set(x, y, -3.33); s.rotation.z = (((i * 37) % 20) - 10) / 60; stickies.add(s); });
  stickies.visible = false;
  scene.add(stickies);

  // ---------- the robot in the background
  const robot = new THREE.Group();
  robot.add(at(box(0.6, 0.26, 0.44, M.mid), 0, 0.19, 0));
  robot.add(at(plain(0.61, 0.03, 0.45, glow(C.amber)), 0, 0.1, 0));
  robot.add(at(plain(0.5, 0.04, 0.38, M.dark), 0, 0.34, 0));
  robot.add(at(cyl(0.05, 0.05, 0.05, M.red, 14), 0.22, 0.385, 0));
  const shoulder = new THREE.Group(); shoulder.position.set(-0.05, 0.4, 0);
  const upper = plain(0.34, 0.05, 0.05, M.shell); upper.geometry.translate(0.17, 0, 0); shoulder.add(upper);
  shoulder.add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), M.joint));
  const elbow = new THREE.Group(); elbow.position.x = 0.34;
  const fore = plain(0.3, 0.04, 0.04, M.shell); fore.geometry.translate(0.15, 0, 0); elbow.add(fore);
  elbow.add(new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), M.joint));
  const grip = new THREE.Object3D(); grip.position.x = 0.32; elbow.add(grip);
  shoulder.add(elbow); robot.add(shoulder);
  const led = at(new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), glow(C.green)), -0.28, 0.3, 0.18);
  robot.add(led);
  scene.add(robot);
  const dock = new THREE.Group();
  dock.position.set(4.75, 0, -2.95); // in the corner, under the end of the window
  dock.add(at(box(0.3, 0.3, 0.5, M.mid), 0, 0.15, 0));
  dock.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), glow(C.green)), -0.16, 0.24, 0));
  scene.add(dock);

  // what the lidar can hit, as boxes on the floor plan: [minX, minZ, maxX, maxZ]
  const OBST = [[-7, -3.5, 7, -3.4], [WALL_L - 0.1, -3.5, WALL_L, 9], [WALL_R, -3.5, WALL_R + 0.1, 9], [SHELF.x - SHELF.w / 2, -3.4, SHELF.x + SHELF.w / 2, -3.4 + SHELF.d], [-1.36, -0.49, -1.28, -0.41], [1.28, -0.49, 1.36, -0.41], [-1.36, 0.41, -1.28, 0.49], [1.28, 0.41, 1.36, 0.49],
    [MX - 0.25, 0.73, MX + 0.25, 1.23], [1.03 - 0.25, -0.38, 1.03 + 0.25, 0.46], [C2.x - 0.25, C2.z - 0.25, C2.x + 0.25, C2.z + 0.25], [1.9, 0.4, 2.3, 0.8], [4.6, -3.2, 4.9, -2.7], [WX - WW / 2, -3.38, WX + WW / 2, -3.02]];
  const RAYS = 170, RANGE = 3.6;
  const lidarGeo = new THREE.BufferGeometry();
  lidarGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAYS * 3), 3));
  const lidar = new THREE.Points(lidarGeo, new THREE.PointsMaterial({ color: C.lidar, size: 0.05, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(lidar);
  function scan(px, pz, heading) {
    const p = lidarGeo.attributes.position;
    let n = 0;
    for (let i = 0; i < RAYS; i++) {
      const a = heading - Math.PI * 0.75 + (i / (RAYS - 1)) * Math.PI * 1.5;
      const dx = Math.cos(a) || 1e-6, dz = -Math.sin(a) || 1e-6;
      let best = RANGE;
      for (const [x0, z0, x1, z1] of OBST) {
        const tx0 = (x0 - px) / dx, tx1 = (x1 - px) / dx, tz0 = (z0 - pz) / dz, tz1 = (z1 - pz) / dz;
        const tn = Math.max(Math.min(tx0, tx1), Math.min(tz0, tz1)), tf = Math.min(Math.max(tx0, tx1), Math.max(tz0, tz1));
        if (tn <= tf && tn > 0.05 && tn < best) best = tn;
      }
      if (best < RANGE) { if (live.scan.length < RAYS * 2) live.scan = new Float32Array(RAYS * 2); live.scan[n * 2] = px + dx * best; live.scan[n * 2 + 1] = pz + dz * best; p.setXYZ(n++, px + dx * best, 0.3, pz + dz * best); }
    }
    live.scanN = n;
    lidarGeo.setDrawRange(0, n);
    p.needsUpdate = true;
  }

  // the loop: tidy the sheet, patrol behind the desk, dock, wait, again
  const HOME = [4.25, -2.95];
  const steps = [
    { move: [3.6, -0.9] }, { move: [3.22, 1.0], face: Math.PI }, { pick: 2.6 }, { move: [2.66, 0.6], face: Math.PI }, { drop: 2.4 },
    { move: [3.4, 1.6] }, { move: [3.7, -1.4] }, { move: [2.0, -2.2] }, { move: [-2.0, -2.2] }, { move: [-3.7, -1.3] }, { move: [-3.6, 1.4] },
    { move: [-3.7, -1.3] }, { move: [-2.0, -2.2] }, { move: [2.0, -2.2] }, { move: HOME, face: 0 }, { wait: 7 },
  ];
  let cursor = HOME, total = 0;
  for (const s of steps) {
    s.from = cursor; s.t0 = total;
    if (s.move) { s.dur = Math.max(1.2, Math.hypot(s.move[0] - cursor[0], s.move[1] - cursor[1]) / 0.55); cursor = s.move; } else s.dur = s.pick || s.drop || s.wait;
    total += s.dur;
  }
  const POSE = { stow: [2.25, -2.5], down: [-0.35, -0.75], carry: [1.0, -1.7], over: [0.55, -1.05] };
  const pose = (a, b, k) => { shoulder.rotation.z = a[0] + (b[0] - a[0]) * k; elbow.rotation.z = a[1] + (b[1] - a[1]) * k; };
  let heading = 0, robotT = 0, busy = false, holding = false;
  const IN_BIN = V(2.1, 0.4, 0.6), tmp = V(0, 0, 0), held = V(0, 0, 0);
  function runRobot(dt) {
    if (!busy || mapCanvas) robotT = (robotT + dt) % total; // still while something else is being read, unless its map is being watched
    const s = steps.find((x) => robotT >= x.t0 && robotT < x.t0 + x.dur) || steps[0];
    const k = clamp01((robotT - s.t0) / s.dur);
    const i = steps.indexOf(s);
    let px = s.from[0], pz = s.from[1], want = heading;
    if (s.move) {
      const e = smooth(k);
      px += (s.move[0] - s.from[0]) * e; pz += (s.move[1] - s.from[1]) * e;
      want = Math.atan2(-(s.move[1] - s.from[1]), s.move[0] - s.from[0]);
      if (s.face !== undefined && k > 0.8) want = s.face;
    } else if (s.face !== undefined) want = s.face;
    let d = want - heading; d = Math.atan2(Math.sin(d), Math.cos(d));
    heading += d * Math.min(1, dt * 4);
    robot.position.set(px, 0, pz);
    robot.rotation.y = heading;
    if (s.pick) { if (k < 0.5) pose(POSE.stow, POSE.down, smooth(k * 2)); else pose(POSE.down, POSE.carry, smooth((k - 0.5) * 2)); holding = k >= 0.5; }
    else if (s.drop) { if (k < 0.5) pose(POSE.carry, POSE.over, smooth(k * 2)); else pose(POSE.over, POSE.stow, smooth((k - 0.5) * 2)); holding = k < 0.5; }
    else if (i === 3) { pose(POSE.carry, POSE.carry, 0); holding = true; }
    else { pose(POSE.stow, POSE.stow, 0); holding = false; }
    // Once let go over the bin the sheet falls in and is gone. (It used to jump back to the floor
    // for the second half of the drop, while the arm was still over the bin.)
    const falling = !!s.drop && k >= 0.5 ? (k - 0.5) / 0.18 : -1;
    const tidied = (i > 4 || falling >= 1) && !s.wait;
    if (holding) { grip.getWorldPosition(tmp); sheet.position.copy(tmp); sheet.visible = true; sheet.scale.setScalar(1); }
    else if (falling >= 0 && falling < 1) {
      // from where the hand was when it let go (the arm has already started back), down into the bin
      pose(POSE.over, POSE.over, 0); robot.updateMatrixWorld(true); grip.getWorldPosition(held);
      pose(POSE.over, POSE.stow, smooth((k - 0.5) * 2));
      sheet.visible = true; sheet.position.lerpVectors(held, IN_BIN, smooth(falling)); sheet.scale.setScalar(1);
    }
    else if (tidied) sheet.visible = false;
    else { sheet.visible = true; sheet.position.copy(MISSED); sheet.scale.setScalar(s.wait ? smooth(clamp01(k * 3)) : 1); }
    led.visible = !s.wait || Math.floor(robotT * 2) % 2 === 0;
    if (s.wait) { lidarGeo.setDrawRange(0, 0); live.scanN = 0; } else scan(px, pz, heading);
    // for the second monitor: the task, where it is, and the rest of this leg of its round
    live.x = px; live.z = pz; live.heading = heading;
    live.task = s.wait ? 'charging' : i <= 4 ? 'cleaning' : i === steps.length - 2 ? 'docking' : 'patrolling';
    live.route = [];
    for (let j = i; j < steps.length && !steps[j].wait; j++) { if (steps[j].move) live.route.push(steps[j].move); if (j >= 4 && i <= 4) break; }
  }

  // ---------- then and now
  let time = 'now';
  const nowOnly = [chair2, robot, dock, lidar, swing, board, train, shelfItems.arms, shelfItems.humanoid, shelfItems.remote];
  function applyTime() {
    const now = time === 'now';
    nowOnly.forEach((o) => { o.visible = now; });
    stickies.visible = !now;
    sheet.visible = now;
    frames.then.visible = !now; frames.now.visible = now;
    boardPic.redraw(now ? drawBoard : blankBoard);
    chairHit.userData.off = !now; monHit.userData.off = !now; boardHit.userData.off = !now; gearsHit.userData.off = !now;
  }
  applyTime();

  // ---------- the time of day
  const offset = (data.clock && data.clock.offsetHours) || 0;
  let walls = 'light';
  let override = null, drawnView = -1, drawnMinute = -1, lampK = 0, lampOn = true;
  function hoursNow() {
    if (override !== null) return override;
    const d = new Date();
    return (d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600 + offset + 24) % 24;
  }
  function applyDay() {
    const h = hoursNow(), look = lookAt(h);
    hoursIn = figureOn && h >= 10 && h < 18; // his hours, every day, IST
    // the clock jumped (a link with ?t=, the preview's slider): he is simply where he would be by then;
    // he only walks in or out when the real time passes 10 or 6
    if (lastDayH !== null && Math.abs(h - lastDayH) > 0.1) clockJumped = true;
    lastDayH = h;
    scene.background.set(look.room); scene.fog.color.set(look.room);
    hemi.intensity = look.amb;
    // a light wall is only as bright as the day: by night it goes to a soft grey, not a lit white
    M.wall.color.set(WALLS[walls]).multiplyScalar(walls === 'light' ? 0.5 + 0.5 * clamp01(look.sun / 1.2) : 1);
    sun.intensity = look.sun * 16; sun.color.set(look.sunCol);
    lampK = lampOn ? Math.max(look.lamp, 0.55) : 0; // on unless switched off; a little gentler in daylight
    lampLight.intensity = 15 * lampK;
    bulb.material.color.set(lampOn ? 0xfff1c9 : 0x4a463e);
    pool.material.opacity = 0.1 * lampK;
    fill.intensity = 4 + 4 * look.lamp;
    if (Math.abs(h - drawnView) > 0.04) { drawView(look); drawnView = h; }
    const minute = Math.floor(h * 60);
    if (minute !== drawnMinute) { drawClock(h); drawnMinute = minute; }
  }
  applyDay();

  // ---------- camera and pointer
  const state = { view: 'room', hover: null, shown: 0, shownTarget: 0, near: 0, leaf: 0 };
  let zoom = ZOOM.start;
  const roomPos = (p, l, z = zoom) => l.clone().add(p.clone().sub(l).multiplyScalar(z));
  const camPos = roomPos(...VIEWS.room), camLook = VIEWS.room[1].clone();
  let narrow = false, snap = true, W = 1, H = 1;
  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    renderer.setSize(W, H, false);
    narrow = W < 860 || W / H < 1.05;
    camera.fov = narrow ? 62 : 40;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }
  resize();
  if (narrow) zoom = ZOOM.far; // a phone starts with the whole room in view
  window.addEventListener('resize', resize);

  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  // what is under a point of the view (x and y from -1 to 1, up is +y)
  function pickNdc(x, y) {
    ptr.set(x, y);
    ray.setFromCamera(ptr, camera);
    const h = ray.intersectObjects(hits, true).find((x) => !x.object.userData.off && (time === 'now' || !x.object.userData.id.startsWith('shelf:') || x.object.userData.id === 'shelf:wheels'));
    return h ? h.object.userData.id : null;
  }
  function pickAt(ev) {
    const r = canvas.getBoundingClientRect();
    return pickNdc(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  }
  // A map of what is under each part of the view, as a grid of cols × rows, for the still picture
  // (scripts/stills.mjs). Each row is a list of runs: [which id (0 is nothing), how many cells].
  function spotMap(cols, rows) {
    camera.updateMatrixWorld();
    const ids = [null], runs = [];
    for (let j = 0; j < rows; j++) {
      const row = [];
      for (let i = 0; i < cols; i++) {
        const id = pickNdc(((i + 0.5) / cols) * 2 - 1, 1 - ((j + 0.5) / rows) * 2);
        let n = ids.indexOf(id);
        if (n < 0) n = ids.push(id) - 1;
        if (row.length && row[row.length - 2] === n) row[row.length - 1]++;
        else row.push(n, 1);
      }
      runs.push(row);
    }
    return { cols, rows, ids, runs };
  }
  let lastMove = 0;
  canvas.addEventListener('pointermove', (ev) => {
    const t = performance.now();
    if (t - lastMove < 40) return;
    lastMove = t;
    const id = pickAt(ev);
    if (id !== state.hover) { state.hover = id; canvas.style.cursor = id === 'clock' ? 'grab' : id ? 'pointer' : ''; }
    if (onHover) onHover(id, ev.clientX, ev.clientY);
  });
  canvas.addEventListener('pointerleave', () => { state.hover = null; canvas.style.cursor = ''; if (onHover) onHover(null); });
  canvas.addEventListener('click', (ev) => { if (performance.now() - clockEnded < 80) return; const id = pickAt(ev); if (id && id !== 'clock' && onPick) onPick(id); });

  // Setting the clock: press on it and drag round its face, and the hour hand goes round with the
  // pointer (one turn is twelve hours, so twice round is the whole day). A click without a drag
  // puts it back to the real time.
  let clockDrag = null, clockEnded = 0;
  const clockPt = V();
  function clockAngle(ev) {
    const r = canvas.getBoundingClientRect();
    clockPt.copy(CLOCK).project(camera);
    return Math.atan2(ev.clientY - (r.top + ((1 - clockPt.y) / 2) * r.height), ev.clientX - (r.left + ((clockPt.x + 1) / 2) * r.width));
  }
  canvas.addEventListener('pointerdown', (ev) => {
    if (state.view !== 'room' || !ev.isPrimary || pickAt(ev) !== 'clock') return;
    clockDrag = { id: ev.pointerId, a: clockAngle(ev), h: hoursNow(), far: 0, x: ev.clientX, y: ev.clientY };
    try { canvas.setPointerCapture(ev.pointerId); } catch { /* not every pointer can be captured */ }
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!clockDrag || ev.pointerId !== clockDrag.id) return;
    clockDrag.far = Math.max(clockDrag.far, Math.hypot(ev.clientX - clockDrag.x, ev.clientY - clockDrag.y));
    if (clockDrag.far < 5) return;
    canvas.style.cursor = 'grabbing';
    const a = clockAngle(ev);
    let d = a - clockDrag.a; d = Math.atan2(Math.sin(d), Math.cos(d));
    clockDrag.a = a;
    clockDrag.h = (((clockDrag.h + (d / (Math.PI * 2)) * 12) % 24) + 24) % 24;
    if (onClock) onClock(clockDrag.h);
  });
  for (const type of ['pointerup', 'pointercancel']) canvas.addEventListener(type, (ev) => {
    if (!clockDrag || ev.pointerId !== clockDrag.id) return;
    const click = type === 'pointerup' && clockDrag.far < 5;
    clockDrag = null; clockEnded = performance.now(); canvas.style.cursor = '';
    if (click && onClock) onClock(null);
  });

  // The view shifts a very little with the mouse, like leaning your head. Only in the whole-room
  // view, only with a mouse, and not for anyone who has asked for less motion.
  const LEAN = { x: 0.22, y: 0.1 };
  const lean = { x: 0, y: 0, tx: 0, ty: 0 };
  const side = V(), upv = V();
  function onLean(ev) {
    if (ev.pointerType !== 'mouse' || !W || !H) return;
    lean.tx = Math.max(-1, Math.min(1, (ev.clientX / W) * 2 - 1));
    lean.ty = Math.max(-1, Math.min(1, 1 - (ev.clientY / H) * 2));
  }
  const noLean = () => { lean.tx = 0; lean.ty = 0; };
  window.addEventListener('pointermove', onLean);
  document.documentElement.addEventListener('pointerleave', noLean);

  // Scroll to step a little nearer or further back. Only while looking at the whole room:
  // at the monitor, the board or the notebook the camera has its own place to stand.
  function setZoom(z) {
    const next = Math.min(ZOOM.far, Math.max(ZOOM.near, z));
    if (next === zoom) return;
    zoom = next;
    if (onZoom) onZoom(zoom);
  }
  canvas.addEventListener('wheel', (ev) => {
    if (state.view !== 'room') return;
    ev.preventDefault();
    const px = ev.deltaMode === 1 ? ev.deltaY * 32 : ev.deltaMode === 2 ? ev.deltaY * H : ev.deltaY;
    setZoom(zoom + Math.max(-240, Math.min(240, px)) * (ev.ctrlKey ? 0.004 : 0.0007)); // ctrl: a pinch on a trackpad
  }, { passive: false });
  // two fingers on a touch screen
  const touches = new Map();
  let pinch = 0;
  const spread = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  canvas.addEventListener('pointerdown', (ev) => { if (ev.pointerType !== 'touch') return; touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); if (touches.size === 2) pinch = spread(); });
  canvas.addEventListener('pointermove', (ev) => {
    if (!touches.has(ev.pointerId)) return;
    touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (touches.size !== 2 || state.view !== 'room' || !pinch) return;
    const d = spread();
    setZoom(zoom * (pinch / Math.max(d, 1)));
    pinch = d;
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) canvas.addEventListener(type, (ev) => { touches.delete(ev.pointerId); pinch = 0; });

  // Sitting at the second monitor: straight in front of where it ends up once it has been pushed
  // over, and close enough that its glass nearly fills the view. The page is then drawn on that
  // glass itself (see screenQuad), so it is the monitor you are looking at, not a box over it.
  const SWING_TO = -0.5, SWING_REST = 0.12;
  const monCentre = V(-1.05, 0.79, -0.38).add(V(0.42, 0.42, 0.141).applyAxisAngle(V(0, 1, 0), SWING_TO));
  const monNormal = V(0, 0, 1).applyAxisAngle(V(0, 1, 0), SWING_TO);
  const fitDist = () => { const vis = 2 * Math.tan((camera.fov * Math.PI) / 360); return Math.max(SH / (0.8 * vis), SW / (0.9 * vis * (W / H))); };
  const monitorView = () => [monCentre.clone().addScaledVector(monNormal, fitDist()), monCentre];
  const corner = V(0, 0, 0);
  // the four corners of the glass, in page pixels: top-left, top-right, bottom-right, bottom-left
  function screenQuad() {
    const out = [];
    for (const [x, y] of [[-SW / 2, SH / 2], [SW / 2, SH / 2], [SW / 2, -SH / 2], [-SW / 2, -SH / 2]]) {
      corner.set(x, y, 0);
      screenPlane.localToWorld(corner).project(camera);
      if (corner.z > 1) return null; // behind the camera
      out.push([(corner.x * 0.5 + 0.5) * W, (-corner.y * 0.5 + 0.5) * H]);
    }
    return out;
  }

  // The whiteboard works the same way: the camera stands square in front of it, near enough that
  // the board nearly fills the view, and its page is fitted to the board's four corners.
  const BW = 2.26, BH = 1.36, boardCentre = V(-2.75, 1.85, -3.345);
  const boardDist = () => { const vis = 2 * Math.tan((camera.fov * Math.PI) / 360); return Math.max(BH / (0.78 * vis), BW / (0.84 * vis * (W / H))); };
  const boardView = () => [boardCentre.clone().add(V(0, 0, boardDist())), boardCentre];
  function boardQuad() {
    const out = [];
    for (const [x, y] of [[-BW / 2, BH / 2], [BW / 2, BH / 2], [BW / 2, -BH / 2], [-BW / 2, -BH / 2]]) {
      corner.set(boardCentre.x + x, boardCentre.y + y, boardCentre.z).project(camera);
      if (corner.z > 1) return null;
      out.push([(corner.x * 0.5 + 0.5) * W, (-corner.y * 0.5 + 0.5) * H]);
    }
    return out;
  }
  // The notebook too: the camera leans over the desk, almost straight down, and the pages are
  // fitted to the corners of the open notebook. It stays slightly tilted, as a book on a desk is.
  const NB_TILT = 0.2;
  const nbDist = () => { const vis = 2 * Math.tan((camera.fov * Math.PI) / 360); return Math.max(NBH / (0.7 * vis), NBW / (0.8 * vis * (W / H))); };
  const nbView = () => [nbCentre.clone().add(V(0, Math.cos(NB_TILT) * nbDist(), Math.sin(NB_TILT) * nbDist())), nbCentre];
  function nbQuad() {
    const out = [];
    for (const [x, z] of [[-NBW / 2, -NBH / 2], [NBW / 2, -NBH / 2], [NBW / 2, NBH / 2], [-NBW / 2, NBH / 2]]) {
      corner.set(nbCentre.x + x, nbCentre.y, nbCentre.z + z).project(camera);
      if (corner.z > 1) return null;
      out.push([(corner.x * 0.5 + 0.5) * W, (-corner.y * 0.5 + 0.5) * H]);
    }
    return out;
  }
  const nbApproach = () => smooth(clamp01(1 - camPos.distanceTo(nbView()[0]) / 5));
  // 0 while the camera is far away, 1 once it is in front of the board
  const boardApproach = () => smooth(clamp01(1 - camPos.distanceTo(boardView()[0]) / 6));

  const OUTSIDE_NARROW = [V(-1.9, 2.1, 0.6), VIEWS.outside[1]]; // a phone has to stand further back to see the whole pane
  const clock = new THREE.Clock();
  let mapT = 0;
  const fps = { n: 0, since: performance.now(), shown: 0 }; // frames the browser gives us each second (none while motion is reduced)
  let raf = 0, slow = 0, lowPower = true, skip = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!reduced) { fps.n++; const now = performance.now(); if (now - fps.since >= 1000) { fps.shown = Math.round((fps.n * 1000) / (now - fps.since)); fps.n = 0; fps.since = now; } }
    // Seated at the monitor, nearly all of the room is behind it and another 3D page is running
    // on its glass, so the room only needs a picture now and then. That saves most of its work.
    if (lowPower && state.view === 'monitor' && state.shown > 0.995 && (skip = (skip + 1) % 12) !== 0) {
      // ...unless the Live map tab is open: then the robot keeps its own pace, and its map is drawn,
      // but the room itself still is not
      if (mapCanvas) {
        const realDt = clock.getDelta();
        if (time === 'now' && !reduced) runRobot(Math.min(realDt, 0.05));
        mapT += realDt;
        if (mapT > 0.09 && time === 'now') { mapT = 0; drawIdle(); }
      }
      return;
    }
    const realDt = clock.getDelta(), dt = Math.min(realDt, 0.05), t = reduced ? 2 : clock.elapsedTime;
    const k = reduced || snap ? 1 : 1 - Math.exp(-Math.min(realDt, 0.2) * 3.5);
    if (time === 'now' && !reduced) runRobot(dt);
    else if (time === 'now') { robot.position.set(HOME[0], 0, HOME[1]); pose(POSE.stow, POSE.stow, 0); lidarGeo.setDrawRange(0, 0); live.x = HOME[0]; live.z = HOME[1]; live.heading = 0; live.task = 'charging'; live.scanN = 0; live.route = []; }
    // a few times a second: the screens, and the time of day
    slow += realDt;
    if (slow > 0.22 || snap) { slow = 0; drawCode(t); applyDay(); }
    mapT += realDt;
    if ((mapT > 0.09 || snap) && time === 'now') { mapT = 0; drawIdle(); }
    // the small robots on the shelf each move a little
    armParts.a.rotation.z = Math.sin(t * 0.9) * 0.5; armParts.b.rotation.z = -0.6 + Math.sin(t * 1.3) * 0.6;
    rover.rotation.y = Math.sin(t * 0.6) * 0.7;
    humanoidArm.rotation.z = -(0.6 + 0.6 * Math.sin(t * 1.1));
    headset.position.y = SY + 0.055 + Math.sin(t * 1.4) * 0.025;
    amberEdge.opacity = 0.55 + 0.35 * Math.sin(t * 2);
    // the notebook: a page lifts a little as the pointer comes near, and lies flat while it is being read
    state.leaf += ((state.hover === 'notebook' && state.view !== 'notebook' ? 1 : 0) - state.leaf) * k;
    leaf.rotation.z = 0.5 * smooth(clamp01(state.leaf)) + (state.view === 'notebook' ? 0 : 0.03 * Math.sin(t * 1.3));
    leaf.visible = time === 'now';
    // the gears: slowly while they are being looked at, a little faster under the pointer, fast for a while after a click
    const nowMs = performance.now();
    if (!reduced) {
      const want = nowMs < small.spinUntil ? 3.2 : state.hover === 'gears' ? 1.3 : state.view === 'bits' ? 0.45 : 0;
      const gdt = Math.min(realDt, 0.25); // by the clock, not by the frame, so a slow machine sees the same speed
      small.spin += (want - small.spin) * Math.min(1, gdt * 2.5);
      if (small.spin > 0.002) { small.angle += small.spin * gdt; turnGears(small.angle); }
      const turned = small.angle.toFixed(1); if (canvas.dataset.gears !== turned) canvas.dataset.gears = turned; // so a test can see them turn
    }
    // the board: one light blinks all the time; a click runs the row there and back
    const run = small.patternFrom < 0 ? -1 : (nowMs - small.patternFrom) / 1000;
    if (run > 2.8) small.patternFrom = -1;
    leds.forEach((m, i) => {
      let on = i === 0 && (reduced || Math.sin(t * 3.2) > -0.2);
      if (run >= 0 && run <= 2.8) { const p = (run * 5) % 8, at = p < 4 ? p : 8 - p; on = reduced ? true : Math.abs(at - i) < 0.6; }
      m.material.color.set(on ? LED_ON[i] : LED_OFF);
    });
    // the drawers: a little way out under the pointer, all the way for a moment after a click
    for (const d of drawerList) {
      if (taking.drawer === d) d.until = nowMs + 500; // stays out while its sheet is being taken
      d.k += ((performance.now() < d.until ? 1 : state.hover === d.hitId && state.view === 'room' ? 0.3 : 0) - d.k) * k;
      d.g.position.z = PED.z1 + 0.34 * smooth(clamp01(d.k));
    }
    // the second chair: a small turn as the pointer comes near, the full move only on a click
    state.near += ((state.hover === 'chair' || state.hover === 'monitor' ? 1 : 0) - state.near) * k;
    state.shown += (state.shownTarget - state.shown) * k;
    const sh = smooth(clamp01(state.shown));
    chair2.userData.seat.rotation.y = 0.32 * state.near * (1 - sh);
    updateHim(realDt, t, robot.position, state.shownTarget > 0.5);
    chair2.position.set(C2.x - 0.04 * sh, 0, C2.z - 0.12 * sh);
    // the second monitor is pushed towards whoever sat down
    swing.rotation.y = SWING_REST + (SWING_TO - SWING_REST) * sh;

    const [p, l] = narrow && state.view === 'outside' ? OUTSIDE_NARROW : !narrow && state.view === 'monitor' ? monitorView() : !narrow && state.view === 'whiteboard' ? boardView() : !narrow && state.view === 'notebook' ? nbView() : VIEWS[state.view] || VIEWS.room;
    const wide = state.view === 'room';
    camPos.lerp(wide ? roomPos(narrow ? V(p.x, p.y + 0.9, p.z * 1.6) : p, l) : p, k);
    camLook.lerp(l, k);
    snap = false;
    camera.position.copy(camPos);
    const leaning = wide && !reduced && !narrow;
    lean.x += ((leaning ? lean.tx : 0) - lean.x) * k;
    lean.y += ((leaning ? lean.ty : 0) - lean.y) * k;
    if (Math.abs(lean.x) > 1e-4 || Math.abs(lean.y) > 1e-4) {
      camera.lookAt(camLook);
      side.set(1, 0, 0).applyQuaternion(camera.quaternion); upv.set(0, 1, 0).applyQuaternion(camera.quaternion);
      camera.position.addScaledVector(side, lean.x * LEAN.x).addScaledVector(upv, lean.y * LEAN.y);
    }
    const leanNow = lean.x.toFixed(2) + ',' + lean.y.toFixed(2);
    if (canvas.dataset.lean !== leanNow) canvas.dataset.lean = leanNow;
    camera.lookAt(camLook);
    if (taking.drawer) {
      // the sheet: lying in the drawer, then lifted out and stood up, then brought up to the eye until it fills the view
      const tt = (performance.now() - taking.from) / 1000;
      const up = smooth(clamp01((tt - 0.55) / 0.65)), near = smooth(clamp01((tt - 1.15) / 0.6));
      taking.drawer.g.getWorldPosition(shA); shA.y += 0.03; shA.z -= 0.2;
      shB.copy(shA); shB.y += 0.44 * up; shB.z += 0.06 * up;
      camera.updateMatrixWorld();
      camera.getWorldDirection(shC).multiplyScalar(0.42).add(camera.position);
      sheetOut.position.lerpVectors(shB, shC, near);
      sheetOut.quaternion.copy(Q_FLAT).slerp(Q_UP, up).slerp(camera.quaternion, near);
      sheetOut.scale.setScalar(1 + 1.9 * near);
      sheetOut.visible = tt > 0.4;
    }
    renderer.render(scene, camera);
  }
  frame();

  return {
    focus(view) { state.view = VIEWS[view] ? view : 'room'; state.shownTarget = view === 'monitor' ? 1 : 0; },
    setTime(v) { time = v === 'then' ? 'then' : 'now'; applyTime(); },
    setBusy(b) { busy = b; },
    setHours(h) { override = h === null || Number.isNaN(h) ? null : ((h % 24) + 24) % 24; drawnView = -1; drawnMinute = -1; applyDay(); },
    hours: hoursNow,
    toggleLamp() { lampOn = !lampOn; applyDay(); return lampOn; },
    lampOn: () => lampOn,
    screenQuad,
    // how big the glass will be, in page pixels, once the camera has arrived
    screenSize() { const s = H / (2 * Math.tan((camera.fov * Math.PI) / 360) * fitDist()); return [Math.round(SW * s), Math.round(SH * s)]; },
    boardQuad,
    boardSize() { const s = H / (2 * Math.tan((camera.fov * Math.PI) / 360) * boardDist()); return [Math.round(BW * s), Math.round(BH * s)]; },
    boardApproach,
    nbQuad, nbApproach,
    nbAspect: NBW / NBH,
    shown: () => state.shown,
    setLowPower(v) { lowPower = !!v; },
    // the monitor's Live map tab: a canvas to draw the robot's map on, or null when the tab is closed
    setMapCanvas(cv) { mapCanvas = cv || null; if (mapCanvas) drawIdle(); },
    setWalls(v) { walls = v === 'dark' ? 'dark' : 'light'; applyDay(); return walls; },
    walls: () => walls,
    setPlace,
    // preview only: put the robot at a moment of its round, facing the way it would be by then
    setRobotTime(sec) {
      robotT = ((sec % total) + total) % total;
      for (const x of steps) { if (x.t0 > robotT) break; if (x.move) heading = x.face !== undefined ? x.face : Math.atan2(-(x.move[1] - x.from[1]), x.move[0] - x.from[0]); }
    },
    kick(id) { if (id === 'gears') small.spinUntil = performance.now() + 2600; else if (id === 'board') small.patternFrom = performance.now(); },
    // A drawer whose label leads to another page: the camera comes in over it, it opens, and a sheet
    // comes out and up to fill the view. The page it stands for takes over from there (desk-main.js).
    takeSheet(id) {
      const d = drawerList.find((x) => x.id === id);
      if (!d) return 0;
      drawSheet(d.label);
      taking.drawer = d; taking.from = performance.now();
      state.view = 'drawer'; state.shownTarget = 0;
      return 1750; // how long it takes, in milliseconds
    },
    putSheetBack() { taking.drawer = null; sheetOut.visible = false; },
    pullDrawer(id) { const d = drawerList.find((x) => x.id === id); if (d) d.until = performance.now() + 1600; },
    flat: () => narrow,
    // him, for checks only: what he is doing, and a way to start a coffee or a pose now
    figure: figureOn ? {
      state: () => ({ mode: fig.mode, visible: him.visible, x: +fig.x.toFixed(2), z: +fig.z.toFixed(2), sit: +fig.sit.toFixed(2), pose: fig.pose, mug: fig.mug, host: +fig.host.toFixed(2) }),
      coffee() { fig.nextCoffee = 0; },
      pose(name) { if (fig.mode === 'desk' && POSES[name]) { fig.pose = name; fig.poseT = 0; fig.poseLen = POSES[name]; } },
    } : null,
    spotMap,
    jump() { snap = true; },
    zoom: () => zoom,
    setZoom,
    dispose() { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('pointermove', onLean); document.documentElement.removeEventListener('pointerleave', noLean); renderer.dispose(); },
  };
}
