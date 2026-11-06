import * as THREE from 'three';

/*
 * The three AFYLLX division objects. Each builder returns
 * `{ group, update(build, time) }` where `build` runs 0 → 1 through an ordered
 * sequence of named steps. Updates are absolute functions of `build`, so
 * scrolling backwards replays the sequence in exact reverse.
 */

const TAU = Math.PI * 2;
const clamp = value => THREE.MathUtils.clamp(value, 0, 1);
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
export const step = (value, from, to) => smooth((value - from) / (to - from));
const linear = (value, from, to) => clamp((value - from) / (to - from));
/** Ease-out with a small overshoot, for objects that pop into place. */
const pop = t => { if (t <= 0) return 0; if (t >= 1) return 1; const c = 1.70158, u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
const lerp = THREE.MathUtils.lerp;

// ---------- shared helpers ----------
function kit({ materials, geometries, textures }) {
  const keep = (set, item) => { set.add(item); return item; };
  return {
    material: m => keep(materials, m),
    geometry: g => keep(geometries, g),
    texture: t => keep(textures, t),
    mesh(parent, geometry, material) {
      const item = new THREE.Mesh(geometry, material);
      parent.add(item);
      return item;
    },
    extrude(shape, depth, bevel = 0, segments = 3) {
      return keep(geometries, new THREE.ExtrudeGeometry(shape, {
        depth, curveSegments: 20, bevelEnabled: bevel > 0,
        bevelThickness: bevel, bevelSize: bevel * .8, bevelSegments: segments,
      }));
    },
    canvasTexture(width, height, draw, srgb = true) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      draw(canvas.getContext('2d'), width, height);
      const texture = new THREE.CanvasTexture(canvas);
      if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      return keep(textures, texture);
    },
  };
}

function roundedRect(width, height, radius, cx = 0, cy = 0) {
  const x = cx - width / 2, y = cy - height / 2, r = Math.min(radius, width / 2, height / 2);
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

function show(item, amount, base = 1) {
  item.visible = amount > .002;
  item.scale.setScalar(base * Math.max(.001, amount));
}

function lineTube(k, points, radius, material, parent, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed);
  const geometry = k.geometry(new THREE.TubeGeometry(curve, Math.max(8, points.length * 6), radius, 6, closed));
  return k.mesh(parent, geometry, material);
}

function glowMaterials(k) {
  return {
    ice: k.material(new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8cc8ff).multiplyScalar(1.6), toneMapped: false })),
    blue: k.material(new THREE.MeshBasicMaterial({ color: new THREE.Color(0x2f6dff).multiplyScalar(2.0), toneMapped: false })),
  };
}

// Deterministic pseudo-random numbers keep textures identical between renders.
function seeded(seed) {
  let value = seed;
  return () => { value = (value * 16807) % 2147483647; return (value - 1) / 2147483646; };
}

// =====================================================================
// Edu — a hardcover book that opens, turns pages and lifts out tools
// =====================================================================
const BOOK = { W: 1.5, H: 2.1, T: .055, B: .34 };

function printedPage(k, seed, side) {
  return k.canvasTexture(512, 720, (c, w, h) => {
    const random = seeded(seed);
    c.fillStyle = '#eef3fc';
    c.fillRect(0, 0, w, h);
    const gutter = side === 'left' ? 0 : w;
    const shade = c.createLinearGradient(gutter, 0, side === 'left' ? 90 : w - 90, 0);
    shade.addColorStop(0, 'rgba(60,80,130,.28)');
    shade.addColorStop(1, 'rgba(60,80,130,0)');
    c.fillStyle = shade;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#2a5ee8';
    c.fillRect(54, 58, 230, 22);
    c.fillStyle = '#7d93c2';
    c.fillRect(54, 92, 150, 10);
    let y = 136;
    for (let line = 0; line < 22; line++) {
      if (line === 9) {
        // A small geometry figure, in keeping with the tools on this page.
        c.strokeStyle = '#3d6ce0';
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(70, y + 120); c.lineTo(250, y + 120); c.lineTo(70, y + 10); c.closePath();
        c.stroke();
        c.beginPath();
        c.arc(370, y + 66, 54, 0, TAU);
        c.stroke();
        c.fillStyle = '#9fb3dd';
        c.fillRect(300, y + 132, 140, 8);
        y += 168;
        continue;
      }
      c.fillStyle = line % 7 === 0 ? '#5d77b4' : '#a4b4d6';
      const length = line % 7 === 6 ? 160 + random() * 120 : 340 + random() * 60;
      c.fillRect(54, y, length, 8);
      y += 22;
      if (y > h - 60) break;
    }
  });
}

