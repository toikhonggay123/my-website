import * as THREE from 'three';

const TAU = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const clamp = (value) => THREE.MathUtils.clamp(value, 0, 1);

function curveThrough(points) {
  return new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), false, 'centripetal');
}

// A closed optical ribbon. The cross section is a soft superellipse, rather
// than a bent low-poly box: the broad face, bevel and thickness share one
// continuously sampled surface and one smoothly averaged indexed normal field.
function ribbonFrame(curve, profile, t) {
  const point = curve.getPointAt(t);
  const tangent = curve.getTangentAt(t).normalize();
  const reference = Math.abs(tangent.dot(Z_AXIS)) > .93 ? Y_AXIS : Z_AXIS;
  const widthAxis = new THREE.Vector3().crossVectors(reference, tangent).normalize();
  widthAxis.applyAxisAngle(tangent, profile.twist(t));
  const thicknessAxis = new THREE.Vector3().crossVectors(tangent, widthAxis).normalize();
  const edge = Math.min(t / .055, (1 - t) / .055, 1);
  const cap = Math.sin(Math.max(0, edge) * Math.PI / 2);
  return { point, widthAxis, thicknessAxis, width: profile.width(t) * cap, thickness: profile.thickness(t) * cap };
}

function ribbonGeometry(curve, profile, geometries) {
  const lengthSegments = 224;
  const ringSegments = 64;
  const positions = [];
  const indices = [];
  const start = curve.getPointAt(0);
  positions.push(start.x, start.y, start.z);
  for (let row = 1; row < lengthSegments; row++) {
    const frame = ribbonFrame(curve, profile, row / lengthSegments);
    for (let column = 0; column < ringSegments; column++) {
      const angle = column / ringSegments * TAU;
      const c = Math.cos(angle), s = Math.sin(angle);
      const wide = Math.sign(c) * Math.abs(c) ** .32 * frame.width;
      const thick = Math.sign(s) * Math.abs(s) ** .32 * frame.thickness;
      const point = frame.point.clone().addScaledVector(frame.widthAxis, wide).addScaledVector(frame.thicknessAxis, thick);
      positions.push(point.x, point.y, point.z);
    }
  }
  const finalIndex = positions.length / 3;
  const end = curve.getPointAt(1);
  positions.push(end.x, end.y, end.z);
  for (let column = 0; column < ringSegments; column++) {
    const next = (column + 1) % ringSegments;
    indices.push(0, 1 + next, 1 + column);
    for (let row = 0; row < lengthSegments - 2; row++) {
      const a = 1 + row * ringSegments + column;
      const b = 1 + row * ringSegments + next;
      const c = a + ringSegments;
      const d = b + ringSegments;
      indices.push(a, b, c, b, d, c);
    }
    const last = 1 + (lengthSegments - 2) * ringSegments;
    indices.push(last + column, last + next, finalIndex);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometries.add(geometry);
  return geometry;
}

function makePalette(materials) {
  const keep = material => { materials.add(material); return material; };
  const glass = (color, transmission, roughness) => keep(new THREE.MeshPhysicalMaterial({
    color, metalness: .065, roughness, transmission, thickness: .45,
    ior: 1.48, attenuationColor: 0x061b3c, attenuationDistance: 1.9,
    clearcoat: 1, clearcoatRoughness: .10, envMapIntensity: 1.0,
    side: THREE.FrontSide,
  }));
  const sapphire = glass(0x061a35, .34, .14);
  const ink = glass(0x030b17, .26, .17);
  const blue = glass(0x0c2850, .40, .125);
  const titanium = keep(new THREE.MeshPhysicalMaterial({
    color: 0x030a14, metalness: .92, roughness: .23,
    clearcoat: 1, clearcoatRoughness: .15, envMapIntensity: 1.0,
  }));
  const edge = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0x74bcff).multiplyScalar(1.35), toneMapped: false }));
  const blueEdge = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0x276bff).multiplyScalar(1.8), toneMapped: false }));
  return { sapphire, ink, blue, titanium, edge, blueEdge };
}

