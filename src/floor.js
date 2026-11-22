// The workshop floor: one 3D scene, drawn from simple shapes, no model files.
// The page scrolls as normal HTML on top; this only moves the camera and runs the robots.
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

// Where each station stands on the floor: [x, z].
export const STATIONS = {
  cell: [0, 0],
  arms: [15, -1],
  wheels: [32, 1],
  remote: [49, -1],
  eyes: [62, 0],
  people: [75, 1],
  humanoid: [89, -1],
};

const C = {
  bg: 0x070a0f,
  floor: 0x0f141b,
  dark: 0x232c38,
  mid: 0x3a4656,
  shell: 0xdfe5ec,
  joint: 0x2f7fd0,
  amber: 0xffb454,
  cyan: 0x62d5ff,
  green: 0x4ade80,
  red: 0xe5533d,
  person: 0x86a9b8,
};

export function createFloor(canvas, { onPick, onHover, reduced = false, order: pageOrder = null, pickable = null, intro = true, maxPixelRatio = 1.5 }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio)); // sharper costs a lot on modest graphics
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.bg);
  scene.fog = new THREE.FogExp2(C.bg, 0.008);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);

  // ---------- materials (shared)
  const M = {
    floor: new THREE.MeshStandardMaterial({ color: C.floor, roughness: 0.92, metalness: 0.05 }),
    dark: new THREE.MeshStandardMaterial({ color: C.dark, roughness: 0.65, metalness: 0.35 }),
    mid: new THREE.MeshStandardMaterial({ color: C.mid, roughness: 0.6, metalness: 0.3 }),
    shell: new THREE.MeshStandardMaterial({ color: C.shell, roughness: 0.45, metalness: 0.1 }),
    joint: new THREE.MeshStandardMaterial({ color: C.joint, roughness: 0.4, metalness: 0.3 }),
    red: new THREE.MeshStandardMaterial({ color: C.red, roughness: 0.5, metalness: 0.1 }),
    person: new THREE.MeshStandardMaterial({ color: C.person, roughness: 0.8, metalness: 0 }),
    screen: new THREE.MeshBasicMaterial({ color: 0x0c1722 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.45 }),
    glowAmber: new THREE.MeshBasicMaterial({ color: C.amber }),
    glowCyan: new THREE.MeshBasicMaterial({ color: C.cyan }),
    glowGreen: new THREE.MeshBasicMaterial({ color: C.green }),
    glowRed: new THREE.MeshBasicMaterial({ color: C.red }),
  };
  // Thin light lines on every edge give the "technical drawing" look.
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x8fdcff, transparent: true, opacity: 0.22 });

  function withEdges(mesh, mat = edgeMat) {
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 28), mat);
    mesh.add(e);
    return mesh;
  }
  function box(w, h, d, mat = M.dark, edges = true, em = edgeMat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    return edges ? withEdges(m, em) : m;
  }
  function cyl(rt, rb, h, mat = M.dark, edges = true, seg = 28) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    return edges ? withEdges(m) : m;
  }
  function at(obj, x, y, z) { obj.position.set(x, y, z); return obj; }
  function line(points, color, opacity = 0.5) {
    const g = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  }
  // A link lying along local +X, starting at the origin.
  function link(len, r, mat) {
    const g = new THREE.CylinderGeometry(r, r, len, 20);
    g.rotateZ(-Math.PI / 2);
    g.translate(len / 2, 0, 0);
    return withEdges(new THREE.Mesh(g, mat));
  }
  function cap(r, w, mat) {
    const g = new THREE.CylinderGeometry(r, r, w, 24);
    g.rotateX(Math.PI / 2);
    return withEdges(new THREE.Mesh(g, mat));
  }

  // ---------- the room
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(320, 120), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(60, 0, 0);
  scene.add(floor);
  const grid = new THREE.GridHelper(320, 160, 0x1c2632, 0x141b24);
  grid.position.set(60, 0.01, 0);
  scene.add(grid);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(320, 14), new THREE.MeshStandardMaterial({ color: 0x0c1016, roughness: 1 }));
  wall.position.set(60, 7, -13);
  scene.add(wall);
  scene.add(at(box(320, 0.06, 0.06, M.glowCyan, false), 60, 5.2, -12.9));
  // The painted walkway along the front of the floor.
  for (let x = -24; x < 150; x += 3) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.12), new THREE.MeshBasicMaterial({ color: C.amber, transparent: true, opacity: 0.5 }));
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(x, 0.02, 6.2);
    scene.add(dash);
  }

  scene.add(new THREE.HemisphereLight(0xa9c0e6, 0x0a0d12, 0.75));
  const key = new THREE.DirectionalLight(0xbfd4ff, 0.35);
  key.position.set(-20, 30, 25);
  scene.add(key);

  // ---------- parts
  const L1 = 1.45, L2 = 1.25, L3 = 0.45, SHOULDER_Y = 0.85;
  function makeArm(shell = M.shell) {
    const root = new THREE.Group();
    root.add(at(cyl(0.42, 0.5, 0.3, M.dark), 0, 0.15, 0));
    const yaw = new THREE.Group();
    root.add(yaw);
    yaw.add(at(cyl(0.27, 0.32, 0.55, shell), 0, 0.57, 0));
    const shoulder = new THREE.Group();
    shoulder.position.y = SHOULDER_Y;
    yaw.add(shoulder);
    shoulder.add(cap(0.26, 0.62, M.joint));
    shoulder.add(link(L1, 0.15, shell));
    const elbow = new THREE.Group();
    elbow.position.x = L1;
    shoulder.add(elbow);
    elbow.add(cap(0.21, 0.5, M.joint));
    elbow.add(link(L2, 0.12, shell));
    const wrist = new THREE.Group();
    wrist.position.x = L2;
    elbow.add(wrist);
    wrist.add(cap(0.15, 0.36, M.joint));
    wrist.add(link(L3 - 0.12, 0.09, shell));
    const hand = new THREE.Group();
    hand.position.x = L3 - 0.12;
    wrist.add(hand);
    hand.add(at(box(0.08, 0.3, 0.16, M.dark), 0.04, 0, 0));
    const fingers = [1, -1].map((side) => {
      const f = at(box(0.2, 0.04, 0.1, M.dark), 0.16, 0.11 * side, 0);
      f.userData.side = side;
      hand.add(f);
      return f;
    });
    // 0 = open, 1 = closed on something about 6 cm across (the pen)
    const grip = (k) => { for (const f of fingers) f.position.y = f.userData.side * (0.11 - 0.06 * k); };
    const tip = new THREE.Object3D();
    tip.position.x = 0.2;
    hand.add(tip);
    const led = at(new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), M.glowGreen), 0, 0.33, 0.3);
    root.add(led);
    // Point the gripper at a target given in the arm's own coordinates.
    function reach(t) {
      yaw.rotation.y = Math.atan2(-t.z, t.x);
      const r = Math.hypot(t.x, t.z);
      const y = t.y + L3 + 0.08 - SHOULDER_Y;
      const d = Math.min(Math.max(Math.hypot(r, y), 0.35), L1 + L2 - 0.02);
      const a1 = Math.atan2(y, r) + Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
      const g = Math.acos((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2));
      const a2 = -(Math.PI - g);
      shoulder.rotation.z = a1;
      elbow.rotation.z = a2;
      wrist.rotation.z = -Math.PI / 2 - a1 - a2;
    }
    const REST = V(0.9, 0.35, 0);
    return { root, reach, grip, tip, hand, REST };
  }

  function makeFace(w, h) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.screen));
    const eye = new THREE.CircleGeometry(h * 0.13, 16);
    const l = new THREE.Mesh(eye, M.glowCyan), r = new THREE.Mesh(eye, M.glowCyan);
    l.position.set(-w * 0.2, h * 0.08, 0.005);
    r.position.set(w * 0.2, h * 0.08, 0.005);
    g.add(l, r);
    g.userData.eyes = [l, r];
    return g;
  }

  // A small companion robot on wheels, drawn after Mini Mitra. Faces local +X.
  function makeRover({ lidar = true } = {}) {
    const root = new THREE.Group();
    root.add(at(cyl(0.44, 0.5, 0.3, M.dark), 0, 0.17, 0));
    root.add(at(cyl(0.26, 0.42, 0.78, M.shell), 0, 0.71, 0));
    root.add(at(cyl(0.1, 0.12, 0.14, M.dark), 0, 1.17, 0));
    const head = new THREE.Group();
    head.position.y = 1.45;
    head.add(box(0.2, 0.44, 0.62, M.shell));
    const face = makeFace(0.52, 0.34);
    face.rotation.y = Math.PI / 2;
    face.position.x = 0.105;
    head.add(face);
    root.add(head);
    root.add(at(cyl(0.09, 0.09, 0.07, M.joint), 0.36, 0.36, 0));
    let fan = null;
    if (lidar) {
      fan = new THREE.Mesh(
        new THREE.CircleGeometry(2.8, 48, -Math.PI * 0.75, Math.PI * 1.5),
        new THREE.MeshBasicMaterial({ color: 0x1fb6ff, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
      );
      fan.rotation.x = -Math.PI / 2;
      fan.position.y = 0.03;
      root.add(fan);
      const sweep = line([V(0, 0.04, 0), V(2.8, 0.04, 0)], C.cyan, 0.9);
      root.add(sweep);
      root.userData.sweep = sweep;
    }
    return { root, head, fan };
  }

  function makePerson() {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.85, 6, 16), M.person), 0, 0.95, 0));
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 16), M.person), 0, 1.82, 0));
    return g;
  }

  // ---------- stations
  const stations = []; // { id, group, light, cone, ring, hit, update(t, wake) }
  const hits = [];

  function station(id, build) {
    const [x, z] = STATIONS[id];
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    scene.add(group);
    const light = new THREE.PointLight(0xfff1dc, 0, 34, 1.0);
    light.position.set(0.5, 6.5, 2.5);
    group.add(light);
    group.add(at(cyl(0.5, 0.5, 0.08, M.glowAmber, false), 0.5, 7.4, 0.5));
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(5.2, 7.4, 40, 1, true),
      new THREE.MeshBasicMaterial({ color: C.amber, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    cone.position.set(0.5, 3.7, 0.5);
    group.add(cone);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(4.6, 4.7, 96),
      new THREE.MeshBasicMaterial({ color: C.amber, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring);
    const s = { id, group, light, cone, ring, wake: 0, hover: 0 };
    const size = build(group, s) || [7, 4, 6];
    const hit = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(0, size[1] / 2, 0);
    hit.userData.id = id;
    group.add(hit);
    hits.push(hit);
    stations.push(s);
    return s;
  }

  // Move through a list of points, pausing at each, lifting between them.
  function tour(points, t, dwell, travel, lift = 0.7) {
    const step = dwell + travel;
    const n = points.length;
    const k = Math.floor(t / step) % n;
    const u = (t % step) - dwell;
    const a = points[k], b = points[(k + 1) % n];
    if (u <= 0) return { p: a.clone(), k, moving: false };
    const s = smooth(u / travel);
    const p = a.clone().lerp(b, s);
    p.y += Math.sin(Math.PI * s) * lift;
    return { p, k, moving: true };
  }

  // 1. The cell: an arm inside a ring of lab devices, all wired to one controller.
  station('cell', (g, s) => {
    g.add(at(box(1.2, 0.5, 1.2, M.mid), 0, 0.25, 0));
    const arm = makeArm();
    arm.root.position.y = 0.5;
    g.add(arm.root);
    const beaker = cyl(0.11, 0.09, 0.24, M.glass, false, 20);
    beaker.rotation.z = Math.PI / 2;
    beaker.position.x = 0.02;
    arm.tip.add(beaker);
    const ctrl = at(box(0.8, 1.5, 0.6, M.mid), 4.1, 0.75, 2.6);
    g.add(ctrl);
    g.add(at(box(0.5, 0.06, 0.02, M.glowCyan, false), 4.1, 1.2, 2.91));
    g.add(at(box(0.5, 0.06, 0.02, M.glowGreen, false), 4.1, 1.05, 2.91));
    const R = 2.75, N = 9;
    const stops = [], pulses = [];
    for (let i = 0; i < N; i++) {
      const th = Math.PI * (-0.12 + (1.24 * i) / (N - 1));
      const px = R * Math.cos(th), pz = -R * Math.sin(th);
      const d = new THREE.Group();
      d.position.set(px, 0, pz);
      d.rotation.y = th + Math.PI / 2;
      d.add(at(box(1.0, 0.7, 0.8, M.dark), 0, 0.35, 0));
      const kind = i % 6;
      if (kind === 0) { d.add(at(box(0.6, 0.14, 0.5, M.shell), 0, 0.77, 0)); d.add(at(cyl(0.2, 0.2, 0.03, M.mid), 0, 0.86, 0)); }
      if (kind === 1) { d.add(at(box(0.5, 0.9, 0.3, M.shell), 0, 1.15, -0.2)); d.add(at(cyl(0.03, 0.03, 0.25, M.mid, false), 0, 0.95, 0.05)); }
      if (kind === 2) { d.add(at(cyl(0.24, 0.1, 0.6, M.shell), 0, 1.25, -0.15)); d.add(at(cyl(0.05, 0.05, 0.3, M.mid, false), 0, 0.85, -0.15)); }
      if (kind === 3) { d.add(at(box(0.8, 0.26, 0.36, M.shell), 0, 0.83, -0.15)); d.add(at(cyl(0.05, 0.05, 0.5, M.glass, false), 0, 1.0, -0.15).rotateZ(Math.PI / 2)); }
      if (kind === 4) {
        for (const sx of [-0.4, 0.4]) d.add(at(box(0.05, 0.9, 0.05, M.mid), sx, 1.15, -0.25));
        d.add(at(box(0.9, 0.06, 0.06, M.mid), 0, 1.6, -0.25));
        d.add(at(box(0.14, 0.3, 0.1, M.shell), 0.1, 1.42, -0.25));
      }
      if (kind === 5) { d.add(at(cyl(0.04, 0.04, 0.9, M.mid, false), -0.3, 1.15, -0.2)); d.add(at(cyl(0.13, 0.13, 0.36, M.shell), -0.05, 1.42, -0.2)); }
      const led = at(new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), M.glowGreen), 0.4, 0.74, 0.34);
      d.add(led);
      g.add(d);
      stops.push(V(2.2 * Math.cos(th), 0.62, -2.2 * Math.sin(th)));
      const a = V(px * 0.82, 0.03, pz * 0.82), b = V(4.1, 0.03, 2.6);
      const mid = V((a.x + b.x) / 2, 0.03, a.z);
      g.add(line([a, mid, b], C.cyan, 0.28));
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), M.glowCyan);
      g.add(dot);
      pulses.push({ dot, a, mid, b, off: i / N });
    }
    s.update = (t, wake) => {
      const { p } = tour(stops, t * 0.9, 1.0, 1.5, 0.75);
      arm.reach(arm.REST.clone().lerp(p, smooth(wake)));
      for (const q of pulses) {
        const u = (t * 0.35 + q.off) % 1;
        if (u < 0.5) q.dot.position.lerpVectors(q.a, q.mid, u * 2);
        else q.dot.position.lerpVectors(q.mid, q.b, (u - 0.5) * 2);
        q.dot.visible = wake > 0.5;
      }
    };
    return [8, 4, 7];
  });

  // 2. Arms: the arm moves through a graph of known-safe points, stops on a fault, then carries on.
  station('arms', (g, s) => {
    g.add(at(box(1.2, 0.5, 1.2, M.mid), 0, 0.25, 0));
    const arm = makeArm();
    arm.root.position.y = 0.5;
    g.add(arm.root);
    const nodes = [], layers = 3, per = 5;
    const dotGeo = new THREE.SphereGeometry(0.06, 12, 12);
    const segs = [];
    for (let l = 0; l < layers; l++) {
      for (let i = 0; i < per; i++) {
        const th = -1.15 + (2.3 * i) / (per - 1);
        const r = 2.0 - l * 0.12;
        const p = V(r * Math.cos(th), 0.55 + l * 0.6, r * Math.sin(th));
        nodes.push(p);
        g.add(at(new THREE.Mesh(dotGeo, M.glowCyan), p.x, p.y + 0.5, p.z));
        if (i > 0) segs.push(nodes[l * per + i - 1], p);
        if (l > 0) segs.push(nodes[(l - 1) * per + i], p);
      }
    }
    const up = V(0, 0.5, 0);
    const web = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(segs.map((p) => p.clone().add(up))),
      new THREE.LineBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.22 }),
    );
    g.add(web);
    const route = [0, 5, 6, 7, 12, 13, 8, 9, 4, 9, 8, 13, 12, 7, 6, 5].map((i) => nodes[i]);
    const routeLine = line(route.slice(0, 9).map((p) => p.clone().add(up)), C.amber, 0.95);
    g.add(routeLine);
    const fault = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 14), M.glowRed);
    fault.visible = false;
    g.add(fault);
    const STEP = 1.25, CYCLE = route.length * STEP, HOLD = 2.2;
    s.update = (t, wake) => {
      // Once per lap the arm faults at the fourth point, waits, and resumes from where it was.
      let u = t % (CYCLE + HOLD);
      const faultAt = 3 * STEP + 0.4;
      const holding = u > faultAt && u < faultAt + HOLD;
      if (u >= faultAt + HOLD) u -= HOLD; else if (holding) u = faultAt;
      const { p } = tour(route, u, 0.35, STEP - 0.35, 0.05);
      arm.reach(arm.REST.clone().lerp(p, smooth(wake)));
      fault.visible = holding && Math.floor(t * 5) % 2 === 0;
      if (holding) fault.position.copy(p).add(up);
    };
    return [6, 4.5, 6];
  });

  // 3. Wheels: a robot drives its loop with the lidar sweeping; others follow; one sits on the dock.
  station('wheels', (g, s) => {
    const RX = 5.2, RZ = 2.7;
    const loop = [];
    for (let i = 0; i <= 96; i++) { const a = (i / 96) * TAU; loop.push(V(RX * Math.cos(a), 0.02, RZ * Math.sin(a))); }
    g.add(line(loop, C.cyan, 0.35));
    const main = makeRover();
    g.add(main.root);
    const others = [];
    for (let i = 0; i < 5; i++) { const r = makeRover({ lidar: false }); r.root.scale.setScalar(0.92); g.add(r.root); others.push(r); }
    // the narrow passage: a pillar either side of the loop where it crosses x = RX, so the robot
    // drives between them (about 9 cm to spare each side), and the outer robots pass outside it
    for (const dx of [-0.85, 0.85]) g.add(at(box(0.45, 1.7, 0.45, M.mid), RX + dx, 0.85, 0));
    // the dock, with its marker, in the back corner outside both loops, so no robot drives through
    // it or the robot parked on it
    const DOCK = { x: -7.2, z: -4.4 };
    const dock = new THREE.Group();
    dock.position.set(DOCK.x, 0, DOCK.z);
    dock.add(at(box(0.9, 0.5, 0.5, M.mid), 0, 0.25, 0));
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), new THREE.MeshBasicMaterial({ color: 0xf2f4f7 }));
    tag.position.set(0, 0.8, 0.26);
    dock.add(tag);
    for (const [x, y] of [[-0.08, 0.08], [0.08, -0.08], [0.08, 0.08]]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0x0b0f14 }));
      b.position.set(x, 0.8 + y, 0.262);
      dock.add(b);
    }
    dock.add(at(box(0.04, 0.5, 0.04, M.mid, false), 0, 0.6, 0.24));
    g.add(dock);
    const parked = makeRover({ lidar: false });
    parked.root.position.set(DOCK.x, 0, DOCK.z + 0.9);
    parked.root.rotation.y = Math.PI / 2;
    g.add(parked.root);
    const charge = at(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), M.glowGreen), DOCK.x, 0.56, DOCK.z + 0.28);
    g.add(charge);
    function place(r, a, rx, rz) {
      r.root.position.set(rx * Math.cos(a), 0, rz * Math.sin(a));
      // heading along the direction of travel
      r.root.rotation.y = Math.atan2(-rz * Math.cos(a), -rx * Math.sin(a));
    }
    s.update = (t, wake) => {
      const a = t * 0.28 * wake + 0.6;
      place(main, a, RX, RZ);
      if (main.root.userData.sweep) main.root.userData.sweep.rotation.y = t * 5;
      others.forEach((r, i) => place(r, a * 0.8 + 1.1 + i * 1.02, RX + 1.9, RZ + 1.5));
      charge.visible = Math.floor(t * 1.5) % 2 === 0;
    };
    return [16, 3.2, 10];
  });

  // 4. Remote hands: a person in a VR headset picks up a pen that is not really there, and a robot
  // arm somewhere else picks up the real one, 100 ms later (the delay measured on RAVEN). Two floor
  // plates with bare floor between them are the two places; a wifi symbol over each is the link.
  station('remote', (g, s) => {
    const DELAY = 0.1; // seconds: the real figure, not slowed down
    // the two places
    g.add(at(box(2.2, 0.05, 2.4, M.dark), -2.7, 0.025, 0.4));
    g.add(at(box(3.6, 0.05, 2.4, M.dark), 1.9, 0.025, -0.4));

    // the robot's side: the arm on its base, a table, the real pen
    g.add(at(box(1.6, 0.7, 1.1, M.dark), 2.6, 0.35, -0.4));
    g.add(at(box(1.0, 0.5, 1.0, M.mid), 1.2, 0.25, -0.4));
    const arm = makeArm();
    arm.root.position.set(1.2, 0.5, -0.4);
    g.add(arm.root);
    const penMat = M.glowAmber.clone();
    penMat.transparent = true;
    const pen = cyl(0.03, 0.03, 0.5, penMat, false, 10);
    g.add(pen);

    // the person's side: standing, headset on, a controller in the near hand
    const P = V(-2.9, 0, 0.4);
    const person = makePerson();
    person.position.copy(P);
    g.add(person);
    const headset = new THREE.Group();
    headset.add(box(0.14, 0.13, 0.3, M.shell));
    headset.add(at(box(0.02, 0.08, 0.24, M.screen, false), 0.075, 0, 0));
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.02, 8, 28), M.dark);
    strap.rotation.x = Math.PI / 2;
    strap.position.x = -0.2;
    headset.add(strap);
    headset.position.set(P.x + 0.2, 1.85, P.z);
    g.add(headset);
    const limb = (len) => new THREE.Mesh(new THREE.CapsuleGeometry(0.06, len, 4, 10), M.person);
    const UP = V(0, 1, 0);
    const lay = (m, p, q) => { m.position.lerpVectors(p, q, 0.5); m.quaternion.setFromUnitVectors(UP, q.clone().sub(p).normalize()); };
    const still = limb(0.75); // the far arm, hanging
    lay(still, V(P.x, 1.42, P.z - 0.3), V(P.x + 0.05, 0.75, P.z - 0.33));
    g.add(still);
    const L = 0.45; // upper arm and forearm
    const upper = limb(L), fore = limb(L);
    g.add(upper, fore);
    const controller = box(0.08, 0.13, 0.08, M.dark);
    g.add(controller);
    const S = V(P.x + 0.02, 1.42, P.z + 0.3); // the near shoulder
    const POLE = V(-0.2, -1, 0.5).normalize(); // the elbow hangs down, back and out
    function reachHand(target) {
      const n = target.clone().sub(S);
      const d = Math.min(n.length(), 2 * L - 0.001);
      n.normalize();
      const hand = S.clone().addScaledVector(n, d);
      const out = POLE.clone().addScaledVector(n, -POLE.dot(n)).normalize();
      const elbow = S.clone().addScaledVector(n, d / 2).addScaledVector(out, Math.sqrt(Math.max(L * L - (d / 2) * (d / 2), 0)));
      lay(upper, S, elbow);
      lay(fore, elbow, hand);
      controller.position.copy(hand);
      controller.quaternion.copy(fore.quaternion);
    }

    // what the person sees: a see-through copy of the robot's table and pen, at a smaller scale
    const K = 0.45, C0 = V(1.4, 0.2, 0), G0 = V(P.x + 0.65, 1.05, P.z);
    const toView = (p) => G0.clone().add(p.clone().sub(C0).multiplyScalar(K)); // arm's own coordinates → in front of the person
    const ghostMat = new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.16, depthWrite: false });
    g.add(at(box(1.6 * K, 0.02, 1.1 * K, ghostMat), G0.x, G0.y - 0.01, G0.z));
    const ghostPenMat = new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.85, depthWrite: false });
    const ghostPen = cyl(0.03, 0.03, 0.5, ghostPenMat, false, 10);
    ghostPen.scale.set(K * 1.8, K, K * 1.8); // a little thicker than to scale, so it can be seen
    g.add(ghostPen);

    // the link: a wifi symbol over the headset and one beside the robot, and the delay between them
    function wifi() {
      const w = new THREE.Group();
      const arcs = [0.1, 0.19, 0.28].map((r) => {
        const m = new THREE.Mesh(
          new THREE.RingGeometry(r - 0.02, r + 0.02, 24, 1, Math.PI * 0.27, Math.PI * 0.46),
          new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
        );
        w.add(m);
        return m;
      });
      w.add(new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), M.glowCyan));
      g.add(w);
      return { w, arcs };
    }
    const here = wifi(), there = wifi();
    here.w.position.set(P.x + 0.1, 2.2, P.z);
    there.w.position.set(0.25, 2.45, 0.3); // above and to the left of the arm, clear of it
    const tag = document.createElement('canvas');
    tag.width = 256; tag.height = 64;
    const tx = tag.getContext('2d');
    tx.font = '500 34px ui-monospace, Menlo, Consolas, monospace';
    tx.fillStyle = '#62d5ff';
    tx.textAlign = 'center';
    tx.textBaseline = 'middle';
    tx.fillText('~100 ms', 128, 32);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(tag), transparent: true, depthWrite: false }));
    label.scale.set(1.1, 0.275, 1);
    label.position.set(-1.0, 2.25, 0.4);
    g.add(label);

    // the action, the same for both: reach, grip the upright pen, lift, lay it down flat, let go,
    // step back. Then the pen fades back to standing and it starts again. Positions are in the arm's
    // own coordinates: A is the upright pen's middle, B the flat pen's (the table top is at 0.2).
    const A = V(1.15, 0.45, 0.3), B = V(1.45, 0.27, -0.3), REST = V(1.0, 0.8, 0), LIFT = V(0, 0.35, 0);
    const KEYS = [
      [0, REST, 0], [1.0, A.clone().add(LIFT), 0], [1.6, A, 0], [2.0, A, 1], [2.6, A.clone().add(LIFT), 1],
      [3.6, B.clone().add(LIFT), 1], [4.2, B, 1], [4.6, B, 0], [5.2, B.clone().add(LIFT), 0], [6.2, REST, 0], [8.0, REST, 0],
    ];
    const LOOP = KEYS[KEYS.length - 1][0];
    const FLAT = (() => { const r = V(-B.z, 0, B.x).normalize(); return new THREE.Quaternion().setFromUnitVectors(UP, r); })();
    const STAND = new THREE.Quaternion();
    function pose(t) {
      t = ((t % LOOP) + LOOP) % LOOP;
      let i = 0;
      while (i < KEYS.length - 2 && t >= KEYS[i + 1][0]) i++;
      const [t0, p0, g0] = KEYS[i], [t1, p1, g1] = KEYS[i + 1];
      const f = smooth(Math.min(Math.max((t - t0) / (t1 - t0), 0), 1));
      const tip = p0.clone().lerp(p1, f);
      const grip = g0 + (g1 - g0) * f;
      // the pen: standing at A, carried from 2.0 s to 4.2 s (turning flat as it goes), then lying at B
      let u = 0, where = A, alpha = 1;
      if (t >= 2.0 && t < 4.2) { u = smooth(Math.min(Math.max((t - 2.6) / 1.0, 0), 1)); where = tip.clone().add(V(0, -0.04 * u, 0)); }
      else if (t >= 4.2 && t < 6.8) { u = 1; where = B.clone().add(V(0, -0.04, 0)); alpha = t < 6.4 ? 1 : 1 - (t - 6.4) / 0.4; }
      else if (t >= 6.8) alpha = t < 7.2 ? 0 : Math.min((t - 7.2) / 0.4, 1);
      return { tip, grip, pen: where, turn: STAND.clone().slerp(FLAT, u), alpha };
    }
    const glow = (arcs, k) => arcs.forEach((m, i) => { m.material.opacity = 0.25 + 0.65 * Math.max(0, 1 - Math.abs(((k - i / 3) % 1 + 1) % 1 - 0.15) * 4); });

    let clock = 0, last = null;
    s.update = (t, wake) => {
      if (last !== null) clock += Math.min(t - last, 0.1) * wake; // the action runs while the scene is being looked at
      last = t;
      // the person, now
      const me = pose(clock);
      reachHand(toView(me.tip));
      ghostPen.position.copy(toView(me.pen));
      ghostPen.quaternion.copy(me.turn);
      ghostPenMat.opacity = 0.85 * me.alpha;
      // the robot, 100 ms later
      const it = pose(clock - DELAY);
      arm.reach(it.tip);
      arm.grip(it.grip);
      pen.position.copy(arm.root.position).add(it.pen);
      pen.quaternion.copy(it.turn);
      penMat.opacity = it.alpha;
      glow(here.arcs, clock * 0.9);
      glow(there.arcs.slice().reverse(), clock * 0.9 - 0.15); // arriving: outside in
    };
    return [8, 4, 5];
  });

  // 5. Eyes: a camera on the wrist looks at a tray and outlines what it finds.
  station('eyes', (g, s) => {
    g.add(at(box(1.0, 0.5, 1.0, M.mid), -1.2, 0.25, 0));
    const arm = makeArm();
    arm.root.position.set(-1.2, 0.5, 0);
    g.add(arm.root);
    arm.hand.add(at(box(0.1, 0.1, 0.16, M.dark), -0.02, 0.24, 0));
    g.add(at(box(2.2, 0.7, 1.5, M.dark), 0.9, 0.35, 0));
    const items = [
      [cyl(0.1, 0.16, 0.34, M.glass, false), 0.3, 0.87, -0.35, [0.36, 0.38, 0.36]],
      [cyl(0.09, 0.09, 0.3, M.shell, false), 0.9, 0.85, 0.3, [0.24, 0.34, 0.24]],
      [box(0.3, 0.16, 0.22, M.mid, false), 1.45, 0.78, -0.25, [0.36, 0.2, 0.28]],
      [box(0.26, 0.02, 0.26, M.shell, false), 1.5, 0.71, 0.4, [0.3, 0.06, 0.3]],
    ];
    const outlines = [];
    for (const [m, x, y, z, sz] of items) {
      g.add(at(m, x, y, z));
      const o = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(sz[0], sz[1], sz[2])),
        new THREE.LineBasicMaterial({ color: C.amber, transparent: true, opacity: 0 }),
      );
      o.position.set(x, y, z);
      g.add(o);
      outlines.push(o);
    }
    const spots = items.map(([, x, , z]) => V(x + 1.2, 1.05, z)); // in the arm's own coordinates
    const cone = [];
    const coneGeo = new THREE.BufferGeometry();
    const coneLine = new THREE.LineSegments(coneGeo, new THREE.LineBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.35 }));
    g.add(coneLine);
    const tipW = V(0, 0, 0);
    s.update = (t, wake) => {
      const { p, k, moving } = tour(spots, t, 1.8, 1.0, 0.15);
      arm.reach(arm.REST.clone().lerp(p, smooth(wake)));
      outlines.forEach((o, i) => { o.material.opacity = wake * (i === k && !moving ? 0.55 + 0.45 * Math.sin(t * 6) : 0.12); });
      arm.tip.getWorldPosition(tipW);
      g.worldToLocal(tipW);
      const [, x, , z] = items[k];
      cone.length = 0;
      for (const [dx, dz] of [[-0.28, -0.22], [0.28, -0.22], [0.28, 0.22], [-0.28, 0.22]]) cone.push(tipW.clone(), V(x + dx, 0.71, z + dz));
      coneGeo.setFromPoints(cone);
      coneLine.visible = wake > 0.6 && !moving;
    };
    return [6, 4, 5];
  });

  // 6. Robots for people: the same small robot follows someone across the room and stops when they sit.
  station('people', (g, s) => {
    const person = makePerson();
    g.add(person);
    const chair = new THREE.Group();
    chair.position.set(3.4, 0, 0);
    chair.add(at(box(0.7, 0.1, 0.7, M.mid), 0, 0.5, 0));
    chair.add(at(box(0.1, 0.8, 0.7, M.mid), 0.34, 0.95, 0));
    for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) chair.add(at(box(0.06, 0.5, 0.06, M.mid, false), x, 0.25, z));
    g.add(chair);
    const rover = makeRover({ lidar: false });
    g.add(rover.root);
    const note = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.54, 40), new THREE.MeshBasicMaterial({ color: C.amber, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    note.rotation.x = -Math.PI / 2;
    g.add(note);
    s.update = (t, wake) => {
      const T = 16, u = (t % T) / T;
      // walk out, sit, walk back, stand
      let x, sit = 0, dir = 1;
      if (u < 0.35) x = -3.2 + (6.2 * u) / 0.35;
      else if (u < 0.55) { x = 3.0; sit = smooth(clamp01((u - 0.35) / 0.05)) * (1 - smooth(clamp01((u - 0.5) / 0.05))); }
      else if (u < 0.9) { x = 3.0 - (6.2 * (u - 0.55)) / 0.35; dir = -1; }
      else { x = -3.2; }
      person.position.set(x, -0.42 * sit, 0.0);
      const gap = 1.7;
      const want = x - dir * gap;
      rover.root.position.x += (want - rover.root.position.x) * 0.05 * (0.2 + 0.8 * wake);
      rover.root.position.z = 0.9;
      rover.root.rotation.y = Math.atan2(-(person.position.z - 0.9), x - rover.root.position.x);
      note.position.set(x, 0.02, 0);
      note.material.opacity = 0.25 + 0.2 * Math.sin(t * 3);
    };
    return [9, 3, 4];
  });

  // 7. Humanoids: one arm is open, showing the printed frame and motors. That arm is the one Gautham built.
  station('humanoid', (g, s) => {
    const body = new THREE.Group();
    g.add(body);
    body.add(at(cyl(0.5, 0.62, 0.9, M.dark), 0, 0.45, 0));
    body.add(at(cyl(0.2, 0.3, 0.4, M.mid), 0, 1.1, 0));
    body.add(at(box(0.5, 1.05, 0.95, M.shell), 0, 1.82, 0));
    const head = new THREE.Group();
    head.position.set(0, 2.72, 0);
    head.add(box(0.26, 0.5, 0.62, M.shell));
    const face = makeFace(0.5, 0.36);
    face.rotation.y = Math.PI / 2;
    face.position.x = 0.135;
    head.add(face);
    body.add(head);
    body.add(at(cyl(0.09, 0.09, 0.14, M.mid, false), 0, 2.4, 0));
    // the finished arm (shell on)
    const right = new THREE.Group();
    right.position.set(0, 2.2, -0.6);
    right.add(at(cyl(0.11, 0.1, 0.62, M.shell), 0, -0.34, 0));
    right.add(at(cyl(0.09, 0.08, 0.6, M.shell), 0, -0.98, 0));
    right.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), M.joint));
    body.add(right);
    // the open arm: red printed frame, motors showing
    const left = new THREE.Group();
    left.position.set(0, 2.2, 0.62);
    const frame = (len) => {
      const f = new THREE.Group();
      for (const [x, z] of [[-0.07, -0.07], [0.07, -0.07], [0.07, 0.07], [-0.07, 0.07]]) f.add(at(box(0.025, len, 0.025, M.red, false), x, -len / 2, z));
      for (const y of [0.08, len / 2, len - 0.08]) f.add(at(box(0.17, 0.025, 0.17, M.red, false), 0, -y, 0));
      f.add(at(cyl(0.055, 0.055, 0.2, M.dark, false, 14), 0, -len * 0.35, 0));
      return f;
    };
    left.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), M.dark));
    left.add(frame(0.62));
    const fore = new THREE.Group();
    fore.position.y = -0.66;
    fore.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), M.dark));
    fore.add(frame(0.56));
    const palm = at(box(0.14, 0.14, 0.05, M.red), 0, -0.66, 0);
    fore.add(palm);
    const fingers = [];
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Group();
      f.position.set(-0.055 + i * 0.037, -0.74, 0);
      f.add(at(box(0.026, 0.13, 0.03, M.red, false), 0, -0.065, 0));
      fore.add(f);
      fingers.push(f);
    }
    left.add(fore);
    body.add(left);
    const spark = at(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), M.glowAmber), 0.1, 2.05, 0.62);
    body.add(spark);
    body.rotation.y = -Math.PI / 2 + 0.45; // face the visitor, turned a little to show the open arm
    s.update = (t, wake) => {
      head.rotation.z = (1 - smooth(wake)) * -0.45 + Math.sin(t * 0.5) * 0.03;
      const lift = smooth(wake) * (0.5 + 0.5 * Math.sin(t * 0.8));
      left.rotation.z = lift * 1.5;
      left.rotation.x = -lift * 0.25;
      fore.rotation.z = lift * 0.9;
      const curl = 0.5 + 0.5 * Math.sin(t * 2.4);
      fingers.forEach((f, i) => { f.rotation.x = curl * 1.1 * smooth(wake) * (0.7 + i * 0.1); });
      spark.visible = Math.floor(t * 2) % 2 === 0;
    };
    return [4.5, 4.4, 4.5];
  });

  // ---------- journey: a line of light along the floor with a post for each chapter
  const journey = new THREE.Group();
  journey.position.set(100, 0, 0);
  scene.add(journey);
  journey.add(at(box(22, 0.03, 0.14, M.glowAmber, false), 11, 0.02, 0));
  const posts = [];
  [0, 4.6, 7.4, 13, 18.4].forEach((x, i) => {
    const p = at(box(0.1, 1.2 + i * 0.25, 0.1, M.mid), x, (1.2 + i * 0.25) / 2, 0);
    journey.add(p);
    const top = at(new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), i === 4 ? M.glowAmber : M.glowCyan), x, 1.2 + i * 0.25 + 0.12, 0);
    journey.add(top);
    posts.push(top);
  });
  const journeyLight = new THREE.PointLight(0xffe2b8, 0, 40, 1.1);
  journeyLight.position.set(11, 7, 3);
  journey.add(journeyLight);

  // ---------- off the floor: an open door and a wall of photographs
  const off = new THREE.Group();
  off.position.set(131, 0, -8);
  scene.add(off);
  off.add(at(box(11, 6, 0.3, M.dark), 0.5, 3, 0));
  off.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1.7, 3.3), new THREE.MeshBasicMaterial({ color: 0xffe9c4 })), -3.6, 1.65, 0.16));
  const tints = [0x6aa5c8, 0xc98a52, 0x5f9c6e, 0x4f8f86, 0x8fae6a, 0xd0a868];
  tints.forEach((c, i) => {
    const w = 1.5, h = 1.05;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c }));
    f.position.set(-1.2 + (i % 3) * 1.9, 3.9 - Math.floor(i / 3) * 1.5, 0.17);
    off.add(f);
    off.add(at(box(w + 0.12, h + 0.12, 0.04, M.shell, false), f.position.x, f.position.y, 0.14));
  });
  const offLight = new THREE.PointLight(0xffe9c4, 0, 26, 1.1);
  offLight.position.set(-1, 4, 5);
  off.add(offLight);

  // ---------- camera stops
  let narrow = false;
  function stop(id) {
    const [x, z] = STATIONS[id];
    const wide = id === 'wheels' || id === 'people' || id === 'cell';
    if (id === 'wheels' && !narrow) return { pos: V(x - 3, 8.5, z + 20), look: V(x, 0.2, z - 0.5) };
    // remote hands is two places side by side: on a phone, stand back and face the middle so both show
    if (id === 'remote' && narrow) return { pos: V(x + 0.3, 7.5, z + 22), look: V(x + 0.3, 1.2, z) };
    if (narrow) return { pos: V(x - 2, wide ? 7.5 : 5.5, z + (wide ? 19 : 12.5)), look: V(x, 1.2, z) };
    return { pos: V(x - 3.6, wide ? 5.4 : 4.0, z + (wide ? 14.5 : 10.5)), look: V(x, wide ? 0.9 : 1.35, z) };
  }
  function keyframes() {
    const overview = narrow ? { pos: V(60, 60, 150), look: V(60, 0, -2) } : { pos: V(58, 34, 74), look: V(58, 0, -4) };
    return {
      opening: narrow ? { pos: V(-12, 8, 24), look: V(8, 1.2, -2) } : { pos: V(-13, 5.2, 15), look: V(9, 1.6, -3) },
      cell: stop('cell'), arms: stop('arms'), wheels: stop('wheels'), remote: stop('remote'),
      eyes: stop('eyes'), people: stop('people'), humanoid: stop('humanoid'),
      journey: narrow ? { pos: V(111, 12, 30), look: V(111, 1, 0) } : { pos: V(98, 5.5, 14), look: V(110, 0.8, -3) },
      off: narrow ? { pos: V(131, 5, 14), look: V(131, 2.6, -8) } : { pos: V(126, 3.4, 6.5), look: V(131.5, 2.9, -8) },
      thanks: overview,
      contact: narrow ? { pos: V(60, 44, 120), look: V(60, 0, -2) } : { pos: V(58, 22, 56), look: V(58, 0, -5) },
    };
  }
  let KF = keyframes();
  // The order of the stops comes from the page. A scene with no stop of its own gets the wide view.
  const order = pageOrder || ['opening', 'cell', 'arms', 'wheels', 'remote', 'eyes', 'people', 'humanoid', 'journey', 'off', 'thanks', 'contact'];
  const kf = (id) => KF[id] || KF.thanks;
  order.forEach((id) => { if (!KF[id]) console.warn('floor: no camera stop for scene ' + id); });

  const state = { progress: 0, focus: null, hover: null };
  const camPos = KF.opening.pos.clone(), camLook = KF.opening.look.clone();
  const wantPos = V(0, 0, 0), wantLook = V(0, 0, 0);

  function target() {
    const i = Math.min(Math.floor(state.progress), order.length - 2);
    const f = smooth(clamp01(state.progress - i));
    const a = kf(order[i]), b = kf(order[i + 1]);
    wantPos.lerpVectors(a.pos, b.pos, f);
    wantLook.lerpVectors(a.look, b.look, f);
    if (state.focus && STATIONS[state.focus]) {
      const k = stop(state.focus);
      wantPos.lerpVectors(k.pos, k.look, 0.3);
      wantLook.copy(k.look);
    }
  }

  // ---------- picking
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  function pickAt(ev) {
    const r = canvas.getBoundingClientRect();
    ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    // only robots that have a story to open can be picked
    const h = ray.intersectObjects(hits, false).find((x) => !pickable || pickable.includes(x.object.userData.id));
    return h ? h.object.userData.id : null;
  }

  // ---------- frame loop
  const clock = new THREE.Clock();
  let started = intro ? performance.now() : performance.now() - 60000; // no lights-on intro when asked to start ready
  let paused = false;
  let raf = 0;
  let snap = false;

  function frame() {
    raf = requestAnimationFrame(frame);
    if (paused) return; // nobody is looking: draw nothing
    const realDt = clock.getDelta();
    const dt = Math.min(realDt, 0.05);
    const t = reduced ? 3 : clock.elapsedTime;
    const since = (performance.now() - started) / 1000;

    stations.forEach((s, i) => {
      // lights come on one bank at a time, and each robot wakes as its light reaches it
      const w = reduced ? 1 : clamp01((since - 0.5 - i * 0.38) / 0.9);
      s.wake = w;
      s.hover += ((state.hover === s.id || state.focus === s.id ? 1 : 0) - s.hover) * (1 - Math.exp(-dt * 8));
      s.light.intensity = (46 + 18 * s.hover) * smooth(w);
      s.cone.material.opacity = (0.028 + 0.02 * s.hover) * smooth(w);
      s.ring.material.opacity = 0.75 * s.hover;
      if (s.update) s.update(t, w);
    });
    journeyLight.intensity = 30 * clamp01(since - 3.2);
    offLight.intensity = 26 * clamp01(since - 3.5);
    posts.forEach((p, i) => { p.scale.setScalar(1 + 0.25 * Math.sin(t * 2 - i)); });


    target();
    const k = reduced || snap ? 1 : 1 - Math.exp(-Math.min(realDt, 0.2) * 3.2);
    snap = false;
    camPos.lerp(wantPos, k);
    camLook.lerp(wantLook, k);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    renderer.render(scene, camera);
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    narrow = w < 860 || w / h < 1.05;
    // Shift the picture so the robots sit to the right of the text (wide screens)
    // or above it (narrow screens). Picking still works: it uses the same projection.
    if (narrow) { camera.setViewOffset(w, h * 1.45, 0, h * 0.45, w, h); camera.aspect = w / (h * 1.45); camera.fov = 64; }
    else { camera.setViewOffset(w * 1.34, h, 0, 0, w, h); camera.aspect = (w * 1.34) / h; camera.fov = 42; }
    camera.updateProjectionMatrix();
    KF = keyframes();
  }
  resize();
  target();
  camPos.copy(wantPos); camLook.copy(wantLook);
  window.addEventListener('resize', resize);

  let lastMove = 0;
  canvas.addEventListener('pointermove', (ev) => {
    const now = performance.now();
    if (now - lastMove < 40) return;
    lastMove = now;
    const id = pickAt(ev);
    if (id !== state.hover) { state.hover = id; canvas.style.cursor = id ? 'pointer' : ''; onHover && onHover(id); }
  });
  canvas.addEventListener('pointerleave', () => { state.hover = null; canvas.style.cursor = ''; });
  canvas.addEventListener('click', (ev) => { const id = pickAt(ev); if (id) onPick && onPick(id); });

  frame();

  return {
    setProgress(p) { state.progress = p; },
    setFocus(id) { state.focus = id; },
    jump() { snap = true; },
    restartIntro() { started = performance.now(); },
    setPaused(v) { paused = !!v; if (!paused) clock.getDelta(); },
    dispose() { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); renderer.dispose(); },
  };
}