function stripeTexture(k) {
  const texture = k.canvasTexture(64, 64, (c, w, h) => {
    for (let x = 0; x < w; x += 2) {
      c.fillStyle = x % 4 === 0 ? '#e3eaf8' : '#c3cfe8';
      c.fillRect(x, 0, 2, h);
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 1);
  return texture;
}

function rulerTexture(k) {
  return k.canvasTexture(1024, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(190,215,255,.55)';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#0d1f4d';
    c.fillStyle = '#0d1f4d';
    c.lineWidth = 2;
    c.font = '600 22px Arial, sans-serif';
    for (let mm = 0; mm <= 150; mm++) {
      const x = 22 + mm * ((w - 44) / 150);
      const tall = mm % 10 === 0 ? 46 : mm % 5 === 0 ? 32 : 20;
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, tall);
      c.stroke();
      if (mm % 10 === 0) c.fillText(String(mm / 10), x - (mm >= 100 ? 12 : 6), 76);
    }
  });
}

function bookObject(resources) {
  const k = kit(resources);
  const glow = glowMaterials(k);
  const { W, H, T, B } = BOOK;
  const zc = T + B / 2;
  const group = new THREE.Group();
  const root = new THREE.Group();
  group.add(root);

  const cover = k.material(new THREE.MeshPhysicalMaterial({
    color: 0x1546b8, roughness: .38, metalness: .1, clearcoat: .9, clearcoatRoughness: .2,
    sheen: .6, sheenColor: new THREE.Color(0x6f9cff), envMapIntensity: 1.1,
    emissive: 0x081f66, emissiveIntensity: .35,
  }));
  const stripes = stripeTexture(k);
  const edgePaper = k.material(new THREE.MeshStandardMaterial({ map: stripes, roughness: .7, emissive: 0x1a2a58, emissiveIntensity: .25 }));
  const plainPaper = k.material(new THREE.MeshStandardMaterial({ color: 0xe9eefa, roughness: .65, emissive: 0x1a2a58, emissiveIntensity: .25 }));
  const pageRight = k.material(new THREE.MeshStandardMaterial({ map: printedPage(k, 11, 'right'), roughness: .62, emissive: 0x1a2a58, emissiveIntensity: .22 }));
  const pageLeft = k.material(new THREE.MeshStandardMaterial({ map: printedPage(k, 29, 'left'), roughness: .62, emissive: 0x1a2a58, emissiveIntensity: .22 }));

  const board = () => {
    const geometry = k.extrude(roundedRect(W + .07, H + .12, .07), T, .012, 2);
    geometry.translate((W + .07) / 2 - .01, 0, 0);
    return geometry;
  };
  const block = (faceMaterial, faceIndex) => {
    const geometry = k.geometry(new THREE.BoxGeometry(W, H, B / 2));
    geometry.translate(W / 2, 0, 0);
    const list = [edgePaper, plainPaper, edgePaper, edgePaper, plainPaper, plainPaper];
    list[faceIndex] = faceMaterial;
    return new THREE.Mesh(geometry, list);
  };

  // Right side: back board and the right half of the page block, pivoting on the spine.
  const rightSide = new THREE.Group();
  rightSide.position.z = zc;
  root.add(rightSide);
  k.mesh(rightSide, board(), cover).position.z = -zc;
  const rightBlock = block(pageRight, 4);
  rightBlock.position.z = T + B / 4 - zc;
  rightSide.add(rightBlock);

  // Front side: front board, emblem and left half of the block swing open together.
  const front = new THREE.Group();
  front.position.z = zc;
  root.add(front);
  const leftBlock = block(pageLeft, 5);
  leftBlock.position.z = T + 3 * B / 4 - zc;
  front.add(leftBlock);
  k.mesh(front, board(), cover).position.z = T + B - zc;
  const emblem = new THREE.Group();
  emblem.position.set(W / 2, .18, T * 2 + B - zc + .004);
  front.add(emblem);
  const emblemShape = new THREE.Shape([[0, .42], [.1, .42], [.42, -.42], [.27, -.42], [.05, .1], [-.1, -.17], [-.25, -.2]].map(([x, y]) => new THREE.Vector2(x - .05, y)));
  k.mesh(emblem, k.extrude(emblemShape, .02, .006, 1), glow.ice);
  lineTube(k, Array.from({ length: 40 }, (_, i) => {
    const a = Math.PI * .15 + i / 39 * Math.PI * 1.55;
    return new THREE.Vector3(Math.cos(a) * .26 - .14, Math.sin(a) * .2 - .2, .012);
  }), .016, glow.ice, emblem);
  const frame = roundedRect(W - .16, H - .2, .05).getPoints(12).map(p => new THREE.Vector3(p.x + W / 2, p.y, T * 2 + B - zc + .006));
  lineTube(k, frame, .006, glow.blue, front, true);

  // Spine: a half cylinder on the left edge of the closed book.
  const spine = k.mesh(root, k.geometry(new THREE.CylinderGeometry(zc + .012, zc + .012, H + .12, 28, 1, false, Math.PI, Math.PI)), cover);
  spine.position.set(0, 0, zc);

  // Three turning pages deform along their width so they curl like paper.
  const pages = [];
  const pageWidth = W * .97;
  for (let index = 0; index < 3; index++) {
    const geometry = k.geometry(new THREE.PlaneGeometry(pageWidth, H * .96, 28, 1));
    geometry.translate(pageWidth / 2, 0, 0);
    const material = k.material(new THREE.MeshStandardMaterial({
      map: index === 1 ? pageLeft.map : pageRight.map, side: THREE.DoubleSide, roughness: .6,
      emissive: 0x1a2a58, emissiveIntensity: .25,
    }));
    const page = k.mesh(rightSide, geometry, material);
    page.position.z = 0;
    pages.push(page);
  }

  // Tools that rise out of the open spread.
  const glass = k.material(new THREE.MeshPhysicalMaterial({
    color: 0x9cc4ff, roughness: .08, metalness: 0, transmission: .7, thickness: .25, ior: 1.45,
    clearcoat: 1, envMapIntensity: 1.3, transparent: true, opacity: .92,
  }));
  const tools = new THREE.Group();
  tools.position.z = zc + .05;
  root.add(tools);

  const ruler = new THREE.Group();
  const rulerFace = k.material(new THREE.MeshPhysicalMaterial({
    map: rulerTexture(k), transparent: true, roughness: .12, clearcoat: 1, envMapIntensity: 1.2,
    emissive: 0x2a5ed8, emissiveIntensity: .15,
  }));
  const rulerBody = k.geometry(new THREE.BoxGeometry(2.1, .3, .025));
  k.mesh(ruler, rulerBody, [glass, glass, glass, glass, rulerFace, glass]);
  lineTube(k, [new THREE.Vector3(-1.05, -.15, .015), new THREE.Vector3(1.05, -.15, .015)], .006, glow.ice, ruler);
  tools.add(ruler);

  const square = new THREE.Group();
  const triangle = new THREE.Shape([[0, 0], [1.25, 0], [0, .85]].map(([x, y]) => new THREE.Vector2(x, y)));
  triangle.holes.push(new THREE.Path([[.2, .14], [.2, .55], [.8, .14]].map(([x, y]) => new THREE.Vector2(x, y))));
  const squareGeometry = k.extrude(triangle, .03, .008, 1);
  squareGeometry.translate(-.42, -.28, 0);
  k.mesh(square, squareGeometry, glass);
  lineTube(k, [[0, 0], [1.25, 0], [0, .85]].map(([x, y]) => new THREE.Vector3(x - .42, y - .28, .04)), .008, glow.blue, square, true);
  tools.add(square);

  const pen = new THREE.Group();
  const barrel = k.material(new THREE.MeshPhysicalMaterial({ color: 0x1c4fe0, metalness: .55, roughness: .22, clearcoat: 1, emissive: 0x0a2580, emissiveIntensity: .3 }));
  const chrome = k.material(new THREE.MeshPhysicalMaterial({ color: 0xe8eefc, metalness: 1, roughness: .12, envMapIntensity: 1.4 }));
  const grip = k.material(new THREE.MeshStandardMaterial({ color: 0x0b1530, roughness: .6 }));
  k.mesh(pen, k.geometry(new THREE.CylinderGeometry(.06, .06, .95, 24)), barrel).position.y = .2;
  k.mesh(pen, k.geometry(new THREE.CylinderGeometry(.055, .05, .3, 24)), grip).position.y = -.43;
  k.mesh(pen, k.geometry(new THREE.ConeGeometry(.05, .16, 24)), chrome).rotation.x = Math.PI;
  pen.children[2].position.y = -.66;
  k.mesh(pen, k.geometry(new THREE.CylinderGeometry(.062, .062, .05, 24)), chrome).position.y = .7;
  const clip = k.mesh(pen, k.geometry(new THREE.BoxGeometry(.02, .42, .03)), chrome);
  clip.position.set(0, .48, .07);
  tools.add(pen);

  const toolPoses = [
    { item: ruler, at: [-.95, 1.65, .7], rot: [-.25, .25, .38], from: .62 },
    { item: square, at: [.98, 1.55, .82], rot: [-.2, -.38, -.28], from: .68 },
    { item: pen, at: [.06, 1.95, 1.05], rot: [.35, .1, -1.0], from: .74 },
  ];

  const START = .09, END = Math.PI - .18;
  function bendPage(page, flip, lift) {
    const position = page.geometry.attributes.position;
    const columns = 29;
    const bend = Math.sin(flip * Math.PI) * 1.15;
    // Pages live in the right half's frame, which is already turned by START.
    const angle0 = lerp(0, END - START, smooth(flip));
    let x = 0, z = 0;
    const du = pageWidth / (columns - 1);
    const xs = [0], zs = [0];
    for (let i = 1; i < columns; i++) {
      const u = i / (columns - 1);
      const a = angle0 + bend * u ** 1.4;
      x += Math.cos(a) * du;
      z += Math.sin(a) * du;
      xs.push(x);
      zs.push(z);
    }
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < columns; i++) {
        const index = row * columns + i;
        position.setX(index, xs[i]);
        position.setZ(index, zs[i] + lift);
      }
    }
    position.needsUpdate = true;
    page.geometry.computeVertexNormals();
  }

  let lastFlip = [-1, -1, -1];
  function update(build, time) {
    const arrive = step(build, 0, .08);
    const open = step(build, .08, .36);
    const settle = step(build, .88, 1);
    root.rotation.y = .55 * (1 - arrive) + .22 * (1 - open) - .04;
    root.rotation.x = -.1 - .24 * open;
    root.position.x = -W / 2 * (1 - open);
    root.position.y = -.25 - .6 * open + Math.sin(time * .5) * .04 * settle;
    front.rotation.y = -END * open;
    rightSide.rotation.y = -START * open;
    // Pages turn one after another once the cover is open.
    pages.forEach((page, index) => {
      page.visible = open > .6;
      const flip = linear(build, .36 + index * .08, .52 + index * .08);
      const key = Math.round(flip * 1000) + (page.visible ? 0 : -5000);
      if (key !== lastFlip[index]) {
        bendPage(page, flip, .004 * (flip < .5 ? 3 - index : index + 1));
        lastFlip[index] = key;
      }
    });
    // Tools pop up from the spread with a small overshoot, then hover.
    for (const [index, pose] of toolPoses.entries()) {
      const t = linear(build, pose.from, pose.from + .16);
      const p = pop(t);
      show(pose.item, Math.min(1, t * 1.6));
      pose.item.position.set(
        pose.at[0] * p,
        lerp(-.4, pose.at[1], p) + Math.sin(time * .9 + index * 2) * .05 * settle,
        lerp(0, pose.at[2], p),
      );
      pose.item.rotation.set(pose.rot[0] * p, pose.rot[1] * p + Math.sin(time * .5 + index) * .08 * settle, pose.rot[2] * p);
    }
    cover.emissiveIntensity = .35 + settle * .25;
  }
  update(0, 0);
  return { group, update };
}

