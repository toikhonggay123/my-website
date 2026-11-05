import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const clamp = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
};
const windowWeight = (value, start, peak, hold, end) => ease((value - start) / (peak - start)) * (1 - ease((value - hold) / (end - hold)));

function roundShape(width, height, radius = 0.12) {
  const x = width / 2;
  const y = height / 2;
  const path = new THREE.Shape();
  path.moveTo(-x + radius, -y);
  path.lineTo(x - radius, -y);
  path.quadraticCurveTo(x, -y, x, -y + radius);
  path.lineTo(x, y - radius);
  path.quadraticCurveTo(x, y, x - radius, y);
  path.lineTo(-x + radius, y);
  path.quadraticCurveTo(-x, y, -x, y - radius);
  path.lineTo(-x, -y + radius);
  path.quadraticCurveTo(-x, -y, -x + radius, -y);
  return path;
}

function createWorkshop() {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const keep = (geometry) => {
    geometries.add(geometry);
    return geometry;
  };
  const box = keep(new THREE.BoxGeometry(1, 1, 1));
  const disk = keep(new THREE.CylinderGeometry(1, 1, 1, 32));

  function metal(color, options = {}) {
    const material = new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.76,
      roughness: 0.31,
      clearcoat: 0.65,
      clearcoatRoughness: 0.22,
      ...options,
    });
    materials.add(material);
    return material;
  }

  function glow(color, intensity = 2) {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false });
    materials.add(material);
    return material;
  }

  function group(parent, x = 0, y = 0, z = 0) {
    const object = new THREE.Group();
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  }

  function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  }

  function block(parent, material, x, y, z, width, height, depth = 0.045) {
    const object = mesh(parent, box, material, x, y, z);
    object.scale.set(width, height, depth);
    return object;
  }

  function extrude(shape, depth, bevel = 0.065) {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 3,
      curveSegments: 7,
      steps: 1,
    });
    geometry.translate(0, 0, -depth / 2);
    return keep(toCreasedNormals(geometry, 0.7));
  }

  function plate(parent, material, x, y, z, width, height, depth = 0.15, radius = 0.12) {
    return mesh(parent, extrude(roundShape(width, height, radius), depth), material, x, y, z);
  }

  function sheet(parent, material, x, y, z, width, height, bend = 0.5, depth = 0.075) {
    const geometry = new RoundedBoxGeometry(width, height, depth, 9, Math.min(depth * 0.45, 0.05));
    const positions = geometry.attributes.position;
    for (let index = 0; index < positions.count; index += 1) {
      const u = positions.getX(index) / width + 0.5;
      const v = positions.getY(index) / height;
      const curvedZ = Math.sin(u * Math.PI * 0.82) * bend + v * u * 0.11;
      positions.setZ(index, positions.getZ(index) + curvedZ);
    }
    geometry.computeVertexNormals();
    return mesh(parent, keep(geometry), material, x, y, z);
  }

  function sweep(parent, material, points, radius = 0.012) {
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    return mesh(parent, keep(new THREE.TubeGeometry(curve, 96, radius, 7, false)), material);
  }

  function point(parent, material, x, y, z, radius = 0.04) {
    const object = mesh(parent, disk, material, x, y, z);
    object.rotation.x = Math.PI / 2;
    object.scale.set(radius, 0.018, radius);
    return object;
  }

  function outline(parent, material, x, y, z, width, height, thickness = 0.025, radius = 0.12) {
    const shape = roundShape(width, height, radius);
    const hole = roundShape(width - thickness * 2, height - thickness * 2, Math.max(0.01, radius - thickness));
    shape.holes.push(hole);
    return mesh(parent, extrude(shape, 0.018, 0.008), material, x, y, z);
  }

  function texture(canvas) {
    const result = new THREE.CanvasTexture(canvas);
    textures.add(result);
    return result;
  }

  return {
    geometries, materials, textures, keep, metal, glow, group, mesh, block, plate, sheet, sweep, point, outline, texture,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const item of textures) item.dispose();
    },
  };
}