function ribbon(parent, curve, profile, material, geometries) {
  const mesh = new THREE.Mesh(ribbonGeometry(curve, profile, geometries), material);
  parent.add(mesh);
  return mesh;
}

// Only a selected section of the polished bevel carries light. The sculpture
// remains a solid silhouette instead of becoming a complete wire outline.
function bevelLight(parent, curve, profile, material, geometries, { from = .2, to = .82, side = -1, radius = .009 } = {}) {
  const points = [];
  for (let i = 0; i <= 104; i++) {
    const t = THREE.MathUtils.lerp(from, to, i / 104);
    const frame = ribbonFrame(curve, profile, t);
    points.push(frame.point.addScaledVector(frame.widthAxis, frame.width * side * .99).addScaledVector(frame.thicknessAxis, frame.thickness * .55));
  }
  const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 160, radius, 8, false);
  geometries.add(geometry);
  const light = new THREE.Mesh(geometry, material);
  parent.add(light);
  return light;
}

function education(parent, palette, geometries) {
  const leaves = [];
  for (let index = 0; index < 3; index++) {
    const direction = index - 1;
    const leaf = new THREE.Group();
    leaf.position.set(direction * .04, -1.85, index === 1 ? .20 : -.23);
    parent.add(leaf);
    const curve = curveThrough([
      [0, 0, 0], [direction * .29, .65, .09],
      [direction * .73, 1.60, .31], [direction * 1.10, 2.52, .21],
      [direction * 1.21, index === 1 ? 3.85 : 3.24, -.18],
    ]);
    const profile = {
      width: t => index === 1 ? .39 + .075 * Math.sin(Math.PI * t) : .30 + .10 * Math.sin(Math.PI * t),
      thickness: t => .068 + .012 * Math.sin(Math.PI * t),
      twist: t => direction * (.25 + t * .20) + (index === 1 ? -.08 : 0),
    };
    ribbon(leaf, curve, profile, [palette.ink, palette.blue, palette.sapphire][index], geometries);
    bevelLight(leaf, curve, profile, index === 1 ? palette.edge : palette.blueEdge, geometries, {
      from: .30, to: .93, side: direction === 1 ? 1 : -1, radius: index === 1 ? .009 : .007,
    });
    leaves.push({ leaf, direction, index });
  }
  return (weight, time) => {
    for (const { leaf, direction, index } of leaves) {
      leaf.position.x = direction * (.04 + weight * .08);
      leaf.rotation.y = direction * (.14 + weight * .18) + Math.sin(time * .19 + index * .8) * .018;
      leaf.rotation.z = -direction * (.018 + weight * .105);
      leaf.rotation.x = -.035 + Math.sin(time * .16 + index) * .012;
    }
  };
}

function digital(parent, palette, geometries) {
  const fold = new THREE.Group();
  parent.add(fold);
  const curve = curveThrough([
    [-1.04, -1.53, .38], [-.98, -.58, .42], [-.66, .68, .27],
    [-.12, 1.54, -.04], [.64, 1.37, -.46], [.94, .37, -.44],
    [.65, -.78, -.11], [-.02, -1.36, .48], [-.57, -.81, .83],
  ]);
  const profile = {
    width: t => .38 + .055 * Math.sin(t * Math.PI),
    thickness: t => .078 + .012 * Math.sin(t * Math.PI),
    twist: t => -.30 + Math.sin(t * Math.PI * 1.2) * .88 - t * .58,
  };
  ribbon(fold, curve, profile, palette.sapphire, geometries);
  const backing = {
    width: t => profile.width(t) * .93,
    thickness: () => .043,
    twist: profile.twist,
  };
  const spine = ribbon(fold, curve, backing, palette.titanium, geometries);
  spine.position.z = -.13;
  bevelLight(fold, curve, profile, palette.edge, geometries, { from: .14, to: .64, side: -1, radius: .01 });
  bevelLight(fold, curve, profile, palette.blueEdge, geometries, { from: .67, to: .96, side: 1, radius: .008 });
  return (weight, time) => {
    fold.rotation.y = -.12 - weight * .10 + Math.sin(time * .17) * .035;
    fold.rotation.z = -.08 + Math.sin(time * .14) * .018;
    fold.position.y = Math.sin(time * .22) * .035;
  };
}