// =====================================================================
// Digital — a website that assembles, gets a phone view and a click
// =====================================================================
function websiteObject(resources) {
  const k = kit(resources);
  const glow = glowMaterials(k);
  const group = new THREE.Group();
  const root = new THREE.Group();
  group.add(root);
  const W = 3.2, H = 2.15;

  const frameGlass = k.material(new THREE.MeshPhysicalMaterial({
    color: 0x0c2657, metalness: .1, roughness: .12, transmission: .35, thickness: .4, ior: 1.45,
    clearcoat: 1, clearcoatRoughness: .06, envMapIntensity: 1.2,
  }));
  const screen = k.material(new THREE.MeshPhysicalMaterial({
    color: 0x030a1a, metalness: .2, roughness: .25, clearcoat: 1, envMapIntensity: .8,
    emissive: 0x0b2c80, emissiveIntensity: .3,
  }));
  const blockBlue = k.material(new THREE.MeshPhysicalMaterial({ color: 0x1d55ff, roughness: .2, clearcoat: 1, emissive: 0x0a2ea6, emissiveIntensity: .55 }));
  const blockIce = k.material(new THREE.MeshPhysicalMaterial({ color: 0x6aa6ff, roughness: .16, clearcoat: 1, emissive: 0x2a64e0, emissiveIntensity: .45 }));
  const blockInk = k.material(new THREE.MeshPhysicalMaterial({ color: 0x0f2350, roughness: .3, clearcoat: .8, emissive: 0x06173f, emissiveIntensity: .5 }));
  const white = k.material(new THREE.MeshPhysicalMaterial({ color: 0xf4f7ff, roughness: .2, clearcoat: 1, emissive: 0x3a4a70, emissiveIntensity: .3 }));
  const dim = k.material(new THREE.MeshBasicMaterial({ color: 0x5f86d8 }));
  const ripple = k.material(new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9cc8ff).multiplyScalar(1.6), toneMapped: false, transparent: true, opacity: 0, depthWrite: false }));

  const browser = new THREE.Group();
  root.add(browser);
  const back = k.mesh(root, k.extrude(roundedRect(W, H, .16), .06, .02), blockInk);
  k.mesh(browser, k.extrude(roundedRect(W, H, .16), .1, .035), frameGlass);
  const display = k.mesh(browser, k.extrude(roundedRect(W - .2, H - .48, .08), .02), screen);
  display.position.set(0, -.14, .15);
  lineTube(k, roundedRect(W + .04, H + .04, .18).getPoints(16).map(p => new THREE.Vector3(p.x, p.y, .16)), .01, glow.blue, browser, true);
  const dots = [glow.ice, glow.blue, glow.blue].map((material, index) => {
    const dot = k.mesh(browser, k.geometry(new THREE.SphereGeometry(.05, 16, 12)), material);
    dot.position.set(-W / 2 + .24 + index * .17, H / 2 - .19, .17);
    return dot;
  });
  const address = new THREE.Group();
  address.position.set(.25, H / 2 - .19, .16);
  browser.add(address);
  k.mesh(address, k.extrude(roundedRect(1.5, .13, .065), .02), blockInk);
  k.mesh(address, k.extrude(roundedRect(.7, .035, .017, -.25, 0), .01), dim).position.z = .025;

  // Page parts, in reading order, each with a depth tier for the exploded view.
  const parts = [];
  const part = (shape, material, x, y, tier, depth = .05) => {
    const item = k.mesh(browser, k.extrude(shape, depth, .01, 2), material);
    item.position.set(x, y, .2);
    parts.push({ item, tier });
    return item;
  };
  part(roundedRect(2.9, .1, .05), blockInk, 0, .56, 1, .02);
  part(roundedRect(1.5, .66, .08), blockBlue, -.66, .14, 1);
  part(roundedRect(1.0, .07, .035), glow.ice, -.8, .3, 2, .02);
  part(roundedRect(.7, .07, .035), glow.ice, -.95, .17, 2, .02);
  const button = part(roundedRect(.46, .14, .07), white, -1.07, -.04, 2, .04);
  part(roundedRect(1.1, .66, .08), blockIce, .86, .14, 1);
  const sun = part(new THREE.Shape().absarc(0, 0, .09, 0, TAU), white, 1.12, .3, 2, .02);
  part(new THREE.Shape([[-.4, -.16], [-.05, .16], [.1, 0], [.22, .1], [.42, -.16]].map(([x, y]) => new THREE.Vector2(x, y))), blockBlue, .82, .02, 2, .02);
  for (const [index, x] of [-1.12, -.42, .28].entries()) {
    part(roundedRect(.64, .5, .06), index === 1 ? blockBlue : blockInk, x, -.5, 1);
    part(roundedRect(.5, .18, .04), blockIce, x, -.4, 2, .02);
    part(roundedRect(.4, .035, .017), glow.blue, x - .05, -.6, 2, .015);
  }
  part(roundedRect(.72, .5, .06), blockInk, 1.07, -.5, 1);
  const bars = [.18, .3, .22, .38].map((height, index) => {
    const bar = k.mesh(browser, k.geometry(new THREE.BoxGeometry(.09, 1, .04)), index === 3 ? glow.ice : blockIce);
    bar.userData = { height, x: .85 + index * .14 };
    return bar;
  });
  void sun;

  // A phone showing the same page, sliding in on the right.
  const phone = new THREE.Group();
  root.add(phone);
  k.mesh(phone, k.extrude(roundedRect(.62, 1.22, .1), .06, .02), frameGlass);
  const phoneScreen = k.mesh(phone, k.extrude(roundedRect(.52, 1.06, .07), .01), screen);
  phoneScreen.position.z = .085;
  [[.42, .3, blockBlue, .25], [.42, .2, blockIce, -.05], [.42, .14, blockInk, -.27], [.42, .14, blockInk, -.44]].forEach(([w, h, m, y]) => {
    k.mesh(phone, k.extrude(roundedRect(w, h, .03), .015), m).position.set(0, y, .1);
  });
  lineTube(k, roundedRect(.66, 1.26, .12).getPoints(10).map(p => new THREE.Vector3(p.x, p.y, .09)), .006, glow.ice, phone, true);

  // A code panel sliding in on the left.
  const code = new THREE.Group();
  root.add(code);
  k.mesh(code, k.extrude(roundedRect(1.15, .82, .08), .04, .015), blockInk);
  const codeLines = [[.5, glow.ice], [.7, dim], [.35, glow.blue], [.62, dim], [.45, glow.ice], [.28, dim]];
  codeLines.forEach(([width, material], index) => {
    k.mesh(code, k.extrude(roundedRect(width, .04, .02), .01), material).position.set(-.38 + width / 2 + (index % 3 === 1 ? .08 : 0), .26 - index * .1, .055);
  });
  const glyph = new THREE.Group();
  glyph.position.set(.36, -.24, .06);
  code.add(glyph);
  for (const [x, rz] of [[-.12, .7], [-.12, -.7], [.12, -.7], [.12, .7]]) {
    const bar = k.mesh(glyph, k.geometry(new THREE.BoxGeometry(.12, .028, .02)), glow.ice);
    bar.position.set(x + (x < 0 ? .0 : 0), rz > 0 === x < 0 ? .04 : -.04, 0);
    bar.rotation.z = rz;
  }
  k.mesh(glyph, k.geometry(new THREE.BoxGeometry(.03, .22, .02)), glow.blue).rotation.z = -.35;

  // Pointer and click ripple.
  const arrow = new THREE.Shape([[0, 0], [0, -.34], [.09, -.25], [.16, -.4], [.21, -.38], [.14, -.23], [.26, -.22]].map(([x, y]) => new THREE.Vector2(x, y)));
  const cursor = k.mesh(root, k.extrude(arrow, .03, .008, 1), white);
  const ring = k.mesh(root, k.geometry(new THREE.TorusGeometry(.2, .012, 8, 48)), ripple);

  function update(build, time) {
    const arrive = step(build, 0, .1);
    const power = step(build, .1, .3);
    const settle = step(build, .9, 1);
    const explode = step(build, .9, 1);
    root.rotation.y = .5 * (1 - arrive) - .12;
    root.rotation.x = -.05;
    root.position.y = Math.sin(time * .45) * .04 * settle;
    back.position.set(.42 * arrive, .36 * arrive, -.5 - .25 * explode);
    back.scale.setScalar(.9);
    screen.emissiveIntensity = .3 + power * .6;
    dots.forEach((dot, index) => show(dot, step(power, .2 + index * .2, .5 + index * .2)));
    show(address, step(power, .6, 1));
    parts.forEach(({ item, tier }, index) => {
      const t = linear(build, .25 + index * (.33 / parts.length), .25 + index * (.33 / parts.length) + .08);
      show(item, Math.min(1, t * 1.4));
      item.position.z = .2 + (1 - pop(t)) * .8 + tier * (.04 + explode * .22);
    });
    bars.forEach((bar, index) => {
      const grow = step(build, .55 + index * .03, .68 + index * .03);
      bar.visible = grow > .01;
      bar.scale.set(1, Math.max(.001, bar.userData.height * grow), 1);
      bar.position.set(bar.userData.x, -.68 + bar.userData.height * grow / 2, .26 + explode * .26);
    });
    const slidePhone = pop(linear(build, .6, .76));
    show(phone, Math.min(1, slidePhone * 1.5));
    phone.position.set(lerp(3.2, 1.95, slidePhone), -.3, .8 + explode * .3);
    phone.rotation.set(0, -.35, .04);
    const slideCode = pop(linear(build, .64, .8));
    show(code, Math.min(1, slideCode * 1.5));
    code.position.set(lerp(-3.4, -2.05, slideCode), .55, -.4 - explode * .25);
    code.rotation.set(0, .38, -.03);
    // The pointer travels to the button, presses it, and a ripple spreads.
    const travel = step(build, .78, .88);
    const press = step(build, .88, .9) * (1 - step(build, .9, .93));
    show(cursor, travel);
    cursor.position.set(lerp(1.6, -.98, travel), lerp(-1.1, -.07, travel), .55 + explode * .3 - press * .06);
    button.position.z -= press * .04;
    const wave = linear(build, .88, .99);
    ring.visible = wave > 0 && wave < 1;
    ring.position.set(-1.07, -.04, .3 + explode * .3);
    ring.scale.setScalar(.4 + wave * 1.8);
    ripple.opacity = (1 - wave) * .9;
  }
  update(0, 0);
  return { group, update };
}