function lightTexture(draw) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(128, 128, 1, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(53,122,255,0.8)');
  gradient.addColorStop(0.18, 'rgba(32,92,240,0.38)');
  gradient.addColorStop(0.52, 'rgba(16,65,190,0.12)');
  gradient.addColorStop(1, 'rgba(0,20,90,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return draw.texture(canvas);
}

function createGate(parent, draw, style, x, y, z, yaw) {
  const { group, sheet, sweep } = draw;
  const gate = group(parent, x, y, z);
  gate.rotation.set(-0.075, yaw, -0.10);
  const back = sheet(gate, style.casing, -0.66, 0, -0.17, 1.74, 4.56, 0.51, 0.12);
  back.rotation.y = -0.24;
  const glass = sheet(gate, style.glass, 0.28, 0, 0.04, 2.65, 4.48, 0.55);
  sweep(gate, style.cold, [[-1.53, -2.26, -0.10], [-1.52, -0.70, -0.05], [-1.50, 0.80, -0.02], [-1.49, 2.26, 0.02]], 0.013);
  sweep(gate, style.softEdge, [[-1.48, 2.27, 0.02], [-0.75, 2.27, 0.34], [0.20, 2.27, 0.59], [1.55, 2.27, 0.33]], 0.009);
  const architecture = group(gate, 0, 0, 0.12);
  const fold = sheet(architecture, style.rail, 0.66, -0.04, 0.42, 1.42, 4.35, -0.65, 0.055);
  fold.rotation.y = -0.36;
  const veil = sheet(architecture, style.glass, -0.20, 0.01, 0.55, 1.94, 4.28, 0.18, 0.04);
  veil.rotation.y = 0.15;
  sweep(architecture, style.edge, [[-0.85, -2.11, 0.66], [-0.18, -1.45, 0.85], [0.47, -0.31, 0.99], [0.94, 1.30, 0.74], [1.0, 2.09, 0.42]], 0.008);
  const content = group(gate, 0, 0, 0.86);
  const reflection = gate.clone(true);
  reflection.scale.y = -1;
  reflection.position.y = -5.28 - y;
  parent.add(reflection);
  const light = new THREE.PointLight(style.light, 0, 10, 2);
  light.position.set(-2.8, 0.8, -4.5);
  gate.add(light);
  return {
    gate, content, architecture, back, glass, reflection, light,
    origin: new THREE.Vector3(x, y, z), yaw,
    revealArchitecture: () => {},
    revealContent: () => {},
  };
}

function fillEducation(content, draw, style) {
  const { group, sheet, block } = draw;
  const terraces = [];
  for (let row = 0; row < 3; row += 1) {
    const panel = group(content, -0.13 + row * 0.11, 1.05 - row * 1.04, row * 0.08);
    sheet(panel, style.surface, 0, 0, 0, 2.52, 0.82, 0.14, 0.045);
    block(panel, style.softEdge, -0.29, 0.10, 0.21, 1.24, 0.025, 0.008);
    block(panel, style.faint, -0.48, -0.08, 0.21, 0.87, 0.018, 0.008);
    block(panel, style.cold, 0.91, 0.02, 0.21, 0.12, 0.13, 0.012);
    panel.rotation.z = (row - 1) * 0.038;
    terraces.push(panel);
  }
  return (weight, time) => {
    terraces.forEach((panel, index) => {
      panel.position.z = index * 0.08 + weight * index * 0.31;
      panel.position.x = -0.13 + index * 0.11 + Math.sin(time * 0.24 + index * 0.7) * 0.015 * weight;
      panel.rotation.x = -weight * 0.12;
    });
  };
}

function fillDigital(content, draw, style) {
  const { group, plate, block, point, outline } = draw;
  const pane = group(content, -0.05, 0.53, 0.03);
  plate(pane, style.surface, 0, 0, 0, 2.35, 2.09, 0.10, 0.085);
  outline(pane, style.softEdge, 0, 0, 0.09, 2.35, 2.09, 0.013, 0.085);
  for (let i = 0; i < 3; i += 1) point(pane, i ? style.faint : style.white, -0.94 + i * 0.12, 0.85, 0.10, 0.021);
  block(pane, style.faint, 0.32, 0.85, 0.10, 0.74, 0.026);
  const hero = plate(pane, style.interior, 0, 0.14, 0.10, 2.08, 1.01, 0.035, 0.04);
  block(pane, style.white, -0.45, 0.36, 0.215, 0.83, 0.08);
  block(pane, style.cold, -0.55, 0.18, 0.215, 0.63, 0.035);
  block(pane, style.edge, -0.70, -0.06, 0.215, 0.34, 0.095);
  const sculpture = plate(pane, style.rail, 0.61, 0.13, 0.24, 0.47, 0.47, 0.15, 0.035);
  sculpture.rotation.set(0.16, -0.24, -0.30);
  for (let i = 0; i < 3; i += 1) {
    block(pane, style.interior, -0.68 + i * 0.68, -0.67, 0.10, 0.59, 0.30);
    block(pane, style.softEdge, -0.74 + i * 0.68, -0.63, 0.14, 0.35, 0.027);
  }
  const phone = group(content, 0.69, -0.86, 0.38);
  phone.rotation.z = -0.10;
  plate(phone, style.rail, 0, 0, 0, 0.88, 1.82, 0.15, 0.105);
  plate(phone, style.surface, 0, 0, 0.13, 0.77, 1.66, 0.035, 0.075);
  outline(phone, style.edge, 0, 0, 0.17, 0.78, 1.68, 0.014, 0.085);
  block(phone, style.faint, 0, 0.69, 0.18, 0.18, 0.023);
  plate(phone, style.interior, 0, 0.20, 0.18, 0.64, 0.67, 0.035, 0.04);
  block(phone, style.white, -0.04, 0.35, 0.30, 0.41, 0.052);
  block(phone, style.edge, -0.12, 0.08, 0.30, 0.24, 0.07);
  for (let i = 0; i < 2; i += 1) {
    block(phone, style.interior, 0, -0.31 - i * 0.25, 0.18, 0.64, 0.17);
    block(phone, style.softEdge, -0.09, -0.31 - i * 0.25, 0.22, 0.34, 0.022);
  }
  block(content, style.white, -0.78, 1.98, 0.05, 0.63, 0.046);
  block(content, style.faint, -0.93, 1.81, 0.05, 0.35, 0.025);
  return (weight, time) => {
    pane.rotation.y = -weight * 0.09;
    phone.position.z = 0.38 + weight * 0.62;
    phone.position.y = -0.86 + Math.sin(time * 0.33) * 0.03 * weight;
    sculpture.rotation.y = -0.24 + Math.sin(time * 0.17) * 0.12;
    hero.position.z = 0.10;
  };
}

function fillGovernment(content, draw, style) {
  const { group, sheet, block, point, sweep } = draw;
  const layers = [];
  for (let row = 0; row < 3; row += 1) {
    const layer = group(content, -0.18 + row * 0.12, 0.98 - row * 1.02, row * 0.10);
    sheet(layer, style.surface, 0, 0, 0, 2.64, 0.68, 0.22, 0.055);
    sweep(layer, style.softEdge, [[-1.11, 0, 0.18], [-0.28, 0.01, 0.25], [0.49, 0, 0.28], [1.13, 0, 0.18]], 0.008);
    for (let column = 0; column < 3; column += 1) {
      point(layer, column === row ? style.cold : style.faint, -0.89 + column * 0.89, 0, 0.29, column === row ? 0.037 : 0.021);
    }
    layers.push(layer);
  }
  const spine = block(content, style.edge, -1.46, -0.02, 0.04, 0.010, 2.20, 0.010);
  for (let row = 0; row < 3; row += 1) block(content, style.edge, -1.31, 0.98 - row * 1.02, 0.04, 0.30, 0.010, 0.010);
  return (weight) => {
    layers.forEach((layer, index) => {
      layer.position.z = index * (0.10 + weight * 0.31);
      layer.position.x = index * weight * 0.045;
      layer.rotation.y = weight * 0.04 * (index - 1.5);
    });
    spine.scale.y = 2.20;
  };
}

function fadeGroup(group, draw) {
  const copies = new Map();
  group.traverse((object) => {
    if (!object.isMesh) return;
    const source = object.material;
    if (!copies.has(source)) {
      const material = source.clone();
      draw.materials.add(material);
      copies.set(source, { material, opacity: source.opacity, transparent: source.transparent, depthWrite: source.depthWrite });
    }
    object.material = copies.get(source).material;
  });
  return (opacity) => {
    group.visible = opacity > 0.002;
    for (const copy of copies.values()) {
      copy.material.opacity = copy.opacity * opacity;
      copy.material.transparent = copy.transparent || opacity < 0.998;
      copy.material.depthWrite = copy.depthWrite && opacity > 0.998;
    }
  };
}

function createAtmosphere(scene, draw) {
  const map = lightTexture(draw);
  const pools = [];
  const poolMaterial = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0.68, depthWrite: false, blending: THREE.AdditiveBlending });
  draw.materials.add(poolMaterial);
  const groundGeometry = draw.keep(new THREE.PlaneGeometry(1, 1));
  for (const [x, z, width, depth] of [[-4, -1.4, 12, 12], [2.8, -1.6, 15, 10], [0, -7, 23, 14]]) {
    const pool = draw.mesh(scene, groundGeometry, poolMaterial, x, -2.62, z);
    pool.rotation.x = -Math.PI / 2;
    pool.scale.set(width, depth, 1);
    pools.push(pool);
  }

  const haze = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { strength: { value: 0.33 }, tint: { value: new THREE.Color(0x165bce) } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec2 vUv; uniform float strength; uniform vec3 tint; void main(){float core=pow(max(0.0,1.0-abs(vUv.x-.5)*2.0),2.7); float vertical=pow(1.0-vUv.y,1.4)*smoothstep(0.0,.12,vUv.y); gl_FragColor=vec4(tint,core*vertical*strength);}',
  });
  draw.materials.add(haze);
  for (const [x, z, width, angle] of [[-5, -6, 4.1, -0.25], [3.3, -8, 6.8, 0.31], [0, -11, 10, -0.13]]) {
    const beam = draw.mesh(scene, groundGeometry, haze, x, 1.5, z);
    beam.scale.set(width, 11, 1);
    beam.rotation.z = angle;
  }
  const haloMaterial = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x2865ef });
  draw.materials.add(haloMaterial);
  const halo = draw.mesh(scene, groundGeometry, haloMaterial, 0, 1.0, -9.0);
  halo.scale.set(28, 17, 1);

  const random = (index) => Math.abs(Math.sin(index * 127.1 + 311.7) * 43758.5453) % 1;
  const points = new Float32Array(185 * 3);
  for (let i = 0; i < 185; i += 1) {
    points[i * 3] = (random(i * 3) - 0.5) * 27;
    points[i * 3 + 1] = random(i * 3 + 1) * 11 - 2;
    points[i * 3 + 2] = -random(i * 3 + 2) * 18;
  }
  const particleGeometry = draw.keep(new THREE.BufferGeometry());
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
  const particleMaterial = new THREE.PointsMaterial({ color: 0x5d8dce, size: 0.018, transparent: true, opacity: 0.52, depthWrite: false, sizeAttenuation: true });
  draw.materials.add(particleMaterial);
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);

  const ground = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { tint: { value: new THREE.Color(0x02091c) } },
    vertexShader: 'varying vec3 world; void main(){vec4 p=modelMatrix*vec4(position,1.0);world=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',
    fragmentShader: 'varying vec3 world; uniform vec3 tint; void main(){float alpha=(1.0-smoothstep(8.0,34.0,length(world.xz)))*.48;gl_FragColor=vec4(tint,alpha);}',
  });
  draw.materials.add(ground);
  const floor = draw.mesh(scene, draw.keep(new THREE.PlaneGeometry(90, 90)), ground, 0, -2.66, -4);
  floor.rotation.x = -Math.PI / 2;
  const conduitMaterial = draw.glow(0x2476ff, 0.32);
  for (const offset of [0]) {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-8, -2.63, 6 + offset),
      new THREE.Vector3(-5.3, -2.63, 0.3 + offset),
      new THREE.Vector3(-1.2, -2.63, -3.8 + offset),
      new THREE.Vector3(3.1, -2.63, -3.0 + offset),
      new THREE.Vector3(6.6, -2.63, 3.7 + offset),
    ]);
    const conduit = draw.keep(new THREE.TubeGeometry(path, 100, 0.015, 7, false));
    draw.mesh(scene, conduit, conduitMaterial);
  }
  return { particles, pools };
}