function government(parent, palette, geometries) {
  const vaults = [];
  for (let index = 0; index < 3; index++) {
    const direction = index - 1;
    const vault = new THREE.Group();
    vault.position.z = index === 1 ? .24 : direction * .26 - .12;
    parent.add(vault);
    const height = index === 1 ? 1.58 : 1.33;
    const curve = curveThrough([
      [-1.02, -1.66, .02], [-1.06, -.63, -.08], [-.94, .73, -.10],
      [-.58, height - .12, -.07], [0, height, -.04], [.58, height - .12, .04],
      [.94, .73, .11], [1.06, -.63, .14], [1.02, -1.66, .04],
    ]);
    const profile = {
      width: t => (index === 1 ? .29 : .255) + .02 * Math.sin(t * Math.PI),
      thickness: () => .085,
      twist: t => direction * .08 + Math.sin(t * Math.PI * 2) * .12,
    };
    ribbon(vault, curve, profile, [palette.ink, palette.blue, palette.sapphire][index], geometries);
    bevelLight(vault, curve, profile, index === 1 ? palette.edge : palette.blueEdge, geometries, {
      from: .24 + index * .035, to: .69 + index * .03, side: index === 2 ? 1 : -1, radius: index === 1 ? .01 : .007,
    });
    vaults.push({ vault, direction, index });
  }
  return (weight, time) => {
    for (const { vault, direction, index } of vaults) {
      vault.rotation.y = direction * (.28 + weight * .045) + Math.sin(time * .14 + index * .6) * .014;
      vault.position.x = direction * (.20 + weight * .065);
      vault.rotation.z = direction * (.028 + Math.sin(time * .17) * .008);
    }
  };
}

/**
 * Three authored brand sculptures in local model space. The caller controls
 * world position, chapter framing and reduced motion; updates are absolute so
 * scroll reversal and repeated renders never accumulate transform drift.
 * @param {'edu'|'digital'|'gov'} kind
 * @param {{materials:Set<THREE.Material>,geometries:Set<THREE.BufferGeometry>}} resources
 */
export function createSculpture(kind, { materials, geometries }) {
  const group = new THREE.Group();
  const content = new THREE.Group();
  group.name = 'AFYLLX ' + kind + ' sculpture';
  group.add(content);
  const palette = makePalette(materials);
  const build = { edu: education, digital, gov: government }[kind];
  if (!build) throw new Error('Unknown AFYLLX sculpture: ' + kind);
  const animate = build(content, palette, geometries);
  // Normalize the union of the authored motion, not only the resting pose.
  // This keeps the opening leaves inside the same framing as the other forms.
  const bounds = new THREE.Box3();
  for (const weight of [0, .5, 1]) {
    for (const time of [0, 6, 12]) {
      animate(weight, time);
      content.updateMatrixWorld(true);
      bounds.union(new THREE.Box3().setFromObject(content));
    }
  }
  animate(0, 0);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = Math.min(4.02 / size.y, 2.20 / size.z);
  // Keep the tall sculptural proportion when the leaves open. Fitting every
  // axis to their widest gesture would turn the open book into a squat object.
  content.scale.set(Math.min(scale, 2.82 / size.x), scale, scale);
  content.position.copy(center).multiply(content.scale).negate();
  return { group, update: (weight = 0, time = 0) => animate(clamp(weight), time) };
}