// =====================================================================
// Gov — a deep, faceted white star over a stepped podium
// =====================================================================
function starPrism(k, outer, inner, half, apex) {
  const ring = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * TAU / 10;
    const r = i % 2 ? inner : outer;
    ring.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const positions = [];
  const push = (...points) => points.forEach(p => positions.push(...p));
  const F = [0, 0, half + apex], Bk = [0, 0, -half - apex];
  for (let i = 0; i < 10; i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % 10];
    const af = [ax, ay, half], bf = [bx, by, half], ab = [ax, ay, -half], bb = [bx, by, -half];
    push(F, af, bf);
    push(Bk, bb, ab);
    push(af, ab, bb);
    push(af, bb, bf);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return { geometry: k.geometry(geometry), ring };
}

function rayTexture(k) {
  return k.canvasTexture(64, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(120,170,255,0)');
    g.addColorStop(.5, 'rgba(150,195,255,.85)');
    g.addColorStop(1, 'rgba(120,170,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    const side = c.createLinearGradient(0, 0, w, 0);
    side.addColorStop(0, 'rgba(0,0,0,1)');
    side.addColorStop(.5, 'rgba(0,0,0,0)');
    side.addColorStop(1, 'rgba(0,0,0,1)');
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = side;
    c.fillRect(0, 0, w, h);
  });
}