function cameraPose(progress) {
  const poses = [
    { at: 0, position: [0, 3.6, 15.8], target: [0, 3.15, -0.8] },
    { at: 0.18, position: [-0.5, 2.1, 13.4], target: [0, 0.0, -1.1] },
    { at: 0.36, position: [-4.75, 1.6, 9.9], target: [-4.75, 0.1, -0.65] },
    { at: 0.58, position: [0.0, 2.7, 12.0], target: [0.1, 2.55, -0.35] },
    { at: 0.80, position: [5.0, 1.5, 10.2], target: [5.0, 0.15, -0.85] },
    { at: 1, position: [0.7, 4.7, 18.3], target: [0, 0.1, -1.3] },
  ];
  const index = Math.max(0, poses.findIndex((pose) => pose.at >= progress) - 1);
  const from = poses[index];
  const to = poses[index + 1] || from;
  const t = ease((progress - from.at) / Math.max(0.001, to.at - from.at));
  return {
    position: new THREE.Vector3(...from.position).lerp(new THREE.Vector3(...to.position), t),
    target: new THREE.Vector3(...from.target).lerp(new THREE.Vector3(...to.target), t),
  };
}

/** @param {HTMLCanvasElement} canvas */
export function createDepthScene(canvas, { mode = 'journey' } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: false,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x01030a, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x01040d);
  scene.fog = new THREE.FogExp2(0x020a20, 0.031);
  const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 110);
  const draw = createWorkshop();
  const room = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromScene(room, 0.06);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.22;
  room.dispose();
  generator.dispose();

  scene.add(new THREE.HemisphereLight(0x6c94dc, 0x01030b, 0.50));
  const key = new THREE.DirectionalLight(0x8dbbff, 1.5);
  key.position.set(-4, 8, 6);
  const edgeLight = new THREE.DirectionalLight(0x3f70ff, 4.8);
  edgeLight.position.set(6, 3, -5);
  scene.add(key, edgeLight);

  const world = new THREE.Group();
  scene.add(world);
  const style = {
    casing: draw.metal(0x061635, { metalness: 0.74, roughness: 0.34, envMapIntensity: 0.28 }),
    rail: draw.metal(0x0a3071, { metalness: 0.78, roughness: 0.28 }),
    glass: draw.metal(0x082b5a, { metalness: 0.30, roughness: 0.16, transparent: true, opacity: 0.64, clearcoat: 1, envMapIntensity: 0.50 }),
    surface: draw.metal(0x071d45, { metalness: 0.62, roughness: 0.24, transparent: true, opacity: 0.90 }),
    interior: draw.metal(0x092d61, { metalness: 0.35, roughness: 0.28 }),
    recess: draw.metal(0x030817),
    edge: draw.glow(0x2469ee, 1.45),
    softEdge: draw.glow(0x4c91ff, 0.95),
    cold: draw.glow(0x75bcff, 1.35),
    white: draw.glow(0xcceaff, 0.92),
    faint: draw.glow(0x12396d, 0.54),
    light: 0x206cff,
  };
  const edu = createGate(world, draw, style, -3.85, -0.20, -1.8, 0.50);
  const digital = createGate(world, draw, style, 0, -0.05, -0.95, -0.10);
  const gov = createGate(world, draw, style, 3.85, -0.20, -2.15, -0.52);
  const gates = [edu, digital, gov];
  const updateEducation = fillEducation(edu.content, draw, style);
  const updateDigital = fillDigital(digital.content, draw, style);
  const updateGovernment = fillGovernment(gov.content, draw, style);
  for (const gate of gates) {
    gate.revealContent = fadeGroup(gate.content, draw);
    gate.revealArchitecture = fadeGroup(gate.architecture, draw);
  }
  const reflectionMaterials = new Map();
  for (const gate of gates) {
    gate.reflection.traverse((object) => {
      if (object.isLight) object.visible = false;
      if (!object.isMesh) return;
      const source = object.material;
      if (!reflectionMaterials.has(source)) {
        const material = source.clone();
        material.transparent = true;
        material.opacity = 0.18;
        material.depthWrite = false;
        draw.materials.add(material);
        reflectionMaterials.set(source, material);
      }
      object.material = reflectionMaterials.get(source);
    });
  }
  const atmosphere = createAtmosphere(scene, draw);
  const renderTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  // Bloom blends back into the read buffer. Multisampled targets lose their
  // resolved color on NVIDIA/ANGLE here, producing empty or partially drawn frames.
  // Keep HDR/bloom and smooth the final geometry with SMAA instead of MSAA.
  renderTarget.samples = 0;
  const composer = new EffectComposer(renderer, renderTarget);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.46, 0.66, 0.95);
  composer.addPass(bloom);
  const antialias = new SMAAPass();
  composer.addPass(antialias);
  composer.addPass(new OutputPass());

  let lastProgress = 0;
  let lastTime = 0;
  let lastX = 0;
  let lastY = 0;
  let disposed = false;

  function render(progress = 0, time = 0, pointerX = 0, pointerY = 0) {
    if (disposed) return;
    lastProgress = clamp(progress);
    lastTime = time;
    lastX = Math.max(-1, Math.min(1, pointerX));
    lastY = Math.max(-1, Math.min(1, pointerY));
    const p = mode === 'hero' ? lastProgress * 0.14 : lastProgress;
    const eduWeight = windowWeight(p, 0.19, 0.33, 0.39, 0.50);
    const digitalWeight = windowWeight(p, 0.40, 0.55, 0.62, 0.73);
    const govWeight = windowWeight(p, 0.63, 0.77, 0.84, 0.98);
    const weights = [eduWeight, digitalWeight, govWeight];
    const portrait = camera.aspect < 0.90;

    gates.forEach((item, index) => {
      const weight = weights[index];
      const others = Math.max(...weights.filter((_, i) => i !== index));
      item.gate.position.copy(item.origin);
      item.gate.position.x *= 1 - weight * 0.23 + others * 0.16;
      item.gate.position.x *= portrait ? 0.80 : 1;
      item.gate.position.z += weight * 0.38 - others * 0.65;
      item.gate.rotation.y = item.yaw * (1 - weight * 0.78) + lastX * 0.035;
      item.gate.rotation.z = -0.10 + weight * 0.07;
      item.gate.rotation.x = -0.075 + Math.sin(time * 0.14 + index) * 0.009;
      const silhouette = [0.92, 1.12, 1.0][index];
      item.gate.scale.setScalar(silhouette + weight * 0.10 - others * 0.07);
      item.light.intensity = 0;
      const reveal = ease((weight - 0.05) / 0.46);
      item.revealArchitecture(1 - reveal);
      item.revealContent(reveal);
      item.reflection.position.set(item.gate.position.x, -5.28 - item.gate.position.y, item.gate.position.z);
      item.reflection.rotation.copy(item.gate.rotation);
      item.reflection.scale.set(item.gate.scale.x, -item.gate.scale.y, item.gate.scale.z);
    });
    updateEducation(eduWeight, time);
    updateDigital(digitalWeight, time);
    updateGovernment(govWeight);

    const pose = cameraPose(p);
    if (mode === 'detail' && Math.max(...weights) > 0.1) {
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      const focus = gates.reduce((sum, gate, index) => sum + gate.gate.position.x * weights[index], 0) / total;
      pose.position.set(focus + 0.2, 1.8, 13.5);
      pose.target.set(focus, 0.1, -0.7);
    }
    const widen = Math.max(1, 1.42 / camera.aspect);
    if (portrait) {
      const chapterFocus = eduWeight * edu.gate.position.x + govWeight * gov.gate.position.x;
      const chapterWeight = Math.max(...weights);
      pose.position.x = THREE.MathUtils.lerp(pose.position.x, chapterFocus, chapterWeight);
      pose.target.x = THREE.MathUtils.lerp(pose.target.x, chapterFocus, chapterWeight);
    }
    camera.position.copy(pose.position);
    camera.position.z += (widen - 1) * (p < 0.16 || p > 0.93 ? 8.9 : 4.5);
    camera.position.x += lastX * 0.24;
    camera.position.y += lastY * 0.14 + (portrait ? 0.25 : 0);
    pose.target.x += lastX * 0.11;
    pose.target.y += lastY * 0.06 + (portrait ? (p < 0.16 ? 1.25 : 1.7) : 0);
    camera.lookAt(pose.target);
    atmosphere.particles.rotation.y = Math.sin(time * 0.02) * 0.025;
    bloom.strength = 0.46 + Math.max(...weights) * 0.08;
    composer.render();
  }

  function resize() {
    if (disposed) return;
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.7, Math.sqrt(2_300_000 / (width * height)));
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(dpr);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render(lastProgress, lastTime, lastX, lastY);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    draw.dispose();
    environment.dispose();
    bloom.dispose();
    antialias.dispose();
    composer.dispose();
    renderer.dispose();
  }

  resize();
  return { render, resize, dispose };
}