function starObject(resources) {
  const k = kit(resources);
  const glow = glowMaterials(k);
  const group = new THREE.Group();
  const root = new THREE.Group();
  group.add(root);

  // White pearl body; its look comes from the moving lights around it.
  const pearl = k.material(new THREE.MeshPhysicalMaterial({
    color: 0xd9e2f4, metalness: .08, roughness: .2, clearcoat: 1, clearcoatRoughness: .03,
    iridescence: .3, iridescenceIOR: 1.3, sheen: .35, sheenColor: new THREE.Color(0xa8c6ff),
    envMapIntensity: .7, emissive: 0x24345c, emissiveIntensity: .04,
  }));
  // A smaller crystal star inside a thin glass shell gives the body inner depth.
  const shell = k.material(new THREE.MeshPhysicalMaterial({
    color: 0xdfe9ff, metalness: 0, roughness: .04, transmission: .92, thickness: .9, ior: 1.6,
    clearcoat: 1, envMapIntensity: 1.4, transparent: true, opacity: .55, depthWrite: false,
  }));
  const coreMaterial = k.material(new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fa6f0).multiplyScalar(.85), toneMapped: false }));

  const star = new THREE.Group();
  root.add(star);
  const body = starPrism(k, 1.38, .58, .2, .42);
  k.mesh(star, body.geometry, pearl);
  const outer = starPrism(k, 1.6, .67, .26, .5);
  const shellMesh = k.mesh(star, outer.geometry, shell);
  const core = k.mesh(star, starPrism(k, .42, .18, .06, .14).geometry, coreMaterial);
  core.position.z = .5;

  // Ridges from the front apex to each point; a bright bead runs along each.
  const ridges = body.ring.filter((_, i) => i % 2 === 0).map(([x, y]) => {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, .62), new THREE.Vector3(x * .5, y * .5, .41), new THREE.Vector3(x, y, .2)]);
    const line = k.mesh(star, k.geometry(new THREE.TubeGeometry(curve, 24, .008, 6, false)), glow.blue);
    const bead = k.mesh(star, k.geometry(new THREE.SphereGeometry(.035, 12, 10)), glow.ice);
    return { curve, line, bead };
  });

  // Dynamic lighting: three coloured lights orbit at different speeds and
  // heights, so highlights sweep across the facets instead of sitting still.
  const orbiters = [
    { color: 0xffffff, power: 3.2, radius: 2.4, speed: .55, tilt: .5, phase: 0 },
    { color: 0x4f86ff, power: 4.5, radius: 2.8, speed: -.38, tilt: -.35, phase: 2.1 },
    { color: 0x9a8cff, power: 2.6, radius: 2.2, speed: .27, tilt: .9, phase: 4.2 },
  ].map(options => {
    const light = new THREE.PointLight(options.color, 0, 9, 1.6);
    root.add(light);
    return { light, ...options };
  });
  const inner = new THREE.PointLight(0xbcd6ff, 0, 4, 2);
  inner.position.z = .9;
  star.add(inner);

  // Soft light shafts behind the star breathe and drift.
  const rayMaterial = k.material(new THREE.MeshBasicMaterial({ map: rayTexture(k), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  const rays = new THREE.Group();
  rays.position.z = -.9;
  root.add(rays);
  const rayGeometry = k.geometry(new THREE.PlaneGeometry(.22, 1));
  const rayItems = [];
  for (let i = 0; i < 10; i++) {
    const holder = new THREE.Group();
    holder.rotation.z = Math.PI / 2 + i * TAU / 10;
    rays.add(holder);
    const ray = k.mesh(holder, rayGeometry, rayMaterial);
    ray.position.y = 2.0;
    rayItems.push(ray);
  }

  const spark = k.mesh(root, k.geometry(new THREE.SphereGeometry(.09, 16, 12)), glow.ice);

  function update(build, time) {
    const ignite = step(build, 0, .15);
    const form = step(build, .1, .45);
    const light = step(build, .38, .65);
    const trace = step(build, .55, .78);
    const bloom = step(build, .65, .88);
    const settle = step(build, .86, 1);
    root.rotation.y = -.08;
    // Step 1: a point of light. Step 2: the star grows out of it, turning face-on.
    show(spark, ignite * (1 - form) * 1.4);
    show(star, .05 + .95 * pop(form));
    star.position.y = .15 + Math.sin(time * .6) * .05 * settle;
    star.rotation.y = (1 - form) * 2.2 + Math.sin(time * .3) * .25 * settle;
    star.rotation.x = Math.sin(time * .22) * .05 * settle;
    shellMesh.visible = form > .6;
    shell.opacity = .3 * step(form, .6, 1);
    // Step 3: the orbiting lights come up and the inner core pulses.
    for (const orbiter of orbiters) {
      const a = orbiter.phase + time * orbiter.speed;
      orbiter.light.position.set(Math.cos(a) * orbiter.radius, star.position.y + Math.sin(a * .7) * orbiter.tilt * 1.6, Math.sin(a) * orbiter.radius * .8 + 1.0);
      orbiter.light.intensity = orbiter.power * light * (.75 + .25 * Math.sin(time * 1.3 + orbiter.phase));
    }
    const pulse = .78 + .22 * Math.sin(time * 2.1);
    inner.intensity = .5 * light * pulse;
    show(core, light * (.75 + .1 * pulse));
    pearl.emissiveIntensity = .04 + .03 * light * pulse;
    // Step 4: ridges trace from the apex outward; beads keep running along them.
    ridges.forEach(({ curve, line, bead }, index) => {
      const draw = linear(trace, index * .12, .4 + index * .12);
      line.visible = draw > .02;
      line.scale.setScalar(Math.max(.001, draw));
      bead.visible = draw > .9;
      bead.position.copy(curve.getPointAt(((time * .35 + index / 5) % 1)));
    });
    // Step 5: light shafts bloom behind and keep breathing.
    rays.visible = bloom > .01;
    rays.position.y = star.position.y;
    rays.rotation.z = time * .05;
    rayItems.forEach((ray, index) => { ray.scale.set(1, Math.max(.001, bloom * (2.4 + Math.sin(time * .9 + index * 1.7) * .6)), 1); });
    rayMaterial.opacity = .1 * bloom * (.8 + .2 * Math.sin(time * 1.6));
  }
  update(0, 0);
  return { group, update };
}

export const createObject = {
  edu: bookObject,
  digital: websiteObject,
  gov: starObject,
};
